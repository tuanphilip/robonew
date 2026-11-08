);
/*
 * ĐẠI DIỆN CỦA APP TRONG KHUNG XEM TRƯỚC DECK (previewHtml.js chèn vào `_preview.html`).
 *
 * Khung chạy ở ORIGIN RIÊNG (`bee-deck://`, src/main/khungDeck.js) nên cửa sổ app không sờ
 * thẳng được DOM / hàm engine trong này nữa. Thay vào đó:
 *   · GỬI LÊN ảnh chụp trạng thái `{ __beeKhung: 'tt', tt }` — slide đang xem, số slide, chữ
 *     từng slide, cỡ khung slide, danh sách lựa chọn của các <select> engine, đèn của slide…
 *     — mỗi khi đổi (và nhịp 0,5 s cho chắc). Phía app đọc bản chụp này một cách ĐỒNG BỘ
 *     (ui-classic/render/deck-cau.js).
 *   · NHẬN một danh sách lệnh CỐ ĐỊNH từ đúng khung cha `{ __beeKhung: 'lenh', id, ten, a }`,
 *     trả `{ __beeKhung: 'kq', id, kq, loi }`. Không có lệnh "chạy mã tuỳ ý".
 * Mở trực tiếp (không có khung cha — vd cửa sổ chụp ảnh slide) thì không làm gì.
 */
