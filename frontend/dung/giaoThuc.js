'use strict';
/**
 * Protocol `bee-media://` — phát media của trình dựng trong giao diện (KE-HOACH.md §3.3).
 *
 *   bee-media://deck/<tên deck>/dung/media/abc-broll.mp4
 *   bee-media://deck/<tên deck>/dung/cache/anh/m123.jpg
 *   bee-media://deck/<tên deck>/output/<deck>.mp4
 *
 * ── Vì sao không dùng `file://` ──────────────────────────────────────────
 *  · Tua video vài GB cần trả đúng ĐOẠN byte được hỏi (`Range` → 206). Có xử lý
 *    rõ ràng ở đây thì không phụ thuộc vào việc `file://` của từng bản Electron
 *    có làm đúng hay không.
 *  · Cửa hẹp: CHỈ tệp dưới `dung/` hoặc `output/` của một deck NẰM TRONG thư mục
 *    nguồn đang mở. Tên deck không được chứa dấu phân cách; đường tương đối qua
 *    `kho.duongTrongDeck` (chặn `..`, tuyệt đối, ổ đĩa, ADS). Một trang lạ có gọi
 *    tới cũng không đọc được tệp nào khác trên máy.
 *
 * `dangKyScheme()` PHẢI chạy trước `app.ready` (luật của Electron);
 * `xuLy(ctx)` chạy sau.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const kho = require('./kho');
const moHinh = require('./moHinh');

const SCHEME = 'bee-media';
const KIEU = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.wma': 'audio/x-ms-wma',
  '.json': 'application/json',
};

/**
 * Tách URL → `{ ten, rel }`. `null` khi sai dạng.
 * (Thuần — bộ thử gọi thẳng.)
 */
function giaiUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== `${SCHEME}:` || u.hostname !== 'deck') return null;
  return giaiPhan(u);
}

/** `bee-media://thu-vien/<rel>` (thư viện dùng chung, thuVienChung.js) → rel; null khi sai. */
function giaiUrlThuVien(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== `${SCHEME}:` || u.hostname !== 'thu-vien') return null;
  const phan = u.pathname.split('/').filter((x) => x !== '');
  if (phan.length < 2) return null;
  try { return phan.map(decodeURIComponent).join('/'); } catch { return null; }
}

function giaiPhan(u) {
  const phan = u.pathname.split('/').filter((x) => x !== '');
  if (phan.length < 3) return null;
  let ten;
  let rel;
  try {
    ten = decodeURIComponent(phan[0]);
    rel = phan.slice(1).map(decodeURIComponent).join('/');
  } catch { return null; }
  // Bộ slide phụ `cha::id` (GĐ3.7) — deckTrongNguon kiểm từng phần.
  if (!ten || (/[\\/:\0]/.test(ten) && !require('./boSlide').tachTen(ten)) || ten === '.' || ten === '..') return null;
  return { ten, rel };
}

/** URL cho một tệp trong deck — giao diện dùng đúng hàm này (qua preload) để khỏi tự ghép. */
const taoUrl = (tenDeck, rel) => moHinh.urlMedia(tenDeck, rel);

/**
 * Header `Range` → `{ dau, cuoi }` (bao gồm cả hai đầu), `null` = không có Range
 * (trả cả tệp), `false` = Range sai/ngoài tệp (416). Chỉ nhận MỘT đoạn.
 */
function phanTichRange(h, co) {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(h).trim());
  if (!m || (m[1] === '' && m[2] === '')) return false;
  let dau;
  let cuoi;
  if (m[1] === '') {                    // bytes=-500 : 500 byte cuối
    const n = Number(m[2]);
    if (!n) return false;
    dau = Math.max(0, co - n);
    cuoi = co - 1;
  } else {
    dau = Number(m[1]);
    cuoi = m[2] === '' ? co - 1 : Math.min(Number(m[2]), co - 1);
  }
  if (!Number.isSafeInteger(dau) || !Number.isSafeInteger(cuoi) || dau > cuoi || dau >= co) return false;
  return { dau, cuoi };
}

/** Tên deck → thư mục, CHỈ khi deck nằm ngay trong thư mục nguồn đang mở — hoặc là BỘ SLIDE PHỤ `cha::id`
 *  (GĐ3.7, src/dung/boSlide.js) của một deck như vậy: `<nguồn>/<cha>/bo-slide/<id>`. */
