;
'use strict';
/**
 * ẢNH THU NHỎ CỦA TỪNG SLIDE — app TỰ chụp, trong một cửa sổ ẨN.
 *
 * ── Vì sao phải là cửa sổ ẩn ─────────────────────────────────────────────
 *
 * Bản đầu (15/09/2026) chụp bằng `preview:chupKhung`: đưa khung xem trước trên
 * màn hình lần lượt về từng slide rồi nhờ `capturePage()` chụp đúng vùng đó.
 * Chạy được, nhưng Electron chụp CỬA SỔ chứ không chụp riêng iframe, nên vùng
 * ấy phải đang HIỆN — tức mỗi lượt chụp là màn hình nhảy qua hết slide trước
 * mắt người dùng. Vì thế nó phải là một nút bấm tay ("Chụp đủ ảnh"), và ai
 * không bấm thì dải slide trống trơn.
 *
 * Cửa sổ ẩn gỡ đúng ràng buộc đó: deck chạy ở một chỗ không ai nhìn, muốn nhảy
 * bao nhiêu slide cũng được. Nhờ vậy mới bỏ được nút bấm tay.
 *
 * ── Ba cái bẫy đã có người dẫm, đừng dẫm lại ─────────────────────────────
 *
 * 1. **`capturePage()` trên cửa sổ ẩn trả ảnh TRẮNG hoặc ảnh CŨ** — Chromium
 *    hãm hợp thành cửa sổ không hiện. Phải `offscreen: true` rồi nghe sự kiện
 *    `paint`, đúng cách mà bộ ghi hình (`render/offscreen.js`) vẫn dùng.
 *
 * 2. **`partition` RIÊNG là bắt buộc**, không phải cho gọn. Ngay dưới đây có
 *    `onBeforeRequest` chặn http/https, mà bộ lọc đó là DUY NHẤT MỘT CÁI CHO
 *    MỖI PHIÊN và không tự gỡ khi cửa sổ đóng. Dùng chung phiên mặc định là
 *    chụp một lần rồi tới khi tắt app, cửa sổ chính mất sạch font/ảnh gọi ra
 *    mạng — lỗi im lặng đã phải chữa một lần (CONTEXT §6.4, mục 2).
 *
 * 3. **`enableLargerThanScreen`** — thiếu nó Windows kẹp chiều cao cửa sổ
 *    xuống vùng làm việc của màn hình. Xem chú thích dài ở `render/offscreen.js`.
 *
 * ⚠ **KHÔNG ghi thêm tệp nào vào thư mục deck.** Lượt chụp nạp lại đúng
 * `_preview.html` mà sân khấu đang dùng — dựng lại nó thì cũng chỉ ghi đè một
 * tệp mà bộ theo dõi đã liệt vào danh sách bỏ qua (`fs-watch.js`). Ghi tên
 * khác là tự bắn watcher, và watcher lại gọi nạp deck, thành vòng lặp.
 *
 * ⚠ **Nhớ theo CHỮ KÝ của deck, không phải theo tên.** Sửa slide hay đổi màu
 * xong mà dải vẫn hiện ảnh của lượt trước thì thà đừng có ảnh. Chữ ký là mốc
 * sửa của bốn tệp quyết định hình dạng; đổi một cái là lượt sau chụp lại.
 */
const fs = require('node:fs');
const path = require('node:path');

const { khungCuaDeck } = require('../render/recordingHtml');

/** Cao 200px: ô trong dải cao 76px, dư hơn 2× cho màn Retina. */
const CAO_ANH = 200;
const CHAT_LUONG = 80;

/** Trần số slide một lượt — deck dài nhất đang có 14 slide. */
const TOI_DA_SLIDE = 60;

/** Giữ ảnh của bao nhiêu deck trong bộ nhớ. Mỗi deck ~10 KB × số slide. */
const TOI_DA_DECK = 12;

/**
 * Bốn tệp quyết định HÌNH DẠNG slide.
 *
 * ⚠ KHÔNG có `script-90s.txt`: bảng sửa ghi tệp đó sau mỗi 0,9 giây gõ, cho nó
 * vào chữ ký là đang gõ lời thoại thì cứ 0,9 giây lại mở một cửa sổ ẩn. Lời
 * thoại cũng không đổi hình slide — nó là giọng đọc.
 */
const TEP_THIET_KE = ['index.html', 'style.css', 'app.js', 'preview-settings.json'];

