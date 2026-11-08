};
'use strict';
/**
 * PHỤ ĐỀ TÁCH LỚP (Giai đoạn 3 trình dựng — chủ dự án chốt 10/10/2026 "làm luôn").
 *
 * Trước đây phụ đề karaoke là một lớp DOM trong trang deck, chạy theo đồng hồ lúc QUAY thời
 * gian thực — đốt luôn vào video, không tách ra được. Nay:
 *   1. `vePhuDeLop`: mở CHÍNH trang quay của deck (`_recording.html`, cùng CSS / phông / thiết
 *      lập phụ đề của deck) trong một cửa sổ offscreen NỀN TRONG SUỐT, ẩn mọi thứ trừ lớp phụ
 *      đề, rồi vẽ từng TRẠNG THÁI (mỗi lần đổi câu / đổi chữ đang đọc) bằng
 *      `__renderScriptSubtitlesAt(t)` — chụp ra PNG có kênh alpha. Trạng thái là hàm THUẦN của
 *      thời gian nên không cần quay thời gian thực: vài trăm ảnh cho vài phút video.
 *   2. `chongPhuDe`: ffmpeg chồng chuỗi ảnh (concat demuxer, mỗi ảnh một độ dài) lên video.
 * Lượt "Tạo video" quay KHÔNG phụ đề → `<deck>.nophude.mp4` (nền cho trình dựng sửa phụ đề) +
 * chồng lớp này → `<deck>.mp4` như cũ. Trình dựng sửa phụ đề thì vẽ lại lớp từ dữ liệu đã sửa.
 *
 * Hỏng ở bước 1 ⇒ pipeline lùi về đường cũ (đốt DOM lúc quay) — lượt dựng không bao giờ hỏng
 * chỉ vì tính năng này.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

/* ── trạng thái (port ĐÚNG hai hàm tìm của SUBTITLE_SCRIPT trong recordingHtml.js) ── */
function chiSoCau(captions, t) {
  let ung = -1;
  for (let i = 0; i < captions.length; i += 1) {
    const c = captions[i];
    if (t >= c.start && t <= c.end + 0.18) return i;
    if (c.start <= t) ung = i;
    if (c.start > t) break;
  }
  return ung;
}
function chiSoChu(words, t) {
  let ung = -1;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (t >= w.start && t <= w.end + 0.08) return i;
    if (w.start <= t) ung = i;
    if (w.start > t) break;
  }
  return ung;
}
function khoaTai(captions, t) {
  if (!captions.length) return 'an';
  const i = chiSoCau(captions, t);
  if (i < 0 || t > captions[captions.length - 1].end + 0.65) return 'an';
  const c = captions[i];
  const w = Array.isArray(c.words) && c.words.length ? chiSoChu(c.words, t) : -1;
  return `${i}|${w}`;
}

/**
 * Các trạng thái theo thời gian: [{ tu, den, khoa, t }] (giây). Lấy mẫu 1/60 giây — mọi mốc
 * của dữ liệu phụ đề đều cách nhau hơn thế.
 */
function tinhTrangThai(captions) {
  const ds = [];
  if (!captions.length) return ds;
  const het = captions[captions.length - 1].end + 0.7;
  const B = 1 / 60;
  let cu = null;
  for (let k = 0; k * B <= het; k += 1) {
    const t = k * B;
    const kh = khoaTai(captions, t);
    if (!cu || cu.khoa !== kh) {
      if (cu) cu.den = t;
      cu = { tu: t, den: het, khoa: kh, t: t + 1e-3 };
      ds.push(cu);
    }
  }
  return ds;
}

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Vẽ lớp phụ đề ra ảnh. `htmlPath` = trang quay đã có dữ liệu phụ đề (prepareRecordingHtml với
 * subtitleData). Trả { danhSach (ffconcat), x, y, w, h, soAnh } — x/y/w/h theo điểm ảnh video.
 * @param {{ htmlPath: string, width: number, height: number, cssScale?: number, captions: Array,
 *           outDir: string, shouldCancel?: () => boolean }} o
 */
