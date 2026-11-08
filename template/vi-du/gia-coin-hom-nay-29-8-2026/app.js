// Giá coin hôm nay 29/8/2026 — Beeknoee slide runtime

const slideScripts = [
  'Bitcoin sáng nay giữ chắc đà tăng, vọt lên một trăm mười hai nghìn đô, cộng thêm hai phẩy bốn phần trăm chỉ sau một đêm!',
  'Mở màn là hai đồng dẫn dắt cả thị trường. Bitcoin neo quanh một trăm mười hai nghìn tư, vốn hoá đã vượt hai nghìn hai trăm tỷ đô. Ethereum cũng leo lên bốn nghìn năm trăm sáu mươi đô, cộng gần hai phần trăm sau một đêm.',
  'Dạo qua nhóm altcoin thì sao? BNB của sàn lớn nhất đứng vững tám trăm sáu mươi đô, còn Solana giữ mốc hai trăm mười đô nhờ phí rẻ tốc độ cao. XRP quanh ba đô mốt, và chú chó DOGE kỳ cựu vẫn nhích lên hai mươi bốn xu.',
  'Vậy cả thị trường đang chạy tới đâu? Tổng vốn hoá tiền số đã cán mốc ba nghìn chín trăm tỷ đô la Mỹ. Khối lượng giao dịch một ngày vẫn quanh một trăm tám mươi hai tỷ đô, cho thấy dòng tiền chưa hề nguội.',
  'Và đây là con số dân trade soi mỗi sáng. Một mình Bitcoin chiếm năm mươi tám phần trăm vốn hoá, toàn bộ altcoin cộng lại chỉ còn bốn mươi hai. Tiền vẫn dồn về Bitcoin, nghĩa là mùa altcoin thật sự vẫn chưa gõ cửa.',
  'Vậy điều gì đang giật dây cả thị trường? Đầu tiên, các quỹ ETF hút vốn mười hai phiên liên tiếp, tổ chức lớn gom đều đỡ giá từ bên dưới. Kế đến, đồng USD mạnh lên sau cuộc họp Fed lại ghìm mọi tài sản rủi ro. Còn đáng ngại nhất là đòn bẩy phái sinh quá nóng, chỉ một cú rung là hàng tỷ đô bị thanh lý.',
  'Nhìn về phía trước, xin nhấn mạnh đây chỉ là góc nhìn tham khảo. Giới phân tích cho rằng Bitcoin sẽ tích lũy quanh vùng chín mươi tám tới một trăm hai mươi tư nghìn đô, với mốc cản gần nhất ở một trăm mười tám. Ở chiều ngược lại, lực mua của các quỹ ETF và nguồn cung khan sau halving vẫn là tấm đệm đỡ giá dài hạn.',
  'Tóm lại, sáng nay Bitcoin cùng nhóm dẫn dắt đồng loạt xanh, còn altcoin đi ngang chờ dòng tiền mới. Giá tiền số nhảy múa từng phút, nên hãy xem đây là thông tin tham khảo chứ đừng coi là lời khuyên xuống tiền.'
];

const slideTransitions = ['gong', 'rise', 'chime', 'sweep', 'boom', 'dramatic', 'ascending', 'chord'];
const slideReveals = ['sparkle', 'ping', 'pop', 'chime', 'drop', 'click', 'bell', 'sparkle'];

const defaultPreviewSettings = {
  theme: 'golden',
  showGrid: false,
  backgroundFx: 'particles',
  bgm: { src: 'preview-assets/bgm/meta.mp3', volume: 0.35 },
  subtitles: { enabled: true, fontSize: 18, bottom: 100, maxLines: 1 },
  slides: {
    scriptLines: slideScripts.slice(),
    transitionSounds: slideTransitions.slice(),
    revealSounds: slideReveals.slice()
  }
};

// --- Reveal engine ---
(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  if (!slides.length) return;

  function revealUnits(slide) {
    const mode = slide.getAttribute('data-mode');
    let sel = '.slide-element';
    if (mode === 'highlight') sel += ', .highlightable';
    if (mode === 'traffic-light') sel += ', .lightable';
    return Array.from(slide.querySelectorAll(sel));
  }

  let slideIndex = 0;
  let revealIndex = 0;

  function showSlide(i) {
    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
    revealIndex = 0;
    step(); // reveal first unit immediately
  }

  function step() {
    const slide = slides[slideIndex];
    const units = revealUnits(slide);
    if (revealIndex < units.length) {
      const el = units[revealIndex];
      el.classList.add('visible');
      if (el.classList.contains('highlightable')) el.classList.add('active');
      revealIndex++;
      return true;
    }
    return false;
  }

  function next() {
    if (!step()) {
      if (slideIndex < slides.length - 1) {
        slideIndex++;
        showSlide(slideIndex);
      }
    }
  }

  function prev() {
    if (slideIndex > 0) {
      slideIndex--;
      showSlide(slideIndex);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });
  document.addEventListener('click', next);

  // Helper for QA/validator-style full reveal
  window.__revealAll = function () {
    slides.forEach((s) => {
      s.classList.add('active');
      revealUnits(s).forEach((el) => {
        el.classList.add('visible');
        el.classList.add('active');
      });
    });
  };

  showSlide(0);
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { slideScripts, slideTransitions, slideReveals, defaultPreviewSettings };
}
