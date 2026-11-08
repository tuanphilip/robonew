'use strict';
/**
 * VIDEO CUỐI của một thư mục dự án — tệp người dùng mở xem / mở thư mục / đăng (rà 16/10/2026).
 *
 *   - Dự án video trống (src/dung/duAnVideo.js): bản đã xuất `output/<tên>.mp4` (timVideo là nền đen).
 *   - Deck có chỉnh sửa timeline: "Tạo video" dựng slide `<tên>.mp4` rồi áp chỉnh sửa ra
 *     `<tên>-dung.mp4` (render/queue.js). Video cuối là bản `-dung` — NẾU nó còn hiệu lực:
 *       · timeline hiện vẫn có chỉnh sửa (gỡ hết chỉnh sửa thì `-dung` chỉ là tệp sót lại), và
 *       · nó không cũ hơn video slide (dựng lại slide mà lượt áp chỉnh sửa bị huỷ / hỏng ⇒ slide mới hơn).
 *   - Còn lại: video slide (timVideo).
 *
 * ⚠ KHÔNG thay timVideo: trình dựng, thanh phát, sóng âm, dung:doc đều phải dùng video SLIDE làm nền —
 * chồng chỉnh sửa lên bản `-dung` là áp hai lần. Chỉ chỗ HIỆN video cho người dùng mới hỏi hàm này.
 *
 * @returns {{ path: string, name: string, banDung?: true } | null}
 */
const fs = require('node:fs');
const path = require('node:path');
const { timVideo, tenVideo } = require('../render/tenVideo');

function timBanCuoi(dir) {
  const out = path.join(dir, 'output');
  if (require('./duAnVideo').laDuAnVideo(dir)) {
    const ten = tenVideo(path.basename(dir));
    return fs.existsSync(path.join(out, ten)) ? { path: path.join(out, ten), name: ten } : null;
  }
  const slide = timVideo(dir);
  const xuat = require('./xuat');
  const tenD = xuat.tenRa(dir);
  let stD;
  try { stD = fs.statSync(path.join(out, tenD)); } catch { return slide; }
  if (slide) {
    try { if (fs.statSync(slide.path).mtimeMs > stD.mtimeMs) return slide; } catch { /* slide vừa mất */ }
  }
  if (!xuat.coChinhSuaDeck(dir)) return slide;
  return { path: path.join(out, tenD), name: tenD, banDung: true };
}

module.exports = { timBanCuoi };
