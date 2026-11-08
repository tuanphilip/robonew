'use strict';
/**
 * NHẠC CÓ SẴN cho timeline (GĐ2.2 lộ trình gộp slide + timeline, 16/10/2026) — mục "Nhạc" của tab Thư viện.
 *
 * Nhạc nền của deck KHÔNG phải tệp: engine tự TỔNG HỢP bằng WebAudio lúc quay (resources/engine/…/engine.js
 * `bgmPresets` + `playChord` / `playArpNote`). Timeline cần TỆP (ffmpeg trộn, <audio> xem trước) ⇒ ở đây chép lại
 * đúng bộ tổng hợp đó bằng JS thuần (dao động sine/triangle, lọc thông thấp biquad theo công thức WebAudio, bao hình
 * tuyến tính / mũ, tiếng vọng 0,375 s) rồi mã hoá MỘT LẦN bằng ffmpeg đi kèm vào userData — không thêm bước dựng bộ
 * cài, không nhét tệp nhị phân vào repo. Deck vẫn dùng nhạc trong trang như cũ (không đổi tiếng deck khách).
 *
 * LẶP KHÔNG VẾT NỐI: một vòng = 4 hợp âm × 8 s = 32 s. Dựng 3 vòng rồi lấy vòng GIỮA — đuôi nốt của vòng trước đã
 * nằm sẵn trong đầu vòng, nên nối đuôi vào đầu là liền (khối nhạc `lap` của timeline — xuat.js `aloop`).
 * Độ to: đo bằng loudnorm rồi chỉnh TUYẾN TÍNH về -23 LUFS (bằng nhạc mẫu `meta.mp3`), đỉnh ≤ -3 dBFS.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PHIEN_BAN = 'v1';               // đổi công thức tổng hợp ⇒ nâng để tệp cũ trong bộ đệm không bị dùng lại
const SR = 44100;
const VONG_S = 32;
const LUFS = -23;

/* ── bộ nốt — CHÉP NGUYÊN từ engine.js `bgmPresets` (đổi bên đó thì đổi cả đây) ── */
const PRESET = {
  ambient: { chords: [[130.81, 164.81, 196, 246.94], [110, 130.81, 164.81, 196], [87.31, 130.81, 164.81, 207.65], [98, 123.47, 146.83, 174.61]], arps: [[523.25, 659.25, 783.99, 987.77], [440, 523.25, 659.25, 783.99], [349.23, 523.25, 659.25, 830.61], [392, 493.88, 587.33, 698.46]] },
  cinematic: { chords: [[146.83, 174.61, 220, 277.18], [116.54, 146.83, 174.61, 220], [98, 116.54, 146.83, 174.61], [110, 138.59, 164.81, 220]], arps: [[293.66, 349.23, 440, 554.37], [233.08, 293.66, 349.23, 440], [196, 233.08, 293.66, 349.23], [220, 277.18, 329.63, 440]] },
  lofi: { chords: [[130.81, 155.56, 196, 233.08], [110, 138.59, 164.81, 207.65], [87.31, 110, 130.81, 164.81], [98, 123.47, 155.56, 185]], arps: [[523.25, 622.25, 783.99, 932.33], [440, 554.37, 659.25, 783.99], [349.23, 440, 523.25, 659.25], [392, 493.88, 622.25, 739.99]] },
  piano: { chords: [[130.81, 164.81, 196, 261.63], [146.83, 174.61, 220, 293.66], [87.31, 110, 130.81, 174.61], [98, 123.47, 146.83, 196]], arps: [[261.63, 329.63, 392, 523.25], [293.66, 349.23, 440, 587.33], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392]] },
  dark: { chords: [[65.41, 82.41, 98, 123.47], [73.42, 87.31, 110, 130.81], [55, 69.3, 82.41, 103.83], [61.74, 77.78, 92.5, 116.54]], arps: [[261.63, 311.13, 392, 466.16], [293.66, 349.23, 440, 523.25], [220, 277.18, 329.63, 415.3], [246.94, 311.13, 369.99, 466.16]] },
};

/** Danh sách hiện ở Thư viện. `mau` = nhạc mẫu của các mẫu slide (tệp có sẵn, không tổng hợp). */
const DS = [
  { id: 'ambient', ten: 'Nhẹ nhàng', moTa: 'Ambient êm — kể chuyện, giải thích' },
  { id: 'piano', ten: 'Piano', moTa: 'Ấm, sáng — mẹo, hướng dẫn' },
  { id: 'lofi', ten: 'Lo-fi', moTa: 'Thư giãn — đời sống, ẩm thực' },
  { id: 'cinematic', ten: 'Điện ảnh', moTa: 'Trang trọng — lịch sử, tin lớn' },
  { id: 'dark', ten: 'Trầm', moTa: 'Bí ẩn — chuyện có thật, giật gân' },
  { id: 'mau', ten: 'Nhạc mẫu', moTa: 'Nhạc nền của các mẫu slide (60 giây)', tep: true },
];

