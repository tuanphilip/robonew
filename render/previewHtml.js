;
'use strict';
/**
 * Dựng bản HTML XEM TRƯỚC của một deck để mở ngay trong app.
 *
 * Vì sao phải dựng chứ không mở thẳng `index.html`:
 *
 * 1. **Engine.** Deck đã migrate trỏ `<script src="bee-engine/1.0.0/engine.js">`
 *    — token cố định do APP phân giải, không phải đường dẫn thật (cạm bẫy #17).
 *    Mở file gốc bằng file:// thì engine không nạp, slide đứng im.
 * 2. **Font.** CSS Font Awesome trỏ `../webfonts/`; không trỏ lại vào bộ font
 *    offline thì chữ vẫn đúng nhưng **mất sạch icon**, và không báo lỗi gì
 *    (cạm bẫy #16).
 *
 * Dùng LẠI đúng hai hàm mà đường render đang dùng, không viết lại — nếu viết
 * lại thì đường xem trước và đường render sẽ lệch nhau, đúng cái mẫu lỗi đã
 * lặp 4 lần trong dự án này.
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { rewriteFontLinks, rewriteEngineSrc } = require('./recordingHtml');

const PREVIEW_FILE = '_preview.html';

/* CSS và script của bảng Preview Editor nằm ở editor/editor.{css,js} (audit
   Phase 4.6, 02/09/2026) — trước đây là hai template literal 640 + 830 dòng
   trong file này, sửa một dòng CSS là phải dò backtick (verify:tpl). Đọc một
   lần lúc nạp module; trong asar fs.readFileSync vẫn đọc được. Nội dung tệp
   là GIÁ TRỊ chuỗi cũ, byte nào ra byte nấy (đã so _preview.html trước/sau). */
const docEditor = (ten) => fs.readFileSync(path.join(__dirname, 'editor', ten), 'utf8');

/* Đại diện của app TRONG khung (khung ở origin riêng `bee-deck://` — src/main/khungDeck.js):
   gửi trạng thái lên, nhận lệnh cố định. Xem editor/khung-cau.js. */
const KHUNG_CAU = '<script>' + String.fromCharCode(10) + docEditor('khung-cau.js') + '</' + 'script>';

/**
 * Bộ icon DÙNG CHUNG với giao diện app.
 *
 * Trang xem trước là một tài liệu riêng nạp trong iframe, nên nó KHÔNG thấy
 * `window.__beeIcons` mà `index.html` của app dựng. Nhưng đó không phải lý
 * do để chép một bộ icon thứ hai vào `editor.js`: hai bộ là hai chỗ phải sửa,
 * và sớm muộn cũng lệch nét nhau. Bơm CHÍNH tệp `icons.js` vào đây — một
 * nguồn, hai nơi dùng.
 *
 * An toàn với nội dung deck: `icons.js` chỉ thay ruột của phần tử mang
 * `data-icon`, mà deck lẫn `engine.js` đều không dùng thuộc tính đó (đã đếm).
 */
const BO_ICON = `<script>
${fs.readFileSync(path.join(__dirname, '..', 'ui-classic', 'icons.js'), 'utf8')}</script>`;

/**
 * Cho bảng Preview Editor đổi tông theo theme của app.
 *
 * ⚠ RANH GIỚI QUAN TRỌNG — chỉ đụng `.theme-editor-*`, TUYỆT ĐỐI không đụng
 * khung slide (`.container`, `.slide`, `.tone-*` của nội dung):
 *
 *   - Bảng editor là giao diện SỬA. Nó không xuất hiện trong video.
 *   - Khung slide 9:16 là HÌNH ẢNH CỦA VIDEO. Nút "Dark" trong TONE MÀU chính
 *     là màu nền của file MP4 xuất ra. Đổi nó theo theme app nghĩa là mở app ở
 *     nền sáng thì render ra video nền sáng — hỏng hoàn toàn.
 *
 * Chèn ở ĐÂY chứ không sửa `engine.js`: engine dùng chung cho 61 deck và nằm
 * trên đường render. `_preview.html` chỉ dùng để xem trong app, sửa ở đây thì
 * không có cách nào chạm tới video.
 *
 * Lớp `bee-light` do đoạn script bên dưới đặt, đọc từ `?theme=` mà
 * `slide-viewer.js` gắn vào URL của iframe.
 */
const EDITOR_LIGHT_CSS = `<style>
${docEditor('editor.css')}</style>`;

