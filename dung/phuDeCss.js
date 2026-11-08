;
'use strict';
/**
 * CSS phụ đề cho LỚP XEM TRƯỚC trên timeline (ui-classic/render/dung-xem.js#vePhuDe) — cùng luật trang
 * quay dùng (recordingHtml: SUBTITLE_CSS + theme + subtitleCssFromSettings), deck lẫn dự án video.
 *
 * Biến phụ đề ĐÃ TÍNH trên trang quay lúc dựng (`output/phu-de/lop.json#bien`, phuDeLop.js) đứng sau cùng
 * — nó là thứ engine thật gắn lên <html> nên thắng :root của preview-settings.json. NHƯNG chỉ khi lớp đó
 * KHÔNG CŨ HƠN preview-settings.json: người dùng đổi kiểu phụ đề sau lượt dựng thì biến của lượt dựng là
 * kiểu cũ — để nó thắng là lớp xem trước đứng yên kiểu cũ dù bảng đã đổi (lỗi L1, rà 16/10/2026).
 */
const fs = require('node:fs');
const path = require('node:path');

function docThietLap(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'preview-settings.json'), 'utf8')) || {}; } catch { return {}; }
}

const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };

/** Dấu của những gì quyết định KIỂU phụ đề: `subtitles` + biến màu chủ đề (theme.variables) — chuỗi so được. */
function dauKieu(dir) {
  const ps = docThietLap(dir);
  return JSON.stringify({ s: ps.subtitles || {}, t: (ps.theme && ps.theme.variables) || {} });
}

/** Khối `:root { --subtitle-*: … }` từ lop.json của lượt dựng — '' khi không có / đã cũ hơn thiết lập. */
function bienLop(dir) {
  const tepLop = path.join(dir, 'output', 'phu-de', 'lop.json');
  const mLop = mtime(tepLop);
  if (!mLop) return '';
  try {
    const lop = JSON.parse(fs.readFileSync(tepLop, 'utf8'));
    /* Lượt dựng mới ghi kèm dấu kiểu lúc dựng ⇒ so dấu (chính xác). Lượt dựng cũ chưa có ⇒ so mtime. */
    if (typeof lop.kieuLucDung === 'string') { if (lop.kieuLucDung !== dauKieu(dir)) return ''; }
    else if (mtime(path.join(dir, 'preview-settings.json')) > mLop) return '';
    const b = lop.bien || {};
    const dong = Object.entries(b).filter(([n, v]) => /^--[A-Za-z0-9_-]{1,60}$/.test(n) && typeof v === 'string'
      && v.length <= 120 && !/[;{}<>]/.test(v)).map(([n, v]) => `  ${n}: ${v};`);
    return dong.length ? `:root {\n${dong.join('\n')}\n}` : '';
  } catch { return ''; }
}

/** @returns {{ css: string, kieu: object }} — `kieu` = `subtitles` của preview-settings.json (cho bảng chỉnh). */
function cssPhuDe(dir) {
  const rh = require('../render/recordingHtml');
  const ps = docThietLap(dir);
  const css = [rh.SUBTITLE_CSS, rh.themeCssFromSettings(ps), rh.subtitleCssFromSettings(ps), bienLop(dir)].filter(Boolean).join('\n');
  return { css, kieu: ps.subtitles && typeof ps.subtitles === 'object' ? ps.subtitles : {} };
}

module.exports = { cssPhuDe, bienLop, docThietLap, dauKieu }