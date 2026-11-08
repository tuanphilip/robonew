;
'use strict';
/**
 * Hiệu ứng video — dùng chung cho ĐƯỜNG RENDER và ĐƯỜNG XEM TRƯỚC.
 *
 * ⚠ VÌ SAO PHẢI DÙNG CHUNG, KHÔNG VIẾT HAI BẢN:
 * `previewHtml.js` chỉ dựng `_preview.html` để xem trong app — mọi thứ chèn ở
 * đó KHÔNG có trong file MP4. `recordingHtml.js` mới là đường tạo video. Viết
 * riêng hai bản là hai bản lệch nhau, và người dùng sẽ thấy hiệu ứng lúc xem
 * trước rồi mở video ra không có gì. Đúng cái mẫu lỗi đã lặp 4 lần trong dự án
 * (xem chú thích đầu previewHtml.js).
 *
 * Mỗi hiệu ứng là CSS thuần hoặc một đoạn JS ngắn, KHÔNG đụng `engine.js`:
 * engine dùng chung cho mọi deck và nằm trên đường render — sửa ở đó là rủi ro
 * cho cả 7 template.
 */

/** Danh sách hiện trong ô chọn của Preview Editor. */
const DANH_SACH = [
  { key: 'none', nhan: 'Không' },
  { key: 'parallax', nhan: 'Trôi nhẹ toàn khung' },
  { key: 'lines', nhan: 'Chữ hiện theo dòng' },
  { key: 'sweep', nhan: 'Vệt sáng quét ngang' },
  { key: 'keyword', nhan: 'Nhấn mạnh từ khoá' },
  { key: 'kenburns', nhan: 'Ken Burns — ảnh trôi + phóng' },
  { key: 'count', nhan: 'Số đếm chạy' },
  { key: 'shimmer', nhan: 'Ánh kim quét' },
  { key: 'all', nhan: 'Trọn bộ (tất cả)' },
];

const CSS = `<style id="bee-videofx">
/* ---- Ken Burns: ảnh chậm phóng và trôi thay vì đứng chết ----
   Chỉ áp cho ảnh/nền lớn trong slide ĐANG hiện. Ảnh nhỏ (logo, chip, avatar)
   loại ra: phóng logo lên là méo thương hiệu. */
.bee-fx-kenburns .slide.active img:not(.no-fx),
.bee-fx-kenburns .slide.active .bee-fx-bg {
  animation: beeKenBurns 14s ease-out both;
  transform-origin: center center;
  will-change: transform;
}
.bee-fx-kenburns .slide.active img.logo,
.bee-fx-kenburns .slide.active img.chip,
.bee-fx-kenburns .slide.active .no-fx { animation: none; }
@keyframes beeKenBurns {
  from { transform: scale(1.0) translate3d(0, 0, 0); }
  to   { transform: scale(1.08) translate3d(-1.2%, -1%, 0); }
}

/* ---- Ánh kim quét trên con số chủ đạo ----
   Dùng background-clip nên KHÔNG đổi màu gốc của chữ khi hiệu ứng tắt. */
.bee-fx-shimmer .slide.active .bee-fx-num {
  background-image: linear-gradient(100deg,
    currentColor 0%, currentColor 40%,
    rgba(255,255,255,0.92) 50%,
    currentColor 60%, currentColor 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: beeShimmer 2.6s ease-in-out 0.35s infinite;
}
@keyframes beeShimmer {
  from { background-position: 140% 0; }
  to   { background-position: -40% 0; }
}

/* ---- Trôi nhẹ toàn khung ----
   Hiệu ứng DUY NHẤT áp được cho mọi slide, kể cả slide chỉ có chữ: ba cái trên
   đều cần ảnh hoặc con số lớn để bám. Biên độ cố tình rất nhỏ (2%) — to hơn là
   chữ chạy khỏi vùng an toàn của khung 9:16.
   Đặt trên .slide-content nếu deck có, không thì trên chính .slide. */
.bee-fx-parallax .slide.active {
  animation: beeParallax 16s ease-out both;
  will-change: transform;
}
@keyframes beeParallax {
  from { transform: translate3d(0, 1.2%, 0) scale(1.012); }
  to   { transform: translate3d(0, -1.2%, 0) scale(1.012); }
}

/* ---- Chữ hiện theo dòng ----
   JS gắn .bee-fx-line cho từng khối chữ và đặt --bee-i để lệch nhịp. Giữ
   both-fill: khung cuối phải đứng yên, không thì đường render bắt phải khung
   đang mờ dở. */
.bee-fx-lines .slide.active .bee-fx-line {
  animation: beeLine 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: calc(var(--bee-i, 0) * 0.06s + 0.12s);
  will-change: transform, opacity;
}
@keyframes beeLine {
  from { opacity: 0; transform: translate3d(0, 9px, 0); }
  to   { opacity: 1; transform: none; }
}

/* ---- Vệt sáng quét ngang khung ----
   Lớp phủ riêng do JS chèn, KHÔNG dùng ::after của .slide: nhiều deck đã dùng
   ::after cho hoạ tiết nền, đè lên là mất hoạ tiết đó. */
.bee-fx-sweep .slide.active .bee-fx-sweep-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(104deg,
    rgba(255,255,255,0) 42%,
    rgba(255,255,255,0.10) 50%,
    rgba(255,255,255,0) 58%);
  background-size: 260% 100%;
  animation: beeSweep 2.4s ease-in-out 0.5s both;
}
@keyframes beeSweep {
  from { background-position: 150% 0; }
  to   { background-position: -60% 0; }
}

/* ---- Nhấn mạnh từ khoá ----
   Bám vào chữ mà chính deck đã đánh dấu là quan trọng (in đậm / mang màu
   nhấn) — không tự đoán từ nào đáng nhấn. */
.bee-fx-keyword .slide.active .bee-fx-key {
  display: inline-block;
  animation: beeKey 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--bee-k, 0) * 0.35s + 0.55s);
  will-change: transform, filter;
}
@keyframes beeKey {
  0%   { transform: none; filter: none; }
  35%  { transform: scale(1.06); filter: brightness(1.28); }
  100% { transform: none; filter: none; }
}
</style>`;