/* ── tổng hợp ─────────────────────────────────────────────────────────────── */
/** Lọc thông thấp biquad — công thức của WebAudio (Q của lowpass tính bằng dB). */
function locThap(f0, qDb, sr) {
  const w0 = (2 * Math.PI * f0) / sr;
  const alpha = Math.sin(w0) / (2 * 10 ** (qDb / 20));
  const c = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (1 - c) / 2 / a0;
  const b1 = (1 - c) / a0;
  const b2 = b0;
  const a1 = (-2 * c) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
const tamGiac = (pha) => 1 - 4 * Math.abs(((pha + 0.25) % 1 + 1) % 1 - 0.5);

/**
 * Ba vòng của một preset (mono, Float32) — y như engine phát từ giây 0: hợp âm mỗi 8 s (4 giọng, sine + triangle
 * lệch 0,3 %, vào lệch 0,15 s), nốt rải mỗi 2 s (nốt của hợp âm đang phát — hẹn giờ hợp âm đặt TRƯỚC nên ở giây
 * 8, 16… hợp âm đổi trước rồi nốt mới đọc).
 */
function tongHop(p, sr = SR, chiTu = 0, chiDen = 3 * VONG_S, nhuong = null) {
  if (nhuong) return tongHopNhuong(p, sr, chiTu, chiDen, nhuong);
  const ra = taoDem(sr);
  for (const viec of congViec(p, sr, chiTu, chiDen, ra)) viec();
  return ra;
}
const taoDem = (sr) => new Float32Array(Math.ceil((3 * VONG_S + 4) * sr));
async function tongHopNhuong(p, sr, chiTu, chiDen, nhuong) {
  const ra = taoDem(sr);
  for (const viec of congViec(p, sr, chiTu, chiDen, ra)) { viec(); await nhuong(); }
  return ra;
}
/** Từng nốt (một giọng hợp âm / một nốt rải) là MỘT việc — ~20 ms mỗi việc. */
function* congViec(p, sr, chiTu, chiDen, ra) {
  const tong = 3 * VONG_S;
  const N = ra.length;
  // `chiTu`/`chiDen`: chỉ dựng nốt KÊU trong khoảng đó (vongLap — nhanh gấp ~2,5 lần, kết quả trong khoảng y hệt).
  for (let k = 0; k * 8 < tong; k += 1) {
    const t0 = k * 8;
    if (t0 + 8.5 <= chiTu || t0 >= chiDen) continue;
    for (let i = 0; i < 4; i += 1) yield () => {
      const f = p.chords[k % 4][i];
      const loc = locThap(350 + i * 50, 0.5, sr);
      const tVao = t0 + i * 0.15;
      const tu = Math.round(tVao * sr);
      const den = Math.min(N, Math.round((t0 + 8.5) * sr));
      for (let n = tu; n < den; n += 1) {
        const t = n / sr;
        const tt = t - t0;
        const bao = tt < 2 ? 0.18 * (tt / 2) : tt < 5 ? 0.18 : tt < 8 ? 0.18 + (0.001 - 0.18) * ((tt - 5) / 3) : 0.001;
        const d = t - tVao;
        ra[n] += loc(bao * (Math.sin(2 * Math.PI * f * d) + tamGiac(f * 1.003 * d)));
      }
    };
  }
  const vong = Math.round(0.375 * sr);
  for (let j = 0; j * 2 < tong; j += 1) {
    const t0 = j * 2;
    if (t0 + 3.375 <= chiTu || t0 >= chiDen) continue;
    yield () => {
    const f = p.arps[Math.floor(t0 / 8) % 4][j % 4];
    const loc = locThap(2000, 0.3, sr);
    const tu = Math.round(t0 * sr);
    const den = Math.min(N, Math.round((t0 + 3) * sr));
    for (let n = tu; n < den; n += 1) {
      const tt = n / sr - t0;
      const bao = tt < 0.05 ? 0.12 * (tt / 0.05)
        : tt < 0.8 ? 0.12 * (0.03 / 0.12) ** ((tt - 0.05) / 0.75)
          : tt < 2.5 ? 0.03 + (0.001 - 0.03) * ((tt - 0.8) / 1.7) : 0.001;
      const y = bao * loc(Math.sin(2 * Math.PI * f * tt));
      ra[n] += y;
      if (n + vong < N) ra[n + vong] += 0.25 * y;
    }
    };
  }
}

/**
 * Như vongLap nhưng NHƯỜNG vòng sự kiện giữa các nốt: tiến trình chính của Electron không đứng ~1 giây lần đầu dựng
 * (IPC tiến độ dựng, MCP vẫn chạy — rà GĐ2). Kết quả y hệt (cùng tongHop, chỉ chen `setImmediate`).
 */
async function vongLapNhuong(p, sr = SR) {
  const ba = await tongHop(p, sr, VONG_S, 2 * VONG_S, () => new Promise((ok) => setImmediate(ok)));
  return ba.subarray(VONG_S * sr, 2 * VONG_S * sr);
}

/** Vòng GIỮA (giây 32–64): lặp liền mạch. */
function vongLap(p, sr = SR) {
  const ba = tongHop(p, sr, VONG_S, 2 * VONG_S);
  return ba.subarray(VONG_S * sr, 2 * VONG_S * sr);
}

function ghiWav(tep, mono, sr = SR) {
  const n = mono.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    const v = Math.max(-32768, Math.min(32767, Math.round(mono[i] * 32767)));
    b.writeInt16LE(v, 44 + i * 4);
    b.writeInt16LE(v, 46 + i * 4);
  }
  fs.writeFileSync(tep, b);
}

