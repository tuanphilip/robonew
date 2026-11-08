};
'use strict';
/**
 * KHUNG DECK Ở ORIGIN RIÊNG — protocol `bee-deck://`.
 *
 * Trước đây khung xem trước deck (`_preview.html`) nạp bằng `file://`, CÙNG ORIGIN với cửa sổ
 * app. Mã của deck (người dùng / AI viết) vì thế với thẳng được `top.beeknoee` (21 nhóm API:
 * xoá dự án, đổi thiết lập, mở liên kết ngoài…), `top.fetch` (đi qua api-shim → IPC) và
 * `top.document` — đo 10/10/2026. Kiểm `senderFrame` ở main KHÔNG chặn được: lời gọi
 * `top.beeknoee.x()` chạy trong ngữ cảnh preload của chính cửa sổ app.
 *
 * Nay mỗi deck một ORIGIN riêng:
 *
 *   bee-deck://d<băm thư mục deck>/_preview.html     ← trang xem trước
 *   bee-deck://d<băm>/assets/anh.png                  ← tệp tương đối của deck
 *   bee-deck://d<băm>/:app/engine/1.0.0/engine.js     ← engine / phông của APP
 *
 * Khác origin ⇒ deck không đọc / gọi được gì của cửa sổ app; app nói chuyện với khung bằng
 * postMessage (`render/editor/khung-cau.js` ở trong khung, `ui-classic/render/deck-cau.js` ở
 * ngoài). Mỗi deck một origin ⇒ deck này cũng không đọc được tệp của deck kia.
 *
 * Cửa hẹp: chỉ tệp nằm THẬT trong thư mục deck (chặn `..`, ổ đĩa, ADS, junction), trừ
 * `dung/` và `output/` (dữ liệu trình dựng / video — trang xem trước không cần). Tiền tố
 * `:app/` (dấu `:` không thể có trong tên thư mục Windows) chỉ mở `engine/` và `fonts/` của
 * thư mục tài nguyên app — cùng origin với deck để phông (`@font-face`, cần CORS khi khác
 * origin) nạp được.
 *
 * `PRIV` phải được gộp vào lời gọi `registerSchemesAsPrivileged` DUY NHẤT trước `app.ready`
 * (dung/giaoThuc.js); `xuLy()` chạy sau, cho phiên mặc định và phiên `anh-slide`.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const SCHEME = 'bee-deck';
const PRIV = { scheme: SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } };
const TIEN_TO_APP = ':app';
const APP_CHO_PHEP = ['engine', 'fonts'];
const DECK_CAM = ['dung', 'output'];

const KIEU = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac',
};

/** host → thư mục deck. Ghi khi dựng `_preview.html` (previewHtml.js). */
const deckTheoHost = new Map();

/** Host cố định cho một thư mục deck — băm đường dẫn (tên deck tiếng Việt không làm host được). */
function hostCua(deckDir) {
  const goc = path.resolve(deckDir);
  return `d${crypto.createHash('sha256').update(process.platform === 'win32' ? goc.toLowerCase() : goc).digest('hex').slice(0, 24)}`;
}

/** Ghi nhận deck, trả gốc URL `bee-deck://<host>/` của nó. */
function dangKyDeck(deckDir) {
  const h = hostCua(deckDir);
  deckTheoHost.set(h, path.resolve(deckDir));
  return `${SCHEME}://${h}/`;
}

/**
 * Tách URL → `{ host, phan: [đoạn đã giải mã] }`; null khi sai dạng. (Thuần — bộ thử gọi thẳng.)
 * Chặn đoạn rỗng / `.` / `..` / có `\` `/` (`%2F` đã giải mã) `:` NUL (trừ `:app` ở đầu).
 */
function giaiUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== `${SCHEME}:` || !/^d[0-9a-f]{24}$/.test(u.hostname)) return null;
  const tho = u.pathname.split('/').slice(1);
  let phan;
  try { phan = tho.map((x) => decodeURIComponent(x)); } catch { return null; }
  if (!phan.length || phan.some((x, i) => !x || x === '.' || x === '..' || /[\\/\0]/.test(x) || (x.includes(':') && !(i === 0 && x === TIEN_TO_APP)))) return null;
  return { host: u.hostname, phan };
}

/** Đường tệp tuyệt đối cho một URL — null nếu ngoài vùng cho phép. */
function tepCho(url, o) {
  const g = giaiUrl(url);
  if (!g) return null;
  const goc = deckTheoHost.get(g.host);
  if (!goc) return null;
  let base;
  let phan = g.phan;
  if (phan[0] === TIEN_TO_APP) {
    phan = phan.slice(1);
    if (!phan.length || !APP_CHO_PHEP.includes(phan[0])) return null;
    base = path.resolve(o.thuMucTaiNguyen());
  } else {
    if (DECK_CAM.includes(phan[0].toLowerCase())) return null;
    base = goc;
  }
  const f = path.resolve(base, ...phan);
  if (!f.startsWith(base + path.sep)) return null;
  // Junction / liên kết trỏ ra ngoài: chuỗi hợp lệ mà đích thì không.
  try {
    const that = fs.realpathSync.native(f);
    const gocThat = fs.realpathSync.native(base);
    if (!that.startsWith(gocThat + path.sep)) return null;
  } catch { return null; }
  return f;
}

function phanTichRange(h, co) {
  return require('../dung/giaoThuc').phanTichRange(h, co);
}

/** Trả tệp (hỗ trợ Range — video trong deck tua được). */
function traTep(req, f) {
  const loi = (ma, chu) => new Response(chu, { status: ma, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  let st;
  try { st = fs.statSync(f); } catch { return loi(404, 'Không có tệp'); }
  if (!st.isFile()) return loi(404, 'Không có tệp');
  const kieu = KIEU[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const r = phanTichRange(req.headers.get('range'), st.size);
  if (r === false) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
  const dau = r ? r.dau : 0;
  const cuoi = r ? r.cuoi : st.size - 1;
  const headers = {
    'content-type': kieu,
    'accept-ranges': 'bytes',
    'content-length': String(st.size ? cuoi - dau + 1 : 0),
    'cache-control': 'no-cache',
  };
  if (r) headers['content-range'] = `bytes ${dau}-${cuoi}/${st.size}`;
  const than = req.method === 'HEAD' || !st.size ? null : Readable.toWeb(fs.createReadStream(f, { start: dau, end: cuoi }));
  return new Response(than, { status: r ? 206 : 200, headers });
}

/**
 * Gắn bộ xử lý. `phien`: các session cần (mặc định + phiên chụp ảnh slide `anh-slide`).
 * @param {{ thuMucTaiNguyen: () => string }} o
 */
function xuLy(o) {
  const { session } = require('electron');
  const xu = async (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Chỉ GET', { status: 405 });
    const f = tepCho(req.url, o);
    if (!f) return new Response('Ngoài vùng cho phép', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return traTep(req, f);
  };
  for (const ses of [session.defaultSession, session.fromPartition('anh-slide')]) {
    try { ses.protocol.handle(SCHEME, xu); } catch (e) { console.warn('[bee-deck] không gắn được protocol:', e && e.message); }
  }
}

module.exports = { SCHEME, PRIV, TIEN_TO_APP, hostCua, dangKyDeck, giaiUrl, tepCho, xuLy, _deckTheoHost: deckTheoHost 