/**
 * Số đếm chạy + gắn dấu cho ánh kim.
 *
 * Đoạn này tự tìm "con số chủ đạo" rồi gắn class bee-fx-num lên nó — vừa để
 * đếm, vừa để CSS ánh kim có chỗ bám. Xem hàm ungVien() để biết ba chốt lọc.
 */
const JS = `<script id="bee-videofx-js">
(function () {
  var CHAY = 800;

  function soCua(el) {
    var t = (el.textContent || '').trim();
    var m = t.match(/^([^0-9]*)([0-9][0-9.,]*)(.*)$/);
    if (!m) return null;
    var raw = m[2];
    var so = Number(raw.replace(/[.,]/g, ''));
    if (!isFinite(so) || so <= 0) return null;
    return { truoc: m[1], sau: m[3], so: so, mau: raw };
  }

  /** Giữ nguyên kiểu ngăn cách của chữ gốc (1.234 hay 1,234). */
  function dinhDang(n, mau) {
    var s = String(Math.round(n));
    if (mau.indexOf('.') < 0 && mau.indexOf(',') < 0) return s;
    var sep = mau.indexOf('.') >= 0 ? '.' : ',';
    return s.replace(/\\B(?=(\\d{3})+(?!\\d))/g, sep);
  }

  function chay(el) {
    if (el.dataset.beeFxDone === '1') return;
    var d = soCua(el);
    if (!d) return;
    el.dataset.beeFxDone = '1';
    var t0 = performance.now();
    function b(now) {
      var p = Math.min(1, (now - t0) / CHAY);
      // ease-out: nhanh lúc đầu, chậm lại về đích — giống đồng hồ dừng số.
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = d.truoc + dinhDang(d.so * e, d.mau) + d.sau;
      if (p < 1) requestAnimationFrame(b);
      else el.textContent = d.truoc + d.mau + d.sau;
    }
    requestAnimationFrame(b);
  }

  /**
   * Tìm "con số chủ đạo" của slide.
   *
   * ⚠ ĐỔI HƯỚNG so với bản đầu. Bản đầu chỉ chạm phần tử đánh dấu
   * data-fx="num" — nghe thì an toàn, nhưng KHÔNG deck nào có dấu đó, nên tính
   * năng chạy mà không ai thấy gì. Tệ hơn: thuộc tính data-fx đã bị deck dùng
   * cho hiệu ứng nền (flow, lorenz, scan...), nên tên đó còn gây nhầm.
   *
   * Nay tự dò, nhưng có ba chốt để không đếm nhầm:
   *   1. phần tử KHÔNG có con — tránh chộp cả khối chứa số
   *   2. chữ là SỐ THUẦN (chỉ chữ số, dấu chấm/phẩy) — loại ngày 4/8/2026,
   *      loại "còn 3 ngày", loại mọi câu có số lẫn trong chữ
   *   3. cỡ chữ >= 36px — số nhỏ là nhãn phụ, số to mới là điểm nhấn
   * Ai muốn chỉ định tay thì gắn class bee-fx-num, luôn được ưu tiên.
   */
  function ungVien(s) {
    var danhDau = s.querySelectorAll('.bee-fx-num');
    if (danhDau.length) return danhDau;
    var ra = [];
    var all = s.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.children.length) continue;
      var t = (e.textContent || '').trim();
      if (!/^[0-9][0-9.,]*$/.test(t)) continue;
      var cs = parseFloat(getComputedStyle(e).fontSize) || 0;
      if (cs < 36) continue;
      ra.push(e);
    }
    return ra;
  }

  /**
   * Gắn class bee-fx-num rồi mới chạy.
   *
   * Ánh kim là CSS thuần, nó cần một class để bám. Không deck nào tự gắn, nên
   * JS phải làm — nếu không thì bật "Ánh kim quét" xong chẳng thấy gì, đúng lỗi
   * đã gặp ở bản đầu.
   */
  /**
   * Chia khối chữ thành từng DÒNG để hiện lệch nhịp.
   *
   * Chọn phần tử chữ ở tầng lá — thẻ nào còn chứa thẻ khác thì bỏ qua, không
   * thì cả khối và từng dòng bên trong đều chạy, thành hai lớp hiệu ứng chồng
   * nhau. Chặn trần 14 dòng: mỗi dòng lệch 60ms, quá số đó là dòng cuối hiện
   * sau gần một giây, chậm hơn lời đọc.
   */
  function chiaDong(s) {
    var all = s.querySelectorAll('h1,h2,h3,h4,p,li,figcaption,span,div');
    var n = 0;
    for (var i = 0; i < all.length && n < 14; i++) {
      var e = all[i];
      if (e.querySelector('h1,h2,h3,h4,p,li,span,div')) continue;
      if (!(e.textContent || '').trim()) continue;
      if (e.classList.contains('bee-fx-line')) { n++; continue; }
      e.classList.add('bee-fx-line');
      e.style.setProperty('--bee-i', n);
      n++;
    }
  }

  /**
   * Đánh dấu TỪ KHOÁ.
   *
   * Chỉ nhận chữ mà CHÍNH DECK đã đánh dấu là quan trọng — in đậm, tô sáng,
   * hoặc mang class có chữ accent/key/hl/primary. Không tự đoán từ nào đáng
   * nhấn: đoán sai thì nhấn vào giới từ, tệ hơn là không nhấn gì.
   */
  function danhDauTuKhoa(s) {
    var els = s.querySelectorAll('strong,b,mark,em,[class*="accent"],[class*="key"],[class*="hl"],[class*="primary"]');
    var n = 0;
    for (var i = 0; i < els.length && n < 4; i++) {
      var e = els[i];
      if (!(e.textContent || '').trim()) continue;
      if (e.querySelector('*')) continue;
      if (!e.classList.contains('bee-fx-key')) {
        e.classList.add('bee-fx-key');
        e.style.setProperty('--bee-k', n);
      }
      n++;
    }
  }

  /** Lớp phủ cho vệt sáng — chèn riêng, không đụng ::after của deck. */
  function themLopQuet(s) {
    if (s.querySelector(':scope > .bee-fx-sweep-layer')) return;
    if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
    var d = document.createElement('div');
    d.className = 'bee-fx-sweep-layer';
    s.appendChild(d);
  }

  function lam() {
    var h = document.documentElement.classList;
    var s = document.querySelector('.slide.active');
    if (!s) return;

    var demSo = h.contains('bee-fx-count');
    var anhKim = h.contains('bee-fx-shimmer');
    if (demSo || anhKim) {
      var els = ungVien(s);
      for (var i = 0; i < els.length; i++) {
        els[i].classList.add('bee-fx-num');
        if (demSo && els[i].dataset.beeFxDone !== '1') chay(els[i]);
      }
    }
    if (h.contains('bee-fx-lines')) chiaDong(s);
    if (h.contains('bee-fx-keyword')) danhDauTuKhoa(s);
    if (h.contains('bee-fx-sweep')) themLopQuet(s);
  }

  // Slide đổi thì làm lại cho slide mới.
  //
  // ⚠ PHẢI ĐỢI DOM. Đoạn này chèn trong <head> nên lúc chạy document.body còn
  // null — bản đầu gọi observe(document.body) ngay và ném
  // "parameter 1 is not of type 'Node'". Hậu quả: observer KHÔNG bao giờ gắn,
  // hiệu ứng chỉ áp cho slide đầu rồi im, mà console chỉ có đúng một dòng lỗi
  // chẳng liên quan gì tới hiệu ứng.
  // Gộp nhiều lần gọi trong cùng một khung hình về MỘT.
  //
  // Deck bật/tắt class liên tục trong lúc chạy hiệu ứng hiện chữ, nên rình cả
  // cây body là mỗi khung hình sinh hàng chục lượt gọi. Bản không gộp làm
  // renderer chết vì hết bộ nhớ (đo được reason: 'oom').
  var doi = 0;
  function hen() {
    if (doi) return;
    doi = 1;
    requestAnimationFrame(function () { doi = 0; lam(); });
  }

  function batDau() {
    lam();
    var goc = document.querySelector('.slide-container') || document.body;
    new MutationObserver(hen)
      .observe(goc, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', batDau);
  else batDau();
})();
</script>`;

