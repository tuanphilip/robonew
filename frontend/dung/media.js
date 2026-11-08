'use strict';
/**
 * NHẬP MEDIA cho trình dựng (KE-HOACH.md §3) — chạy ở tiến trình chính.
 *
 *   nhap(deckDir, duongNguon)   kiểm bằng ffprobe → băm → CHÉP vào dung/media/
 *   taoAnhNho / taoSong / taoProxy   bộ nhớ đệm trong dung/cache/ (xoá được)
 *
 * ── Vì sao kiểm bằng ffprobe TRƯỚC khi chép ──────────────────────────────
 * Đường dẫn đến từ giao diện (kéo thả / hộp chọn tệp). Không tin đuôi tệp: một
 * tệp `.mp4` hỏng hay một tệp bất kỳ đổi đuôi sẽ được chép vào deck rồi làm hỏng
 * lượt xuất mấy chục phút sau. ffprobe đọc được luồng hình/tiếng thật mới nhận.
 *
 * ── Khử trùng ────────────────────────────────────────────────────────────
 * Tên tệp đích = `<12 ký tự sha256>-<tên gốc đã làm sạch>`, id media = `m` + 10
 * ký tự băm. Nhập cùng một tệp hai lần (hay hai tệp cùng nội dung khác tên) chỉ
 * tốn đĩa một lần và ra cùng một id.
 *
 * Không `require('electron')`: bộ thử chạy bằng Node thường.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const config = require('../config');
const kho = require('./kho');
const moHinh = require('./moHinh');

const TRAN_BYTE = 4 * 1024 ** 3;   // 4 GB mỗi tệp
const DUOI = {
  video: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'gif'],
  anh: ['png', 'jpg', 'jpeg', 'webp', 'bmp'],
  tieng: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wma'],
};
const MOI_DUOI = new Set([...DUOI.video, ...DUOI.anh, ...DUOI.tieng]);
const CODEC_ANH = new Set(['png', 'mjpeg', 'bmp', 'webp', 'gif']);
/* Codec ffmpeg ĐI KÈM không giải mã được dù Chromium phát được: nhận vào là ảnh thu
   nhỏ/proxy/bản xuất hỏng lặng lẽ về sau. Từ chối ngay lúc nhập, nói rõ lý do.
   AV1: decoder `av1` gốc của FFmpeg chỉ chạy bằng phần cứng — không có libdav1d. */
const CODEC_KHONG_GIAI = { av1: 'video AV1' };
/* Chromium phát thẳng được (không cần proxy) khi: H.264/VP8/VP9 8-bit 4:2:0 và
   tiếng AAC/MP3/Opus/Vorbis (hoặc không có tiếng). */
const HINH_CHROME = new Set(['h264', 'vp8', 'vp9']);
const DIEM_ANH_CHROME = new Set(['yuv420p', 'yuvj420p']);
const TIENG_CHROME = new Set(['', 'aac', 'mp3', 'opus', 'vorbis']);

function exe(ten) {
  const dir = config.ffmpegDir();
  if (!dir) return null;
  const f = path.join(dir, process.platform === 'win32' ? `${ten}.exe` : ten);
  return fs.existsSync(f) ? f : null;
}

/** Chạy một tiến trình, gom stdout/stderr. `henMs` quá hạn thì giết. */
function chay(bin, args, { henMs = 120000, khiDong, khiSpawn } = {}) {
  return new Promise((xong) => {
    const p = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (b) => { out += b; if (khiDong) khiDong(String(b)); });
    p.stderr.on('data', (b) => { err = (err + b).slice(-8000); });
    const hen = setTimeout(() => { try { p.kill(); } catch { /* đã thoát */ } }, henMs);
    p.on('error', (e) => { clearTimeout(hen); xong({ ma: -1, out, err: e.message }); });
    p.on('close', (ma) => { clearTimeout(hen); xong({ ma, out, err }); });
    if (khiSpawn) khiSpawn(p);
  });
}

/**
 * Đọc thông số một tệp media. `null` = không phải media đọc được.
 * @returns {Promise<null|{loai:'video'|'anh'|'tieng', ms:number, rong:number, cao:number,
 *   fps:number, xoay:number, coTieng:boolean, codec:string}>}
 */
