;
'use strict';
/**
 * TIẾNG HIỆU ỨNG CÓ SẴN (đợt 1 hiệu ứng, 23/10/2026) — mục "Hiệu ứng" của tab Thư viện.
 *
 * Như nhạc có sẵn (nhacSan.js): TỔNG HỢP bằng JS thuần — không thêm tệp nhị phân vào repo, không cần mạng, không
 * vướng bản quyền. Dựng một lần vào userData/tieng-hieu-ung/<PHIEN_BAN>/<id>.wav (~0,1 giây mỗi tiếng).
 *
 * WAV 16-bit stereo, KHÔNG mã hoá mp3: mp3 chèn ~26 ms im lặng đầu tệp (độ trễ bộ mã) — tiếng "tách" đặt đúng chỗ cắt
 * cảnh sẽ trễ một khung. Tiếng ngắn (≤ 2,5 s) nên WAV chỉ vài trăm KB.
 *
 * Nhiễu dùng bộ sinh số giả ngẫu nhiên CỐ ĐỊNH hạt: dựng lại (xoá bộ đệm, máy khác) ra đúng từng mẫu — bộ thử so được.
 * Lọc: state-variable filter (Chamberlin) — đổi tần số từng mẫu mà không vỡ, hợp cho tiếng "vút" quét tần.
 */
const fs = require('node:fs');
const path = require('node:path');

const PHIEN_BAN = 'v1';               // đổi công thức ⇒ nâng để tệp cũ trong bộ đệm không bị dùng lại
const SR = 44100;

/** Danh sách hiện ở Thư viện (thứ tự = thứ tự hiện). `dai` giây — đặt khối đúng độ dài tệp. */
const DS = [
  { id: 'vut', ten: 'Vút', moTa: 'Gió lướt qua — chuyển cảnh, chữ bay vào', dai: 0.9 },
  { id: 'vut-nhanh', ten: 'Vút nhanh', moTa: 'Lướt ngắn, sắc — cắt nhanh, trượt ảnh', dai: 0.4 },
  { id: 'bup', ten: 'Bụp', moTa: 'Bật lên — chữ / biểu tượng hiện ra', dai: 0.2 },
  { id: 'no-tram', ten: 'Nổ trầm', moTa: 'Cú dội trầm — mở màn, khoảnh khắc lớn', dai: 2 },
  { id: 'dang', ten: 'Tiếng dâng', moTa: 'Căng dần lên — trước cú cắt, trước khi lộ kết quả', dai: 2.5 },
  { id: 'ting', ten: 'Ting', moTa: 'Chuông nhỏ trong — điểm nhấn, đúng / hoàn thành', dai: 1.6 },
  { id: 'tach', ten: 'Tách', moTa: 'Một tiếng bấm — hiện từng ý, đổi số', dai: 0.08 },
  { id: 'go-phim', ten: 'Gõ phím', moTa: 'Chuỗi gõ phím — chữ hiện từng ký tự', dai: 2 },
  { id: 'thong-bao', ten: 'Thông báo', moTa: 'Hai nốt chuông đi lên — kêu gọi đăng ký, thông báo', dai: 1.2 },
];

/* ── công cụ âm ───────────────────────────────────────────────────────────── */
/** Nhiễu trắng −1..1 từ hạt cố định (xorshift32). */
function taoNhieu(hat) {
  let x = hat >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return (x / 4294967296) * 2 - 1;
  };
}
/** Bộ lọc state-variable (Chamberlin): `buoc(x, fc, q)` → { thap, dai, cao } — fc đổi từng mẫu được. */
function taoSvf() {
  let lo = 0;
  let bd = 0;
  return (x, fc, q) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);   // ổn định khi fc ≤ sr/6
    const d = 1 / q;
    // Hai bước nửa mẫu (oversample ×2) cho tần cao ổn định hơn.
    let hi = 0;
    for (let k = 0; k < 2; k += 1) {
      lo += (f / 2) * bd;
      hi = x - lo - d * bd;
      bd += (f / 2) * hi;
    }
    return { thap: lo, dai: bd, cao: hi };
  };
}
const muDan = (a, b, p) => a * (b / a) ** p;                 // a → b theo hàm mũ, p 0..1
const ss = (p) => { const t = Math.max(0, Math.min(1, p)); return t * t * (3 - 2 * t); };
/** Chuông: tổng các bội số (không hài hoà) tắt dần theo hàm mũ. */
function chuong(L, R, t0, f0, phan, amp) {
  const tu = Math.round(t0 * SR);
  for (let n = tu; n < L.length; n += 1) {
    const t = (n - tu) / SR;
    let y = 0;
    for (const [boi, a, tat] of phan) y += a * Math.exp(-t / tat) * Math.sin(2 * Math.PI * f0 * boi * t);
    const vao = Math.min(1, t / 0.002);
    L[n] += amp * vao * y;
    R[n] += amp * vao * y * 0.97;
  }
}