/**
 * Sắp xếp lại vài chỗ trong Preview Editor.
 *
 * Phải làm bằng JS chứ không phải CSS: đây là DI CHUYỂN phần tử sang chỗ khác
 * trong cây DOM, không phải đổi kiểu hiển thị.
 *
 * Chạy ở đây thay vì sửa `app.js` của deck: `setupThemeEditor()` nằm trong
 * engine dùng chung cho 61 deck và nằm trên đường render. `_preview.html` chỉ
 * để xem trong app nên sửa ở đây không có cách nào chạm tới video.
 *
 * Đợi bằng MutationObserver: bảng editor do `init()` dựng sau khi trang nạp
 * xong, không có sự kiện nào báo. Đặt hạn 10 giây rồi bỏ — deck ở chế độ render
 * không dựng bảng này, treo observer mãi thì rò bộ nhớ.
 */
const EDITOR_LAYOUT_SCRIPT = `<script>
${docEditor('editor.js')}</script>`;

/**
 * ẨN bảng Preview Editor cũ nằm TRONG khung deck.
 *
 * Từ 15/09/2026 bảng sửa nằm ở CỬA SỔ APP (`ui-classic/render/bang-sua.js`),
 * còn khung này chỉ còn là hình ảnh của video. Hai bảng cùng hiện là hai chỗ
 * sửa một tệp `preview-settings.json`, ghi đè lẫn nhau.
 *
 * ⚠ **`display: none` chứ KHÔNG gỡ khỏi DOM, và VẪN bơm `editor.js`.** Bảng
 * mới đọc danh sách lựa chọn THẲNG từ các `<select>` của engine trong khung
 * này (`backgroundFxSelect`, `transitionSelect`…) để engine thêm hiệu ứng mới
 * là bảng tự có. Hơn nữa nhãn tiếng Việt ("Particles — hạt bay") do chính
 * `editor.js` dịch lúc chạy — bỏ nó đi là bảng mới hiện nhãn tiếng Anh.
 * Đọc `<select>.options` của phần tử đang `display:none` vẫn ra đủ.
 *
 * `.side-controls` của deck (loa, tông, xoá slide) thì GIỮ: app chưa có nút
 * thay thế cho chúng, ẩn đi là mất chức năng chứ không phải dọn giao diện.
 */
const AN_BANG_CU_CSS = `<style>
.theme-editor-panel { display: none !important; }
/* ⚠ ENGINE CĂN GIỮA THEO BỀ NGANG CÒN LẠI SAU BẢNG SỬA.
   .main-wrapper là position:fixed và engine TỰ TÍNH rồi đặt left — đo được
   left 262.7px trong một khung rộng 635px, tức nó vẫn chừa chỗ cho bảng sửa
   mà ta vừa ẩn. Kết quả: deck nằm lệch hẳn sang phải.
   Ép về giữa bằng left/right 0 + lề tự động. KHÔNG đụng transform: engine
   dùng nó để căn theo chiều dọc (đo được translateY -314px).
   ⚠ TUYỆT ĐỐI KHÔNG dùng dấu huyền trong khối này — nó nằm TRONG một template
   literal, một dấu là đứt chuỗi và cả tệp sai cú pháp (đã dính 15/09/2026). */
.main-wrapper {
  left: 0 !important; right: 0 !important;
  margin-left: auto !important; margin-right: auto !important;
  /* Wrapper nay trai rong het khung, ma no la flex voi justify-content mac
     dinh (flex-start) nen slide-container nam sat trai. Do duoc: le trai 0px,
     le phai 282px. */
  justify-content: center !important;
}
/* Nền trang trong suốt: sân khấu bên app không tô nền, nên nền trắng của body
   vẽ ra một mảng sáng quanh deck — mà nền của deck mới là hình ảnh của video,
   đặt cạnh một mảng màu lạ chỉ làm mắt so sánh nhầm. */
html, body { background: transparent !important; }
/* Bo nut rieng cua deck (tong mau, loa, mui ten, so slide): tu 15/09/2026
   khung deck duoc ep sat mep khung slide nen chung nam DE LEN hinh, ma hinh
   do chinh la hinh cua video. App da co du: tong mau o bang phai, dieu huong
   o dai slide duoi day, tat tieng o thanh san khau (nut do bam vao chinh
   #muteBtn ben trong day - xem san-khau.js). */
.side-controls { display: none !important; }
/* Thanh tien do tren dinh slide: an, KHOP voi duong dung video (xem
   recordingHtml.js). Hai ban phai giong nhau, khong thi xem truoc mot dang
   video mot dang. */
.progress-bar { display: none !important; }
/* PHONG CHU PHU DE. Bien --subtitle-font do bang sua dat thang len :root cua
   tai lieu deck (xem bang-sua.js), va duong dung video dat cung ten bien
   (recordingHtml.js) - hai ban phai khop, khong thi xem truoc mot dang video
   mot neo. Rong thi roi ve --font cua deck nhu cu. */
.script-subtitle-line {
  font-family: var(--subtitle-font, var(--font, 'Inter', sans-serif)) !important;
  font-weight: var(--subtitle-weight, 950) !important;
  font-style: var(--subtitle-style, normal) !important;
  text-decoration: var(--subtitle-deco, none) !important;
  text-decoration-thickness: 0.06em;
  text-underline-offset: 0.16em;
  /* NEN sau chu. Mac dinh --subtitle-bg-alpha 0 tuc trong suot hoan toan, nen
     deck chua bat nen trong y nhu cu. */
  padding: var(--subtitle-bg-dem, 0) !important;
  border-radius: var(--subtitle-bg-bo, 0) !important;
  background: color-mix(in srgb,
    var(--subtitle-bg-color, #000000) calc(var(--subtitle-bg-alpha, 0) * 1%),
    transparent) !important;
}
/* VIEN CHU. Be rong mac dinh 0 tuc tat han. Dat o CA line lan word: mau chu nam
   o word, ma paint-order chi an tren chinh phan tu ve chu. */
.script-subtitle-line, .script-subtitle-word {
  paint-order: stroke fill;
  -webkit-text-stroke: var(--subtitle-outline-w, 0) var(--subtitle-outline, #000000) !important;
}
/* VI TRI tren/duoi khung. Phai co !important VA phai dung ca hai bien: style.css
   cua deck tu dat bottom cho .script-subtitles, con engine thi dat
   --subtitle-bottom noi tuyen moi lan ap thiet lap. */
.script-subtitles {
  justify-content: var(--subtitle-align, center) !important;
  top: var(--subtitle-top, auto) !important;
  bottom: var(--subtitle-bottom, 96px) !important;
}
</style>`;