function deckTrongNguon(ctx, ten) {
  const bo = require('./boSlide').tachTen(ten);
  if (bo) {
    const cha = deckTrongNguon(ctx, bo.cha);
    const dirB = cha && require('./boSlide').dirCon(cha, bo.id);
    return dirB && fs.existsSync(path.join(dirB, 'index.html')) ? dirB : null;
  }
  if (!ten || /[\\/:\0]/.test(ten)) return null;
  const root = (ctx.loadSettings() || {}).sourceRoot;
  if (!root) return null;
  const dir = path.join(path.resolve(root), ten);
  if (path.dirname(dir) !== path.resolve(root)) return null;
  return fs.existsSync(path.join(dir, 'index.html')) ? dir : null;
}

function dangKyScheme() {
  const { protocol } = require('electron');
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    /* KHÔNG `corsEnabled` / ACAO: mọi trang trong app đều là `file://` (cả JS của deck
       người dùng), mở CORS "*" là trang nào cũng đọc được dung/ + output/ của mọi deck
       (audit 10/10/2026). Phát `<video>/<img>/<audio>` không cần CORS. Giai đoạn 3
       (WebAudio / canvas WebCodecs) cần thì mở có chọn lọc theo origin của chính app. */
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
  /* `bee-deck://` — khung xem trước deck ở ORIGIN RIÊNG (src/main/khungDeck.js). Gộp vào ĐÚNG
     MỘT lời gọi: gọi `registerSchemesAsPrivileged` lần hai là đè mất lần đầu. */
  require('../main/khungDeck').PRIV]);
}

function xuLy(ctx) {
  const { protocol } = require('electron');
  protocol.handle(SCHEME, async (req) => {
    const loi = (ma, chu) => new Response(chu, { status: ma, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (req.method !== 'GET' && req.method !== 'HEAD') return loi(405, 'Chỉ GET');
    let f;
    const relTv = giaiUrlThuVien(req.url);
    if (relTv) {
      // Thư viện dùng chung: CHỈ media/ và anh/ trong thư mục thư viện (kiểm cả realpath).
      f = require('./thuVienChung').trongThuVien(relTv);
      if (!f) return loi(403, 'Ngoài vùng cho phép');
    } else {
      const g = giaiUrl(req.url);
      if (!g) return loi(400, 'URL sai');
      const dir = deckTrongNguon(ctx, g.ten);
      if (!dir) return loi(404, 'Không có deck');
      f = kho.duongTrongDeck(dir, g.rel, [kho.THU_MUC, 'output']);
      if (!f) return loi(403, 'Ngoài vùng cho phép');
      // Junction / liên kết trong dung/ trỏ ra ngoài: chuỗi đường hợp lệ nhưng đích thì không.
      try { if (!kho.nhanThatTrongDeck(dir, f)) return loi(403, 'Ngoài vùng cho phép'); } catch { return loi(404, 'Không có tệp'); }
    }
    let st;
    try { st = fs.statSync(f); } catch { return loi(404, 'Không có tệp'); }
    if (!st.isFile()) return loi(404, 'Không có tệp');
    const kieu = KIEU[path.extname(f).toLowerCase()] || 'application/octet-stream';
    const r = phanTichRange(req.headers.get('range'), st.size);
    if (r === false) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
    }
    const dau = r ? r.dau : 0;
    const cuoi = r ? r.cuoi : st.size - 1;
    const headers = {
      'content-type': kieu,
      'accept-ranges': 'bytes',
      'content-length': String(st.size ? cuoi - dau + 1 : 0),
      'cache-control': 'no-cache',
    };
    if (r) headers['content-range'] = `bytes ${dau}-${cuoi}/${st.size}`;
    const than = req.method === 'HEAD' || !st.size ? null
      : Readable.toWeb(fs.createReadStream(f, { start: dau, end: cuoi }));
    return new Response(than, { status: r ? 206 : 200, headers });
  });
}

module.exports = { SCHEME, giaiUrl, giaiUrlThuVien, taoUrl, phanTichRange, deckTrongNguon, dangKyScheme, xuLy };