/** Lớp CSS đặt lên `<html>` theo lựa chọn. */
const TAT_CA = ['parallax', 'lines', 'sweep', 'keyword', 'kenburns', 'count', 'shimmer'];

function lopCua(key) {
  if (!key || key === 'none') return '';
  if (key === 'all') return TAT_CA.map((k) => `bee-fx-${k}`).join(' ');
  return `bee-fx-${key}`;
}

/**
 * Chèn hiệu ứng vào HTML.
 * @param {string} html
 * @param {string} key  giá trị `videoFx` trong preview-settings.json
 */
function themVideoFx(html, key) {
  const lop = lopCua(key);
  // LUÔN chèn CSS + JS, kể cả khi chưa chọn hiệu ứng nào.
  //
  // Cả hai đều trơ nếu thẻ <html> không mang lớp bee-fx-*, nên chèn sẵn không
  // tốn gì. Bản đầu chỉ chèn khi đã có hiệu ứng — hậu quả: mở deck chưa chọn
  // gì, bấm "Trọn bộ", lớp gắn lên html nhưng CSS không có trong trang nên
  // KHÔNG có gì chạy, phải đóng mở lại deck mới thấy. Đã đo: coCssHieuUng false.
  const chen = `${CSS}\n${JS}`;
  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${chen}\n</head>`)
    : `${chen}\n${html}`;

  if (!lop) return html;

  // Đặt lớp NGAY trên thẻ <html> chứ không đợi JS: đường render bắt hình từ
  // khung đầu tiên, thêm lớp muộn một nhịp là mất phần đầu của hiệu ứng.
  return html.replace(/<html([^>]*)>/i, (m, attrs) => {
    if (/\sclass\s*=/.test(attrs)) {
      return `<html${attrs.replace(/(\sclass\s*=\s*["'])/i, `$1${lop} `)}>`;
    }
    return `<html${attrs} class="${lop}">`;
  });
}

module.exports = { themVideoFx, DANH_SACH, lopCua }