/** Đặt lớp theme từ `?theme=` trên URL của iframe. */
const EDITOR_THEME_SCRIPT = `<script>
(function () {
  try {
    var t = new URLSearchParams(location.search).get('theme');
    if (t === 'light') document.documentElement.classList.add('bee-light');
  } catch (e) { /* mở trực tiếp, không có query — cứ để tông tối */ }
})();
</script>`;

/**
 * Cầu nối `/api/*` cho trang deck chạy trong iframe.
 *
 * Preview Editor bên trong deck gọi `/api/preview-settings`, `/api/slide-script`,
 * `/api/preview-bgm` — vốn là endpoint của `web_server.py`. Trong app không có
 * server, `api-shim.js` gánh việc đó, NHƯNG nó cần `window.beeknoee` do preload
 * bơm vào, mà **preload chỉ chạy ở khung chính, không chạy trong iframe**
 * (muốn có thì phải bật `nodeIntegrationInSubFrames`, tức mở quyền Node cho mọi
 * khung con — cái giá quá đắt cho ba endpoint).
 *
 * Nên iframe chỉ chuyển tiếp: gói `{url, init}` gửi lên khung cha bằng
 * postMessage, khung cha gọi `fetch` (đã bị api-shim vá sẵn) rồi gửi kết quả về.
 * Quyền hạn không đổi — iframe vẫn không chạm được vào Node hay IPC.
 *
 * Chỉ chuyển tiếp đường dẫn bắt đầu bằng `/api/`; mọi thứ khác đi `fetch` gốc.
 */
/**
 * localStorage/sessionStorage GIẢ cho khung xem trước.
 *
 * ⚠ HIỆN TẠI ĐÂY LÀ LƯỚI AN TOÀN, KHÔNG PHẢI THỨ ĐANG CẦN. Khung xem trước chạy
 * `file://` bình thường nên `localStorage` dùng được, và hàm `conDung()` bên
 * dưới tự nhận ra điều đó rồi KHÔNG thay gì cả.
 *
 * Giữ lại vì nếu sau này khung xem trước được đổi sang origin riêng (protocol
 * tự đăng ký — xem nợ kỹ thuật §5) thì storage có thể bị chặn, mà code sẵn có
 * của deck gọi thẳng `localStorage.setItem(...)` không bọc try/catch: nổ ở đó
 * là đứt luôn cả hàm lưu của bảng Preview Editor.
 *
 * KHÔNG mất dữ liệu gì: deck chạy file:// vốn đã rơi vào nhánh ghi localStorage
 * — một ngõ cụt, file trên đĩa không hề đổi. Việc lưu THẬT đi qua /api (xem
 * "Tự lưu script XUỐNG FILE" ở dưới). Bản giả này chỉ để code cũ chạy êm trong
 * một phiên; đóng khung là mất, đúng như trước đây nó vốn vô dụng.
 */