function chay(ffmpeg, args) {
  return new Promise((ok, hong) => {
    const p = spawn(ffmpeg, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); });
    p.on('error', hong);
    p.on('close', (ma) => (ma === 0 ? ok(err) : hong(new Error(`ffmpeg thoát mã ${ma}: ${err.slice(-400)}`))));
  });
}

/* ── bộ đệm ───────────────────────────────────────────────────────────────── */
const dang = new Map();

/** Tệp nhạc mẫu của các mẫu slide (giống hệt nhau ở mọi mẫu) — tìm trong thư mục mẫu. */
function tepMau(gocMau) {
  for (const g of gocMau || []) {
    let ds = [];
    try { ds = fs.readdirSync(g, { withFileTypes: true }); } catch { continue; }
    for (const x of ds) {
      if (!x.isDirectory()) continue;
      const f = path.join(g, x.name, 'preview-assets', 'bgm', 'meta.mp3');
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

/**
 * Đường dẫn tệp của một mục (tạo lần đầu, ~1 giây). Hai lời gọi cùng lúc dùng chung một lượt.
 * @param {string} id
 * @param {{ thuMuc: string, ffmpeg: string, gocMau?: string[] }} o  `thuMuc`: bộ đệm trong userData
 */
async function damBao(id, o) {
  const muc = DS.find((x) => x.id === id);
  if (!muc) throw new Error('Không có bản nhạc này.');
  if (!muc.tep && !o.ffmpeg) throw new Error('Không có ffmpeg đi kèm app — không dựng được nhạc có sẵn.');
  if (muc.tep) {
    const f = tepMau(o.gocMau);
    if (!f) throw new Error('Không tìm thấy nhạc mẫu trong thư mục mẫu slide.');
    return f;
  }
  const dich = path.join(o.thuMuc, PHIEN_BAN, `${id}.mp3`);
  if (fs.existsSync(dich) && fs.statSync(dich).size > 1000) return dich;
  if (dang.has(dich)) return dang.get(dich);
  const lam = (async () => {
    fs.mkdirSync(path.dirname(dich), { recursive: true });
    const wav = `${dich}.${process.pid}.wav`;
    const tam = `${dich}.${process.pid}.tam.mp3`;
    try {
      ghiWav(wav, await vongLapNhuong(PRESET[id]));
      // Đo độ to (loudnorm chỉ ĐO) → chỉnh tuyến tính: không nén động, đầu/cuối vòng vẫn khớp.
      const err = await chay(o.ffmpeg, ['-hide_banner', '-nostdin', '-i', wav, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
      const j = err.slice(err.lastIndexOf('{'));
      let i = -30;
      let tp = -10;
      try { const x = JSON.parse(j.slice(0, j.indexOf('}') + 1)); i = Number(x.input_i); tp = Number(x.input_tp); } catch { /* giữ mặc định */ }
      const tang = Math.min(LUFS - i, -3 - tp);
      await chay(o.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', wav, '-af', `volume=${tang.toFixed(2)}dB`,
        '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', String(SR), tam]);
      fs.renameSync(tam, dich);
      return dich;
    } finally {
      for (const f of [wav, tam]) { try { fs.unlinkSync(f); } catch { /* không có */ } }
    }
  })();
  dang.set(dich, lam);
  try { return await lam; } finally { dang.delete(dich); }
}

module.exports = { DS, PRESET, VONG_S, tongHop, vongLap, vongLapNhuong, damBao, tepMau };
