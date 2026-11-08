;
'use strict';
/**
 * RÀO MẠNG + `file://` CHO CÁC CỬA SỔ ẨN CHẠY MÃ DECK (24/10/2026).
 *
 * ── Vì sao phải có ───────────────────────────────────────────────────────
 *
 * Bốn cửa sổ ẩn nạp trang deck bằng `file://`: ảnh thu nhỏ (`main/anhSlide.js`), kiểm bố
 * cục (`main/kiemDeck.js`), quay video (`render/offscreen.js`), vẽ lớp phụ đề
 * (`render/phuDeLop.js`). Mã chạy trong đó là `app.js` / `index.html` của deck — do người
 * dùng hoặc AGENT viết (`studio_write_file`). Trang `file://` của Electron 33 `fetch` / XHR /
 * `<img>` / `<iframe>` được MỌI tệp trên máy — đo 24/10/2026: một trang deck
 * `fetch('file:///C:/Users/.../bimat.txt')` nhận nguyên nội dung — rồi in lên slide, tức lên
 * chính tấm ảnh xem trước mà agent nhận về (`studio_preview_slides`) hay lên video. Cách ly
 * `bee-deck://` (`main/khungDeck.js`) chỉ áp cho khung trong cửa sổ chính, không với tới đây.
 *
 * ── Rào thế nào ──────────────────────────────────────────────────────────
 *
 * `webRequest.onBeforeRequest` trên PHIÊN RIÊNG của từng loại cửa sổ (mỗi loại một
 * `partition` — bẫy 2 ở đầu `anhSlide.js`). Đo cùng ngày: bộ lọc này CÓ bắt `file://`, cả
 * trang chính lẫn xhr / fetch / ảnh, và có kèm `webContentsId`. Tệp `file://` chỉ được nạp
 * khi nằm THẬT trong:
 *   · thư mục deck đang nạp — ảnh, css, video tương đối của deck, `_preview.html` /
 *     `_recording.html` mà app dựng cạnh `index.html`;
 *   · `engine/` và `fonts/` của thư mục tài nguyên app — đúng hai thứ trang dựng trỏ tới
 *     bằng đường TUYỆT ĐỐI (`recordingHtml.js#rewriteFontLinks / rewriteEngineSrc`), cùng
 *     danh sách với `khungDeck.js#APP_CHO_PHEP`. Đã dò 24/10/2026: deck mẫu
 *     (`resources/authoring/template`, `slide`) lẫn 138 deck thật không deck nào trỏ `../`
 *     hay đường tuyệt đối ra ngoài thư mục của nó.
 * "Nằm thật" = so chuỗi TRƯỚC (đường ngoài vùng bị chặn mà không chạm đĩa — `file://may-la/`
 * thành `\\may-la\...`, stat nó là Windows gửi NTLM ra máy lạ) rồi so SAU realpath (junction /
 * symlink trong deck trỏ ra ngoài cũng bị chặn).
 * `bee-deck://` (phiên `anh-slide` có bộ xử lý) chỉ được tới host của CHÍNH deck đó: host là
 * băm của đường dẫn, deck tự tính được host của deck khác rồi vẽ tệp của nó lên ảnh.
 *
 * ⚠ MỖI PHIÊN CHỈ MỘT BỘ LỌC, gọi lại là THAY bộ cũ. Nên lắp MỘT LẦN cho mỗi phiên rồi tra
 * cấu hình theo `webContentsId`: hai lượt chụp ảnh của hai deck chạy song song (cùng phiên
 * `anh-slide`) mà lượt nào cũng tự lắp bộ lọc của mình thì lượt sau xoá rào của lượt trước.
 * Cũng vì thế việc chặn http/https/ws của các cửa sổ này phải đi qua đây — một lời gọi
 * `onBeforeRequest` riêng ở chỗ khác là gỡ sạch rào `file://` của cả phiên.
 */
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const MANG = new Set(['http:', 'https:', 'ws:', 'wss:']);
/** Thư mục con của tài nguyên app mà trang deck được nạp — xem chú thích đầu tệp. */
const THU_MUC_APP = ['engine', 'fonts'];

