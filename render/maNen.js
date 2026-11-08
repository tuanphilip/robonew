);
'use strict';
/**
 * Chọn BỘ NÉN VIDEO cho bước quay (khung thô → intermediate.mp4) và bước ghép
 * cuối — dùng chung cho `pipeline.js` (app) và `cli/render.js`.
 *
 * VÌ SAO CÓ FILE NÀY: trên Mac, app từng nén bằng `libx264` thuần CPU trong
 * lúc PHẢI quay slide thời gian thực. Máy yếu (Mac mini M1 8GB của khách)
 * nghẽn CPU → rớt khung → hình chạy trước tiếng, máy nóng, "lag". Chip Apple
 * có sẵn bộ nén phần cứng (VideoToolbox) và ffmpeg đóng gói đã có
 * `h264_videotoolbox` (đo 29/08 trên cả hai bản mac-arm64 lẫn mac-x64) — chỉ
 * là app chưa dùng.
 *
 * NGUYÊN TẮC "CHẮC CHẮN CHẠY ĐƯỢC":
 *   1. Không TIN vào việc encoder có trong danh sách: THỬ THẬT bằng đúng bộ
 *      tham số sẽ dùng (bơm 3 khung thô 64×64 qua stdin y như bộ ghi), thành
 *      công mới dùng. Thử một lần mỗi tiến trình rồi nhớ.
 *   2. Ưu tiên chế độ chất-lượng-cố-định `-q:v` (như CRF, file gọn theo nội
 *      dung) — đo được chỉ Apple Silicon nhận; bản x64/Rosetta báo "qscale not
 *      available" → rơi xuống chế độ bitrate `-b:v`; không được nữa → libx264
 *      như cũ. Windows/Linux không đụng gì.
 *   3. Lỡ VideoToolbox hỏng GIỮA lượt quay (rất hiếm) → `danhDauHong()` để lượt
 *      sau tự dùng libx264, người dùng chỉ việc bấm tạo lại.
 *   4. `BEE_HW_ENCODER=0` tắt hẳn để hỗ trợ so sánh/khoanh vùng lỗi.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const config = require('../config');

function ffmpegPath() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const dir = config.ffmpegDir();
  return dir ? path.join(dir, exe) : exe;
}

const LIBX264 = { ten: 'libx264', nhan: 'libx264 (CPU)', cheDo: null };

let daChon = null;   // kết quả thử của tiến trình này
let lyDoHong = '';   // VideoToolbox từng hỏng giữa chừng → khoá lại

/** Tham số nén cho BƯỚC QUAY (intermediate, cần gần-không-mất, tốc độ là trên hết). */
function thamSoQuay(bo, width, height, fps) {
  if (!bo || bo.ten === 'libx264') {
    return ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-pix_fmt', 'yuv420p'];
  }
  const chung = ['-c:v', 'h264_videotoolbox', '-allow_sw', '1', '-realtime', '1', '-prio_speed', '1'];
  if (bo.cheDo === 'q') return [...chung, '-q:v', '90', '-pix_fmt', 'yuv420p'];
  // Bitrate rất cao cho file tạm: ~0,5 bit/điểm ảnh/khung (1080×1920@30 ≈ 31 Mbps).
  const bps = Math.max(2_000_000, Math.round(width * height * fps * 0.5));
  return [...chung, '-b:v', String(bps), '-pix_fmt', 'yuv420p'];
}

/* Chất lượng bước GHÉP theo mức người dùng chọn. `q` là thang 1–100 của
   VideoToolbox; `heSo` là bit/điểm ảnh/khung cho chế độ bitrate (máy Intel).

   Hiệu chỉnh 02/09/2026 trên MacBook M3, deck chữ 63s, đo SSIM so với bản
   libx264 slow CRF16 và dung lượng:
     q60 → 1,8 MB / SSIM 0,9937   q66 → 3,0 MB / 0,9939
     q72 → 6,0 MB / 0,9942        q85 → 12,2 MB / 0,9968
   SSIM gần như phẳng từ q60 tới q78 (trần của bộ nén phần cứng với chữ nét),
   dung lượng thì tăng gấp đôi mỗi 6 bậc — nên chọn ở đầu thấp của vùng phẳng.
   Bản render thật q72 so với libx264 cùng deck: PSNR 47 dB (mắt không phân
   biệt), file 9,0 MB so 5,0 MB. Chế độ bitrate: -b:v 4M…8M đều ra ~13 MB /
   SSIM 0,9965 (VideoToolbox có sàn chất lượng riêng) — heSo chỉ là trần. */
