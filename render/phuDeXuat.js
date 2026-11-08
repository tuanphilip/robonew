};
'use strict';
/**
 * Xuất phụ đề `.srt` và danh sách chương — hai thứ YouTube cần mà video dọc
 * không cần.
 *
 * ══ VÌ SAO ═══════════════════════════════════════════════════════════════════
 * Phụ đề của app được ĐỐT THẲNG vào hình (trang tự vẽ, bộ ghi quay lại). Trên
 * TikTok/Reels thì đúng — người xem không có nút bật/tắt nào. Trên YouTube thì
 * mất ba thứ: người xem không tắt được, Google không đọc được chữ để xếp hạng
 * tìm kiếm, và không dịch tự động sang ngôn ngữ khác được.
 *
 * ⚠ HAI TỆP NÀY KHÔNG ĐỤNG GÌ TỚI VIDEO. Chúng ghi cạnh file `.mp4`, ai không
 * cần thì bỏ qua. Vì thế xuất cho CẢ video dọc — không việc gì phải bắt người
 * dùng chọn, và deck dọc đăng lên YouTube Shorts cũng dùng được.
 */

/** Giây → `00:01:23,456` (đúng dạng SubRip). */
function mocSrt(giay) {
  const g = Math.max(0, Number(giay) || 0);
  const ms = Math.round(g * 1000);
  const h = Math.floor(ms / 3600000);
  const p = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const n = ms % 1000;
  const hai = (x) => String(x).padStart(2, '0');
  return `${hai(h)}:${hai(p)}:${hai(s)},${String(n).padStart(3, '0')}`;
}

/**
 * Dựng nội dung `.srt` từ danh sách caption mà Whisper đã căn.
 *
 * ⚠ Bỏ caption rỗng và caption có `end <= start`. `subtitle_timing.py` kẹp sàn
 * 0,35 s cho mỗi mảnh nên bình thường không có, nhưng một tệp `.srt` chứa dòng
 * lộn ngược thì trình phát bỏ qua CẢ TỆP chứ không bỏ mỗi dòng đó.
 */
function dungSrt(captions) {
  const sach = (Array.isArray(captions) ? captions : [])
    .filter((c) => c && String(c.text || '').trim() && Number(c.end) > Number(c.start));
  return sach
    .map((c, i) => `${i + 1}\n${mocSrt(c.start)} --> ${mocSrt(c.end)}\n${String(c.text).trim()}\n`)
    .join('\n');
}

/** Giây → `0:00` hoặc `1:02:03` — đúng dạng YouTube nhận. */
function mocChuong(giay) {
  const t = Math.max(0, Math.floor(Number(giay) || 0));
  const h = Math.floor(t / 3600);
  const p = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const hai = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${hai(p)}:${hai(s)}` : `${p}:${hai(s)}`;
}

/** Lấy một cái tên chương đọc được từ lời thoại của slide. */
function tenChuong(text, toiDa = 62) {
  const cau = String(text || '').trim().split(/(?<=[.!?])\s+/)[0] || '';
  const g = cau.replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '').trim();
  if (g.length <= toiDa) return g;
  // Cắt ở ranh giới từ, đừng cắt giữa chừng một chữ.
  const ngan = g.slice(0, toiDa);
  const cho = ngan.lastIndexOf(' ');
  return `${(cho > toiDa * 0.6 ? ngan.slice(0, cho) : ngan).trim()}…`;
}

/* ⚠ BA LUẬT CỦA YOUTUBE, thiếu một là nó BỎ QUA CẢ DANH SÁCH (không báo lỗi,
   chỉ đơn giản không hiện chương):
     1. Mốc đầu tiên phải là 0:00
     2. Ít nhất 3 chương
     3. Mỗi chương dài ít nhất 10 giây
   Vì thế hàm dưới GỘP slide ngắn lại thay vì cho ra một danh sách bị YouTube
   ném đi. Và nếu gộp xong vẫn chưa đủ 3 chương thì trả về rỗng — thà không có
   tệp còn hơn có một tệp dán vào chẳng thấy gì. */
const CHUONG_TOI_THIEU_GIAY = 10;
const CHUONG_TOI_THIEU_SO = 3;

/**
 * Dựng danh sách chương từ timing của LƯỢT DỰNG.
 *
 * ⚠ Phải là `renderTiming` (đã cộng pre-delay), KHÔNG phải `timing.json` gốc.
 * Hai bộ số đó lệch nhau đúng bằng phần chờ mà trang tự chèn, và chương lệch
 * vài giây là bấm vào nhảy sai chỗ.
 *
 * Trả về chuỗi rỗng khi không đủ điều kiện — nơi gọi tự quyết định không ghi.
 */
function dungChuong(renderTiming) {
  const ds = Array.isArray(renderTiming) ? renderTiming : [];
  if (!ds.length) return '';

  const nhom = [];
  let moc = 0;
  let dang = null;
  for (const it of ds) {
    const dai = Number(it && it.duration) || 0;
    if (!dang) dang = { moc, dai: 0, ten: tenChuong(it && it.text) };
    dang.dai += dai;
    moc += dai;
    if (dang.dai >= CHUONG_TOI_THIEU_GIAY) { nhom.push(dang); dang = null; }
  }
  // Slide lẻ ở cuối chưa đủ 10 s thì nhập vào chương trước, đừng bỏ đi.
  if (dang) {
    if (nhom.length) nhom[nhom.length - 1].dai += dang.dai;
    else nhom.push(dang);
  }

  if (nhom.length < CHUONG_TOI_THIEU_SO) return '';
  nhom[0].moc = 0; // luật 1 — mốc đầu LUÔN là 0:00
  /* ⚠ Tên rỗng thì phải có tên thay. Lời thoại luôn có chữ (bước kiểm mapping
     đòi mỗi dòng ít nhất một câu), nhưng một dòng chỉ gồm dấu câu vẫn lọt qua
     được và `tenChuong()` trả về rỗng. Khi đó dòng chương thành "0:00 " — dán
     vào YouTube là một mốc không tên, trông như lỗi. */
  const dong = nhom.map((c, i) => `${mocChuong(c.moc)} ${c.ten || `Phần ${i + 1}`}`);
  return `${dong.join('\n')}\n`;
}

/** Đếm số mốc trong danh sách chương — để nơi gọi khỏi tự tách chuỗi. */
function demChuong(chuong) {
  // Tách bằng mã ký tự chứ không viết ký tự thoát: tệp này đi qua nhiều
  // tầng công cụ, và dấu xuống dòng viết thẳng đã bị nuốt một lần rồi.
  const XUONG_DONG = String.fromCharCode(10);
  return String(chuong || '').trim().split(XUONG_DONG).filter(Boolean).length;
}

module.exports = {
  dungSrt,
  demChuong,
  dungChuong,
  mocSrt,
  mocChuong,
  tenChuong,
  CHUONG_TOI_THIEU_GIAY,
  CHUONG_TOI_THIEU_SO,
}