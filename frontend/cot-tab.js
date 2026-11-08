'use strict';
/**
 * HÀNG TAB của cột trái (còn "AI agent" — "Thư viện" sang bảng phải 16/10/2026) + bộ vẽ markdown cho khung chat.
 *
 * Tách từ `ai-tao.js` khi gỡ tab "Tạo bằng AI" (16/10/2026, chủ dự án: "kết nối bằng AI agent rồi thì
 * bỏ tab tạo bằng AI"). Hai thứ dùng chung còn lại sống ở đây:
 *   - `window.__beeMoTab(ma)` — mở một tab, nhớ lựa chọn (agent-tab.js, src/agentChat/index.js gọi);
 *   - `window.__beeVeMarkdown(el, raw)` — markdown → DOM cho tin nhắn của agent (agent-tab.js).
 * Kiểu dáng khung chat (`.ait-*`) vẫn ở `css/ai-tao.css`.
 *
 * ⚠ Nạp TRƯỚC agent-tab.js (nó lấy hai hàm trên lúc dựng).
 */
(function () {
  const KHOA_TAB = 'bee:cot-du-an:tab';
  // 'thuvien' dời sang bảng phải (render/tab-phai.js, 16/10/2026) — cột trái chỉ còn AI agent.
  const TAB = ['agent'];

  const tao = (the, lop) => {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    return e;
  };

  // ── chuyển tab ─────────────────────────────────────────────────────────
  const hangTab = document.querySelector('.rl-tab');
  function moTab(ma) {
    if (!hangTab) return;
    if (!TAB.includes(ma)) ma = TAB[0];
    for (const n of hangTab.querySelectorAll('.rl-tab-nut')) {
      const chon = n.dataset.pane === ma;
      n.classList.toggle('dang-chon', chon);
      n.setAttribute('aria-selected', chon ? 'true' : 'false');
    }
    for (const p of document.querySelectorAll('.slide-list .rl-pane')) {
      p.hidden = p.dataset.pane !== ma;
    }
    try { localStorage.setItem(KHOA_TAB, ma); } catch { /* chế độ riêng tư thì thôi */ }
  }
  if (hangTab) {
    hangTab.addEventListener('click', (e) => {
      const n = e.target.closest('.rl-tab-nut');
      if (n) moTab(n.dataset.pane);
    });
    /* Máy còn nhớ 'ai' (tab "Tạo bằng AI" đã gỡ) hay 'duan' (đã thành hộp bật lên) ⇒ về "AI agent". */
    let dau = TAB[0];
    try { dau = localStorage.getItem(KHOA_TAB) || TAB[0]; } catch { /* không có kho */ }
    moTab(dau);
  }

  /**
   * MARKDOWN → DOM. Nhỏ, đủ dùng, và KHÔNG đi qua `innerHTML`.
   *
   * ⚠ VÌ SAO TỰ VIẾT chứ không kéo một thư viện: chữ ở đây do MODEL sinh ra,
   * tức là dữ liệu ngoài. Mọi thư viện markdown đều trả về một CHUỖI HTML, mà
   * nhận chuỗi HTML từ model rồi gán `innerHTML` là mở sẵn cửa cho `<script>`,
   * `<img onerror>`, `<iframe>`. Dựng thẳng bằng `createElement` +
   * `textContent` thì không có đường nào để chữ biến thành thẻ. Đổi lại chỉ
   * nhận đúng mấy cú pháp model hay dùng, liệt kê ngay dưới.
   *
   * ⚠ Link `[chữ](url)` KHÔNG thành `<a>`: bấm vào một địa chỉ do model bịa ra,
   * trong một cửa sổ Electron, là đánh đổi không đáng. Hiện thành `chữ (url)`
   * để người dùng tự quyết.
   */
  function veMarkdown(el, raw) {
    el.textContent = '';
    const dong = String(raw || '').split(/\r?\n/);
    const doan = [];   // gom các dòng chữ liền nhau thành một đoạn
    let i = 0;
    const xaDoan = () => {
      if (!doan.length) return;
      const p = tao('div', 'ait-md-p');
      inDong(p, doan.join(' '));
      el.append(p);
      doan.length = 0;
    };
    while (i < dong.length) {
      const d = dong[i];
      /* Khối mã ```…```: giữ nguyên từng ký tự, không xét cú pháp gì bên trong. */
      if (/^\s*```/.test(d)) {
        i += 1;
        const than = [];
        while (i < dong.length && !/^\s*```/.test(dong[i])) { than.push(dong[i]); i += 1; }
        i += 1;
        xaDoan();
        const pre = tao('pre', 'ait-md-ma');
        pre.textContent = than.join('\n');
        el.append(pre);
        continue;
      }
      const tieuDe = d.match(/^(#{1,6})\s+(.*)$/);
      if (tieuDe) {
        xaDoan();
        /* Luôn là `div` chứ không `h1`-`h6`: trong khung chat hẹp, cỡ chữ của
           thẻ tiêu đề thật quá lớn — thứ cần là ĐẬM và tách dòng. */
        const h = tao('div', `ait-md-h ait-md-h${Math.min(tieuDe[1].length, 3)}`);
        inDong(h, tieuDe[2]);
        el.append(h);
        i += 1;
        continue;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(d)) {
        xaDoan();
        el.append(tao('div', 'ait-md-vach'));
        i += 1;
        continue;
      }
      const gach = d.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (gach) {
        xaDoan();
        const li = tao('div', 'ait-md-li');
        const dau = tao('span', 'ait-md-dau');
        dau.textContent = /\d/.test(gach[1]) ? gach[1] : '•';
        const noi = tao('span');
        inDong(noi, gach[2]);
        li.append(dau, noi);
        el.append(li);
        i += 1;
        continue;
      }
      if (!d.trim()) { xaDoan(); i += 1; continue; }
      doan.push(d.trim());
      i += 1;
    }
    xaDoan();
  }

  /** Chữ trong MỘT dòng: `**đậm**`, `*nghiêng*`, `` `mã` ``, `[chữ](url)`. */
  function inDong(cha, chu) {
    const re = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
    let cuoi = 0;
    let m = re.exec(chu);
    while (m) {
      if (m.index > cuoi) cha.append(document.createTextNode(chu.slice(cuoi, m.index)));
      if (m[1] != null || m[2] != null) {
        const b = tao('b');
        b.textContent = m[1] != null ? m[1] : m[2];
        cha.append(b);
      } else if (m[3] != null) {
        const it = tao('i');
        it.textContent = m[3];
        cha.append(it);
      } else if (m[4] != null) {
        const c = tao('code', 'ait-md-code');
        c.textContent = m[4];
        cha.append(c);
      } else {
        cha.append(document.createTextNode(`${m[5]} (${m[6]})`));
      }
      cuoi = m.index + m[0].length;
      m = re.exec(chu);
    }
    if (cuoi < chu.length) cha.append(document.createTextNode(chu.slice(cuoi)));
  }

  window.__beeMoTab = moTab;
  window.__beeVeMarkdown = veMarkdown;
})();