const kho = new Map();       // deckDir -> { chuKy, anh: string[] }
const dangCho = new Map();   // deckDir -> Promise (gộp các lời gọi trùng)

function chuKyDeck(deckDir) {
  return TEP_THIET_KE.map((ten) => {
    try { return String(fs.statSync(path.join(deckDir, ten)).mtimeMs); } catch { return '-'; }
  }).join('|');
}

function nho(deckDir, chuKy, anh) {
  kho.set(deckDir, { chuKy, anh });
  while (kho.size > TOI_DA_DECK) kho.delete(kho.keys().next().value);
}

const doi = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Bộ điều khiển bơm vào trang deck.
 *
 * ⚠ Mở HẾT phần hiện dần TRƯỚC KHI chụp, và TẮT transition trước khi mở. Ảnh
 * phải là slide đã ra hết chữ; chụp lúc vừa vào slide thì chỉ có phần tử đầu,
 * nhìn dải toàn ảnh dở dang. Thêm lớp `visible` là chạy hiệu ứng mờ dần, nên
 * không tắt transition thì lại ra tấm ảnh đang mờ nửa chừng.
 *
 * ⚠ Hai chế độ `highlight` và `traffic-light` còn bước tô/thắp riêng — chỗ này
 * KHÔNG đụng tới, ảnh sẽ đủ chữ nhưng chưa tô.
 */
const BO_DIEU_KHIEN = `(function () {
  var A = {};
  A.dem = function () { return document.querySelectorAll('.slide').length; };
  A.chiSo = function () {
    var ds = [].slice.call(document.querySelectorAll('.slide'));
    return ds.indexOf(document.querySelector('.slide.active'));
  };
  A.tatHieuUng = function () {
    if (document.getElementById('__beeTatHieuUng')) return;
    var s = document.createElement('style');
    s.id = '__beeTatHieuUng';
    s.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.appendChild(s);
  };
  A.moHet = function () {
    var sl = document.querySelector('.slide.active');
    if (!sl) return 0;
    var an = [].slice.call(sl.querySelectorAll('.slide-element'))
      .filter(function (e) { return !e.classList.contains('visible'); });
    an.forEach(function (e) { e.classList.add('visible'); });
    return an.length;
  };
  A.toi = function (i) {
    if (typeof goToSlide === 'function') { try { goToSlide(i); } catch (e) { return false; } return true; }
    for (var n = 0; n < 200 && A.chiSo() < i; n += 1) {
      try { document.body.click(); } catch (e) { return false; }
    }
    return A.chiSo() === i;
  };
  window.__beeAnh = A;
  return true;
})()`;

/**
 * Chụp thật — mở cửa sổ ẩn, đi hết slide, đóng.
 * @returns {Promise<string[]>} data URL từng slide (rỗng khi không chụp được).
 */
