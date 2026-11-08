};
'use strict';
/**
 * SÓNG ÂM (+ mốc từng chữ) cho timeline dưới khung xem trước (ui-classic/render/timeline.js).
 *
 * Timeline vẽ hai track tiếng như Premiere: A1 giọng đọc, A2 nhạc nền. Muốn vẽ
 * sóng thì phải giải mã tệp tiếng — việc đó làm Ở ĐÂY bằng ffmpeg đi kèm app
 * chứ không ở renderer:
 *   · renderer không được đọc tệp trên đĩa (sandbox), và mở tệp qua `file://`
 *     rồi `decodeAudioData` cả một video 60 MB chỉ để lấy đường bao là phí;
 *   · ffmpeg xuống mẫu 8 kHz một kênh rồi mình gom thành ĐỈNH theo từng 20 ms —
 *     video 3 phút ra 9.000 số, gửi qua IPC nhẹ tênh.
 *
 * ── Tệp nào là "giọng đọc" ───────────────────────────────────────────────
 * Thứ tự ưu tiên, đo trên deck mẫu `aizen-github` (video 204,1 s):
 *   1. `voiceover_concat_render.mp3` — 202,8 s: đúng chuỗi line_*.mp3 + khoảng
 *      lặng mà bộ dựng ghép vào video (xem `concat_render_list.txt`), tức khớp
 *      trục thời gian của video từ giây 0.
 *   2. `voiceover_concat.mp3` / `full_voiceover.mp3` — 201,3 s: thiếu khoảng lặng
 *      chèn lúc dựng, lệch dần về cuối nhưng vẫn hơn không có gì.
 *   3. Chính tệp video — tiếng ĐÃ TRỘN (giọng + nhạc). Chỉ dùng khi hai loại trên
 *      không còn (người dùng dọn rác `output/`).
 *
 * ── Nhạc nền ──────────────────────────────────────────────────────────────
 * Chỉ khi `bgm.mode === 'custom'`: đó là tệp người dùng tải lên. Các mẫu nhạc
 * có sẵn (ambient, lofi…) KHÔNG phải tệp — engine TỔNG HỢP bằng WebAudio lúc
 * phát (`bgmPresets` trong engine.js), nên không có gì để giải mã; timeline tự
 * vẽ chúng thành khối không sóng.
 *
 * ⚠ Đường dẫn nhạc nằm trong `preview-settings.json` — tệp người dùng (hay AI)
 * sửa được. Chỉ nhận đường NẰM TRONG thư mục deck; trỏ ra ngoài là bỏ qua,
 * không giải mã hộ một tệp bất kỳ trên máy.
 *
 * ⚠ ĐANG DỰNG VIDEO thì không đọc: chính lượt dựng đang ghi lại mấy tệp mp3 ở
 * trên. Trả `{ dangDung: true }`, timeline hỏi lại khi lượt dựng xong.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ipcMain } = require('electron');
const config = require('../config');
const { timVideo } = require('../render/tenVideo');

const MAU_HZ = 8000;              // xuống mẫu cho nhẹ — chỉ cần đường bao
const BUOC = 0.02;                // một đỉnh mỗi 20 ms
const TRAN_GIAY = 30 * 60;        // video dài hơn 30 phút thì chỉ vẽ 30 phút đầu
const TRAN_NHO = 24;              // số kết quả giữ trong bộ nhớ
const DUOI_TIENG = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|mp4)$/i;

const nho = new Map();            // khoá tệp → { giay, buoc, dinh } (hoặc Promise khi đang giải mã)

function ffmpegExe() {
  const dir = config.ffmpegDir();
  if (!dir) return null;
  const exe = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  return fs.existsSync(exe) ? exe : null;
}

/** Khoá bộ nhớ theo đường + mốc sửa + cỡ: tệp đổi là tự giải mã lại. */
function khoaTep(file) {
  try {
    const st = fs.statSync(file);
    return st.isFile() ? `${file}|${st.mtimeMs}|${st.size}` : null;
  } catch { return null; }
}

/**
 * Giải mã một tệp thành dãy ĐỈNH 0–100 (đã chuẩn hoá theo đỉnh to nhất của tệp).
 * @returns {Promise<{giay:number, buoc:number, dinh:number[]}|null>}
 */