/**
 * Thay localStorage của trang xem trước bằng một KHO RIÊNG, nạp sẵn từ chính
 * `preview-settings.json` của deck.
 *
 * ⚠ HAI LỖI CÓ SẴN CỦA ENGINE mà cái này chữa (đo 15/09/2026):
 *
 * 1. **Engine không bao giờ đọc tệp.** `loadPreviewSettings()` đọc localStorage
 *    trước, rồi gặp cửa chốt
 *        if (!project || !window.location.protocol.startsWith('http')) return;
 *    Khung chạy `file://` nên nó QUAY RA LUÔN, không bao giờ gọi `/api`. Tức
 *    bản trên đĩa và bản engine đang vẽ có thể khác hẳn nhau.
 * 2. **Khoá kho của engine ĐỔI THEO ĐƯỜNG DẪN.** `settingsStorageKey()` là
 *    `preview-settings:` + (`projectNameFromPath()` || `'local'`), mà hàm đó dò
 *    `/slide/<tên>` trong `location.pathname`.
 *
 *    ⚠ ĐỪNG TIN rằng đường `file://` không khớp được đoạn đó — ĐO 16/09/2026:
 *    thư mục nguồn thật của chủ dự án là `D:\8.Bee Video\Beeknoee Studio\slide`,
 *    nên `file:///D:/.../slide/camoufox-.../_preview.html` KHỚP, và khoá thành
 *    `preview-settings:camoufox-...` chứ không phải `preview-settings:local`.
 *    Kho tạm chỉ nạp sẵn đúng một khoá `:local` ⇒ engine không thấy gì, rơi về
 *    `defaultPreviewSettings` NẰM TRONG `app.js` CỦA CHÍNH DECK (bottom 148/152)
 *    — đúng cái lỗi "để 100px, tắt đi bật lại phụ đề vẫn nằm ở 152px, đụng vào
 *    thanh kéo mới nhảy xuống". Đo được: `--subtitle-bottom` = 148px trong khi
 *    trên đĩa là 100.
 *
 *    Nên `getItem` TRẢ BẢN NẠP SẴN CHO MỌI KHOÁ `preview-settings:*` chưa ai
 *    ghi, thay vì gài cứng một khoá. Deck nằm ở đâu, tên gì, cũng đọc ra đúng
 *    thứ trên đĩa.
 *
 *    (Mặt trái cũ — mọi deck chung một khoá nên màu deck này lẫn sang deck kia
 *    và sống qua cả lần mở app sau — kho riêng theo từng lần dựng trang đã chữa,
 *    xem đoạn dưới.)
 *
 * Kho riêng theo từng lần dựng trang nên hết lẫn; nạp sẵn từ tệp nên engine
 * luôn khởi động ĐÚNG bằng thứ nằm trên đĩa. Việc ghi xuống đĩa thì bảng sửa
 * bên app lo (xem `ui-classic/render/deck-cau.js`).
 *
 * KHÔNG sửa `engine.js`: nó dùng chung cho 61 deck và nằm trên ĐƯỜNG RENDER.
 */
/** Đọc `preview-settings.json` của deck; thiếu hoặc hỏng thì trả object rỗng. */
function docThietLapDeck(slideDir) {
  try {
    const f = path.join(slideDir, 'preview-settings.json');
    if (!fs.existsSync(f)) return {};
    return JSON.parse(fs.readFileSync(f, 'utf8')) || {};
  } catch { return {}; }
}