async function chupThat(deckDir) {
  const { BrowserWindow } = require('electron');
  const { preparePreviewHtml } = require('../render/previewHtml');
  const { pathToFileURL } = require('node:url');

  /* Dựng lại `_preview.html` cho đúng thiết lập MỚI NHẤT: tệp đó nhúng sẵn
     `preview-settings.json` lúc dựng, nên bản sân khấu đang mở có thể là bản
     trước lượt đổi màu vừa rồi. Ghi đè chính nó nên watcher vẫn bỏ qua. */
  const r = preparePreviewHtml(deckDir);
  const k = khungCuaDeck(deckDir);

  let win = null;
  try {
    win = new BrowserWindow({
      show: false,
      width: k.w,
      height: k.h,
      frame: false,
      enableLargerThanScreen: true,   // Windows kẹp chiều cao nếu thiếu — xem offscreen.js
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        nodeIntegration: false,
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required',
        partition: 'anh-slide',       // ⚠ BẮT BUỘC — xem chú thích đầu tệp, bẫy 2
      },
    });
    // Gọi lại sau khi tạo: cỡ lúc khởi tạo vẫn bị kẹp.
    win.setContentSize(k.w, k.h);

    const wc = win.webContents;
    wc.setAudioMuted(true);
    /* 10 khung/giây là đủ: chỉ cần vài lượt vẽ để chắc chắn bắt được một khung
       đã ổn định sau mỗi lần đổi slide. Cao hơn là đốt CPU cho khung sẽ bị vứt. */
    wc.setFrameRate(10);
    // Deck không được gọi ra mạng khi đang chụp: một font Google chậm là treo
    // cả lượt, mà ảnh thu nhỏ thì không đáng để chờ.
    /* ⚠ Và không được đọc tệp NGOÀI deck (24/10/2026): ảnh chụp ở đây về thẳng tay agent qua
       `studio_preview_slides`, nên một `fetch('file:///…')` trong app.js là in được tệp bất kỳ
       của máy lên ảnh. Cả hai việc chặn đi qua `raoCuaSoAn` — tự gọi `onBeforeRequest` ở đây là
       THAY mất bộ lọc của cả phiên, kể cả rào của lượt chụp deck khác đang chạy song song. */
    require('./raoCuaSoAn').rao(wc, { deckDir, chanMang: true });

    /* Chỉ nén khi ĐANG ĐỢI một tấm. Giữa hai lần đổi slide vẫn có `paint` bắn
       đều; nén hết là mỗi lượt chụp thêm vài chục lần resize+JPEG vô ích.
       ⚠ NativeImage của `paint` KHÔNG sống qua khỏi lần gọi handler — phải nén
       ngay trong đó, không cất lại rồi nén sau. */
    let dangDoi = false;
    let soVe = 0;
    let moiNhat = null;
    wc.on('paint', (_e, _dirty, image) => {
      if (!dangDoi) return;
      soVe += 1;
      try { moiNhat = image.resize({ height: CAO_ANH, quality: 'better' }).toJPEG(CHAT_LUONG); }
      catch { /* khung hụt thì bỏ, khung sau bù */ }
    });

    /**
     * Chụp khi hình ĐÃ ĐỨNG YÊN — hai khung liên tiếp giống hệt nhau.
     *
     * ⚠ **PHẢI gọi `invalidate()`, không ngồi đợi suông.** Cửa sổ offscreen chỉ
     * phát `paint` KHI CÓ GÌ ĐÓ ĐỔI. Slide đang hiện thì không có gì đổi nữa,
     * nên đợi suông là treo tới hết hạn rồi trả rỗng — đã đo: 0 ảnh, 0 câu báo,
     * 590 ms.
     *
     * ⚠ **Và phải đợi HÌNH ĐỨNG, không lấy khung đầu tiên vớ được.**
     * `goToSlide()` của engine đặt slide mới `opacity: 0` rồi mới xoá trong
     * `requestAnimationFrame` kế tiếp — chụp trúng nhịp đó là ra một tấm ĐEN.
     * Đã đo: ảnh slide 2 nặng 975 byte trong khi các slide khác 3,6 KB, mở ra
     * đúng là một tấm trống. So byte hai khung liền nhau thì bắt được cả những
     * hiệu ứng chạy bằng JS mà `transition: none` không tắt nổi.
     */
    async function chupKhiDung(han) {
      dangDoi = true; soVe = 0; moiNhat = null;
      const het = Date.now() + han;
      let truoc = null;
      let lan = 0;
      while (Date.now() < het) {
        try { wc.invalidate(); } catch { /* bản Electron không có thì đợi paint tự nhiên */ }
        await doi(90);
        lan += 1;
        if (!moiNhat) continue;
        // Phải qua ít nhất hai vòng: vòng đầu hay bắt đúng lúc trang vừa đổi.
        if (lan >= 2 && truoc && truoc.equals(moiNhat)) break;
        truoc = moiNhat;
      }
      dangDoi = false;
      return moiNhat;
    }

    /**
     * Đưa trang tới slide thứ `i` và CHỜ tới nơi thật.
     *
     * ⚠ `goToSlide()` của engine mở đầu bằng `if (index === currentSlide ||
     * isAnimating) return;` và chỉ hạ `isAnimating` sau **420 ms**. Gọi liên
     * tiếp nhanh hơn thế là mọi lời gọi sau đều rơi vào hư không, KHÔNG báo gì.
     * Đã đo: lượt chụp đầu dừng ở slide 1 rồi chụp lại đúng tấm đó bốn lần cho
     * slide 2·3·4·5 — bốn ảnh trùng byte.
     */
    async function toiSlide(i) {
      for (let lan = 0; lan < 8; lan += 1) {
        await wc.executeJavaScript(`window.__beeAnh.toi(${i})`, true).catch(() => false);
        for (let n = 0; n < 6; n += 1) {
          await doi(100);
          const c = await wc.executeJavaScript('window.__beeAnh.chiSo()', true).catch(() => -1);
          if (c === i) return true;
        }
      }
      return false;
    }

    await wc.loadURL(pathToFileURL(r.path).href);

    // Đợi engine dựng xong slide. `.slide` có sẵn trong HTML tĩnh nên phải hỏi
    // thêm `__beeAnh` — tức đã bơm được bộ điều khiển vào.
    let sanSang = false;
    for (let n = 0; n < 60 && !sanSang; n += 1) {
      sanSang = await wc.executeJavaScript(BO_DIEU_KHIEN + ' && window.__beeAnh.dem() > 0', true)
        .catch(() => false);
      if (!sanSang) await doi(100);
    }
    if (!sanSang) { console.warn('[anh-slide] engine chưa sẵn sàng sau 6 giây:', deckDir); return []; }
    await doi(350);   // engine còn dựng `.slide-container` sau khi `load` bắn

    const tong = Math.min(TOI_DA_SLIDE, await wc.executeJavaScript('window.__beeAnh.dem()', true).catch(() => 0));
    if (!tong) { console.warn('[anh-slide] không đếm được slide nào:', deckDir); return []; }

    const ra = [];
    await wc.executeJavaScript('window.__beeAnh.tatHieuUng()', true).catch(() => {});
    for (let i = 0; i < tong; i += 1) {
      if (!await toiSlide(i)) {
        console.warn('[anh-slide] không tới được slide', i, 'của', deckDir);
        break;
      }
      /* Mở hết phần hiện dần SAU khi đã tới nơi: `goToSlide()` gọi
         `resetElements(index)` ngay đầu, tức xoá sạch lớp `visible` của slide
         đích. Mở trước là mở vào chỗ sắp bị xoá. */
      await wc.executeJavaScript('window.__beeAnh.moHet()', true).catch(() => {});
      const buf = await chupKhiDung(2500);
      if (!buf || buf.length < 256) { console.warn('[anh-slide] hụt khung ở slide', i, '— số lượt vẽ', soVe); break; }
      ra.push('data:image/jpeg;base64,' + buf.toString('base64'));
    }
    return ra;
  } finally {
    try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* đã đóng */ }
  }
}

