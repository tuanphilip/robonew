;
'use strict';
/**
 * Port sang JS của auto_render.prepare_recording_html() + build_recording_css()
 * + AUDIO_CAPTURE_SCRIPT.
 *
 * Khác bản Python: BỎ build_display_capture_script() (getDisplayMedia) vì bản
 * desktop lấy frame qua sự kiện `paint` của Electron offscreen.
 * Xem DESKTOP_ARCHITECTURE.md §3.
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const config = require('../config');

/**
 * Thay các thẻ <link> trỏ CDN bằng font đã bundle.
 *
 * [XÁC NHẬN] 86/86 index.html trong source gốc nạp Inter từ fonts.googleapis.com
 * và Font Awesome từ cdnjs.cloudflare.com. Không thay thì render mất chữ đúng
 * font / mất icon khi offline hoặc mạng chậm, và mỗi lần render lại lộ IP người
 * dùng cho Google + Cloudflare.
 */
function rewriteFontLinks(html) {
  const fontsDir = path.join(config.resourcesRoot(), 'fonts');
  const interCss = path.join(fontsDir, 'inter', 'inter.css');
  // PHẢI giữ đúng tầng thư mục chuẩn của Font Awesome: CSS nằm trong css/ và
  // trỏ ../webfonts/. Đặt CSS sai tầng thì chữ vẫn đúng nhưng ICON MẤT SẠCH —
  // hiện ra ô vuông rỗng, và không có lỗi nào báo ra.
  const faCss = path.join(fontsDir, 'fontawesome', 'css', 'all.min.css');

  const replaced = { inter: 0, fontawesome: 0, preconnect: 0 };
  if (!fs.existsSync(interCss) || !fs.existsSync(faCss)) {
    return { html, replaced, available: false };
  }

  const interHref = pathToFileURL(interCss).href;
  const faHref = pathToFileURL(faCss).href;

  // Bỏ preconnect tới Google — không còn tác dụng gì ngoài lộ IP
  html = html.replace(/<link[^>]*rel=["']preconnect["'][^>]*>\s*/gi, (m) => {
    if (/fonts\.(googleapis|gstatic)\.com/i.test(m)) {
      replaced.preconnect += 1;
      return '';
    }
    return m;
  });

  html = html.replace(/<link[^>]*href=["'][^"']*fonts\.googleapis\.com\/css2[^"']*["'][^>]*>/gi, () => {
    replaced.inter += 1;
    return `<link rel="stylesheet" href="${interHref}" />`;
  });

  html = html.replace(/<link[^>]*href=["'][^"']*font-awesome[^"']*\.css[^"']*["'][^>]*>/gi, () => {
    replaced.fontawesome += 1;
    return `<link rel="stylesheet" href="${faHref}" />`;
  });

  return { html, replaced, available: true };
}

/**
 * Trỏ thẻ <script src="...engine.js"> về engine dùng chung của app.
 *
 * Deck sau khi migrate tham chiếu engine bằng đường dẫn tương đối để mở bằng
 * trình duyệt cũng chạy được. Nhưng khi render thì app mới là nơi biết engine
 * nằm ở đâu (khác nhau giữa dev và bản đóng gói), nên phải trỏ lại — cùng cách
 * đã làm với font.
 */
function rewriteEngineSrc(html) {
  const m = /<script[^>]*\ssrc=["']([^"']*\bengine\.js)["'][^>]*>\s*<\/script>/i.exec(html);
  if (!m) return { html, replaced: 0, version: null };

  const version = (/engine[\/\\]([0-9]+\.[0-9]+\.[0-9]+)[\/\\]/.exec(m[1]) || [])[1] || '1.0.0';
  const enginePath = path.join(config.resourcesRoot(), 'engine', version, 'engine.js');
  if (!fs.existsSync(enginePath)) return { html, replaced: 0, version, missing: enginePath };

  const href = pathToFileURL(enginePath).href;
  return {
    html: html.replace(m[0], `<script src="${href}"></script>`),
    replaced: 1,
    version,
  };
}