(function () {
  if (window.parent === window) return;
  var cha = window.parent;

  function cacSlide() { return [].slice.call(document.querySelectorAll('.slide')); }

  function chup() {
    var ds = cacSlide();
    var o = document.querySelector('.slide-container') || document.querySelector('.slide');
    var chon = {};
    [].slice.call(document.querySelectorAll('select[id]')).forEach(function (s) {
      chon[s.id] = [].slice.call(s.options).map(function (x) { return { v: x.value, t: (x.textContent || '').trim() }; });
    });
    var den = null;
    try { if (typeof window.toneSlideOverride === 'function') den = JSON.parse(JSON.stringify(window.toneSlideOverride() || null)); } catch (e) { den = null; }
    var ov = document.querySelector('.preview-script-subtitles');
    return {
      sanSang: typeof window.applyVisualSettings === 'function',
      soSlide: ds.length,
      chiSo: ds.indexOf(document.querySelector('.slide.active')),
      chu: ds.map(function (s) { return (s.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60); }),
      khung: o ? { w: o.offsetWidth, h: o.offsetHeight } : null,
      // Cỡ khung nhìn LÚC đo — bên app biết số đo trên ứng với cỡ iframe nào (san-khau.js#theoKhung).
      vp: { w: window.innerWidth, h: window.innerHeight },
      chon: chon,
      den: den,
      coPhuDe: typeof window.startPreviewSubtitles === 'function',
      phuDeChay: !!(ov && ov.classList.contains('visible')),
      coNutTieng: !!document.getElementById('muteBtn')
    };
  }

  var cu = '';
  function gui(ep) {
    var t;
    try { t = chup(); } catch (e) { return; }
    var s = JSON.stringify(t);
    if (!ep && s === cu) return;
    cu = s;
    cha.postMessage({ __beeKhung: 'tt', tt: t }, '*');
  }
  var hen = 0;
  function guiSau(ms) { clearTimeout(hen); hen = setTimeout(function () { gui(false); }, ms || 40); }

  function toiSlide(i) {
    var dich = i | 0;
    if (typeof window.goToSlide === 'function') { window.goToSlide(dich); return true; }
    /* Deck TỰ VIẾT app.js (không có goToSlide): chỉ tiến theo từng cú BẤM. Bấm dần tới đúng số,
       chặn số vòng để deck lạ không treo. Không lùi được bằng cách bấm. */
    var so = function () { var ds = cacSlide(); return ds.indexOf(document.querySelector('.slide.active')); };
    if (so() > dich) return false;
    for (var n = 0; n < 200 && so() < dich; n += 1) document.body.click();
    return so() === dich;
  }

  var LENH = {
    ping: function () { gui(true); return true; },
    apDung: function (a) { if (typeof window.applyVisualSettings !== 'function') return false; window.applyVisualSettings(a.thietLap); return true; },
    apPhuDe: function (a) { if (typeof window.applySubtitleSettings !== 'function') return false; window.applySubtitleSettings(a.thietLap); return true; },
    // Biến CSS phụ đề trên <html> — chỉ nhận tên biến `--…`.
    bien: function (a) {
      var g = document.documentElement.style;
      Object.keys(a.bien || {}).forEach(function (k) { if (/^--[A-Za-z0-9_-]+$/.test(k)) g.setProperty(k, String(a.bien[k])); });
      return true;
    },
    videoFx: function (a) {
      var el = document.documentElement;
      [].slice.call(el.classList).forEach(function (c) { if (c.indexOf('bee-fx-') === 0) el.classList.remove(c); });
      String(a.lop || '').split(/\s+/).filter(function (c) { return /^bee-fx-[A-Za-z0-9_-]+$/.test(c); })
        .forEach(function (c) { el.classList.add(c); });
      return true;
    },
    ngheThu: function (a) {
      if (typeof window.initAudio === 'function') window.initAudio();
      if (a.loai === 'bgm') { if (typeof window.startBackgroundMusic !== 'function') return false; window.startBackgroundMusic(); return true; }
      if (a.loai === 'dung-bgm') { if (typeof window.stopBackgroundMusic !== 'function') return false; window.stopBackgroundMusic(0.25); return true; }
      var ds = cacSlide();
      var i = Math.max(0, ds.indexOf(document.querySelector('.slide.active')));
      if (a.loai === 'chuyen' && typeof window.setSlideTransition === 'function') { window.setSlideTransition(i, a.giaTri || 'minimal'); return true; }
      if (a.loai === 'hien' && typeof window.setSlideReveal === 'function') { window.setSlideReveal(i, a.giaTri || 'ping'); return true; }
      return false;
    },
    // Để ENGINE tính tông / đèn rồi trả bản chụp nó ghi vào kho (deck-cau.js#dungEngine).
    dungEngine: function (a) {
      if (typeof window.setToneVisual !== 'function') return null;
      window.setToneVisual(a.doiGi, true);
      if (typeof window.settingsStorageKey !== 'function') return null;
      var t = window.localStorage.getItem(window.settingsStorageKey());
      return t ? JSON.parse(t) : null;
    },
    toiSlide: function (a) { return toiSlide(a.i); },
    // Đang xem video thành phẩm đè lên: câm tiếng của deck bên dưới.
    dungMedia: function () {
      [].slice.call(document.querySelectorAll('audio, video')).forEach(function (m) { try { m.pause(); } catch (e) { /* đã gỡ */ } });
      return true;
    },
    bamTieng: function () { var n = document.getElementById('muteBtn'); if (!n) return false; n.click(); return true; },
    batPhuDe: function (a) { if (typeof window.startPreviewSubtitles !== 'function') return false; window.startPreviewSubtitles(a.i | 0); return true; },
    tong: function (a) { document.documentElement.classList.toggle('bee-light', !!a.sang); return true; }
  };

  window.addEventListener('message', function (e) {
    if (e.source !== cha) return;
    var d = e.data;
    if (!d || d.__beeKhung !== 'lenh' || typeof d.ten !== 'string') return;
    var kq = null;
    var loi = null;
    try {
      if (!Object.prototype.hasOwnProperty.call(LENH, d.ten)) throw new Error('Lệnh lạ: ' + d.ten);
      kq = LENH[d.ten](d.a || {});
    } catch (x) { loi = String((x && x.message) || x); }
    try { cha.postMessage({ __beeKhung: 'kq', id: d.id, kq: kq, loi: loi }, '*'); } catch (x) {
      cha.postMessage({ __beeKhung: 'kq', id: d.id, kq: null, loi: 'Kết quả không gửi được.' }, '*');
    }
    guiSau(30);
  });

  // Đổi slide / bật phụ đề… đều là đổi lớp — gom lại rồi gửi một lần.
  function batDau() {
    gui(true);
    try {
      new MutationObserver(function () { guiSau(40); })
        .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* không theo dõi được thì còn nhịp đều */ }
    setInterval(function () { gui(false); }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', batDau);
  else batDau();
  window.addEventListener('load', function () { gui(true); });
  window.addEventListener('resize', function () { guiSau(60); });
})(