const daLap = new WeakSet();   // phiên đã lắp bộ lọc
const theoWc = new Map();      // webContentsId -> cấu hình
const theoPhien = new WeakMap(); // phiên -> Set cấu hình (cho yêu cầu không mang webContentsId)

/* Windows không phân biệt hoa thường — `C:\Deck` và `c:\deck` là một. macOS mặc định cũng
   không phân biệt, nhưng đường gốc và URL đều do app dựng từ CÙNG một chuỗi nên so nguyên chữ
   vẫn khớp; hạ chữ ở đó lại mở cửa cho ổ APFS phân biệt hoa thường. */
const so = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

function trongGoc(f, goc) {
  const a = so(f);
  const b = so(goc);
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

function thatCua(p) {
  try { return fs.realpathSync.native(p); } catch { return null; }
}

/**
 * Các gốc được nạp cho một deck: `[{ tho, that }]` — `tho` đã resolve, `that` sau realpath
 * (gốc thiếu thì giữ `tho`, phép so sau realpath của tệp sẽ tự hụt).
 */
function gocCho(deckDir, thuMucTaiNguyen) {
  const ds = [path.resolve(deckDir)];
  if (thuMucTaiNguyen) for (const t of THU_MUC_APP) ds.push(path.resolve(thuMucTaiNguyen, t));
  return ds.map((tho) => ({ tho, that: thatCua(tho) || tho }));
}

/**
 * Xét một URL `file://`: `null` = cho nạp, không thì là LÝ DO chặn.
 * @param {string} url
 * @param {Array<{tho:string, that:string}>} goc
 */
function xetTep(url, goc) {
  let f;
  // `%2F` / `%5C` đã mã hoá thì fileURLToPath ném — coi như sai dạng, chặn.
  try { f = path.resolve(fileURLToPath(url)); } catch { return 'sai-url'; }
  // So chuỗi TRƯỚC khi chạm đĩa — xem chú thích đầu tệp (UNC → NTLM).
  if (!goc.some((g) => trongGoc(f, g.tho))) return 'tep-ngoai-deck';
  const that = thatCua(f);
  // Không realpath được = tệp không có: chặn cũng chỉ ra đúng cái lỗi trang vốn nhận.
  if (!that) return 'tep-khong-co';
  return goc.some((g) => trongGoc(that, g.that)) ? null : 'lien-ket-ra-ngoai';
}

/** URL `file://` có được nạp không. Thuần — bộ thử gọi thẳng. */
const choPhepTep = (url, goc) => !xetTep(url, goc);

/** Quyết định cho MỘT yêu cầu theo một cấu hình. Thuần — bộ thử gọi thẳng. */
function quyetDinh(url, ch) {
  let u;
  try { u = new URL(url); } catch { return { chan: true, loai: 'sai-url' }; }
  if (u.protocol === 'file:') {
    const ly = xetTep(url, ch.goc);
    return ly ? { chan: true, loai: ly } : { chan: false };
  }
  if (MANG.has(u.protocol)) return ch.chanMang ? { chan: true, loai: 'mang' } : { chan: false };
  if (u.protocol === 'bee-deck:') return ch.hostDeck && u.hostname === ch.hostDeck ? { chan: false } : { chan: true, loai: 'deck-khac' };
  return { chan: false };
}

/* Chỉ báo những lượt chặn có NGHĨA: đọc ra ngoài deck / qua liên kết ra ngoài / cửa sổ lạ.
   Tệp không có trong deck (deck cũ trỏ `bee-engine/…` tương đối, ảnh đã xoá) vốn hỏng sẵn —
   báo là ngập nhật ký mỗi lượt chụp. */
const LOAI_CANH_BAO = new Set(['tep-ngoai-deck', 'lien-ket-ra-ngoai', 'khong-ro-cua-so']);

/* Bảng sửa trong `_preview.html` (`render/editor/editor.js`) gọi `fetch('/api/…')`; ở khung của
   cửa sổ chính cầu `bee-deck` trả lời, còn ở cửa sổ ẩn `file://` nó thành `file:///C:/api/…` —
   một lượt hỏng VÔ HẠI có từ trước (đo 24/10/2026, mỗi lượt chụp ảnh một lần). Vẫn chặn, chỉ không báo. */
function laCauApi(url) {
  try { return /^\/(?:[A-Za-z]:\/)?api\//.test(new URL(url).pathname); } catch { return false; }
}

function lapPhien(ses) {
  if (daLap.has(ses)) return;
  daLap.add(ses);
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => {
    const ch = theoWc.get(d.webContentsId);
    let kq;
    if (ch) {
      kq = quyetDinh(d.url, ch);
    } else {
      /* Yêu cầu không mang `webContentsId` (đo 24/10/2026 chưa gặp — để phòng worker…): cho
         qua nếu MỘT cửa sổ đang mở của phiên này cho qua. Không cửa sổ nào ⇒ chặn. */
      const ds = [...(theoPhien.get(ses) || [])];
      kq = ds.length && ds.some((c) => !quyetDinh(d.url, c).chan) ? { chan: false } : { chan: true, loai: 'khong-ro-cua-so' };
    }
    if (kq.chan && ch && ch.khiChan) {
      try { ch.khiChan(d.url, kq.loai); } catch { /* người nghe hỏng không được làm hỏng bộ lọc */ }
    }
    /* KHÔNG im lặng với tệp ngoài deck: deck hợp lệ không bao giờ chạm tới đây (đã dò), nên
       một dòng này là dấu hiệu hoặc deck đang dò tệp máy, hoặc app vừa trỏ thêm một thư mục
       tài nguyên mới mà quên thêm vào THU_MUC_APP — cả hai đều phải thấy được. */
    if (kq.chan && LOAI_CANH_BAO.has(kq.loai) && !laCauApi(d.url) && (!ch || (ch.soCanhBao = (ch.soCanhBao || 0) + 1) <= 5)) {
      console.warn('[rao-cua-so-an] chặn', kq.loai, String(d.url).slice(0, 160));
    }
    cb({ cancel: !!kq.chan });
  });
}

/**
 * Rào một cửa sổ ẩn. Gọi TRƯỚC `loadURL`.
 *
 * @param {Electron.WebContents} wc
 * @param {{ deckDir: string, chanMang?: boolean, khiChan?: (url: string, loai: string) => void }} o
 *   `chanMang` mặc định true (chặn http/https/ws/wss); `khiChan` nghe từng lượt bị chặn.
 */
function rao(wc, o) {
  let taiNguyen = null;
  try { taiNguyen = require('../config').resourcesRoot(); } catch { /* không có thì chỉ mở thư mục deck */ }
  const deckDir = path.resolve(String(o.deckDir));
  const ch = {
    goc: gocCho(deckDir, taiNguyen),
    chanMang: o.chanMang !== false,
    hostDeck: require('./khungDeck').hostCua(deckDir),
    khiChan: typeof o.khiChan === 'function' ? o.khiChan : null,
  };
  const id = wc.id;
  const ses = wc.session;
  theoWc.set(id, ch);
  if (!theoPhien.has(ses)) theoPhien.set(ses, new Set());
  theoPhien.get(ses).add(ch);
  wc.once('destroyed', () => {
    theoWc.delete(id);
    const s = theoPhien.get(ses);
    if (s) s.delete(ch);
  });
  /* `window.open` từ trang ẩn mở ra một cửa sổ THẬT, hiện trên màn hình, cùng phiên nhưng không
     có cấu hình riêng — không trang deck nào cần cửa sổ bật ra khi chụp / đo / quay. Cấm hẳn. */
  try { wc.setWindowOpenHandler(() => ({ action: 'deny' })); } catch { /* bản Electron cũ không có thì thôi */ }
  lapPhien(ses);
}

module.exports = { rao, choPhepTep, quyetDinh, gocCho, THU_MUC_APP 