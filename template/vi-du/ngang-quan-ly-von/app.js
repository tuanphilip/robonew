/* Engine hé lộ tối giản cho mẫu ngang.

   ══ HỢP ĐỒNG VỚI ĐƯỜNG DỰNG — đọc trước khi sửa ═══════════════════════════
   Bộ ghi KHÔNG gọi hàm nào của deck. Nó bấm CHUỘT THẬT vào trang
   (`recorder.click()`), đúng nhịp mà `timeline.build_click_timeline` tính ra.
   Luật của bảng nhịp đó (python/timeline.py):

     · Slide có N phần tử  →  N−1 cú bấm hé lộ phần tử 2…N
     · Cú bấm thứ N        →  chuyển sang slide kế, và phần tử 1 của slide mới
                              PHẢI hiện sẵn ngay lúc đó

   Nên "chuyển slide" và "hé lộ phần tử đầu của slide mới" là MỘT cú bấm, không
   phải hai. Tách ra là lệch cả video đi một nhịp.

   ⚠ Slide đầu tiên: `pipeline.js` bấm một cú mồi khi chưa có
   `.slide-element.visible` nào. Vì vậy KHÔNG được tự hé lộ lúc nạp trang —
   làm thế là mất cú mồi và lệch một nhịp. Đã có tiền lệ: deck kiểu cũ tự hiện
   đơn vị 1 nên bộ ghi phải dò `daTuHien` để bỏ cú mồi.

   ⚠ Slide 0 có 1 câu script thì bảng nhịp gộp mọi phần tử vào một cú bấm
   (HOOK_SENTENCE_COUNTS). Nên cú mồi phải hé lộ HẾT phần tử của slide 0, không
   phải từng cái một. */
'use strict';
(() => {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const tienDo = document.getElementById('tienDo');
  let iSlide = 0;

  const phanTu = (i) => Array.from(slides[i].querySelectorAll('.slide-element'));
  const conAn = (i) => phanTu(i).filter((e) => !e.classList.contains('visible'));

  function veTienDo() {
    if (tienDo) tienDo.style.width = `${((iSlide + 1) / slides.length) * 100}%`;
  }

  function hienHet(i) {
    phanTu(i).forEach((e) => e.classList.add('visible'));
  }

  function moSlide(i) {
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    iSlide = i;
    veTienDo();
  }

  /** Một cú bấm = một nhịp của bảng timeline. */
  function nhip() {
    const an = conAn(iSlide);
    if (an.length) {
      an[0].classList.add('visible');
      return;
    }
    if (iSlide < slides.length - 1) {
      moSlide(iSlide + 1);
      // Phần tử đầu của slide mới hiện NGAY trong cùng cú bấm — xem hợp đồng.
      const moi = conAn(iSlide);
      if (moi.length) moi[0].classList.add('visible');
    }
  }

  document.addEventListener('click', nhip);
  // Phím mũi tên / cách: chỉ để người soạn deck xem thử bằng bàn phím.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nhip(); }
  });

  moSlide(0);
  /* ⚠ SLIDE 0 PHẢI HIỆN SẴN LÚC NẠP — đừng đợi cú bấm.
     Slide hook có 1 câu, mà hợp đồng timeline là: N câu ⇒ N−1 cú để hiện dần,
     cú thứ N để SANG slide. N=1 ⇒ 0 cú hiện, cú 1 sang slide. Bản đầu tiêu cú 1
     để hiện slide 0 nên lệch đúng một cú: câu đầu đọc trên một slide TRỐNG, và
     phần tử cuối của deck không bao giờ được mở. Lộ ra khi xem deck trong sân
     khấu mới (15/09/2026) — opacity của cả hai phần tử đo được bằng 0. */
  hienHet(0);
  veTienDo();
})();
