;
'use strict';
/**
 * LỚP PHỦ CÓ SẴN (đợt 1 hiệu ứng, 23/10/2026) — mục "Hiệu ứng" của tab Thư viện.
 *
 * Ảnh PNG trong suốt PHỦ CẢ KHUNG (viền tối, vệt sáng, khung điện ảnh…), VẼ bằng JS thuần đúng cỡ khung xuất của dự án
 * (1080×1920, 1920×1080…) rồi đặt lên track hình trên cùng như một khối ảnh thường — xem trước / xuất / keyframe / độ
 * đục / chuyển cảnh dùng lại hết, không thêm bộ lọc ffmpeg nào (ffmpeg đi kèm không có blend / vignette / noise).
 * Bộ đệm: userData/lop-phu/<PHIEN_BAN>/<id>-<rộng>x<cao>.png.
 *
 * PNG tự mã hoá (zlib của Node, lọc "Sub" từng hàng) — không phụ thuộc thư viện ảnh. Điểm ngẫu nhiên (đốm sáng) dùng
 * hạt CỐ ĐỊNH: vẽ lại ra đúng từng điểm.
 *
 * `macDinh` = cách đặt khi thêm: `dai: 'het'` (tới hết video) hoặc ms; `kfMo` keyframe độ đục [[ms, giá trị], …];
 * `mo` tăng / giảm dần (ms).
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const PHIEN_BAN = 'v1';

const DS = [
  { id: 'vien-toi', ten: 'Viền tối', moTa: 'Tối dần ra bốn góc — dồn mắt vào giữa, "chất phim"', macDinh: { dai: 'het' } },
  { id: 'vet-sang-am', ten: 'Vệt sáng ấm', moTa: 'Ánh cam lướt qua góc trên — đặt ngay chỗ chuyển cảnh', macDinh: { dai: 1500, kfMo: [[0, 0], [600, 1], [1500, 0]] } },
  { id: 'vet-sang-tim', ten: 'Vệt sáng tím', moTa: 'Ánh hồng tím từ góc dưới — mơ màng, đêm', macDinh: { dai: 1500, kfMo: [[0, 0], [600, 1], [1500, 0]] } },
  { id: 'khung-dien-anh', ten: 'Khung điện ảnh', moTa: 'Hai dải đen trên / dưới — cảm giác phim chiếu rạp', macDinh: { dai: 'het' } },
  { id: 'dai-toi-duoi', ten: 'Dải tối dưới', moTa: 'Nền tối dần ở đáy — chữ / phụ đề dễ đọc trên ảnh sáng', macDinh: { dai: 'het' } },
  { id: 'dai-toi-tren', ten: 'Dải tối trên', moTa: 'Nền tối dần ở đỉnh — tiêu đề trên cùng dễ đọc', macDinh: { dai: 'het' } },
  { id: 'chop-sang', ten: 'Chớp sáng', moTa: 'Loé trắng 0,36 s — đặt đúng nhịp nhạc / chỗ cắt', macDinh: { dai: 360, kfMo: [[0, 0], [120, 0.9], [360, 0]] } },
  { id: 'dom-sang', ten: 'Đốm sáng', moTa: 'Đốm sáng mờ bay lơ lửng (bokeh) — lãng mạn, lễ hội', macDinh: { dai: 4000, mo: { vaoMs: 600, raMs: 800 } } },
  { id: 'vien-manh', ten: 'Viền mảnh', moTa: 'Khung viền trắng mảnh cách mép — sang, kiểu bưu thiếp', macDinh: { dai: 'het' } },
];

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function taoNgau(hat) {
  let x = hat >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/**
 * Vẽ một lớp phủ → RGBA (straight alpha) W×H.
 * @returns {Buffer}
 */