/**
 * Ảnh thu nhỏ của deck — lấy từ bộ nhớ nếu deck chưa đổi, không thì chụp lại.
 *
 * @param {string} deckDir
 * @returns {Promise<{anh: string[], tuKho: boolean}>}
 */
async function anhCuaDeck(deckDir, ep) {
  if (!deckDir || !fs.existsSync(deckDir)) return { anh: [], tuKho: false };
  const chuKy = chuKyDeck(deckDir);
  const co = kho.get(deckDir);
  /* `ep` = người dùng BẤM nút làm mới. Bỏ qua bộ nhớ, kể cả khi chữ ký không
     đổi: chữ ký chỉ nhìn năm tệp: deck có thể đổi vì một tệp ảnh, một tệp
     phông, hay chính engine dùng chung — bấm nút là muốn chụp lại thật. */
  if (!ep && co && co.chuKy === chuKy) return { anh: co.anh, tuKho: true };

  // Hai lời gọi cùng lúc cho cùng deck (mở deck + lưu thiết lập) chỉ chạy MỘT
  // lượt chụp — cửa sổ ẩn nào cũng tranh GPU với cửa sổ người dùng đang nhìn.
  const dang = dangCho.get(deckDir);
  if (dang) return dang;

  const viec = (async () => {
    try {
      const anh = await chupThat(deckDir);
      if (anh.length) nho(deckDir, chuKy, anh);
      return { anh, tuKho: false };
    } catch (e) {
      /* KHÔNG nuốt im: lượt chụp chạy ở cửa sổ ẩn, hỏng thì trên màn hình chỉ
         thấy dải slide không bao giờ có ảnh — đúng kiểu hỏng im lặng khó lần. */
      console.warn('[anh-slide] không chụp được:', (e && e.message) || e);
      return { anh: [], tuKho: false };
    } finally {
      dangCho.delete(deckDir);
    }
  })();
  dangCho.set(deckDir, viec);
  return viec;
}

/** Quên ảnh của một deck (đổi tên, xoá). Không truyền gì là quên hết. */
function quen(deckDir) {
  if (deckDir) kho.delete(deckDir);
  else kho.clear();
}

module.exports = { anhCuaDeck, quen }