/* ══ KHUNG SLIDE — hai khổ, không phải một ═════════════════════════════════
 *
 * Bộ ghi ép `.slide-container` về ĐÚNG một khung CSS cố định rồi phóng to bằng
 * `zoom`. Nhờ vậy thiết kế của deck ghim px thoải mái mà vẫn ra đúng mọi độ
 * phân giải — nhưng nó cũng có nghĩa: **khung quyết định TỈ LỆ, không chỉ cỡ**.
 *
 * ⚠ `doc` là hai con số cũ, KHÔNG ĐƯỢC đổi. Toàn bộ 21 mẫu hiện có (4.205 dòng
 * CSS, 1.062 giá trị px ghim cứng) được thiết kế trên đúng khung 390×693 này.
 * Đổi một pixel là lệch hết.
 *
 * `ngang` chọn 1232×693 vì **693 × 16/9 = 1232 chằn** — cùng CHIỀU CAO với khung
 * dọc nên thang chữ/khoảng cách nằm trong khoảng quen thuộc, mà ở 1920×1080 thì
 * zoom khít cả hai chiều (1920/1232 = 1080/693 = 1,55844156), **không viền đen**.
 */
const KHUNG_SLIDE = Object.freeze({
  doc: Object.freeze({ ma: 'doc', w: 390, h: 693, ten: 'dọc 9:16' }),
  ngang: Object.freeze({ ma: 'ngang', w: 1232, h: 693, ten: 'ngang 16:9' }),
});

/* Giữ tên cũ cho mã ngoài còn tham chiếu — trỏ vào khung DỌC, đúng nghĩa trước
   giờ. Mã mới nên dùng `KHUNG_SLIDE`. */
const BASE_SLIDE_WIDTH = KHUNG_SLIDE.doc.w;
const BASE_SLIDE_HEIGHT = KHUNG_SLIDE.doc.h;

/**
 * Deck này thiết kế cho khổ nào — đọc từ chính `index.html` của nó.
 *
 * ⚠ KHÔNG khai gì = DỌC. Mọi deck đã tồn tại đều không có thẻ này, và chúng
 * phải chạy y hệt như trước — đó là điều kiện của cả bước này.
 *
 *     <meta name="bee-khung" content="ngang">
 *
 * Vì sao để trong HTML của deck chứ không phải một nút lúc dựng: khổ video là
 * **thuộc tính của thiết kế**, không phải lựa chọn lúc bấm nút. Đã đo 15/09/2026
 * trên deck dọc thật: ép dựng khổ ngang thì slide vẽ ra 1920×3412 trong khung
 * cao 1080 — **chỉ thấy 31,7 %, mất 2.332px phía dưới**, mà không một lời báo.
 * Để người dùng chọn được con số đó là mời họ tạo ra file hỏng.
 */
/* Nhớ theo MỐC SỬA của `index.html`, không nhớ theo đường dẫn suông.
 *
 * ⚠ CẦN BỘ NHỚ NÀY vì `listProjects()` cũng gọi hàm này, mà nó chạy lại MỖI
 * nhịp watcher — và watcher bắn liên tục lúc AI dựng deck. Đo 15/09/2026 trên
 * thư mục nguồn thật: 57 deck, 1,0 MB `index.html`, **46,3 ms mỗi lượt** nếu
 * đọc lại từ đầu. Dự án đã từng từ chối một phép quét 139 ms đúng vì lý do này
 * (xem chú thích đầu `don-rac.js`).
 *
 * ⚠ KHOÁ PHẢI GỒM CẢ mtime VÀ size: người dùng sửa `index.html` trong Trình sửa
 * là khổ có thể đổi, nhớ theo đường dẫn suông thì app giữ khổ cũ tới lúc khởi
 * động lại. Và KHÔNG đọc tắt vài KB đầu để cho nhanh — thẻ `<meta>` nằm trong
 * `<head>` thật, nhưng deck tự viết có thể nhét bất cứ thứ gì trước nó, và đọc
 * sót thẻ thì lượt dựng bị chặn kèm một câu báo chẳng liên quan. */
const nhoKhung = new Map();