function ve(id, W, H) {
  if (!DS.some((x) => x.id === id)) throw new Error('Không có lớp phủ này.');
  if (!(W >= 16 && H >= 16 && W <= 8192 && H <= 8192)) throw new Error('Cỡ khung lớp phủ sai.');
  const b = Buffer.alloc(W * H * 4);
  const dat = (i, r, g, bl, a) => { b[i] = r; b[i + 1] = g; b[i + 2] = bl; b[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255))); };
  const ngan = Math.min(W, H);
  const cheo = Math.hypot(W, H);

  if (id === 'vien-toi') {
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const dx = (x + 0.5 - W / 2) / (W / 2);
        const dy = (y + 0.5 - H / 2) / (H / 2);
        const r = Math.hypot(dx, dy) / Math.SQRT2;   // góc = 1, giữa cạnh ≈ 0,71
        dat((y * W + x) * 4, 0, 0, 0, ss(0.42, 1.05, r) ** 1.25 * 0.82);
      }
    }
  } else if (id === 'vet-sang-am' || id === 'vet-sang-tim') {
    // Các đốm Gauss chồng nhau: màu = trung bình theo cường độ, alpha = 1 − Π(1 − Iₖ).
    const am = id === 'vet-sang-am';
    const dom = am
      ? [[1, 0.02, 0.34, [255, 150, 60], 0.8], [0.8, 0.16, 0.2, [255, 92, 118], 0.45], [1.02, -0.02, 0.16, [255, 226, 160], 0.9]]
      : [[0, 0.98, 0.34, [205, 80, 255], 0.7], [0.22, 0.82, 0.2, [255, 90, 150], 0.42], [-0.02, 1.02, 0.16, [130, 170, 255], 0.85]];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        let sr = 0; let sg = 0; let sb = 0; let tong = 0; let con = 1;
        for (const [ux, uy, rr, c, a] of dom) {
          const d = Math.hypot(x - ux * W, y - uy * H) / (rr * cheo);
          const I = a * Math.exp(-d * d * 2.2);
          sr += c[0] * I; sg += c[1] * I; sb += c[2] * I; tong += I; con *= 1 - I;
        }
        const i = (y * W + x) * 4;
        if (tong > 1e-4) dat(i, sr / tong, sg / tong, sb / tong, 1 - con); else dat(i, 0, 0, 0, 0);
      }
    }
  } else if (id === 'khung-dien-anh') {
    // Ngang / vuông: dải tới khổ 2,39:1. Dọc: mỗi dải 11 % chiều cao (khung "điện ảnh" cho video dọc).
    const thanh = W >= H ? Math.max(0, Math.round((H - W / 2.39) / 2)) : Math.round(H * 0.11);
    for (let y = 0; y < H; y += 1) {
      const a = y < thanh || y >= H - thanh ? 1 : 0;
      for (let x = 0; x < W; x += 1) dat((y * W + x) * 4, 0, 0, 0, a);
    }
  } else if (id === 'dai-toi-duoi' || id === 'dai-toi-tren') {
    const duoi = id === 'dai-toi-duoi';
    for (let y = 0; y < H; y += 1) {
      const v = (y + 0.5) / H;
      const a = duoi ? ss(0.5, 1, v) * 0.78 : ss(0.4, 0, v) * 0.68;
      for (let x = 0; x < W; x += 1) dat((y * W + x) * 4, 0, 0, 0, a);
    }
  } else if (id === 'chop-sang') {
    b.fill(255);
  } else if (id === 'dom-sang') {
    const ng = taoNgau(0x2545f491);
    const dom = [];
    for (let k = 0; k < 22; k += 1) {
      dom.push({ x: ng() * W, y: ng() * H, r: ngan * (0.025 + 0.075 * ng() ** 2), a: 0.28 + 0.34 * ng(), am: ng() });
    }
    const A = new Float32Array(W * H);
    const T = new Float32Array(W * H);   // độ ấm (0 trắng xanh → 1 vàng)
    for (const d of dom) {
      const r = d.r;
      const x0 = Math.max(0, Math.floor(d.x - r - 2));
      const x1 = Math.min(W - 1, Math.ceil(d.x + r + 2));
      const y0 = Math.max(0, Math.floor(d.y - r - 2));
      const y1 = Math.min(H - 1, Math.ceil(d.y + r + 2));
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const q = Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) / r;
          // Đĩa mềm: giữa đều, mép sáng nhẹ hơn rồi tắt (như ánh nhoè ống kính).
          const a = q >= 1 ? 0 : d.a * (0.75 + 0.25 * ss(0.6, 0.92, q)) * (1 - ss(0.88, 1, q));
          if (a <= 0) continue;
          const i = y * W + x;
          T[i] = (T[i] * A[i] + d.am * a) / (A[i] + a || 1);
          A[i] = 1 - (1 - A[i]) * (1 - a);
        }
      }
    }
    for (let i = 0; i < W * H; i += 1) dat(i * 4, 255, 236 + 14 * (1 - T[i]), 200 + 50 * (1 - T[i]), A[i]);
  } else if (id === 'vien-manh') {
    const le = Math.round(ngan * 0.035);
    const day = Math.max(3, Math.round(ngan * 0.004));
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const trong = x >= le && x < W - le && y >= le && y < H - le;
        const loi = x >= le + day && x < W - le - day && y >= le + day && y < H - le - day;
        dat((y * W + x) * 4, 255, 255, 255, trong && !loi ? 0.92 : 0);
      }
    }
  }
  return b;
}

