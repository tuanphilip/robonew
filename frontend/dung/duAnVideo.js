'use strict';
/**
 * DỰ ÁN VIDEO TRỐNG (12/10/2026) — dựng video kiểu Premiere KHÔNG cần slide / giọng đọc:
 * thả ảnh, video, nhạc, chữ lên timeline rồi xuất.
 *
 * GĐ3.4 lộ trình gộp (16/10/2026): BỎ nền đen giả `output/_nen.mp4` + `timing.json` một "slide" + giãn nền
 * (`dung:gianNen`). Đồng hồ timeline đã độc lập (thanh-phat.js, GĐ3.0) và bản xuất tự sinh nền đen (lavfi,
 * xuat.js — GĐ3.2) ⇒ dự án video chỉ còn: `index.html` tối giản (cổng `deckTrongNguon` của danh sách dự án +
 * `<meta name="bee-khung">`), tệp đánh dấu `du-an-video.json` (khổ dọc/ngang), và `dung/du-an.json` KHÔNG có
 * khối slide (`slide: null`). Dự án cũ còn `_nen.mp4` / `timing.json` giả trên đĩa: bỏ qua (Dọn dẹp gỡ được).
 * Bản xuất cắt ĐÚNG tới khối cuối cùng và ghi thẳng `output/<tên>.mp4` — không có đuôi đen.
 */
const fs = require('node:fs');
const path = require('node:path');

const TEP_DANH_DAU = 'du-an-video.json';
const TEN_NEN = '_nen.mp4';   // tên nền đen CŨ (trước GĐ3.4) — chỉ còn để Dọn dẹp nhận ra và gỡ
const FPS = 30;
const KHUNG = { doc: { rong: 1080, cao: 1920, ten: 'Dọc 9:16' }, ngang: { rong: 1920, cao: 1080, ten: 'Ngang 16:9' } };

const laDuAnVideo = (dir) => !!dir && fs.existsSync(path.join(dir, TEP_DANH_DAU));

/** Thông tin đã ghi lúc tạo: { khung: 'doc' | 'ngang' }. Hỏng thì coi như dọc. */
function docDanhDau(dir) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, TEP_DANH_DAU), 'utf8')) || {};
    return { khung: d.khung === 'ngang' ? 'ngang' : 'doc', taoLuc: d.taoLuc || null };
  } catch { return { khung: 'doc', taoLuc: null }; }
}

/** Khổ + fps THẬT của dự án video: { rong, cao, fps }. */
function khungDuAn(dir) {
  const k = KHUNG[docDanhDau(dir).khung];
  return { rong: k.rong, cao: k.cao, fps: FPS };
}

/* Cỡ khung slide chuẩn của deck (render/recordingHtml.js KHUNG_SLIDE) — sân khấu đo `.slide-container`
   qua khung-cau.js để canh tỉ lệ; thiếu nó thì khung xem đứng ở khổ dọc mặc định và ẩn (đo 12/10/2026). */
const KHUNG_SLIDE = { doc: { w: 390, h: 693 }, ngang: { w: 1232, h: 693 } };

/* Kiểu phụ đề MẶC ĐỊNH của dự án video (phụ đề tự động — dung:phuDeTuDong). CSS phụ đề tính theo khung
   slide (390 / 1232 × 693): 15px mặc định trên khung NGANG chỉ còn ~23px ở video 1080p (đo 13/10/2026,
   khó đọc). Ghi vào preview-settings.json lúc tạo — đường xem trước và bản xuất cùng đọc. Viền đen +
   đậm vì nền là video / ảnh bất kỳ, không phải nền tối của deck. */
const PHU_DE_MAC_DINH = {
  doc: { fontSize: 18, bold: true, outlineColor: '#000000' },
  ngang: { fontSize: 28, bold: true, outlineColor: '#000000' },
};
const thietLapMacDinh = (khung) => ({ subtitles: { ...PHU_DE_MAC_DINH[khung === 'ngang' ? 'ngang' : 'doc'] } });

/** `index.html` tối giản: nền đen đúng khổ, KHÔNG engine / `.slide` — dải slide và các tab của deck tự ẩn. */
function htmlTrong(khung) {
  const ks = KHUNG_SLIDE[khung === 'ngang' ? 'ngang' : 'doc'];
  return [
    '<!doctype html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta name="bee-khung" content="${khung === 'ngang' ? 'ngang' : 'doc'}">`,
    '<meta name="bee-du-an" content="video">',
    '<title>Dự án video</title>',
    '<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}'
      + `.slide-container{width:${ks.w}px;height:${ks.h}px;background:#000}</style>`,
    '</head>',
    '<body><div class="slide-container"></div></body>',
    '</html>',
    '',
  ].join('\n');
}

