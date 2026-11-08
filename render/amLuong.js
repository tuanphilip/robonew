};
'use strict';
/**
 * CHUẨN ÂM LƯỢNG video ra — -14 LUFS, đỉnh thật ≤ -1,5 dBTP (mức YouTube / TikTok / Facebook
 * đều chuẩn hoá về quanh đó; video nhỏ hơn bị nền tảng KÉO LÊN kèm nén, to hơn thì bị hạ).
 *
 * Trước 10/10/2026 không có bước này: độ lớn video tuỳ nguồn giọng (Edge, ElevenLabs, Beeknoee,
 * giọng trên máy, tệp tải lên) và nhạc deck — hai video liền nhau trên kênh to nhỏ khác hẳn.
 *
 * HAI LƯỢT, sau khi đã ra tệp (dùng chung cho "Tạo video" — render/pipeline.js — và "Xuất bản
 * dựng" — dung/xuat.js):
 *   1. Đo: `loudnorm print_format=json` chỉ đọc phần tiếng (nhanh, không giải mã hình).
 *   2. Lệch quá DUNG_SAI_LU hoặc đỉnh vượt TP_TRAN ⇒ chuẩn hoá TUYẾN TÍNH theo số đo (`linear=true`
 *      + measured_*: giữ nguyên độ động của giọng, không "bơm" như chế độ động một lượt) và mã hoá
 *      lại CHỈ phần tiếng — hình chép nguyên (`-c:v copy`), không nén lại lần hai.
 * Im lặng / quá ngắn (đo ra -inf) ⇒ bỏ qua. Hỏng ở đây ⇒ giữ tệp gốc, chỉ báo: một video to
 * nhỏ lệch chút vẫn hơn một lượt dựng hỏng.
 */
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const MUC = { I: -14, TP: -1.5, LRA: 11 };
const DUNG_SAI_LU = 0.5;
const TP_TRAN = -1.0;

function chay(ff, args, shouldCancel) {
  return new Promise((xong, hong) => {
    const p = spawn(ff, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let loi = '';
    p.stderr.on('data', (b) => { loi = (loi + b).slice(-20000); });
    const canh = setInterval(() => { if (shouldCancel && shouldCancel()) { try { p.kill(); } catch { /* bỏ */ } } }, 300);
    p.on('error', (e) => { clearInterval(canh); hong(e); });
    p.on('close', (ma) => {
      clearInterval(canh);
      if (shouldCancel && shouldCancel()) { hong(Object.assign(new Error('Đã dừng.'), { cancelled: true })); return; }
      xong({ ma, loi });
    });
  });
}

/** Khối JSON cuối mà loudnorm in ra stderr → số đo; null khi không đọc được. (Thuần — bộ thử gọi.) */
function docSoDo(stderr) {
  const m = String(stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!m) return null;
  try {
    const j = JSON.parse(m[m.length - 1]);
    const so = (k) => Number(j[k]);
    return { i: so('input_i'), tp: so('input_tp'), lra: so('input_lra'), thresh: so('input_thresh'), offset: so('target_offset') };
  } catch { return null; }
}

/** Đo độ lớn phần tiếng của một tệp. */
async function doDoLon(ff, tep, o = {}) {
  const r = await chay(ff, ['-hide_banner', '-nostdin', '-nostats', '-i', tep, '-vn', '-sn',
    '-af', `loudnorm=I=${MUC.I}:TP=${MUC.TP}:LRA=${MUC.LRA}:print_format=json`, '-f', 'null', '-'], o.shouldCancel);
  return r.ma === 0 ? docSoDo(r.loi) : null;
}

/** Có cần chuẩn hoá không, theo số đo. (Thuần.) */
function canChuan(sd) {
  if (!sd || !Number.isFinite(sd.i) || sd.i < -70) return false;   // im lặng / không đo được
  return Math.abs(sd.i - MUC.I) > DUNG_SAI_LU || (Number.isFinite(sd.tp) && sd.tp > TP_TRAN);
}

/**
 * Chuẩn âm lượng `tep` TẠI CHỖ (ghi tệp tạm rồi đổi tên). Trả { daChuan, truoc, sau?, loi? }.
 * @param {{ ffmpeg: string, tep: string, tanSo?: number, shouldCancel?: () => boolean }} o
 */
async function chuanAmLuong(o) {
  let truoc;
  try {
    truoc = await doDoLon(o.ffmpeg, o.tep, o);
  } catch (e) {
    // Không chạy được ffmpeg (thiếu tệp, bị chặn…) ⇒ giữ nguyên video, KHÔNG làm hỏng cả lượt dựng.
    if (e && e.cancelled) throw e;
    return { daChuan: false, truoc: null, loi: String((e && e.message) || e) };
  }
  if (!canChuan(truoc)) return { daChuan: false, truoc };
  // Tệp không đuôi thì regex không khớp ⇒ tam === tep ⇒ ffmpeg ghi đè chính đầu vào. Chặn.
  let tam = o.tep.replace(/(\.[^./\\]+)$/, '.am-tam$1');
  if (tam === o.tep) tam = `${o.tep}.am-tam.mp4`;
  const loc = `loudnorm=I=${MUC.I}:TP=${MUC.TP}:LRA=${MUC.LRA}`
    + `:measured_I=${truoc.i}:measured_TP=${truoc.tp}:measured_LRA=${truoc.lra}`
    + `:measured_thresh=${truoc.thresh}:offset=${truoc.offset}:linear=true:print_format=summary`
    // loudnorm làm việc ở 192 kHz — trả về đúng tần số cũ của video.
    + `,aresample=${o.tanSo || 44100}`;
  try {
    const r = await chay(o.ffmpeg, ['-y', '-v', 'error', '-nostdin', '-i', o.tep,
      '-map', '0:v?', '-map', '0:a:0', '-c:v', 'copy', '-af', loc,
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tam], o.shouldCancel);
    if (r.ma !== 0 || !fs.existsSync(tam)) throw new Error(r.loi.trim().split(/\r?\n/).slice(-2).join(' · ') || 'ffmpeg hỏng');
    fs.renameSync(tam, o.tep);
  } catch (e) {
    try { fs.unlinkSync(tam); } catch { /* chưa có */ }
    if (e && e.cancelled) throw e;
    return { daChuan: false, truoc, loi: String((e && e.message) || e) };
  }
  const sau = await doDoLon(o.ffmpeg, o.tep, o).catch(() => null);
  return { daChuan: true, truoc, sau };
}

/** Câu tiến độ ngắn: "-19,8 → -14,0 LUFS". */
function moTa(kq) {
  const s = (x) => (Number.isFinite(x) ? x.toFixed(1).replace('.', ',') : '?');
  if (!kq || !kq.truoc) return `Không đo được âm lượng${kq && kq.loi ? ` (${kq.loi})` : ''} — giữ nguyên`;
  if (!Number.isFinite(kq.truoc.i) || kq.truoc.i < -70) return 'Video không có tiếng — bỏ qua chuẩn âm lượng';
  if (kq.loi) return `Không chuẩn được âm lượng (${kq.loi}) — giữ nguyên ${s(kq.truoc.i)} LUFS`;
  if (!kq.daChuan) return `Âm lượng đã chuẩn (${s(kq.truoc.i)} LUFS)`;
  return `Chuẩn âm lượng ${s(kq.truoc.i)} → ${s(kq.sau && kq.sau.i)} LUFS`;
}

module.exports = { MUC, docSoDo, canChuan, doDoLon, chuanAmLuong, moTa 