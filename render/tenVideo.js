;
'use strict';
/**
 * Tên file video đầu ra.
 *
 * Trước đây mọi deck đều đẻ ra `output/final_video.mp4`. Trong app thì không
 * sao — mỗi video nằm trong thư mục mang tên deck. Nhưng người dùng kéo file ra
 * ngoài để đăng: mười deck là mười file cùng tên `final_video.mp4` nằm chung
 * thư mục Downloads, không biết cái nào của cái nào, và Windows tự thêm
 * `(1) (2) (3)` vào sau.
 *
 * Nay đặt theo tên deck: `cloudflare-os.mp4`. Kéo ra là biết ngay của bài nào.
 *
 * ⚠ VẪN PHẢI ĐỌC ĐƯỢC TÊN CŨ. Deck đã render trước bản này vẫn giữ
 * `final_video.mp4`; đổi tên mà quên nhánh cũ thì app báo "chưa render" cho
 * video đang nằm sờ sờ đó. Mọi chỗ ĐỌC dùng `timVideo()`, chỉ chỗ GHI mới dùng
 * `tenVideo()`.
 */
const fs = require('node:fs');
const path = require('node:path');

const TEN_CU = 'final_video.mp4';

/**
 * Tên file cho deck.
 * @param {string} deck tên thư mục deck
 */
function tenVideo(deck) {
  // Bỏ ký tự Windows cấm trong tên file. Tên deck vốn là tên thư mục nên gần
  // như luôn sạch, nhưng deck nhập từ ngoài vào thì chưa chắc.
  const sach = String(deck || '').replace(/[\\/:*?"<>|]/g, '-').trim();
  return (sach || 'video') + '.mp4';
}

/**
 * Tìm video đã render trong thư mục deck.
 * @returns {{path: string, name: string} | null}
 */
function timVideo(projectDir) {
  const outDir = path.join(projectDir, 'output');
  /* DỰ ÁN VIDEO TRỐNG (src/dung/duAnVideo.js): KHÔNG có video slide (GĐ3.4 bỏ nền đen giả `_nen.mp4` — bản
     xuất tự sinh nền đen). Chỗ cần BẢN XUẤT (danh sách dự án, bảng thông tin) tự tìm `<tên>.mp4`. */
  if (fs.existsSync(path.join(projectDir, 'du-an-video.json'))) return null;
  const uuTien = [tenVideo(path.basename(projectDir)), TEN_CU];
  for (const ten of uuTien) {
    const f = path.join(outDir, ten);
    if (fs.existsSync(f)) return { path: f, name: ten };
  }
  return null;
}

module.exports = { tenVideo, timVideo, TEN_CU }