/* ── KIỂU PHỤ ĐỀ (rà 16/10/2026) ─────────────────────────────────────────────
   Dự án video không có engine (khung slide) — bộ chỉnh phụ đề chung (render/kieu-phu-de.js, tab Thuộc
   tính khi bấm C1) ghi thẳng `preview-settings.json` → `subtitles` qua đây, CÙNG khoá deck dùng:
   bản xuất (prepareRecordingHtml → subtitleCssFromSettings) và lớp xem trước đọc y như phụ đề deck.
   Chỉ nhận khoá + giá trị trong bảng dưới — chuỗi này đi thẳng vào một khối <style>. */
const PHONG_PHU_DE = ['', 'Inter, sans-serif', 'Arial, Helvetica, sans-serif', "'Segoe UI', Roboto, sans-serif",
  'Georgia, serif', "'Times New Roman', Times, serif", "'Courier New', monospace"];
const laHex = (x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x);
const trongKhoang = (x, a, b) => Number.isFinite(Number(x)) && Number(x) >= a && Number(x) <= b;

/**
 * Lọc một bản vá kiểu phụ đề. `null` cho một khoá = bỏ khoá đó (viền / màu đang đọc: "tắt" / "theo màu chữ").
 * @returns {{ vao: object, xoa: string[], loi: string[] }}
 */
function locKieuPhuDe(va) {
  const vao = {};
  const xoa = [];
  const loi = [];
  for (const [k, v] of Object.entries(va && typeof va === 'object' ? va : {})) {
    if (v === null && ['outlineColor', 'activeColor', 'fontFamily'].includes(k)) { xoa.push(k); continue; }
    const hop = {
      position: () => v === 'tren' || v === 'duoi',
      bottom: () => trongKhoang(v, 40, 180),
      fontSize: () => trongKhoang(v, 12, 28),
      fontFamily: () => PHONG_PHU_DE.includes(v),
      bold: () => typeof v === 'boolean',
      italic: () => typeof v === 'boolean',
      color: () => laHex(v),
      outlineColor: () => laHex(v),
      activeColor: () => laHex(v),
      bgColor: () => laHex(v),
      bgOpacity: () => trongKhoang(v, 0, 100),
      align: () => ['trai', 'giua', 'phai'].includes(v),
      underline: () => typeof v === 'boolean',
    }[k];
    if (!hop || !hop()) { loi.push(k); continue; }
    if (k === 'fontFamily' && v === '') { xoa.push(k); continue; }
    vao[k] = ['bottom', 'fontSize', 'bgOpacity'].includes(k) ? Math.round(Number(v)) : v;
  }
  return { vao, xoa, loi };
}

/** CSS phụ đề của lớp xem trước — cùng luật trang quay (recordingHtml) dùng khi xuất. */
function cssPhuDe(ps) {
  const rh = require('../render/recordingHtml');
  return [rh.SUBTITLE_CSS, rh.themeCssFromSettings(ps), rh.subtitleCssFromSettings(ps)].filter(Boolean).join('\n');
}

function docThietLap(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'preview-settings.json'), 'utf8')) || {}; } catch { return {}; }
}

/**
 * Ghi bản vá kiểu phụ đề vào `preview-settings.json` (giữ mọi khoá khác; ghi tệp tạm rồi đổi tên).
 * @returns {{ ok: true, kieu: object, css: string } | { ok: false, loi: string[] }}
 */
function ghiKieuPhuDe(dir, va) {
  if (!laDuAnVideo(dir)) return { ok: false, loi: ['Không phải dự án video.'] };
  const { vao, xoa, loi } = locKieuPhuDe(va);
  if (loi.length) return { ok: false, loi: [`Giá trị phụ đề không hợp lệ: ${loi.join(', ')}`] };
  const ps = docThietLap(dir);
  const sub = { ...(ps.subtitles && typeof ps.subtitles === 'object' ? ps.subtitles : {}), ...vao };
  for (const k of xoa) delete sub[k];
  /* subtitleCssFromSettings chỉ lật neo (trên / dưới) khi CÓ `bottom` — dự án mới chưa có khoá đó thì chọn
     "Trên" không ăn. Điền đúng mặc định của CSS (96 px) để hình không nhảy (thử trong app 16/10/2026). */
  if (sub.position && !trongKhoang(sub.bottom, 40, 180)) sub.bottom = 96;
  ps.subtitles = sub;
  const tep = path.join(dir, 'preview-settings.json');
  const tam = `${tep}.tam-${process.pid}`;
  fs.writeFileSync(tam, JSON.stringify(ps, null, 2) + '\n', 'utf8');
  try { fs.renameSync(tam, tep); } catch (e) { try { fs.unlinkSync(tam); } catch { /* bỏ */ } throw e; }
  return { ok: true, kieu: sub, css: cssPhuDe(ps) };
}

module.exports = {
  TEP_DANH_DAU, TEN_NEN, FPS, KHUNG, PHONG_PHU_DE,
  laDuAnVideo, docDanhDau, khungDuAn, htmlTrong, thietLapMacDinh,
  locKieuPhuDe, cssPhuDe, docThietLap, ghiKieuPhuDe,
};
