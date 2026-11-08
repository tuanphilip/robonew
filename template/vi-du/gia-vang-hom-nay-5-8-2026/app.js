// Giá vàng hôm nay 5/8/2026 — Beeknoee slide runtime

const slideScripts = [
  'Vàng sáng nay bật xanh trở lại, SJC vọt thẳng lên 141 triệu một lượng, cộng nửa triệu chỉ sau một đêm!',
  'Mở màn là bảng giá trong nước. SJC miếng neo 138 tới 141 triệu, mua bán chênh nhau đúng 3 triệu một lượng. Nhẫn trơn SJC cũng leo lên vùng 136 tới 140 triệu, tăng đều nửa triệu cả hai chiều.',
  'Dạo qua các nhà vàng lớn thì sao? PNJ và DOJI cùng đẩy nhẫn trơn lên 137 tới 140 triệu rưỡi, nhỉnh hơn cả SJC. Bảo Tín Minh Châu chốt 137 tới 140 triệu, còn Mi Hồng bóp mua bán chỉ hở hơn một triệu rưỡi.',
  'Vậy sàn thế giới đang chạy tới đâu? Vàng giao ngay quanh mốc 4.080 USD một ounce, quy đổi ra đã gần 130 triệu đồng mỗi lượng. Hợp đồng tương lai tháng 12 trên sàn Comex còn vọt tới 4.135 USD, cho thấy giới đầu tư vẫn đặt cược vàng chưa chịu hạ nhiệt.',
  'Và đây mới là con số khiến nhiều người giật mình. Vàng thế giới quy đổi chỉ khoảng 130 triệu, còn giá trong nước đã vượt 140 triệu một lượng. Khoảng vênh nội ngoại phình tới hơn 10 triệu rưỡi, một mức cao hiếm thấy trên thị trường.',
  'Vậy điều gì đang giật dây cả thị trường? Đầu tiên, giá dầu lao dốc hơn 5 phần trăm kéo áp lực lạm phát dịu lại, mở đường cho vàng bật lên. Kế đến, đồng USD mạnh sau cuộc họp Fed lại đè giá thế giới, khiến vàng khó bứt phá. Bù lại, dòng tiền châu Á ồ ạt đổ vào quỹ vàng Trung Quốc suốt 14 phiên liên tiếp.',
  'Nhìn về phía trước, xin nhấn mạnh đây chỉ là góc nhìn tham khảo. Giới phân tích cho rằng vàng sẽ tích lũy quanh vùng 3.950 tới 4.300 USD, và rất khó vượt mốc cản 4.200 nếu Fed chưa chịu hạ giọng. Ở chiều ngược lại, lực mua của các ngân hàng trung ương và bất ổn địa chính trị vẫn là tấm đệm đỡ giá dài hạn.',
  'Tóm lại, sáng nay vàng trong nước đồng loạt xanh, còn thế giới đi ngang ngay dưới trần 4.200 USD. Giá vàng nhảy múa từng giờ, nên hãy xem đây là thông tin tham khảo và cân nhắc thật kỹ theo nhu cầu của riêng bạn.'
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