function khungCuaDeck(slideDir) {
  try {
    const f = path.join(slideDir, 'index.html');
    const st = fs.statSync(f);
    const khoa = `${f}|${st.mtimeMs}|${st.size}`;
    const da = nhoKhung.get(khoa);
    if (da) return da;
    let html = fs.readFileSync(f, 'utf8');
    /* ⚠ BỎ CHÚ THÍCH TRƯỚC KHI DÒ. Chính README và mẫu deck đều in thẻ này ra
       làm ví dụ; ai chép nguyên cả dòng ví dụ vào deck dưới dạng chú thích thì
       deck dọc bị nhận nhầm thành ngang, rồi bị cửa chốt chặn kèm một câu báo
       chẳng liên quan gì tới việc họ vừa làm. */
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    const m = /<meta\s[^>]*name=["']bee-khung["'][^>]*content=["']\s*([a-z]+)\s*["'][^>]*>/i.exec(html)
      || /<meta\s[^>]*content=["']\s*([a-z]+)\s*["'][^>]*name=["']bee-khung["'][^>]*>/i.exec(html);
    const ma = m && m[1].toLowerCase();
    const khung = (ma && KHUNG_SLIDE[ma]) || KHUNG_SLIDE.doc;
    /* Nhớ CẢ ca rơi về dọc: deck cũ không có thẻ nào là đa số, mà đó mới đúng
       là nhóm cần tránh đọc lại 57 lần mỗi nhịp watcher. */
    if (nhoKhung.size > 500) nhoKhung.clear();   // chặn phình vô hạn
    nhoKhung.set(khoa, khung);
    return khung;
  } catch { /* không đọc được thì coi như deck cũ */ }
  return KHUNG_SLIDE.doc;
}

/**
 * Khung video có hợp với khổ của deck không — NÉM LỖI nếu không.
 *
 * ⚠ Sai số 5 % là CỐ Ý RỘNG, không phải cẩu thả. Khung dọc 390×693 không đúng
 * 9:16 tuyệt đối (390/693 = 0,56277 so với 0,5625), nên ngay ca hợp lệ nhất đã
 * lệch sẵn. Đo 15/09/2026 trên cả bốn tổ hợp hợp lệ: lệch **0,05 %** (dọc) và
 * **0,00 %** (ngang). Hai ca hỏng lệch **216 %**. Hai nhóm cách nhau hơn bốn
 * nghìn lần — không việc gì phải đi tìm ngưỡng tinh vi.
 */
function kiemKhungHinh(khung, videoWidth, videoHeight) {
  const tiLeDeck = khung.w / khung.h;
  const tiLeVideo = videoWidth / videoHeight;
  const lech = Math.abs(tiLeVideo - tiLeDeck) / tiLeDeck;
  if (lech <= 0.05) return { ok: true, lech };
  const goiY = khung.ma === 'doc' ? '1080x1920 hoặc 720x1280' : '1920x1080 hoặc 1280x720';
  throw new Error(
    `Deck này thiết kế cho khổ ${khung.ten} (${khung.w}×${khung.h}) nhưng đang dựng ở ${videoWidth}×${videoHeight}. `
    + `Lệch tỉ lệ ${(lech * 100).toFixed(0)}% — video ra sẽ bị cắt mất phần lớn hình. `
    + `Dùng ${goiY}, hoặc sửa thẻ <meta name="bee-khung"> trong index.html của deck.`
  );
}

// Nguyên văn từ auto_render.py:139-233 — giữ y hệt để so sánh hành vi.
const AUDIO_CAPTURE_SCRIPT = `
<script>
(() => {
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeAudioContext || window.__slideAudioPatchInstalled) return;

  window.__slideAudioPatchInstalled = true;
  let captureDestination = null;
  let mediaRecorder = null;
  let chunks = [];
  let armed = false;
  let activeAudioContext = null;
  const mediaSources = new WeakMap();
  const retainedMediaSources = [];

  function connectMediaElements(ctx) {
    if (!ctx) return;
    document.querySelectorAll('video, audio').forEach((element) => {
      if (mediaSources.has(element)) return;
      try {
        const source = ctx.createMediaElementSource(element);
        source.connect(ctx.destination);
        mediaSources.set(element, source);
        retainedMediaSources.push(source);
      } catch (err) {}
    });
  }

  const originalConnect = window.AudioNode && window.AudioNode.prototype.connect;
  if (originalConnect) {
    window.AudioNode.prototype.connect = function(destination, ...args) {
      const result = originalConnect.call(this, destination, ...args);
      if (captureDestination && destination && destination.constructor?.name === 'AudioDestinationNode') {
        try { originalConnect.call(this, captureDestination); } catch (err) {}
      }
      return result;
    };
  }

  function startRecorder() {
    if (!captureDestination || mediaRecorder) return;
    chunks = [];
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus' }
      : {};
    mediaRecorder = new MediaRecorder(captureDestination.stream, options);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    mediaRecorder.start(250);
  }

  function PatchedAudioContext(...args) {
    const ctx = new NativeAudioContext(...args);
    activeAudioContext = ctx;
    captureDestination = ctx.createMediaStreamDestination();
    setTimeout(() => connectMediaElements(ctx), 0);
    if (armed) startRecorder();
    return ctx;
  }
  PatchedAudioContext.prototype = NativeAudioContext.prototype;
  Object.setPrototypeOf(PatchedAudioContext, NativeAudioContext);

  window.AudioContext = PatchedAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioContext;

  window.__armSlideAudioRecording = () => {
    armed = true;
    connectMediaElements(activeAudioContext);
    startRecorder();
  };

  window.__connectSlideMediaAudio = () => {
    connectMediaElements(activeAudioContext);
  };

  window.__stopSlideAudioRecording = async () => {
    if (!mediaRecorder) return '';
    if (mediaRecorder.state !== 'inactive') {
      await new Promise((resolve) => {
        mediaRecorder.onstop = resolve;
        mediaRecorder.stop();
      });
    }
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    return btoa(binary);
  };

  // Bổ sung riêng cho POC: thăm dò trạng thái audio graph trong renderer ẩn.
  window.__audioProbe = () => ({
    hasNativeAudioContext: !!NativeAudioContext,
    patched: !!window.__slideAudioPatchInstalled,
    ctxCreated: !!activeAudioContext,
    ctxState: activeAudioContext ? activeAudioContext.state : null,
    sampleRate: activeAudioContext ? activeAudioContext.sampleRate : null,
    currentTime: activeAudioContext ? activeAudioContext.currentTime : null,
    hasCaptureDestination: !!captureDestination,
    recorderState: mediaRecorder ? mediaRecorder.state : null,
    recorderMime: mediaRecorder ? mediaRecorder.mimeType : null,
    chunkCount: chunks.length,
    chunkBytes: chunks.reduce((sum, c) => sum + c.size, 0),
    mediaSourceCount: retainedMediaSources.length,
  });

  // KHẮC PHỤC (phát hiện ở POC-2): khi không có nguồn audio liên tục (ví dụ tắt
  // nhạc nền), MediaRecorder bỏ gói ở những đoạn im lặng -> độ dài bản thu NGẮN
  // HƠN thời gian thực và audio lệch khỏi video. Nối một nguồn im lặng biên độ 0
  // vào capture destination để dòng dữ liệu luôn liên tục.
  window.__enableSilentKeepAlive = () => {
    if (!activeAudioContext || !captureDestination) return 'no-context';
    if (window.__silentKeepAlive) return 'already-on';
    const ctx = activeAudioContext;
    const src = ctx.createConstantSource();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    originalConnect ? originalConnect.call(gain, captureDestination) : gain.connect(captureDestination);
    src.start();
    window.__silentKeepAlive = { src, gain };
    return 'on';
  };

  window.__resumeAudioContext = async () => {
    if (!activeAudioContext) return 'no-context';
    try { await activeAudioContext.resume(); } catch (err) { return 'error:' + err.message; }
    return activeAudioContext.state;
  };
})();
</script>
`;

function buildRecordingCss(videoWidth, videoHeight, khung = KHUNG_SLIDE.doc) {
  /* ⚠ `min` CHỨ KHÔNG phải chia theo chiều rộng.
   *
   * Bản cũ là `videoWidth / BASE_SLIDE_WIDTH` — chỉ nhìn chiều rộng, nên khung
   * video thấp hơn tỉ lệ của deck là slide tràn xuống dưới rồi bị cắt. Đo
   * 15/09/2026: deck dọc dựng ở 1920×1080 ra slide 1920×3412, **mất 2.332px**.
   *
   * ⚠ ĐỔI NÀY KHÔNG ĐỤNG GÌ TỚI ĐƯỜNG DỌC — đã tính ra từng chữ số:
   *     1080×1920 : cũ 2.76923077 · mới 2.76923077
   *      720×1280 : cũ 1.84615385 · mới 1.84615385
   * Y HỆT NHAU, vì ở khổ dọc chiều rộng luôn là cạnh bó trước. Không phải
   * "chắc là ổn" mà là toán. */
  const zoom = Math.min(videoWidth / khung.w, videoHeight / khung.h);
  return `
html, body {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
  scrollbar-width: none !important;
  cursor: none !important;
}
html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }
* { cursor: none !important; }
.side-controls,
.script-panel,
.audio-panel,
.theme-editor-panel { display: none !important; }
/* THANH TIEN DO tren dinh slide - an khoi VIDEO (16/09/2026, chu du an yeu
   cau). No la vach sang chay dan tu slide 1 toi slide cuoi, do engine dung
   KHONG DUNG DAU HUYEN O DAY - khoi nay nam trong template literal.
   chung ve (ham updateProgress dat be rong cua #progressFill); moi deck deu co.
   AN chu khong go: engine van dat style.width cho no moi lan doi slide, go
   khoi DOM la nem loi giua luot quay. Muon bo lenh an nay thi xoa dung mot
   dong - va nho xoa ca dong tuong ung trong previewHtml.js (AN_BANG_CU_CSS),
   khong thi ban xem truoc va video khac nhau. */
.progress-bar { display: none !important; }
.main-wrapper {
  position: static !important;
  top: auto !important; right: auto !important; bottom: auto !important; left: auto !important;
  display: block !important;
  margin: 0 !important; padding: 0 !important;
  transform: none !important;
}
.slide-container {
  position: fixed !important;
  top: 0 !important; left: 0 !important;
  width: ${khung.w}px !important;
  height: ${khung.h}px !important;
  border: 0 !important; border-radius: 0 !important;
  box-shadow: none !important;
  transform: none !important;
  transform-origin: top left !important;
  zoom: ${zoom.toFixed(8)} !important;
}
`;
}

// Nguyên văn SUBTITLE_CSS từ auto_render.py:417-481.
const SUBTITLE_CSS = `
.script-subtitles {
  position: absolute;
  left: 4px !important;
  right: 4px !important;
  /* VI TRI: dat phu de o day (mac dinh) hay o dinh khung. Hai bien chu khong
     mot: top auto + bottom 96px la day, top 96px + bottom auto la dinh - giu
     nguyen cung mot con so khoang cach cho ca hai chieu.
     KHONG DUNG DAU HUYEN VA DAU NGOAC NGUOC O DAY - nam trong template literal. */
  top: var(--subtitle-top, auto);
  bottom: var(--subtitle-bottom, 96px);
  z-index: 180;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: var(--subtitle-align, center);
  padding: 0;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  outline: 0 !important;
  backdrop-filter: none !important;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.script-subtitles.visible { opacity: 1; }
.script-subtitle-line {
  display: inline-flex !important;
  width: auto;
  max-width: none !important;
  max-height: none !important;
  font-family: var(--subtitle-font, var(--font, 'Inter', sans-serif));
  font-size: var(--subtitle-font-size, 15px);
  font-weight: var(--subtitle-weight, 950);
  font-style: var(--subtitle-style, normal);
  text-decoration: var(--subtitle-deco, none);
  text-decoration-thickness: 0.06em;
  text-underline-offset: 0.16em;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-align: center;
  flex-wrap: nowrap !important;
  align-items: center;
  justify-content: center;
  gap: 0.08em 0.24em;
  overflow: visible !important;
  white-space: nowrap !important;
  /* NEN sau chu. Mac dinh --subtitle-bg-alpha 0 nghia la trong suot hoan toan,
     tuc giong het ban truoc khi co khoa nay; dem cung chi moc ra khi co nen,
     chu khong thi moi dong phu de tu day them 10px ma chang de lam gi. */
  padding: var(--subtitle-bg-dem, 0) !important;
  background: color-mix(in srgb,
    var(--subtitle-bg-color, #000000) calc(var(--subtitle-bg-alpha, 0) * 1%),
    transparent) !important;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: var(--subtitle-bg-bo, 0) !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  transform-origin: center center;
}
/* CANH BAO: VIEN CHU dat o WORD chu khong o LINE - mau chu nam o word, ma
   paint-order chi co tac dung tren chinh phan tu ve chu. Be rong mac dinh 0
   tuc tat han, nen deck chua chon vien trong y nhu cu (bong do mem o duoi). */
.script-subtitle-line, .script-subtitle-word {
  paint-order: stroke fill;
  -webkit-text-stroke: var(--subtitle-outline-w, 0) var(--subtitle-outline, #000000);
}
.script-subtitle-word {
  flex: 0 0 auto;
  color: var(--subtitle-color, #ffffff);
  background: transparent !important;
  box-shadow: none !important;
  transition: color 0.06s linear, opacity 0.06s linear, text-shadow 0.06s linear;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
.script-subtitle-word.past { color: var(--subtitle-color, #ffffff); }
.script-subtitle-word.active {
  color: var(--subtitle-active-color, #ff4d4f);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
`;

// Nguyên văn SUBTITLE_SCRIPT từ auto_render.py:483-615.
const SUBTITLE_SCRIPT = `
(() => {
  const data = window.__SCRIPT_SUBTITLE_DATA__;
  if (!data || !Array.isArray(data.captions) || data.captions.length === 0) return;
  let overlay = null, line = null, startedAt = 0, raf = null;
  let lastCaptionIndex = -1, lastActiveWordIndex = -2;

  function ensureOverlay() {
    if (overlay) return overlay;
    const container = document.getElementById('slideContainer') || document.body;
    overlay = document.createElement('div');
    overlay.className = 'script-subtitles';
    line = document.createElement('div');
    line.className = 'script-subtitle-line';
    overlay.appendChild(line);
    container.appendChild(overlay);
    return overlay;
  }
  function subtitleMaxLines() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--subtitle-max-lines').trim();
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 2;
  }
  function fitSubtitleLine() {
    if (!line) return;
    line.style.transform = '';
    line.style.transformOrigin = 'center center';
    if (subtitleMaxLines() > 1) return;
    const overlayRect = overlay?.getBoundingClientRect();
    const availableWidth = Math.max(0, (overlayRect?.width || line.parentElement?.getBoundingClientRect().width || 0) - 10);
    if (!availableWidth) return;
    const range = document.createRange();
    range.selectNodeContents(line);
    const measuredWidth = Math.max(line.scrollWidth || 0, range.getBoundingClientRect().width || 0);
    if (!availableWidth || !measuredWidth || measuredWidth <= availableWidth) return;
    line.style.transform = 'scale(' + Math.min(1, (availableWidth / measuredWidth) * 0.98) + ')';
  }
  function findCaptionIndex(time) {
    const captions = data.captions;
    let candidate = -1;
    for (let i = 0; i < captions.length; i += 1) {
      const c = captions[i];
      if (time >= c.start && time <= c.end + 0.18) return i;
      if (c.start <= time) candidate = i;
      if (c.start > time) break;
    }
    return candidate;
  }
  function findActiveWordIndex(words, time) {
    let candidate = -1;
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i];
      if (time >= w.start && time <= w.end + 0.08) return i;
      if (w.start <= time) candidate = i;
      if (w.start > time) break;
    }
    return candidate;
  }
  function renderWords(caption, activeWordIndex) {
    line.replaceChildren();
    caption.words.forEach((word, idx) => {
      const span = document.createElement('span');
      span.className = 'script-subtitle-word';
      if (idx < activeWordIndex) span.classList.add('past');
      else if (idx === activeWordIndex) span.classList.add('active');
      span.textContent = word.text;
      line.appendChild(span);
    });
    fitSubtitleLine();
  }
  function render(time) {
    ensureOverlay();
    const captions = data.captions;
    const idx = findCaptionIndex(time);
    if (idx < 0 || time > captions[captions.length - 1].end + 0.65) {
      overlay.classList.remove('visible');
      line.replaceChildren();
      lastCaptionIndex = -1; lastActiveWordIndex = -2;
      return;
    }
    const caption = captions[idx];
    const hasWords = Array.isArray(caption.words) && caption.words.length > 0;
    const activeWordIndex = hasWords ? findActiveWordIndex(caption.words, time) : -1;
    if (idx !== lastCaptionIndex || activeWordIndex !== lastActiveWordIndex) {
      if (hasWords) renderWords(caption, activeWordIndex);
      else { line.textContent = caption.text; fitSubtitleLine(); }
      lastCaptionIndex = idx; lastActiveWordIndex = activeWordIndex;
    }
    overlay.classList.add('visible');
  }
  function loop() {
    render((performance.now() - startedAt) / 1000);
    raf = requestAnimationFrame(loop);
  }
  window.__startScriptSubtitles = () => {
    startedAt = performance.now();
    ensureOverlay();
    if (raf) cancelAnimationFrame(raf);
    loop();
  };
  window.__stopScriptSubtitles = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (overlay) overlay.classList.remove('visible');
  };
  /* Ve DUNG trang thai tai giay t (khong chay dong ho) - phuDeLop.js chup tung trang thai
     thanh anh PNG de chong len video sau (phu de tach lop, Giai doan 3). */
  window.__renderScriptSubtitlesAt = (time) => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    render(time);
  };
})();
`;

/** Port của auto_render.theme_css_from_settings() — lọc kỹ để chống chèn CSS độc. */
function themeCssFromSettings(settings) {
  const vars = settings?.theme?.variables;
  if (!vars || typeof vars !== 'object') return '';
  const lines = [];
  for (const [name, value] of Object.entries(vars)) {
    if (typeof name !== 'string' || typeof value !== 'string') continue;
    if (!/^--[A-Za-z0-9_-]+$/.test(name)) continue;
    if (/[;{}<>]/.test(value) || value.length > 80) continue;
    lines.push(`  ${name}: ${value};`);
  }
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '';
}

function hexToRgba(hex, alpha) {
  const v = hex.replace('#', '');
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`;
}

/** Port của auto_render.subtitle_css_from_settings(). */
function subtitleCssFromSettings(settings) {
  const s = settings?.subtitles;
  if (!s || typeof s !== 'object') return '';
  const lines = [];
  const hex = /^#[0-9a-fA-F]{6}$/;
  if (typeof s.color === 'string' && hex.test(s.color)) lines.push(`  --subtitle-color: ${s.color};`);
  let active = typeof s.activeColor === 'string' && hex.test(s.activeColor) ? s.activeColor : s.color;
  if (typeof active === 'string' && hex.test(active)) {
    lines.push(`  --subtitle-active-color: ${active};`);
    lines.push(`  --subtitle-active-glow: ${hexToRgba(active, 0.34)};`);
  }
  /* PHÔNG CHỮ phụ đề. Lọc kỹ y như mọi giá trị khác ở đây — chuỗi này đi
     thẳng vào một khối <style>, lọt dấu `;` hay `{` là chèn được CSS lạ.
     Chỉ cho chữ, số, khoảng trắng, dấu nháy, phẩy và gạch nối. */
  const font = typeof s.fontFamily === 'string' ? s.fontFamily.trim() : '';
  if (font && font.length <= 60 && /^[A-Za-z0-9 ,'"-]+$/.test(font)) {
    lines.push(`  --subtitle-font: ${font};`);
  }
  /* ĐẬM · NGHIÊNG · CĂN LỀ. Ba khoá này KHÔNG có trong engine — chúng chỉ là
     biến CSS mà bảng sửa ghi vào `preview-settings.json`, đường xem trước và
     đường dựng video cùng đọc. Giá trị đóng kín trong bảng dưới đây, không
     nhận chuỗi tự do: đây là nội dung đi thẳng vào một khối <style>. */
  if (s.bold === true) lines.push('  --subtitle-weight: 950;');
  else if (s.bold === false) lines.push('  --subtitle-weight: 500;');
  if (s.italic === true) lines.push('  --subtitle-style: italic;');
  const CAN = { trai: 'flex-start', giua: 'center', phai: 'flex-end' };
  if (typeof s.align === 'string' && CAN[s.align]) lines.push(`  --subtitle-align: ${CAN[s.align]};`);
  const fs = Number(s.fontSize);
  if (fs >= 12 && fs <= 28) lines.push(`  --subtitle-font-size: ${fs}px;`);
  const bottom = Number(s.bottom);
  if (bottom >= 40 && bottom <= 180) {
    /* `position: 'tren'` ⇒ đổi chiều neo: khoảng cách tính từ ĐỈNH. Vẫn dùng
       đúng con số đó, người dùng không phải nhập lại khi lật vị trí. */
    if (s.position === 'tren') {
      lines.push(`  --subtitle-top: ${bottom}px;`);
      lines.push('  --subtitle-bottom: auto;');
    } else {
      lines.push(`  --subtitle-bottom: ${bottom}px;`);
    }
  }
  if (s.underline === true) lines.push('  --subtitle-deco: underline;');
  /* VIỀN CHỮ. Chỉ phát khi người dùng ĐÃ CHỌN một màu — không có khoá thì bề
     rộng giữ 0 và phụ đề trông y như trước, không tự dưng viền đen dày lên ở
     58 deck cũ. */
  const vien = typeof s.outlineColor === 'string' ? s.outlineColor.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(vien)) {
    lines.push(`  --subtitle-outline: ${vien};`);
    lines.push('  --subtitle-outline-w: 0.045em;');
  }
  /* NỀN. Độ mờ 0 là không nền — khi đó khỏi phát màu lẫn đệm cho gọn. */
  const doMo = Math.round(Number(s.bgOpacity));
  if (doMo >= 1 && doMo <= 100) {
    const nen = typeof s.bgColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.bgColor.trim())
      ? s.bgColor.trim() : '#000000';
    lines.push(`  --subtitle-bg-color: ${nen};`);
    lines.push(`  --subtitle-bg-alpha: ${doMo};`);
    lines.push('  --subtitle-bg-dem: 0.12em 0.5em;');
    lines.push('  --subtitle-bg-bo: 0.25em;');
  }
  const maxLines = Math.round(Number(s.maxLines));
  if (maxLines >= 1 && maxLines <= 3) {
    lines.push(`  --subtitle-max-lines: ${maxLines};`);
    if (maxLines <= 1) {
      lines.push('  --subtitle-flex-wrap: nowrap;');
      lines.push('  --subtitle-white-space: nowrap;');
    }
  }
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '';
}

/** Đánh dấu mốc thời gian first-paint để đo trễ khởi động. */
const PROBE_SCRIPT = `
<script>
window.__pocMarks = { htmlStart: performance.now() };
document.addEventListener('DOMContentLoaded', () => { window.__pocMarks.domReady = performance.now(); });
window.addEventListener('load', () => { window.__pocMarks.load = performance.now(); });
window.__pocGetMarks = () => window.__pocMarks;
</script>
`;

/**
 * @param {string} slideDir thư mục project (chứa index.html)
 * @param {object} opts { videoWidth, videoHeight, outName }
 * @returns {string} đường dẫn file HTML đã dựng
 */
function prepareRecordingHtml(slideDir, opts = {}) {
  const videoWidth = opts.videoWidth || 1080;
  const videoHeight = opts.videoHeight || 1920;
  const outName = opts.outName || '_poc_recording.html';
  /* Khổ do chính deck khai (xem `khungCuaDeck`). Cho ép qua `opts.khung` để
     chạy thử mà không phải sửa file deck. */
  const khung = opts.khung || khungCuaDeck(slideDir);

  const htmlPath = path.join(slideDir, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Font offline: làm NGAY sau khi đọc file, trước mọi thao tác inject khác,
  // để regex không đụng phải các thẻ <link>/<style> do ta tự thêm vào.
  const fontResult = rewriteFontLinks(html);
  html = fontResult.html;
  if (opts.onFontRewrite) opts.onFontRewrite(fontResult);

  // Engine dùng chung (deck đã migrate). Deck chưa migrate không có thẻ này ->
  // replaced = 0, app.js cũ vẫn chạy như trước. Đây chính là shim tương thích.
  const engineResult = rewriteEngineSrc(html);
  html = engineResult.html;
  if (opts.onEngineRewrite) opts.onEngineRewrite(engineResult);

  let previewSettings = {};
  const settingsPath = path.join(slideDir, 'preview-settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      previewSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      previewSettings = {};
    }
  }
  if (opts.previewSettingsOverride) {
    previewSettings = { ...previewSettings, ...opts.previewSettingsOverride };
  }

  // Hiệu ứng video — CHUNG với đường xem trước (src/render/videoFx.js).
  // Phải chèn ở CẢ HAI đường, nếu không thì xem trước thấy hiệu ứng mà mở file
  // MP4 ra không có gì.
  {
    const { themVideoFx } = require('./videoFx');
    html = themVideoFx(html, previewSettings && previewSettings.videoFx);
  }

  const settingsPayload = JSON.stringify(previewSettings).replace(/<\//g, '<\\/');

  html = html.replace(
    '</head>',
    `<script>window.__RENDER_MODE__ = true; window.__PREVIEW_SETTINGS__ = ${settingsPayload};</script>\n</head>`
  );
  html = html.replace('</head>', `${PROBE_SCRIPT}\n</head>`);
  html = html.replace('</head>', `${AUDIO_CAPTURE_SCRIPT}\n</head>`);
  html = html.replace(
    '</head>',
    `<style>${buildRecordingCss(videoWidth, videoHeight, khung)}</style>\n</head>`
  );

  // Theme + subtitle CSS lấy từ preview-settings.json (như auto_render.py:1359-1365)
  const settingsCss = [themeCssFromSettings(previewSettings), subtitleCssFromSettings(previewSettings)]
    .filter(Boolean)
    .join('\n');
  if (settingsCss) html = html.replace('</head>', `<style>${settingsCss}</style>\n</head>`);

  // Phụ đề karaoke: dữ liệu do sidecar Python dựng bằng Whisper word-timestamps
  if (opts.subtitleData) {
    const payload = JSON.stringify(opts.subtitleData).replace(/<\//g, '<\\/');
    html = html.replace('</head>', `<style>${SUBTITLE_CSS}</style>\n</head>`);
    html = html.replace(
      '</body>',
      `<script>window.__SCRIPT_SUBTITLE_DATA__ = ${payload};</script>\n<script>${SUBTITLE_SCRIPT}</script>\n</body>`
    );
  }

  if (opts.extraHeadHtml) html = html.replace('</head>', `${opts.extraHeadHtml}\n</head>`);
  if (opts.extraBodyHtml) html = html.replace('</body>', `${opts.extraBodyHtml}\n</body>`);

  // Ghi cạnh index.html để đường dẫn tương đối (app.js, style.css, image.png,
  // preview-assets/) hoạt động mà không cần thẻ <base>.
  const outPath = path.join(slideDir, outName);
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

module.exports = {
  prepareRecordingHtml,
  subtitleCssFromSettings,
  themeCssFromSettings,
  SUBTITLE_CSS,
  rewriteFontLinks,
  rewriteEngineSrc,
  buildRecordingCss,
  KHUNG_SLIDE,
  khungCuaDeck,
  kiemKhungHinh,
  themeCssFromSettings,
  subtitleCssFromSettings,
  AUDIO_CAPTURE_SCRIPT,
  SUBTITLE_CSS,
  SUBTITLE_SCRIPT,
  BASE_SLIDE_WIDTH,
  BASE_SLIDE_HEIGHT,
}