async function doThongSo(file) {
  const fp = exe('ffprobe');
  if (!fp) throw new Error('Thiếu ffprobe đi kèm app.');
  const r = await chay(fp, ['-v', 'error', '-show_entries',
    'format=duration,format_name:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration,pix_fmt'
    + ':stream_disposition=attached_pic:stream_side_data=rotation:stream_tags=rotate',
    '-of', 'json', file], { henMs: 30000 });
  if (r.ma !== 0) return null;
  let j;
  try { j = JSON.parse(r.out); } catch { return null; }
  const luong = j.streams || [];
  const hinh = luong.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const tieng = luong.find((s) => s.codec_type === 'audio');
  /* Thời lượng: của container, thiếu thì của luồng. MKV ghi qua đường ống (OBS,
     MediaRecorder) không có `format.duration` — thiếu bước lùi này là nhập ra
     video dài 0 ms rồi cả dự án không qua được kiểm (audit 10/10/2026). */
  let giay = Number(j.format && j.format.duration);
  if (!(giay > 0)) giay = Math.max(Number(hinh && hinh.duration) || 0, Number(tieng && tieng.duration) || 0);
  const fmt = String((j.format && j.format.format_name) || '');
  /* MP3 VBR không có khung Xing/VBRI: ffprobe ĐOÁN thời lượng theo bitrate đầu tệp — sai cả
     chục giây (đo: 20,8 s thay vì 30 s), phần cuối không dùng được (audit 10/10/2026). Giải mã
     hết để đếm (MP3 giải mã nhanh hàng trăm lần thời gian thực). */
  if (fmt === 'mp3' && tieng && !(hinh && !(hinh.disposition && hinh.disposition.attached_pic))) {
    const ff = exe('ffmpeg');
    if (ff) {
      const d = await chay(ff, ['-v', 'error', '-nostdin', '-i', file, '-map', '0:a:0', '-f', 'null', '-progress', 'pipe:1', '-nostats', '-'], { henMs: 120000 });
      const ds = [...String(d.out).matchAll(/out_time_us=(\d+)/g)];
      const us = ds.length ? Number(ds[ds.length - 1][1]) : 0;
      if (d.ma === 0 && us > 0) giay = us / 1e6;
    }
  }
  const phanSo = (x) => {
    const [a, b] = String(x || '').split('/').map(Number);
    return a && b ? a / b : 0;
  };
  if (hinh) {
    const soKhung = Number(hinh.nb_frames);
    /* ẢNH = codec ảnh và (container ảnh, hoặc gần như không có thời lượng, hoặc
       đúng MỘT khung). GIF một khung là ảnh; GIF động là video. */
    const laAnh = CODEC_ANH.has(hinh.codec_name)
      && (soKhung === 1 || (!(soKhung > 1) && (/image2|_pipe|^webp|^png|^bmp/.test(fmt) || !(giay > 0.05))));
    /* Xoay: luồng video mang display matrix ở side data; ẢNH JPEG thì hướng nằm
       trong EXIF, ffprobe chỉ báo ở mức KHUNG. ffmpeg (ảnh thu nhỏ, xuất) và
       Chromium (xem trước) đều TỰ xoay theo, nên `rong/cao` lưu theo hướng HIỂN
       THỊ — đổi chỗ khi xoay 90/270 — để giao diện tính khung đúng tỉ lệ. */
    let rot = NaN;
    const sd = (hinh.side_data_list || []).find((x) => x.rotation != null);
    if (sd) rot = Number(sd.rotation);
    if (!Number.isFinite(rot) && laAnh && hinh.codec_name === 'mjpeg') rot = await xoayKhungDau(fp, file);
    const xoay = Number.isFinite(rot) ? ((Math.round(-rot / 90) * 90) % 360 + 360) % 360 : 0;
    const dung = xoay === 90 || xoay === 270;
    const w = Number(hinh.width) || 0;
    const h = Number(hinh.height) || 0;
    return {
      loai: laAnh ? 'anh' : 'video',
      ms: laAnh ? 0 : Math.round((giay || 0) * 1000),
      rong: dung ? h : w,
      cao: dung ? w : h,
      fps: laAnh ? 0 : Math.round((phanSo(hinh.avg_frame_rate) || phanSo(hinh.r_frame_rate)) * 100) / 100,
      xoay,
      coTieng: !laAnh && !!tieng,
      codec: String(hinh.codec_name || ''),
      pixFmt: String(hinh.pix_fmt || ''),
      codecTieng: !laAnh && tieng ? String(tieng.codec_name || '') : '',
    };
  }
  if (tieng && giay > 0) {
    const ct = String(tieng.codec_name || '');
    return { loai: 'tieng', ms: Math.round(giay * 1000), rong: 0, cao: 0, fps: 0, xoay: 0, coTieng: true, codec: ct, pixFmt: '', codecTieng: ct };
  }
  return null;
}