async function vePhuDeLop(o) {
  const { BrowserWindow } = require('electron');
  const tiLe = Number(o.cssScale) > 0 ? Number(o.cssScale) : 1;
  const cssW = Math.round(o.width / tiLe);
  const cssH = Math.round(o.height / tiLe);
  const trangThai = tinhTrangThai(o.captions || []);
  if (!trangThai.some((x) => x.khoa !== 'an')) throw new Error('Không có câu phụ đề nào để vẽ.');
  fs.rmSync(o.outDir, { recursive: true, force: true });
  fs.mkdirSync(o.outDir, { recursive: true });

  const win = new BrowserWindow({
    show: false, width: cssW, height: cssH, frame: false, transparent: true, backgroundColor: '#00000000',
    enableLargerThanScreen: true,
    /* Phiên mạng RIÊNG: `onBeforeRequest` chỉ có MỘT bộ lọc mỗi phiên và không tự gỡ — cài trên
       phiên mặc định là cửa sổ chính mất phông / ảnh gọi ra mạng tới khi tắt app (CONTEXT.md, bẫy
       cửa sổ chụp bìa; audit GĐ3). */
    webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true, sandbox: false, partition: 'phu-de-lop' },
  });
  try {
    win.setContentSize(cssW, cssH);
    const wc = win.webContents;
    /* Như bộ quay: không cho trang gọi mạng (phông đã bundle), VÀ không cho mã deck đọc tệp ngoài thư mục deck
       (main/raoCuaSoAn.js — 24/10/2026). ⚠ Đừng thêm lời gọi onBeforeRequest riêng ở đây: cùng phiên là nó THAY mất rào. */
    require('../main/raoCuaSoAn').rao(wc, { deckDir: path.dirname(path.resolve(o.htmlPath)), chanMang: true });
    wc.setAudioMuted(true);
    wc.setFrameRate(60);   // mỗi trạng thái chờ một lần vẽ — 60 nhanh gấp đôi 30
    let anhCuoi = null;
    let cho = null;
    wc.on('paint', (_e, _d, img) => { anhCuoi = img; if (cho) { const f = cho; cho = null; f(img); } });
    await wc.loadURL(pathToFileURL(o.htmlPath).href);
    await ngu(300);
    /* Chỉ chừa lớp phụ đề: mọi phần tử khác ẨN (visibility không đổi bố cục — lớp phụ đề nằm
       đúng chỗ như lúc quay); nền trong suốt; tắt chuyển động để chụp đúng trạng thái cuối. */
    const ok = await wc.executeJavaScript(`(async () => {
      const s = document.createElement('style');
      s.textContent = 'html,body{background:transparent!important}'
        + 'body *{visibility:hidden!important;transition:none!important;animation:none!important}'
        + '.script-subtitles,.script-subtitles *{visibility:visible!important}';
      document.head.appendChild(s);
      try { await document.fonts.ready; } catch (e) {}
      return typeof window.__renderScriptSubtitlesAt === 'function';
    })()`);
    if (!ok) throw new Error('Trang quay không có bộ vẽ phụ đề.');

    const chup = async (t) => {
      const r = await wc.executeJavaScript(`(async () => {
        window.__renderScriptSubtitlesAt(${Number(t)});
        await new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
        const el = document.querySelector('.script-subtitles');
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return [b.left, b.top, b.width, b.height];
      })()`);
      const img = await new Promise((xong) => {
        cho = xong;
        wc.invalidate();
        setTimeout(() => { if (cho) { cho = null; xong(anhCuoi); } }, 500);
      });
      return { img, r };
    };

    // Vùng cắt: dải ngang quanh lớp phụ đề (đo ở trạng thái đầu tiên có chữ), nới 60% chiều cao
    // mỗi phía cho chữ phóng / dấu thanh / viền — cố định cho mọi ảnh để chồng đúng một chỗ.
    const dau = trangThai.find((x) => x.khoa !== 'an');
    /* Phông CHỈ phụ đề dùng (đậm 950, nghiêng, phông riêng) chỉ bắt đầu nạp khi câu đầu được vẽ —
       vẽ một lần, chờ phông xong rồi mới đo / chụp (audit GĐ3). */
    await chup(dau.t);
    await wc.executeJavaScript('(async () => { try { await document.fonts.ready; } catch (e) {} return 1; })()');
    const d0 = await chup(dau.t);
    if (!d0.img || !d0.r) throw new Error('Không chụp được lớp phụ đề.');
    const kt = d0.img.getSize();
    const doi = kt.width / cssW;            // điểm ảnh bitmap / px CSS
    const chan = (v) => Math.max(2, Math.round(v / 2) * 2);
    const caoCss = Math.max(d0.r[3], 10);
    const y0 = Math.max(0, Math.floor((d0.r[1] - caoCss * 0.6) * doi / 2) * 2);
    const y1 = Math.min(kt.height, Math.ceil((d0.r[1] + caoCss * 1.6) * doi / 2) * 2);
    const vung = { x: 0, y: y0, width: chan(kt.width), height: chan(y1 - y0) };
    if (vung.y + vung.height > kt.height) vung.height = Math.floor((kt.height - vung.y) / 2) * 2;

    const tep = [];
    const daCo = new Map();   // khoá trạng thái → tên ảnh (trạng thái lặp lại thì dùng lại ảnh)
    for (const x of trangThai) {
      if (o.shouldCancel && o.shouldCancel()) throw Object.assign(new Error('Đã dừng.'), { cancelled: true });
      let ten = daCo.get(x.khoa);
      if (!ten) {
        const { img } = await chup(x.khoa === 'an' ? -1 : x.t);
        if (!img) throw new Error('Không chụp được lớp phụ đề.');
        ten = x.khoa === 'an' ? 'trong.png' : `pd-${String(daCo.size).padStart(5, '0')}.png`;
        fs.writeFileSync(path.join(o.outDir, ten), img.crop(vung).toPNG());
        daCo.set(x.khoa, ten);
      }
      tep.push({ ten, dai: Math.max(0.001, x.den - x.tu) });
    }
    if (!daCo.has('an')) {
      const { img } = await chup(-1);
      fs.writeFileSync(path.join(o.outDir, 'trong.png'), img.crop(vung).toPNG());
    }
    // ffconcat: ảnh "trống" phủ từ 0 tới câu đầu; ảnh cuối lặp lại (luật của concat demuxer).
    /* `option framerate 1000`: ảnh qua image2 mặc định có timebase 1/25 — giờ mỗi ảnh bị làm tròn
       về bội 40 ms, trạng thái ngắn mất hẳn (đo bằng ffprobe; audit GĐ3). */
    const dong = ['ffconcat version 1.0'];
    const anh = (ten) => dong.push(`file '${ten}'`, 'option framerate 1000');
    if (trangThai[0].tu > 0) { anh('trong.png'); dong.push(`duration ${trangThai[0].tu.toFixed(4)}`); }
    tep.forEach((x) => { anh(x.ten); dong.push(`duration ${x.dai.toFixed(4)}`); });
    anh('trong.png');
    const danhSach = path.join(o.outDir, 'lop.ffconcat');
    fs.writeFileSync(danhSach, `${dong.join('\n')}\n`, 'utf8');
    // Kích thước theo điểm ảnh VIDEO (bitmap có thể to hơn nếu màn hình Retina không ép được).
    const kx = o.width / kt.width;
    /* Biến phụ đề ĐÃ TÍNH trên trang quay (engine gắn thẳng lên <html> từ thiết lập đã chuẩn hoá,
       style.css của deck có thể đặt --font…) — trình dựng vẽ phụ đề xem trước bằng đúng các số này
       thay vì tự đoán từ preview-settings.json (audit GĐ3). */
    const bien = await wc.executeJavaScript(`(() => {
      const cs = getComputedStyle(document.documentElement);
      const ten = new Set(['--font', '--subtitle-color', '--subtitle-active-color', '--subtitle-active-glow', '--subtitle-font-size',
        '--subtitle-bottom', '--subtitle-top', '--subtitle-max-lines', '--subtitle-flex-wrap', '--subtitle-white-space', '--subtitle-font',
        '--subtitle-weight', '--subtitle-style', '--subtitle-align', '--subtitle-deco', '--subtitle-bg-color', '--subtitle-bg-alpha']);
      for (let i = 0; i < cs.length; i += 1) if (cs[i].startsWith('--subtitle')) ten.add(cs[i]);
      const ra = {};
      ten.forEach((k) => { const v = cs.getPropertyValue(k).trim(); if (v) ra[k] = v; });
      return ra;
    })()`).catch(() => ({}));
    const lop = {
      danhSach, soAnh: daCo.size, bien,
      x: 0, y: Math.round((vung.y * kx) / 2) * 2, w: chan(vung.width * kx), h: chan(vung.height * kx), scale: kx !== 1,
    };
    fs.writeFileSync(path.join(o.outDir, 'lop.json'), JSON.stringify(lop), 'utf8');
    return lop;
  } finally {
    try { win.destroy(); } catch { /* đã đóng */ }
  }
}

