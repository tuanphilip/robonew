'use strict';
/**
 * ĐOẠN CÓ GIỌNG của một deck — đầu vào của "hạ nhạc khi có giọng" (ducking, Giai đoạn 2).
 *
 * Đo bằng `silencedetect` trên tệp giọng TÁCH SẴN (`output/voiceover_concat_render.mp3`):
 * giọng = phần bù của các khoảng lặng. MỘT nguồn cho cả xem trước (IPC `dung:hoatDong`)
 * lẫn bản xuất (xuat.js) — hai bên dùng chung đường cong `moHinh.btHaNhac`, nên nghe thử
 * và bản xuất hạ nhạc đúng cùng chỗ.
 *
 * Kết quả nhớ ở `dung/cache/giong.json` theo cỡ + giờ sửa của tệp giọng (dựng lại video
 * là đo lại). Dọn dẹp xoá bộ nhớ đệm thì lần sau đo lại — vài trăm ms cho vài phút giọng.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require('../config');
const kho = require('./kho');

const NGUONG = '-35dB';   // nhỏ hơn mức này coi là lặng
const LANG_TOI_THIEU = 0.3; // giây — ngắt hơi ngắn hơn thì vẫn tính là đang nói

function exe(ten) {
  const dir = config.ffmpegDir();
  if (!dir) return null;
  const f = path.join(dir, process.platform === 'win32' ? `${ten}.exe` : ten);
  return fs.existsSync(f) ? f : null;
}

/** Chạy silencedetect → { ms tổng, lang: [{tuMs, denMs}] }. stderr đọc TRỌN (mỗi khoảng lặng một dòng). */
function doLang(file) {
  const ff = exe('ffmpeg');
  if (!ff) return Promise.resolve(null);
  return new Promise((xong) => {
    const p = spawn(ff, ['-hide_banner', '-nostdin', '-nostats', '-i', file, '-map', '0:a:0',
      '-af', `silencedetect=noise=${NGUONG}:d=${LANG_TOI_THIEU}`, '-f', 'null', '-progress', 'pipe:1', '-'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let loi = '';
    let ra = '';
    p.stderr.on('data', (b) => { loi += b; if (loi.length > 4e6) loi = loi.slice(-4e6); });
    p.stdout.on('data', (b) => { ra = (ra + b).slice(-4000); });
    const hen = setTimeout(() => { try { p.kill(); } catch { /* đã thoát */ } }, 120000);
    p.on('error', () => { clearTimeout(hen); xong(null); });
    p.on('close', (ma) => {
      clearTimeout(hen);
      if (ma !== 0) { xong(null); return; }
      const us = [...ra.matchAll(/out_time_us=(\d+)/g)].pop();
      const ms = us ? Math.round(Number(us[1]) / 1000) : 0;
      const lang = [];
      let tu = null;
      loi.split(/\r?\n/).forEach((d) => {
        const a = /silence_start:\s*(-?[\d.]+)/.exec(d);
        const b = /silence_end:\s*(-?[\d.]+)/.exec(d);
        if (a) tu = Math.max(0, Math.round(Number(a[1]) * 1000));
        if (b && tu != null) { lang.push({ tuMs: tu, denMs: Math.round(Number(b[1]) * 1000) }); tu = null; }
      });
      if (tu != null) lang.push({ tuMs: tu, denMs: ms });   // lặng tới hết tệp
      xong({ ms, lang });
    });
  });
}

/** Phần bù của khoảng lặng trong [0, ms] = các đoạn có giọng. */
function boLang(ms, lang) {
  const ra = [];
  let t = 0;
  lang.slice().sort((a, b) => a.tuMs - b.tuMs).forEach((x) => {
    if (x.tuMs > t) ra.push({ tuMs: t, denMs: x.tuMs });
    t = Math.max(t, x.denMs);
  });
  if (ms > t) ra.push({ tuMs: t, denMs: ms });
  return ra.filter((x) => x.denMs - x.tuMs >= 40);
}

/**
 * Các đoạn có giọng của deck (ms, trục video). Không có tệp giọng tách ⇒ [].
 * @param {string} deckDir
 * @param {string|null} fileGiong  đường tuyệt đối tệp giọng (đã kiểm khớp video — xuat.dauVaoDeck)
 */
async function hoatDong(deckDir, fileGiong) {
  if (!fileGiong || !fs.existsSync(fileGiong)) return [];
  const st = fs.statSync(fileGiong);
  const khoa = `${st.size}-${Math.round(st.mtimeMs)}`;
  const tepNho = path.join(kho.thuMucCache(deckDir).goc, 'giong.json');
  try {
    const j = JSON.parse(fs.readFileSync(tepNho, 'utf8'));
    if (j && j.khoa === khoa && Array.isArray(j.ds)) return j.ds;
  } catch { /* chưa đo */ }
  const r = await doLang(fileGiong);
  if (!r) return [];
  const ds = boLang(r.ms, r.lang);
  try {
    fs.mkdirSync(path.dirname(tepNho), { recursive: true });
    fs.writeFileSync(tepNho, JSON.stringify({ khoa, ds }), 'utf8');
  } catch { /* không ghi được thì lần sau đo lại */ }
  return ds;
}

module.exports = { hoatDong, boLang, doLang };
