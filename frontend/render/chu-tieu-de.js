'use strict';
/**
 * CHỮ TIÊU ĐỀ của trình dựng (Giai đoạn 2) — vẽ chữ ra ảnh PNG trong giao diện.
 *
 * Vì sao vẽ ở đây chứ không dùng drawtext của ffmpeg: ffmpeg đi kèm không có libfreetype/
 * libass, và phông chữ phải giống hệt giữa xem trước với bản xuất. Vẽ một lần bằng canvas
 * (phông của chính app: Inter offline + phông hệ thống) → PNG lưu vào `dung/media/` (IPC
 * `dung:ghiChu`) → xem trước lẫn bản xuất đều chỉ chồng CÙNG một ảnh.
 *
 * Ảnh vẽ cho khung có cạnh dài `moHinh.CHU_KHUNG` (1920) điểm ảnh: `co` = cỡ chữ ở khung đó.
 * `moHinh.coGoc` đặt media chữ ở CỠ TỰ NHIÊN theo tỉ lệ này (không "vừa khung").
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});

  /** Phông chọn được: Inter + font chữ tiêu đề đi kèm app (resources/fonts/tieu-de — đợt 1 hiệu ứng) + phông có sẵn
   *  trên Windows/macOS (thiếu thì trình duyệt thay).
   *  `an`: KHÔNG hiện ở ô chọn nữa nhưng vẫn vẽ được cho chữ cũ — Georgia / Impact trên Windows vẽ SAI dấu chồng tiếng
   *  Việt ("SỐT" thành "SÔ´", đo 23/10/2026); thay bằng Playfair Display / Anton có đủ dấu. */
  const PHONG = [
    { ten: 'Inter', css: 'Inter, "Segoe UI", sans-serif' },
    { ten: 'Be Vietnam Pro', css: '"Be Vietnam Pro", Inter, sans-serif' },
    { ten: 'Montserrat', css: 'Montserrat, Inter, sans-serif' },
    { ten: 'Playfair Display', css: '"Playfair Display", "Times New Roman", serif' },
    { ten: 'Anton', css: 'Anton, Impact, sans-serif' },
    { ten: 'Dancing Script', css: '"Dancing Script", cursive' },
    { ten: 'Segoe UI', css: '"Segoe UI", "Helvetica Neue", sans-serif' },
    { ten: 'Arial', css: 'Arial, Helvetica, sans-serif' },
    { ten: 'Tahoma', css: 'Tahoma, Verdana, sans-serif' },
    { ten: 'Times New Roman', css: '"Times New Roman", Times, serif' },
    { ten: 'Courier New', css: '"Courier New", Courier, monospace' },
    { ten: 'Georgia', css: 'Georgia, "Times New Roman", serif', an: true },
    { ten: 'Impact', css: 'Impact, "Arial Black", sans-serif', an: true },
  ];
  const CHU_MAC_DINH = () => ({
    noiDung: 'Tiêu đề', phong: 'Inter', co: 110, mau: '#ffffff', nen: '', vien: 0, mauVien: '#000000',
    bong: true, dam: true, nghieng: false, canh: 'giua',
  });

  const cssPhong = (ten) => (PHONG.find((p) => p.ten === ten) || PHONG[0]).css;

  /**
   * Vẽ chữ → { png (base64, không tiền tố), rong, cao }.
   * Chờ phông nạp xong (Inter là webfont) — vẽ trước khi nạp là ra phông thay thế.
   */
  async function ve(chu) {
    const c = { ...CHU_MAC_DINH(), ...(chu || {}) };
    const font = `${c.nghieng ? 'italic ' : ''}${c.dam ? '700' : '400'} ${c.co}px ${cssPhong(c.phong)}`;
    try { if (document.fonts && document.fonts.load) await document.fonts.load(font, c.noiDung); } catch { /* dùng phông thay */ }
    const dong = String(c.noiDung).split(/\r?\n/);
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    g.font = font;
    const rongDong = dong.map((d) => g.measureText(d || ' ').width);
    const caoDong = Math.round(c.co * 1.22);
    const dem = Math.ceil(c.vien + (c.bong ? c.co * 0.18 : 0) + (c.nen ? c.co * 0.38 : 0) + 4);
    const rong = Math.min(8192, Math.max(2, Math.ceil(Math.max(...rongDong) + 2 * dem)));
    const cao = Math.min(8192, Math.max(2, Math.ceil(dong.length * caoDong + 2 * dem)));
    cv.width = rong;
    cv.height = cao;
    g.font = font;
    g.textBaseline = 'middle';
    if (c.nen) {
      g.fillStyle = c.nen;
      const r = Math.min(c.co * 0.25, cao / 2);
      g.beginPath();
      if (g.roundRect) g.roundRect(0, 0, rong, cao, r); else g.rect(0, 0, rong, cao);
      g.fill();
    }
    dong.forEach((d, i) => {
      const w = rongDong[i];
      const x = c.canh === 'trai' ? dem : c.canh === 'phai' ? rong - dem - w : (rong - w) / 2;
      const y = dem + caoDong * (i + 0.5);
      g.save();
      if (c.bong) {
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = c.co * 0.12;
        g.shadowOffsetY = c.co * 0.05;
      }
      if (c.vien > 0) {
        g.lineJoin = 'round';
        g.lineWidth = c.vien * 2;
        g.strokeStyle = c.mauVien;
        g.strokeText(d, x, y);
        g.shadowColor = 'transparent';
      }
      g.fillStyle = c.mau;
      g.fillText(d, x, y);
      g.restore();
    });
    const url = cv.toDataURL('image/png');
    return { png: url.slice(url.indexOf(',') + 1), rong, cao };
  }

  RP.chuTieuDe = { PHONG, CHU_MAC_DINH, ve };
})();