/**
 * Chồng lớp phụ đề lên video → tệp mới (libx264, giữ nguyên tiếng).
 * @param {{ ffmpeg: string, video: string, lop: object, ra: string, shouldCancel?: () => boolean }} o
 */
function chongPhuDe(o) {
  const loc = `[1:v]${o.lop.scale ? `scale=${o.lop.w}:${o.lop.h},` : ''}format=yuva444p[pd];`
    + `[0:v][pd]overlay=x=${o.lop.x}:y=${o.lop.y}:eof_action=pass:format=auto,format=yuv420p[v]`;
  const args = ['-y', '-v', 'error', '-nostdin', '-i', o.video, '-f', 'concat', '-safe', '0', '-i', o.lop.danhSach,
    '-filter_complex', loc, '-map', '[v]', '-map', '0:a?', '-c:a', 'copy',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', o.ra];
  return new Promise((xong, hong) => {
    const p = spawn(o.ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let loi = '';
    p.stderr.on('data', (b) => { loi = (loi + b).slice(-3000); });
    const canh = setInterval(() => { if (o.shouldCancel && o.shouldCancel()) { try { p.kill(); } catch { /* bỏ */ } } }, 300);
    p.on('error', (e) => { clearInterval(canh); hong(e); });
    p.on('close', (ma) => {
      clearInterval(canh);
      if (o.shouldCancel && o.shouldCancel()) { hong(Object.assign(new Error('Đã dừng.'), { cancelled: true })); return; }
      if (ma !== 0) { hong(new Error(`Không chồng được phụ đề: ${loi.trim().split(/\r?\n/).slice(-2).join(' · ')}`)); return; }
      xong(o.ra);
    });
  });
}

module.exports = { vePhuDeLop, chongPhuDe, tinhTrangThai, khoaTai 