/** Góc xoay ở mức KHUNG ĐẦU (EXIF của JPEG) — NaN nếu không có. */
async function xoayKhungDau(fp, file) {
  const r = await chay(fp, ['-v', 'error', '-select_streams', 'v:0', '-read_intervals', '%+#1',
    '-show_entries', 'frame_side_data=rotation', '-of', 'json', file], { henMs: 15000 });
  if (r.ma !== 0) return NaN;
  try {
    const kh = (JSON.parse(r.out).frames || [])[0] || {};
    const sd = (kh.side_data_list || []).find((x) => x.rotation != null);
    return sd ? Number(sd.rotation) : NaN;
  } catch { return NaN; }
}

function bamTep(file) {
  return new Promise((xong, hong) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (b) => h.update(b)).on('error', hong).on('end', () => xong(h.digest('hex')));
  });
}

/** Tên tệp gọn, an toàn trên Windows/macOS: bỏ ký tự cấm, cắt ngắn, giữ đuôi. */
function tenSach(ten) {
  /* Tách đuôi BẰNG TAY, không qua `path.basename/extname`: trên Windows chúng coi
     `a:` là ổ đĩa và cắt mất đầu tên — mà tên tệp từ macOS được phép có `:`. */
  const s = String(ten || '');
  const cham = s.lastIndexOf('.');
  const ext = (cham > 0 ? s.slice(cham) : '').toLowerCase().replace(/[^.a-z0-9]/g, '');
  const than = (cham > 0 ? s.slice(0, cham) : s)
    .normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/\s+/g, ' ').trim()
    .replace(/[. ]+$/, '').slice(0, 40) || 'media';
  return `${than}${ext}`;
}

/**
 * Nhập MỘT tệp vào deck.
 * @returns {Promise<{ ok: true, media: object, daCo: boolean, codec: string } | { ok: false, loi: string }>}
 */
/**
 * @param {{ ten?: string }} [o] `ten` = tên hiển thị (vd nhập từ thư viện dùng chung — tệp ở đó
 *   mang tiền tố băm). Mặc định là tên tệp nguồn.
 */