/* ── PNG (RGBA 8-bit, lọc Sub) ───────────────────────────────────────────── */
const BANG_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = BANG_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function khoi(loai, du) {
  const dai = Buffer.alloc(4);
  dai.writeUInt32BE(du.length);
  const lt = Buffer.from(loai, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([lt, du])));
  return Buffer.concat([dai, lt, du, crc]);
}
function maPng(rgba, W, H) {
  const hang = W * 4;
  const tho = Buffer.alloc((hang + 1) * H);
  for (let y = 0; y < H; y += 1) {
    const o = y * (hang + 1);
    tho[o] = 1;   // Sub
    for (let i = 0; i < hang; i += 1) {
      const v = rgba[y * hang + i];
      const trai = i >= 4 ? rgba[y * hang + i - 4] : 0;
      tho[o + 1 + i] = (v - trai) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), khoi('IHDR', ihdr),
    khoi('IDAT', zlib.deflateSync(tho, { level: 6 })), khoi('IEND', Buffer.alloc(0))]);
}

/**
 * Đường dẫn PNG của một lớp phủ ở cỡ khung W×H (vẽ lần đầu; ~0,1–0,5 s với 1080×1920).
 * @param {{ thuMuc: string }} o
 */
function damBao(id, W, H, o) {
  if (!DS.some((x) => x.id === id)) throw new Error('Không có lớp phủ này.');
  const w = Math.round(Number(W));
  const h = Math.round(Number(H));
  const dich = path.join(o.thuMuc, PHIEN_BAN, `${id}-${w}x${h}.png`);
  if (fs.existsSync(dich) && fs.statSync(dich).size > 60) return dich;
  fs.mkdirSync(path.dirname(dich), { recursive: true });
  const tam = `${dich}.${process.pid}.tam`;
  try {
    fs.writeFileSync(tam, maPng(ve(id, w, h), w, h));
    fs.renameSync(tam, dich);
  } finally { try { fs.unlinkSync(tam); } catch { /* đã đổi tên */ } }
  return dich;
}

/**
 * Cỡ VẼ cho khung W×H: lớp phủ được kéo giãn phủ kín khung (moHinh.coGoc) nên không cần đúng cỡ khung — mịn (viền tối,
 * vệt sáng, dải tối, đốm, chớp, dải đen) vẽ cạnh dài ≤ 960, viền mảnh (nét 0,4 %) ≤ 1920. Vẽ chạy ĐỒNG BỘ trong tiến
 * trình chính: 1080×1920 vệt sáng ~0,6 s, 4K ~2,5 s chặn cả giao diện + MCP (rà soát đợt 1) — 960 còn ~0,15 s.
 */
function coVe(id, W, H) {
  const tran = id === 'vien-manh' ? 1920 : 960;
  const k = Math.min(1, tran / Math.max(W, H));
  return { w: Math.max(16, Math.round(W * k)), h: Math.max(16, Math.round(H * k)) };
}

/** Ảnh thu nhỏ (data URL) cho Thư viện — vẽ thẳng ở cỡ nhỏ, không qua bộ đệm. */
function anhNho(id, W, H) {
  return `data:image/png;base64,${maPng(ve(id, W, H), W, H).toString('base64')}`;
}

module.exports = { DS, PHIEN_BAN, ve, maPng, damBao, anhNho, coVe }