function giaiMa(file) {
  const exe = ffmpegExe();
  const khoa = khoaTep(file);
  if (!exe || !khoa) return Promise.resolve(null);
  const co = nho.get(khoa);
  if (co) return co instanceof Promise ? co : Promise.resolve(co);

  const viec = new Promise((xong) => {
    const p = spawn(exe, ['-v', 'error', '-t', String(TRAN_GIAY), '-i', file,
      // ⚠ WAV chứ không `-f s16le`: ffmpeg đi kèm app là bản RÚT GỌN, chỉ có vài
      // muxer (adts, mp3, mp4, wav…) — đo 09/10/2026, `s16le` báo "not known".
      '-vn', '-ac', '1', '-ar', String(MAU_HZ), '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-f', 'wav', 'pipe:1'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const manh = [];
    let tong = 0;
    p.stdout.on('data', (b) => { manh.push(b); tong += b.length; });
    let biGiet = false;
    const hen = setTimeout(() => { biGiet = true; try { p.kill(); } catch { /* đã thoát */ } }, 30000);
    p.on('error', () => { clearTimeout(hen); xong(null); });
    p.on('close', (ma) => {
      clearTimeout(hen);
      /* CHỈ nhận khi ffmpeg chạy hết (mã 0, không bị giết vì quá giờ). Nhận nửa
         chừng là đỉnh sóng của MỘT PHẦN tệp được nhớ (và trình dựng ghi xuống
         cache) như thể đầy đủ — sóng cụt mãi mãi (audit 10/10/2026). */
      if (biGiet || ma !== 0 || !tong) { xong(null); return; }
      const wav = Buffer.concat(manh, tong);
      // Bỏ phần đầu WAV: dữ liệu mẫu bắt đầu sau thẻ "data" + 4 byte độ dài.
      const the = wav.indexOf('data', 12, 'latin1');
      if (the < 0) { xong(null); return; }
      const buf = wav.subarray(the + 8);
      const soMau = Math.floor(buf.length / 2);
      const moiO = Math.max(1, Math.round(MAU_HZ * BUOC));
      const soO = Math.ceil(soMau / moiO);
      const tho = new Array(soO).fill(0);
      let max = 1;
      for (let o = 0; o < soO; o += 1) {
        let dinh = 0;
        const het = Math.min(soMau, (o + 1) * moiO);
        for (let i = o * moiO; i < het; i += 1) {
          const v = Math.abs(buf.readInt16LE(i * 2));
          if (v > dinh) dinh = v;
        }
        tho[o] = dinh;
        if (dinh > max) max = dinh;
      }
      xong({ giay: soMau / MAU_HZ, buoc: BUOC, dinh: tho.map((v) => Math.round((v / max) * 100)) });
    });
  }).then((kq) => {
    if (kq) {
      nho.set(khoa, kq);
      while (nho.size > TRAN_NHO) nho.delete(nho.keys().next().value);
    } else {
      nho.delete(khoa);
    }
    return kq;
  });
  nho.set(khoa, viec);
  return viec;
}

/**
 * Mốc TỪNG CHỮ của lượt dựng (Whisper canh giọng với script) — cho track phụ đề.
 * `output/timing.lock.json`: `lineDurations[]` (một mục mỗi slide) + `words[]`
 * tính theo trục của TỆP GIỌNG (không có khoảng lặng chèn lúc dựng) — timeline
 * tự quy về trục video theo từng slide. Không có tệp (giọng ElevenLabs tải lên
 * chưa canh, deck chưa dựng) thì trả null: timeline chia câu ước lượng.
 */
function docMocChu(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'output', 'timing.lock.json'), 'utf8'));
    const dong = Array.isArray(j.lineDurations) ? j.lineDurations.map((x) => Number(x && x.duration) || 0) : [];
    const tu = Array.isArray(j.words) ? j.words
      .filter((w) => w && typeof w.word === 'string' && Number.isFinite(Number(w.start)))
      .slice(0, 20000)
      .map((w) => ({ w: w.word, s: Number(w.start), e: Number(w.end) || Number(w.start) })) : [];
    return dong.length && tu.length ? { dong, tu } : null;
  } catch { return null; }
}

/** Tệp giọng đọc khớp trục thời gian video nhất — xem đầu tệp. */
function tepGiong(dir) {
  /* CÙNG chỗ chọn với trình dựng (xuat.tepGiongKhop): đúng tệp giọng đi cùng video hiện có.
     Lấy tệp đầu tiên có trên đĩa là có thể vẽ sóng của giọng CŨ (audit 10/10/2026). */
  const g = require('../dung/xuat').tepGiongKhop(dir);
  if (g && g.file) return { file: g.file, nguon: path.basename(g.file), tron: false };
  const v = timVideo(dir);
  return v ? { file: v.path, nguon: v.name, tron: true } : null;
}

/** Tệp nhạc nền người dùng tải lên — CHỈ khi nằm trong thư mục deck. */
function tepNhac(dir) {
  let bgm = null;
  try {
    bgm = (JSON.parse(fs.readFileSync(path.join(dir, 'preview-settings.json'), 'utf8')) || {}).bgm;
  } catch { return null; }
  if (!bgm || bgm.mode !== 'custom' || !bgm.custom) return null;
  const rel = String(bgm.custom.path || bgm.custom.url || '');
  if (!rel) return null;
  const goc = path.resolve(dir);
  const f = path.resolve(goc, rel);
  if (!f.startsWith(goc + path.sep) || !DUOI_TIENG.test(f) || !fs.existsSync(f)) return null;
  return { file: f, ten: String(bgm.custom.name || path.basename(f)) };
}

function dangKy(ctx) {
  ipcMain.handle('timeline:songAm', async (_e, nameOrDir) => {
    const dir = ctx.resolveDeckDir(nameOrDir);
    if (!dir) return null;
    /* Nhường CPU cho bước quay thời gian thực của lượt "Tạo video". Lượt XUẤT BẢN DỰNG (ffmpeg,
       không thời gian thực) thì không cần nhường — chặn cả nó là sóng âm kẹt "đang dựng" (audit). */
    const st = ctx.trangThaiDung ? ctx.trangThaiDung() : null;
    if (st ? (st.running && st.loai !== 'dung') : (ctx.jobState && ctx.jobState.running)) return { dangDung: true };
    const g = tepGiong(dir);
    const n = tepNhac(dir);
    const [giong, nhac] = await Promise.all([g ? giaiMa(g.file) : null, n ? giaiMa(n.file) : null]);
    return {
      giong: giong ? { ...giong, nguon: g.nguon, tron: g.tron } : null,
      nhac: nhac ? { ...nhac, ten: n.ten } : null,
      chu: docMocChu(dir),
    };
  });
  return {};
}

module.exports = { dangKy, giaiMa }