async function nhap(deckDir, nguon, o = {}) {
  const ten = path.basename(String(nguon || ''));
  /* Kiểm ĐUÔI TRƯỚC khi stat (24/10/2026). Đường vào đây có cả `studio_media_import` của agent:
     stat trước thì hai câu lỗi "không đọc được tệp" / "định dạng chưa hỗ trợ" thành cái máy dò
     tệp nào có trên máy, và ffprobe còn mở cả tệp không phải media. Đuôi sai thì dừng ngay. */
  const duoi = path.extname(ten).slice(1).toLowerCase();
  if (!MOI_DUOI.has(duoi)) return { ok: false, loi: `${ten}: định dạng .${duoi || '?'} chưa hỗ trợ.` };
  let st;
  try { st = fs.statSync(nguon); } catch { return { ok: false, loi: `${ten}: không đọc được tệp.` }; }
  if (!st.isFile()) return { ok: false, loi: `${ten}: không phải tệp.` };
  if (st.size > TRAN_BYTE) return { ok: false, loi: `${ten}: lớn hơn 4 GB.` };

  const ts = await doThongSo(nguon);
  if (!ts) return { ok: false, loi: `${ten}: không đọc được hình/tiếng — tệp hỏng hoặc định dạng lạ.` };
  if (CODEC_KHONG_GIAI[ts.codec]) return { ok: false, loi: `${ten}: ${CODEC_KHONG_GIAI[ts.codec]} chưa hỗ trợ — đổi sang MP4 (H.264) rồi nhập lại.` };
  if (ts.loai !== 'tieng' && (!ts.rong || !ts.cao)) {
    return { ok: false, loi: `${ten}: không đọc được khung hình (ảnh động WebP chưa hỗ trợ — dùng GIF hoặc MP4).` };
  }
  if (ts.loai !== 'anh' && ts.ms > moHinh.TRAN.msToiDa) return { ok: false, loi: `${ten}: dài quá 6 giờ.` };
  if (ts.loai !== 'anh' && ts.ms < 1) return { ok: false, loi: `${ten}: không xác định được thời lượng.` };

  const bam = await bamTep(nguon);
  const id = `m${bam.slice(0, 10)}`;
  const thuMuc = path.join(kho.thuMuc(deckDir), 'media');
  let tenDich = `${bam.slice(0, 12)}-${tenSach(ten)}`;
  /* Đường quá dài (thư mục nguồn sâu + tên deck dài) thì Explorer, Thùng rác, công
     cụ nén trên Windows hay hỏng dù Node/ffmpeg chịu được — rút còn băm + đuôi. */
  if (path.join(thuMuc, tenDich).length > 230) tenDich = `${bam.slice(0, 12)}${path.extname(tenSach(ten))}`;
  const media = {
    id, loai: ts.loai, tep: `dung/media/${tenDich}`, ten: typeof o.ten === 'string' && o.ten ? o.ten.slice(0, 255) : ten,
    ms: ts.ms, rong: ts.rong, cao: ts.cao, fps: ts.fps, xoay: ts.xoay, coTieng: ts.coTieng, byte: st.size,
    codec: ts.codec, pixFmt: ts.pixFmt, codecTieng: ts.codecTieng,
  };
  // KIỂM bản ghi TRƯỚC khi chép: media mà moHinh từ chối thì cả dự án không lưu được nữa.
  const k = moHinh.kiem({ ...moHinh.moi(), media: [media] });
  if (!k.ok) return { ok: false, loi: `${ten}: ${k.loi[0]}` };

  fs.mkdirSync(thuMuc, { recursive: true });
  const daCoTep = fs.readdirSync(thuMuc).find((f) => f.startsWith(bam.slice(0, 12)) && !/\.tam-/.test(f));
  if (daCoTep) {
    media.tep = `dung/media/${daCoTep}`;
  } else {
    // Tạm RIÊNG mỗi lượt: nhập cùng tệp hai lần song song không giẫm lên nhau.
    const tam = path.join(thuMuc, `${tenDich}.tam-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
    try {
      await fs.promises.copyFile(nguon, tam);
      const dich = path.join(thuMuc, tenDich);
      if (fs.existsSync(dich)) fs.unlinkSync(tam);   // lượt song song chép xong trước
      else fs.renameSync(tam, dich);
    } catch (e) {
      try { fs.unlinkSync(tam); } catch { /* chưa kịp tạo */ }
      return { ok: false, loi: `${ten}: chép không được (${e.code || e.message}) — đĩa đầy hoặc tệp bị khoá.` };
    }
  }
  return { ok: true, daCo: !!daCoTep, codec: ts.codec, media };
}

/* ── bộ nhớ đệm ─────────────────────────────────────────────────────────── */

/** Ảnh thu nhỏ JPG 320px của media (video: khung tiêu biểu quanh 10% đầu). */
async function taoAnhNho(deckDir, m) {
  const ff = exe('ffmpeg');
  const vao = kho.duongTrongDeck(deckDir, m.tep);
  if (!ff || !vao || m.loai === 'tieng') return null;
  const c = kho.thuMucCache(deckDir);
  fs.mkdirSync(c.anh, { recursive: true });
  const ra = path.join(c.anh, `${m.id}.jpg`);
  if (fs.existsSync(ra)) return ra;
  const tam = path.join(c.anh, `${m.id}.tam.jpg`);
  const ss = m.loai === 'video' ? ['-ss', String(Math.min(3, (m.ms / 1000) * 0.1))] : [];
  const r = await chay(ff, ['-y', '-v', 'error', ...ss, '-i', vao, '-frames:v', '1',
    '-vf', m.loai === 'video' ? 'thumbnail=12,scale=320:-2' : 'scale=320:-2', '-q:v', '4', tam]);
  if (r.ma !== 0 || !fs.existsSync(tam)) return null;
  fs.renameSync(tam, ra);
  return ra;
}

/** Đỉnh sóng âm (cùng định dạng main/songAm.js) → dung/cache/song/<id>.json. */
async function taoSong(deckDir, m) {
  if (m.loai === 'anh' || (m.loai === 'video' && !m.coTieng)) return null;
  const vao = kho.duongTrongDeck(deckDir, m.tep);
  if (!vao) return null;
  const c = kho.thuMucCache(deckDir);
  const ra = path.join(c.song, `${m.id}.json`);
  if (fs.existsSync(ra)) return ra;
  const { giaiMa } = require('../main/songAm');
  const kq = await giaiMa(vao);
  if (!kq) return null;
  fs.mkdirSync(c.song, { recursive: true });
  fs.writeFileSync(`${ra}.tam`, JSON.stringify(kq));
  fs.renameSync(`${ra}.tam`, ra);
  return ra;
}

/**
 * Video cần proxy không. Xem thẳng được khi Chromium phát mượt: H.264/VP8/VP9 8-bit
 * 4:2:0, ≤ 1280px, ≤ 60 fps, không xoay, tiếng AAC/MP3/Opus/Vorbis. Còn lại (HEVC
 * điện thoại, 4K, 10-bit, ProRes, tiếng PCM/AC-3…) xem bằng proxy.
 * @param {string} [codec] codec hình — mặc định lấy `m.codec`
 */
/* Tệp CHỈ có tiếng: Chromium phát được thêm FLAC / PCM trong WAV. Ngoài ra (WMA, ALAC, AC-3…)
   thì xem trước câm — sinh bản AAC (audit 10/10/2026). Bản XUẤT vẫn đọc tệp gốc. */
const TIENG_RIENG_CHROME = new Set([...TIENG_CHROME, 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'pcm_u8']);
const canProxy = (m, codec) => {
  if (m.loai === 'tieng') return !TIENG_RIENG_CHROME.has(m.codecTieng || '');
  if (m.loai !== 'video') return false;
  const c = codec || m.codec || '';
  return !(HINH_CHROME.has(c) && DIEM_ANH_CHROME.has(m.pixFmt || 'yuv420p')
    && TIENG_CHROME.has(m.codecTieng || '') && Math.max(m.rong, m.cao) <= 1280 && m.fps <= 60 && !m.xoay);
};

/**
 * Bản xem trước H.264 ≤1280px, GOP 15 khung (tua nhanh), 30 fps cố định — phát
 * được trong Chromium dù gốc là HEVC điện thoại, 4K hay khung hình biến thiên.
 * Bản XUẤT luôn đọc tệp gốc.
 * @param {{ khiTien?: (phan: number) => void, khiSpawn?: (p: import('node:child_process').ChildProcess) => void }} [o]
 *   `khiSpawn`: nhận tiến trình ffmpeg để còn GIẾT khi thoát app — trên Windows tiến
 *   trình con không tự chết theo app, proxy video dài sẽ chạy mồ côi hàng phút.
 */
async function taoProxy(deckDir, m, o = {}) {
  const khiTien = o.khiTien;
  const ff = exe('ffmpeg');
  const vao = kho.duongTrongDeck(deckDir, m.tep);
  if (!ff || !vao || (m.loai !== 'video' && m.loai !== 'tieng')) return null;
  const c = kho.thuMucCache(deckDir);
  fs.mkdirSync(c.proxy, { recursive: true });
  const ra = path.join(c.proxy, `${m.id}.mp4`);
  if (fs.existsSync(ra)) return ra;
  const tam = path.join(c.proxy, `${m.id}.tam.mp4`);
  const tongUs = Math.max(1, m.ms * 1000);
  const doc = (s) => {
    const k = /out_time_us=(\d+)/.exec(s);
    if (k && khiTien) khiTien(Math.min(1, Number(k[1]) / tongUs));
  };
  const chiTieng = m.loai === 'tieng'
    ? ['-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart']
    : null;
  const r = await chay(ff, chiTieng ? ['-y', '-v', 'error', '-i', vao, ...chiTieng, '-progress', 'pipe:1', '-nostats', tam] : ['-y', '-v', 'error', '-i', vao,
    '-map', '0:v:0', '-map', '0:a:0?',
    // CHỈ THU, không phóng: video nhỏ hơn 1280 giữ nguyên cỡ (`min(1280,iw)`).
    '-vf', 'scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-g', '15', '-keyint_min', '15',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats', tam], { henMs: 3 * 3600 * 1000, khiDong: doc, khiSpawn: o.khiSpawn });
  if (r.ma !== 0 || !fs.existsSync(tam)) {
    try { fs.unlinkSync(tam); } catch { /* không có */ }
    return null;
  }
  fs.renameSync(tam, ra);
  return ra;
}

module.exports = { TRAN_BYTE, DUOI, MOI_DUOI, doThongSo, nhap, tenSach, bamTep, exe, taoAnhNho, taoSong, taoProxy, canProxy };