/* ── công thức từng tiếng ────────────────────────────────────────────────── */
/** @returns {{ L: Float32Array, R: Float32Array }} */
function tongHop(id) {
  const muc = DS.find((x) => x.id === id);
  if (!muc) throw new Error('Không có tiếng hiệu ứng này.');
  const N = Math.round(muc.dai * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const nhieu = taoNhieu(0x9e3779b9 ^ id.length * 2654435761);

  if (id === 'vut' || id === 'vut-nhanh') {
    // Nhiễu qua lọc dải, tần quét lên rồi xuống (đỉnh ở 55 %), lia trái → phải (nhanh: phải → trái).
    const nhanh = id === 'vut-nhanh';
    const [fA, fB, fC] = nhanh ? [900, 6500, 1800] : [280, 3200, 600];
    const svf = taoSvf();
    const than = taoSvf();
    for (let n = 0; n < N; n += 1) {
      const p = n / N;
      const dinh = 0.55;
      const fc = p < dinh ? muDan(fA, fB, ss(p / dinh)) : muDan(fB, fC, ss((p - dinh) / (1 - dinh)));
      const bao = p < dinh ? Math.sin((Math.PI / 2) * (p / dinh)) ** 2 : (1 - ss((p - dinh) / (1 - dinh))) ** 1.5;
      const x = nhieu();
      const y = svf(x, fc, 1.6).dai * 1.6 + than(x, fc * 0.5, 0.7).thap * 0.35;
      const pan = nhanh ? 1 - p : p;                       // 0 = trái, 1 = phải
      L[n] = y * bao * Math.cos((pan * Math.PI) / 2);
      R[n] = y * bao * Math.sin((pan * Math.PI) / 2);
    }
  } else if (id === 'bup') {
    // Sin rơi tần 900 → 170 Hz + một tiếng tách rất ngắn ở đầu.
    let pha = 0;
    const loc = taoSvf();
    for (let n = 0; n < N; n += 1) {
      const t = n / SR;
      const f = muDan(900, 170, Math.min(1, t / 0.11));
      pha += (2 * Math.PI * f) / SR;
      const bao = Math.min(1, t / 0.002) * Math.exp(-t / 0.045);
      const tach = t < 0.004 ? loc(nhieu(), 3500, 1).dai * (1 - t / 0.004) * 0.6 : 0;
      const y = Math.sin(pha) * bao + tach;
      L[n] = y;
      R[n] = y;
    }
  } else if (id === 'no-tram') {
    // Sin trầm 72 → 36 Hz tắt chậm + nhiễu lọc thấp dội đầu; nén mềm (tanh) cho chắc tiếng.
    let pha = 0;
    const loc = taoSvf();
    for (let n = 0; n < N; n += 1) {
      const t = n / SR;
      const f = muDan(72, 36, Math.min(1, t / 0.9));
      pha += (2 * Math.PI * f) / SR;
      const than = Math.sin(pha) * Math.min(1, t / 0.004) * Math.exp(-t / 0.55);
      const doi = loc(nhieu(), muDan(900, 120, Math.min(1, t / 0.25)), 0.8).thap * Math.exp(-t / 0.12) * 0.9;
      const y = Math.tanh(1.6 * (than + doi)) / Math.tanh(1.6);
      L[n] = y;
      R[n] = y;
    }
  } else if (id === 'dang') {
    // Nhiễu lọc dải quét 200 → 5 kHz + hai sóng răng cưa lệch nhẹ (rộng stereo) 110 → 440 Hz; to dần, tắt gọn cuối.
    const sv = taoSvf();
    const lo = [taoSvf(), taoSvf()];
    const pha = [0, 0];
    for (let n = 0; n < N; n += 1) {
      const p = n / N;
      const t = n / SR;
      const fc = muDan(200, 5000, p);
      const no = sv(nhieu(), fc, 1 + 3 * p).dai;
      const f0 = muDan(110, 440, p ** 1.4);
      const bao = p ** 2 * (t > muc.dai - 0.012 ? Math.max(0, (muc.dai - t) / 0.012) : 1);
      [0, 1].forEach((k) => {
        pha[k] = (pha[k] + (f0 * (k ? 1.006 : 0.994)) / SR) % 1;
        const rang = lo[k](2 * pha[k] - 1, Math.min(9000, f0 * 6), 0.8).thap;
        const y = bao * (0.55 * no + 0.45 * rang);
        if (k) R[n] = y; else L[n] = y;
      });
    }
  } else if (id === 'ting') {
    chuong(L, R, 0, 1318.5, [[1, 1, 0.9], [2.0, 0.42, 0.45], [3.01, 0.22, 0.28], [4.2, 0.12, 0.16], [5.43, 0.06, 0.1]], 0.5);
  } else if (id === 'thong-bao') {
    const phan = [[1, 1, 0.55], [2.0, 0.35, 0.3], [3.01, 0.15, 0.18], [4.2, 0.08, 0.1]];
    chuong(L, R, 0, 987.8, phan, 0.42);       // B5
    chuong(L, R, 0.14, 1318.5, phan, 0.45);   // E6
  } else if (id === 'tach') {
    const loc = taoSvf();
    let pha = 0;
    for (let n = 0; n < N; n += 1) {
      const t = n / SR;
      pha += (2 * Math.PI * 2100) / SR;
      const y = loc(nhieu(), 2600, 1.4).dai * Math.exp(-t / 0.004) * 1.2 + Math.sin(pha) * Math.exp(-t / 0.006) * 0.45;
      L[n] = y;
      R[n] = y;
    }
  } else if (id === 'go-phim') {
    // ~15 phím, nhịp không đều (cố định theo hạt), mỗi phím: tách lọc dải ngẫu nhiên + tiếng đục 160 Hz rất ngắn.
    const nhip = taoNhieu(0x51ed270b);
    let t0 = 0.03;
    while (t0 < muc.dai - 0.08) {
      const fc = 1800 + 1700 * (nhip() * 0.5 + 0.5);
      const amp = 0.55 + 0.35 * (nhip() * 0.5 + 0.5);
      const pan = 0.5 + 0.18 * nhip();
      const loc = taoSvf();
      const tu = Math.round(t0 * SR);
      for (let n = tu; n < Math.min(N, tu + Math.round(0.05 * SR)); n += 1) {
        const t = (n - tu) / SR;
        const y = amp * (loc(nhieu(), fc, 1.2).dai * Math.exp(-t / 0.005) * 1.3 + Math.sin(2 * Math.PI * 160 * t) * Math.exp(-t / 0.012) * 0.35);
        L[n] += y * Math.cos((pan * Math.PI) / 2) * 1.414;
        R[n] += y * Math.sin((pan * Math.PI) / 2) * 1.414;
      }
      t0 += 0.075 + 0.11 * (nhip() * 0.5 + 0.5);
    }
  }

  // Chuẩn hoá ĐỈNH (tiếng ngắn: loudnorm đo tích phân cần ≥ 0,4 s — không tin được). Mỗi tiếng một mức cảm nhận.
  const MUC = { vut: 0.7, 'vut-nhanh': 0.7, bup: 0.8, 'no-tram': 0.9, dang: 0.7, ting: 0.55, tach: 0.6, 'go-phim': 0.6, 'thong-bao': 0.55 };
  let dinh = 0;
  for (let n = 0; n < N; n += 1) dinh = Math.max(dinh, Math.abs(L[n]), Math.abs(R[n]));
  const k = dinh > 0 ? (MUC[id] || 0.7) / dinh : 1;
  // Đuôi 4 ms về 0: không "tách" ở cuối tệp.
  const duoi = Math.round(0.004 * SR);
  for (let n = 0; n < N; n += 1) {
    const g = n >= N - duoi ? (N - 1 - n) / (duoi - 1) : 1;   // mẫu cuối đúng 0
    L[n] *= k * g;
    R[n] *= k * g;
  }
  return { L, R };
}

function ghiWav(tep, { L, R }) {
  const n = L.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  const q = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i += 1) {
    b.writeInt16LE(q(L[i]), 44 + i * 4);
    b.writeInt16LE(q(R[i]), 46 + i * 4);
  }
  fs.writeFileSync(tep, b);
}

/**
 * Đường dẫn tệp WAV của một tiếng (dựng lần đầu). Ghi qua tệp tạm rồi đổi tên — hai lượt cùng lúc không đọc tệp dở.
 * @param {string} id
 * @param {{ thuMuc: string }} o  `thuMuc`: bộ đệm trong userData
 */
function damBao(id, o) {
  if (!DS.some((x) => x.id === id)) throw new Error('Không có tiếng hiệu ứng này.');
  const dich = path.join(o.thuMuc, PHIEN_BAN, `${id}.wav`);
  if (fs.existsSync(dich) && fs.statSync(dich).size > 44) return dich;
  fs.mkdirSync(path.dirname(dich), { recursive: true });
  const tam = `${dich}.${process.pid}.tam`;
  try {
    ghiWav(tam, tongHop(id));
    fs.renameSync(tam, dich);
  } finally { try { fs.unlinkSync(tam); } catch { /* đã đổi tên */ } }
  return dich;
}

module.exports = { DS, SR, PHIEN_BAN, tongHop, damBao, ghiWav }