const MUC_GHEP = {
  fast: { q: 58, heSo: 0.08 },
  balanced: { q: 64, heSo: 0.10 },
  quality: { q: 70, heSo: 0.13 },
};

/** Tham số nén cho BƯỚC GHÉP — trả {ten, args} để Python nối vào lệnh ffmpeg. */
function thamSoGhep(bo, quality, width, height, fps) {
  const muc = MUC_GHEP[quality] || MUC_GHEP.quality;
  if (!bo || bo.ten === 'libx264') return { ten: 'libx264', args: null };   // Python dùng preset/CRF cũ
  const chung = ['-c:v', 'h264_videotoolbox', '-allow_sw', '1', '-profile:v', 'high'];
  if (bo.cheDo === 'q') return { ten: bo.ten, args: [...chung, '-q:v', String(muc.q)] };
  const bps = Math.max(1_500_000, Math.round(width * height * fps * muc.heSo));
  return {
    ten: bo.ten,
    args: [...chung, '-b:v', String(bps), '-maxrate', String(Math.round(bps * 1.5)), '-bufsize', String(bps * 2)],
  };
}

/** Bơm 3 khung thô 64×64 qua stdin y như bộ ghi, đúng bộ tham số sẽ dùng. */
function thuMot(args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let xong = false;
    const ketThuc = (ok) => { if (!xong) { xong = true; resolve(ok); } };
    let p;
    try {
      p = spawn(ffmpegPath(), [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', '64x64', '-r', '30', '-i', 'pipe:0',
        ...args, '-f', 'null', '-',
      ], { stdio: ['pipe', 'ignore', 'ignore'] });
    } catch { return ketThuc(false); }
    const hen = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* đã chết */ } ketThuc(false); }, timeoutMs);
    p.on('error', () => { clearTimeout(hen); ketThuc(false); });
    p.on('close', (code) => { clearTimeout(hen); ketThuc(code === 0); });
    try {
      p.stdin.on('error', () => {});   // ffmpeg đóng sớm thì EPIPE — đã có 'close' lo
      p.stdin.end(Buffer.alloc(64 * 64 * 4 * 3));
    } catch { /* 'close' sẽ báo */ }
  });
}

async function chonBoNen() {
  if (daChon) return daChon;
  if (process.platform !== 'darwin' || process.env.BEE_HW_ENCODER === '0' || lyDoHong) {
    daChon = LIBX264;
    return daChon;
  }
  // Thử đúng bộ tham số của BƯỚC QUAY (bước nặng nhất) với khung 64×64; thử
  // với -allow_sw 0 để chắc là PHẦN CỨNG thật, lúc chạy thật mới cho allow_sw 1.
  const ungVien = [
    { ten: 'videotoolbox', nhan: 'VideoToolbox (phần cứng Apple, chất lượng cố định)', cheDo: 'q' },
    { ten: 'videotoolbox', nhan: 'VideoToolbox (phần cứng Apple, bitrate)', cheDo: 'b' },
  ];
  for (const uv of ungVien) {
    const args = thamSoQuay(uv, 64, 64, 30).map((a, i, arr) => (arr[i - 1] === '-allow_sw' ? '0' : a));
    // eslint-disable-next-line no-await-in-loop
    if (await thuMot(args)) { daChon = uv; return daChon; }
  }
  daChon = LIBX264;
  return daChon;
}

/** VideoToolbox hỏng giữa lượt → lượt sau về libx264 (chỉ trong tiến trình này). */
function danhDauHong(lyDo) {
  lyDoHong = String(lyDo || 'hỏng giữa lượt quay');
  daChon = LIBX264;
}

function dangDungPhanCung() {
  return Boolean(daChon && daChon.ten !== 'libx264');
}

module.exports = { chonBoNen, thamSoQuay, thamSoGhep, danhDauHong, dangDungPhanCung, MUC_GHEP 