function storageShim(thietLap) {
  /* ⚠ Phải là '<' + HAI dấu gạch ngược + '/' trong mã nguồn, tức MỘT dấu gạch
     ngược trong chuỗi ra. Viết một dấu thì chuỗi ra chỉ là '</' — phép thoát
     không làm gì, và một chuỗi '</script>' trong thiết lập sẽ đóng thẻ sớm. */
  const goi = JSON.stringify(JSON.stringify(thietLap || {})).replace(/<\//g, '<\\/');
  return `<script>
(function () {
  var nap = ${goi};
  function kho(hat) {
    var m = Object.create(null);
    if (hat) { m['preview-settings:local'] = hat; }
    return {
      getItem: function (k) {
        k = String(k);
        if (k in m) return m[k];
        /* Khoa thiet lap CHUA AI GHI -> tra ban nap san, bat ke duoi khoa la gi
           (':local' hay ':<ten deck>'). Xem chu thich muc 2 ben tren. */
        if (hat && k.lastIndexOf('preview-settings:', 0) === 0) return hat;
        return null;
      },
      setItem: function (k, v) { m[String(k)] = String(v); },
      removeItem: function (k) { delete m[String(k)]; },
      clear: function () { m = Object.create(null); },
      key: function (i) { var ks = Object.keys(m); return i < ks.length ? ks[i] : null; },
      get length() { return Object.keys(m).length; }
    };
  }
  try { Object.defineProperty(window, 'localStorage', { value: kho(nap), configurable: true }); }
  catch (e) { /* trình duyệt không cho ghi đè thì đành chịu */ }
  try { Object.defineProperty(window, 'sessionStorage', { value: kho(null), configurable: true }); }
  catch (e) { /* như trên */ }
})();
</` + `script>`;
}

const API_BRIDGE = `<script>
(function () {
  if (window.parent === window) return;   // mở trực tiếp, không có cha để hỏi
  var seq = 0;
  var waiting = new Map();
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__beeApi !== 'res') return;
    var w = waiting.get(d.id);
    if (!w) return;
    waiting.delete(d.id);
    w(new Response(d.body, {
      status: d.status,
      headers: { 'Content-Type': d.type || 'application/json; charset=utf-8' }
    }));
  });
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/') !== 0) return nativeFetch(input, init);
    var id = ++seq;
    return new Promise(function (resolve, reject) {
      waiting.set(id, resolve);
      // Chỉ gửi phần tuần tự hoá được: Headers/AbortSignal không qua được
      // postMessage và ba endpoint này cũng không cần tới.
      var i = init || {};
      window.parent.postMessage({
        __beeApi: 'req',
        id: id,
        url: url,
        init: { method: i.method || 'GET', body: typeof i.body === 'string' ? i.body : null }
      }, '*');
      setTimeout(function () {
        if (!waiting.has(id)) return;
        waiting.delete(id);
        reject(new Error('Khung cha không trả lời /api sau 20 giây.'));
      }, 20000);
    });
  };
})();
</script>`;

/**
 * Sinh `_preview.html` cạnh `index.html` và trả về file:// URL.
 *
 * Phải nằm CÙNG THƯ MỤC với deck: ảnh, css, video trong deck đều tham chiếu
 * tương đối, đặt ở thư mục tạm là gãy hết.
 */
function preparePreviewHtml(slideDir) {
  const htmlPath = path.join(slideDir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Không thấy index.html trong ${slideDir}`);
  }

  let html = fs.readFileSync(htmlPath, 'utf8');

  const fontResult = rewriteFontLinks(html);
  html = fontResult.html;

  const engineResult = rewriteEngineSrc(html);
  html = engineResult.html;

  // Script phải chạy SỚM: đoạn theme đặt class trước khi trang vẽ, còn cầu API
  // phải vá `fetch` trước khi script của deck gọi tới.
  html = html.replace(
    /<head([^>]*)>/i,
    (m) => `${m}\n<!-- Bản XEM TRƯỚC do Beeknoee Studio sinh tự động. Sửa index.html, đừng sửa file này. -->`
      // STORAGE_SHIM phải đứng TRƯỚC mọi thứ: script của deck có thể đụng
      // localStorage ngay lúc nạp, mà trong khung sandbox nó ném lỗi.
      + `\n${storageShim(docThietLapDeck(slideDir))}\n${EDITOR_THEME_SCRIPT}\n${API_BRIDGE}\n${KHUNG_CAU}\n${BO_ICON}\n${EDITOR_LAYOUT_SCRIPT}`
  );

  /* KIỂU CHỮ PHỤ ĐỀ (phông · đậm · nghiêng · căn lề) — phát các biến CSS ngay
     lúc dựng trang, đúng
     cùng phép lọc với đường dựng video (`recordingHtml.js#subtitleCssFromSettings`).
     Không có bước này thì mở deck lên phụ đề vẫn là phông cũ cho tới khi người
     dùng đụng vào ô chọn — mà lúc đó bảng sửa mới đặt biến. */
  {
    /* ⚠ GỌI THẲNG HÀM CỦA ĐƯỜNG DỰNG VIDEO, đừng chép lại phép lọc.
       Bản trước chép nguyên đoạn sang đây; thêm một khoá phụ đề mới là phải nhớ
       sửa CẢ HAI chỗ, mà quên một chỗ thì xem trước một đằng video một nẻo —
       đúng loại lỗi khó thấy nhất vì không có gì báo. Nay chỉ còn MỘT nơi biết
       khoá nào ra biến nào: `recordingHtml.js#subtitleCssFromSettings`. */
    const { subtitleCssFromSettings } = require('./recordingHtml');
    const css = subtitleCssFromSettings(docThietLapDeck(slideDir));
    if (css) html = html.replace(/<\/head>/i, '<style>' + css + '</style></head>');
  }

  // Hiệu ứng video — CHUNG với đường render (src/render/videoFx.js).
  {
    const { themVideoFx, DANH_SACH } = require('./videoFx');
    let fx = '';
    try {
      const f = path.join(slideDir, 'preview-settings.json');
      if (fs.existsSync(f)) fx = (JSON.parse(fs.readFileSync(f, 'utf8')) || {}).videoFx || '';
    } catch { /* thiếu file thì coi như không có hiệu ứng */ }
    html = themVideoFx(html, fx);
    // Hai chỗ giữ chỗ trong EDITOR_LAYOUT_SCRIPT: danh sách hiệu ứng và tên
    // deck. Thay ở đây thay vì nhúng thẳng vào chuỗi, để phần script vẫn đọc
    // được như JavaScript bình thường.
    html = html
      .replace('__BEE_FX_LIST__', JSON.stringify(DANH_SACH))
      // Bộ slide phụ (GĐ3.7): tên `cha::id` — khung chỉ được gọi API của CHÍNH deck mình (slide-viewer.js).
      .replace('__BEE_DECK__', JSON.stringify(require('../dung/boSlide').tenDeckCua(slideDir)));
  }

  // CSS thì ngược lại — phải nằm CUỐI, sau `style.css` của deck.
  //
  // Chèn ngay sau <head> là sai: luật ghi đè CÙNG độ ưu tiên với luật gốc
  // (`.theme-editor-title` chọi `.theme-editor-title`) sẽ thua vì đứng trước.
  // Đã dính thật: `display: none` cho tiêu đề không có tác dụng, trong khi các
  // luật `html.bee-light .x` (độ ưu tiên cao hơn) vẫn chạy — nên nhìn qua
  // tưởng cả khối đã ăn.
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${EDITOR_LIGHT_CSS}\n${AN_BANG_CU_CSS}\n</body>`)
    : `${html}\n${EDITOR_LIGHT_CSS}\n${AN_BANG_CU_CSS}`;

  /* ORIGIN RIÊNG cho khung (src/main/khungDeck.js): engine + phông của app đổi từ `file://…`
     tuyệt đối sang `bee-deck://<deck>/:app/…` — cùng origin với deck (phông `@font-face` khác
     origin thì cần CORS). Trang mở bằng `file://` (cửa sổ chụp ảnh slide) vẫn nạp được các
     URL này: phiên `anh-slide` cũng có bộ xử lý `bee-deck`. */
  const khungDeck = require('../main/khungDeck');
  const gocKhung = khungDeck.dangKyDeck(slideDir);
  const gocTaiNguyen = pathToFileURL(path.resolve(require('../config').resourcesRoot())).href;
  for (const thu of ['engine', 'fonts']) html = html.split(`${gocTaiNguyen}/${thu}/`).join(`${gocKhung}${khungDeck.TIEN_TO_APP}/${thu}/`);

  const outPath = path.join(slideDir, PREVIEW_FILE);
  fs.writeFileSync(outPath, html, 'utf8');

  return {
    // Khung trong app nạp bằng `url` (origin riêng); `path` cho ai cần mở thẳng tệp.
    url: `${gocKhung}${PREVIEW_FILE}`,
    path: outPath,
    fonts: fontResult,
    engine: engineResult,
  };
}

/** Dọn file xem trước — gọi khi đóng cửa sổ xem. */
function cleanupPreviewHtml(slideDir) {
  const p = path.join(slideDir, PREVIEW_FILE);
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = { preparePreviewHtml, cleanupPreviewHtml, PREVIEW_FILE }