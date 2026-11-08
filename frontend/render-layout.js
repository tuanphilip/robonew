'use strict';
/**
 * Sắp lại trang Dựng video theo bản thiết kế đã chốt.
 *
 * Bốn thay đổi:
 *   1. Đảo cột — danh sách sang TRÁI (chọn trước), bảng điều khiển sang PHẢI.
 *   2. Gộp hai công tắc thành MỘT hàng ba lựa chọn.
 *   3. Đánh số 1-2-3 cho ba bước.
 *   4. Nút render ghim đáy cột.
 *
 * VÌ SAO LÀM Ở ĐÂY THAY VÌ SỬA THẲNG `render-page.js`:
 * file đó 1800 dòng, trích nguyên từ bản web, và mọi thứ trong nó gắn với nhau
 * qua id/class. Đụng vào cấu trúc là kéo theo hàng chục chỗ. Lớp này chỉ **sắp
 * lại** những phần tử đã có và bấm hộ các nút cũ — logic bên dưới không đổi một
 * dòng, nên không có gì để hỏng. Muốn quay lại chỉ cần bỏ một thẻ script.
 */
(() => {
  /**
   * Lựa chọn giọng đọc, ánh xạ về đúng cặp (engine, mode) của bản cũ.
   *
   * `an: true` = TẠM ẨN nút, KHÔNG xoá. Cả đường xử lý phía sau (engine
   * `edgetts`, ô chọn giọng, mã sidecar) vẫn còn nguyên — bỏ `an: true` là nút
   * hiện lại ngay, không phải dựng lại gì. Xoá hẳn thì lần bật lại phải dò
   * ngược cả `index.html`, `api-shim.js` và pane `[data-pane="edgetts"]`.
   */
  /* Bảng nguồn giọng nằm ở giong.js (một chỗ duy nhất từ 02/09/2026) — thêm
     một nguồn là sửa ở đó, không phải ở đây lẫn api-shim.js. */
  const { GIONG, keyTu } = window.__beeGiong;

  function style() {
    // CSS của module này nằm ở css/render-layout.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  const $ = (s) => document.querySelector(s);

  /** Bấm hộ hai công tắc cũ. Không tự quản trạng thái — nguồn sự thật vẫn ở đó. */
  function chon(g) {
    const nutEngine = document.querySelector(`[data-engine="${g.engine}"]`);
    if (nutEngine) nutEngine.click();
    if (g.mode) {
      const radio = document.querySelector(`input[name="elevenMode"][value="${g.mode}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    to();
  }

  /** Tô lại nút nào đang chọn, đọc NGƯỢC từ trạng thái thật của mã cũ. */
  function to() {
    const engine = document.querySelector('[data-engine].active')?.dataset.engine || 'elevenlabs';
    const mode = document.querySelector('input[name="elevenMode"]:checked')?.value || 'upload';
    const dang = keyTu(engine, mode);
    document.querySelectorAll('.rl-giong button').forEach((b) => {
      b.classList.toggle('active', b.dataset.giong === dang);
    });
  }

  /**
   * Mốc chia phần — ICON chứ không phải SỐ THỨ TỰ (đổi 16/09/2026).
   *
   * "1." với "2." chỉ đúng khi hai mốc luôn đứng cạnh nhau theo thứ tự. Từ lúc
   * trang gộp, mốc 2 bị ẩn ở tab Âm thanh và mốc 1 bị ẩn trong hộp Tạo video —
   * nên chỗ nào cũng chỉ còn MỘT con số lẻ loi, đánh số một danh sách một phần
   * tử. Icon thì nói được nội dung của mốc ở bất kỳ chỗ nào nó xuất hiện.
   */
  function nhan(icon, chu, mo = false) {
    const d = document.createElement('div');
    d.className = `rl-buoc${mo ? ' mo' : ''}`;
    d.innerHTML = `<i class="btn-icon rl-buoc-ic" data-icon="${icon}"></i><span>${chu}</span>`;
    if (window.__beeIcons) window.__beeIcons.apply(d);
    return d;
  }


  /**
   * Dẹp DẢI ĐẦU TRANG của bảng điều khiển.
   *
   * Dải đó cao 80px mà chỉ có ba nút nằm dồn bên phải — logo đã chuyển sang
   * thanh trái nên nửa bên trái trống trơn. Ba nút ấy đều là việc hiếm dùng
   * (hai hướng dẫn + chọn thư mục nguồn), nên gộp vào hàng "Danh sách dự án"
   * cạnh nút Làm mới, rồi bỏ hẳn dải.
   *
   * KHÔNG xoá phần tử: nút đổi sáng/tối nằm trong đó và thẻ Cài đặt của popup
   * tài khoản bấm hộ chính nút này — xoá là thẻ đó mất tác dụng (đã ghi trong
   * pages.js). Chỉ chuyển chỗ, phần vỏ thì ẩn.
   */
  function depDauTrang() {
    const head = document.querySelector('.dashboard-header');
    const tools = head && head.querySelector('.header-tools');
    const title = document.querySelector('.list-title');
    if (!head || !tools || !title || title.querySelector('.header-tools')) return;
    const refresh = title.querySelector('#refreshList');
    // Hai nút hướng dẫn giữ chữ, nên phải chuyển chữ sang `title` cho lúc màn
    // hẹp chữ bị cắt — rê chuột vẫn biết là nút gì.
    [].slice.call(tools.querySelectorAll('.guide-header-btn')).forEach((b) => {
      const chu = (b.textContent || '').trim();
      if (chu && !b.getAttribute('title')) b.setAttribute('title', chu);
    });
    // ⚠ Đặt cụm nút xuống HÀNG RIÊNG, không nhét vào `.list-title`.
    //
    // Bản trước chèn thẳng vào cạnh tiêu đề. Cột này chỉ rộng nửa cửa sổ, mà
    // hàng đó có: tiêu đề 22px + 2 nút hướng dẫn có chữ + Source + đổi nền +
    // Làm mới. Không đủ chỗ → hoặc rớt dòng lộn xộn, hoặc (khi ép nowrap) các
    // nút ĐÈ LÊN tiêu đề — đã chụp thấy "Danh sách dự án (0)" chồng chữ.
    //
    // Nay: hàng trên chỉ tiêu đề + Làm mới (thứ bấm thường xuyên nhất, để sát
    // mép phải cho dễ nhắm), cụm còn lại xuống hàng dưới.
    title.parentElement.appendChild(tools);

    // Source LÊN hàng tiêu đề, đứng ngay trước Làm mới.
    //
    // Chọn thư mục nguồn hoá ra là việc làm thường xuyên chứ không hiếm như
    // đoạn trên đoán — nên nó thuộc về hàng trên cùng với Làm mới. Chỉ nhấc
    // MỘT nút này thôi: hai nút hướng dẫn có chữ dài, kéo cả lên là lặp lại
    // đúng cảnh nút đè chữ "Danh sách dự án (0)" đã chụp được trước đây.
    //
    // Chèn TRƯỚC `refresh` để Làm mới vẫn sát mép phải — nó là nút bấm nhiều
    // nhất, giữ nguyên chỗ cũ cho khỏi phải nhắm lại.
    const nutSource = tools.querySelector('[data-source-root-select]');
    if (nutSource) {
      const cum = document.createElement('div');
      cum.className = 'rl-cum-nut';
      if (refresh) title.insertBefore(cum, refresh);
      else title.appendChild(cum);

      /* ĐÃ BỎ ô lọc trạng thái (15/09/2026, chủ dự án yêu cầu).
         Ô tìm kiếm theo tên đã che gần hết nhu cầu, mà cột này chỉ rộng 380px —
         một ô chọn nữa là hàng công cụ phải xuống dòng.
         ⚠ KHÔNG gỡ `locDuAn()`/`capNhatOLoc()` bên `project-list.js`: cả hai đã
         tự lùi về "tất cả" khi không thấy `#locTrangThai`, và giữ chúng thì thêm
         lại ô lọc sau này chỉ là dựng lại cái thẻ. */

      cum.appendChild(nutSource);
      if (refresh) cum.appendChild(refresh);
    }

  }


  /**
   * Gom hai ô tick của Edge TTS vào MỘT hàng ngang.
   *
   * Làm ở đây thay vì sửa index.html: khối Edge TTS còn dùng chung với đường
   * cũ, đổi cấu trúc thẻ ở đó là đụng cả chỗ khác. Bọc lại thì chỉ trang này
   * đổi cách xếp, nội dung giữ nguyên.
   */
  function gomTick() {
    const pane = document.querySelector('[data-advanced-engine="edgetts"]');
    if (!pane || pane.querySelector('.hang-tick')) return;
    const ticks = [].slice.call(pane.querySelectorAll(':scope > label.check'));
    if (ticks.length < 2) return;
    const hang = document.createElement('div');
    hang.className = 'hang-tick';
    pane.insertBefore(hang, ticks[0]);
    ticks.forEach((t) => hang.appendChild(t));
  }


  /**
   * Đưa ô tick "Đọc lại giọng" lên hàng mốc "2 THÔNG SỐ".
   *
   * Có tới hai ô cùng nhãn — một của ElevenLabs, một của Edge TTS — nhưng mỗi
   * lúc chỉ một cái hiện. Chuyển CẢ HAI lên hàng mốc rồi để nguyên cơ chế
   * ẩn/hiện sẵn có lo phần còn lại; đụng vào cách ẩn/hiện là hỏng chỗ khác.
   */
  function tickLenMoc(moc) {
    if (!moc) return;
    const ds = [];
    ['elevenForce', 'edgeForce', 'beeForce', 'vieneuForce'].forEach((id) => {
      const o = document.getElementById(id);
      const nhan = o && o.closest('label.check');
      if (!nhan) return;
      // NHỚ khối gốc TRƯỚC khi chuyển: đó là thứ quyết định ô tick này thuộc
      // về engine nào. Chuyển ra khỏi khối là mất luôn cơ chế ẩn/hiện sẵn có —
      // đã chụp thấy cả hai ô cùng hiện, hai dòng chữ y hệt nhau nằm cạnh nhau.
      const goc = nhan.parentElement;
      nhan.classList.add('rl-tick');
      moc.appendChild(nhan);
      ds.push({ nhan, goc });
    });
    if (!ds.length) return;

    const dongBo = () => {
      ds.forEach(({ nhan, goc }) => {
        nhan.hidden = !goc || goc.offsetParent === null;
      });
    };
    dongBo();
    // Đổi engine hay đổi chế độ đều chỉ là bật/tắt thuộc tính hidden ở mấy khối
    // kia — rình đúng thuộc tính đó. Gộp theo khung hình cho khỏi chạy dồn.
    let cho = 0;
    new MutationObserver(() => {
      if (cho) return;
      cho = 1;
      requestAnimationFrame(() => { cho = 0; dongBo(); });
    }).observe(document.querySelector('.render-machine') || document.body,
      { attributes: true, subtree: true, attributeFilter: ['hidden', 'style', 'class'] });
  }


  /**
   * Bảng thông tin video — hiện khi rê vào dấu ⓘ `[data-thong-tin-video][data-project]`.
   *
   * Trước 11/10/2026 dấu này nằm trên từng dòng của danh sách dự án; chủ dự án
   * chuyển lên THANH TRÊN cạnh nút đổi tên (thanh-tren.js#tbThongTin) — nên nghe
   * trên cả trang, không riêng danh sách. Bảng vẫn vẽ ở đây, một chỗ.
   *
   * Đọc LƯỜI và có nhớ: chỉ hỏi `video:info` lần đầu rê vào mỗi deck.
   */
  function dauThongTin() {
    const list = document.getElementById('projectList');
    if (!list) return;

    const nho = new Map();
    let bang = null;

    const gio = (x) => {
      const n = Math.max(0, Math.round(Number(x) || 0));
      return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
    };
    const mb = (b) => `${(Number(b || 0) / 1024 / 1024).toFixed(1)} MB`;
    const tiLe = (w, h) => {
      const ucln = (a, b) => (b ? ucln(b, a % b) : a);
      const g = ucln(w, h) || 1;
      return `${w / g}:${h / g}`;
    };
    const ngay = (iso) => {
      const d = new Date(iso);
      if (isNaN(d)) return null;
      const hai = (x) => String(x).padStart(2, '0');
      return `${hai(d.getDate())}/${hai(d.getMonth() + 1)} ${hai(d.getHours())}:${hai(d.getMinutes())}`;
    };

    const dong = () => { if (bang) { bang.remove(); bang = null; } };

    const hien = (nut, d) => {
      dong();
      bang = document.createElement('div');
      bang.className = 'vid-bang';
      bang.id = 'vidBang';
      bang.setAttribute('role', 'tooltip');
      nut.setAttribute('aria-describedby', 'vidBang');
      if (!d) {
        bang.textContent = 'Chưa đọc được thông tin video.';
      } else {
        // CHỈ hiện dòng có dữ liệu — video render từ bản cũ thiếu vài mục, in
        // dấu gạch hàng loạt thì bảng trông như hỏng.
        const hang = [
          // Deck có chỉnh sửa timeline: bảng nói về VIDEO CUỐI `<tên>-dung.mp4` (src/dung/banCuoi.js).
          ['Bản', d.banDung ? 'Đã áp chỉnh sửa timeline' : null],
          ['Độ dài', d.duration ? gio(d.duration) : null],
          ['Khung hình', d.width && d.height ? `${d.width}×${d.height}` : null],
          ['Tỉ lệ', d.width && d.height ? tiLe(d.width, d.height) : null],
          ['Dung lượng', d.sizeBytes ? mb(d.sizeBytes) : null],
          ['Tốc độ khung', d.fps ? `${d.fps} fps` : null],
          ['Bitrate', d.bitrate ? `${Math.round(d.bitrate / 1000)} kbps` : null],
          ['Mã hoá', [d.codec, d.codecAmThanh].filter(Boolean).join(' / ') || null],
          ['Số slide', d.slides || null],
          ['Giọng đọc', d.engine ? ({ edge: 'Edge TTS', upload: 'File tải lên', beeknoee: 'Beeknoee AI', vieneu: 'Trên máy (VieNeu)' }[d.engine] || 'ElevenLabs') : null],
          ['Tốc độ đọc', d.speed ? `${d.speed}×` : null],
          ['Tạo lúc', d.taoLuc ? ngay(d.taoLuc) : null],
        ].filter(([, v]) => v != null && v !== '');
        const dl = document.createElement('dl');
        hang.forEach(([k, v]) => {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = String(v);
          dl.appendChild(dt);
          dl.appendChild(dd);
        });
        bang.appendChild(dl);
      }
      document.body.appendChild(bang);

      // position: fixed + toạ độ tính từ nút. Đặt trong dòng thì bảng bị cắt
      // theo vùng cuộn của danh sách.
      const r = nut.getBoundingClientRect();
      const b = bang.getBoundingClientRect();
      let top = r.bottom + 8;
      if (top + b.height > innerHeight - 8) top = Math.max(8, r.top - b.height - 8);
      bang.style.top = `${top}px`;
      bang.style.left = `${Math.min(Math.max(8, r.left - 6), innerWidth - b.width - 8)}px`;
    };

    // Dấu đang được trỏ vào. TỰ THEO DÕI thay vì hỏi `:hover` lúc dữ liệu về:
    // `:hover` chỉ đúng khi con trỏ thật nằm trên phần tử, nên nó sai trong mọi
    // phép thử tự động và cũng sai nếu hàng bị vẽ lại giữa chừng.
    let dangTro = null;

    /* Rê chuột VÀ tiêu điểm bàn phím (Tab tới nút ⓘ trên thanh trên) — trước đây dấu này ở danh sách có
       tabindex=-1; nay là nút thật nên bàn phím / trình đọc màn hình phải dùng được (rà 16/10/2026). */
    const moBang = async (e) => {
      const nut = e.target.closest && e.target.closest('[data-thong-tin-video][data-project]');
      if (!nut || !nut.dataset.project) return;
      dangTro = nut;
      const ten = nut.dataset.project;
      if (nho.has(ten)) { hien(nut, nho.get(ten)); return; }
      try {
        const d = await window.beeknoee.preview.videoInfo(ten, { banXuat: true });
        nho.set(ten, d);
        // Chuột có thể đã rời đi trong lúc chờ đọc — đừng bật bảng cho một dấu
        // người dùng không còn trỏ vào.
        if (dangTro === nut) hien(nut, d);
      } catch { nho.set(ten, null); }
    };
    const dongBang = (e) => {
      if (!e.target.closest || !e.target.closest('[data-thong-tin-video]')) return;
      dangTro = null;
      dong();
    };
    document.addEventListener('mouseover', moBang);
    document.addEventListener('focusin', moBang);
    document.addEventListener('mouseout', dongBang);
    document.addEventListener('focusout', dongBang);
    /* Vẽ lại danh sách (Làm mới, đổi thư mục, dựng xong) là mọi dấu cũ biến
       mất — bảng nổi thì không, phải tự dọn.
       ⚠ VÀ PHẢI XOÁ BỘ NHỚ. `nho` giữ kết quả `video:info` theo TÊN DECK và
       trước đây không bao giờ hết hạn: dựng lại cùng một deck với tốc độ khác
       thì `.info.json` trên đĩa đã đổi, nhưng rê vào dấu ⓘ vẫn ra bảng của lượt
       dựng ĐẦU TIÊN trong phiên — độ dài, dung lượng, tốc độ đọc, giờ tạo đều
       là số cũ. Chủ dự án phát hiện 16/09/2026. Danh sách được vẽ lại sau mỗi
       lượt dựng, nên xoá ở đây là đủ và không tốn thêm nhịp nào. */
    new MutationObserver(() => { dong(); nho.clear(); }).observe(list, { childList: true });
  }

  function boot() {
    const may = $('.render-machine');
    const ds = $('.slide-list');
    if (!may || !ds) return;
    style();
    depDauTrang();
    gomTick();
    dauThongTin();

    // KHÔNG đánh số ở cột danh sách: tiêu đề "Danh sách dự án (N)" ngay trên đó
    // đã nói rõ đây là gì, thêm dòng "1 CHỌN DỰ ÁN" là nhắc lại một lần nữa.
    // Hai bước còn lại vẫn giữ số vì chúng nằm chung một cột, cần thứ tự.
    const tabs = may.querySelector('.tabs');

    // Khối đầu trang: một tấm nền có ảnh, mang icon + tiêu đề + deck đang chọn.
    // Tên deck xuống DÒNG RIÊNG dưới tiêu đề chứ không nằm cùng hàng như trước:
    // tên deck dài (`agent-reach-ai-agent-internet-9slide`) đẩy tiêu đề co lại
    // rồi cả hàng gãy ở chỗ tuỳ hứng.
    const dau = document.createElement('div');
    dau.className = 'rl-dau';
    dau.innerHTML =
      '<div class="rl-dau-hang">'
      + '<span class="rl-dau-icon"><span class="btn-icon" data-icon="play"></span></span>'
      + '<div class="rl-dau-chu">'
      + '<div class="rl-tieude">Dựng video</div>'
      + '<div class="rl-deck"></div>'
      + '</div>'
      + '</div>'
      // Khớp với tên hai mốc bên dưới ("1 Giọng đọc" / "2 Tuỳ chỉnh video") — dòng
      // này là bản tóm tắt của chúng, gọi khác tên là người đọc phải tự ghép.
      + '<div class="rl-phu">Chọn giọng đọc, tuỳ chỉnh video rồi bấm tạo video.</div>';
    // Bám theo ô tên deck cũ (đã ẩn) thay vì tự tra danh sách: ô đó do
    // `setSelectedProject()` cập nhật, nên chép lại là luôn đúng, không cần
    // móc thêm vào luồng chọn dự án.
    const nguon = $('#selectedName');
    const oDeck = dau.querySelector('.rl-deck');
    const dongBo = () => {
      const t = (nguon && nguon.textContent || '').trim();
      const co = Boolean(t) && t !== 'Chưa chọn dự án';
      // ⚠ Dòng này LUÔN có chữ, kể cả lúc chưa chọn gì. Để trống thì khối đầu
      // trang thấp đi một dòng rồi cao lại ngay khi chọn deck — cả cột bên phải
      // giật một nhịp ở đúng cú bấm đầu tiên của người dùng.
      oDeck.classList.toggle('trong', !co);
      oDeck.textContent = co ? 'Dự án đang chọn: ' : 'Chưa chọn dự án';
      // Tên deck do NGƯỜI DÙNG đặt (tên thư mục) — dựng bằng textContent chứ
      // không nối chuỗi vào innerHTML.
      if (co) {
        const b = document.createElement('b');
        b.textContent = t;
        oDeck.appendChild(b);
      }
    };
    if (nguon) {
      dongBo();
      new MutationObserver(dongBo).observe(nguon, { childList: true, characterData: true, subtree: true });
    }
    may.insertBefore(dau, may.firstChild);
    // icons.js chỉ quét trang một lần lúc nạp; khối này dựng sau nên phải gọi
    // tay, nếu không `data-icon` nằm đó mà không ai thay bằng SVG.
    if (window.__beeIcons) window.__beeIcons.apply(dau);

    // Bước 2 + hàng ba lựa chọn, chèn ngay trước hai công tắc cũ (đã ẩn).
    const giong = document.createElement('div');
    giong.className = 'rl-giong';
    giong.setAttribute('aria-label', 'Chọn nguồn giọng đọc');
    GIONG.filter((g) => !g.an).forEach((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.giong = g.key;
      b.innerHTML = `<span class="rl-giong-icon"><span class="btn-icon" data-icon="${g.icon || 'mic'}"></span></span>`
        + `<span class="rl-giong-chu"><b>${g.nhan}</b><em>${g.phu}</em></span>`;
      b.onclick = () => chon(g);
      giong.appendChild(b);
    });
    // icons.js chỉ quét trang một lần lúc nạp; ba nút này dựng sau nên phải gọi
    // tay, nếu không `data-icon` nằm đó mà không ai thay bằng SVG.
    if (window.__beeIcons) window.__beeIcons.apply(giong);

    // Nếu công tắc cũ đang đứng ở một engine vừa bị ẩn thì kéo về lựa chọn đầu
    // tiên còn hiện. Không làm thì `to()` tính ra `dang='edge'`, không nút nào
    // sáng lên, mà bảng thông số vẫn hiện của engine người dùng không chọn được.
    const dangAn = GIONG.find((g) => g.an
      && document.querySelector(`[data-engine="${g.engine}"]`)?.classList.contains('active'));
    if (dangAn) chon(GIONG.find((g) => !g.an));
    if (tabs) {
      // Hai nút hướng dẫn về ĐÚNG mốc "1. Giọng đọc", nằm mép phải.
      //
      // Chúng vốn ở cột danh sách dự án bên kia — xa hẳn chỗ người dùng đang
      // bí. Ai loay hoay ở bước chọn giọng thì hướng dẫn phải nằm trong tầm
      // mắt, không phải liếc sang cột khác.
      //
      // Chạy SAU `depDauTrang()` (dòng 664) nên cụm nút đã ở chỗ mới; tra bằng
      // `document` chứ không phải một nhánh cố định để khỏi phụ thuộc thứ tự.
      const moc1 = nhan('mic', 'Giọng đọc');
      const nutHD = [].slice.call(document.querySelectorAll('.guide-header-btn'));
      if (nutHD.length) {
        const cum = document.createElement('span');
        cum.className = 'rl-hd';
        nutHD.forEach((b) => cum.appendChild(b));
        moc1.appendChild(cum);
      }
      may.insertBefore(moc1, tabs);
      may.insertBefore(giong, tabs);
    }

    // Bước 3 trước khối thông số nâng cao.
    const nangCao = $('#advancedSettings');
    if (nangCao) {
      /* "Tuỳ chỉnh video" chứ không phải "Thông số".
         "Thông số" không nói gì cả — thông số của ai, để làm gì? Bên trong là
         tốc độ đọc, độ phân giải, phụ đề: toàn thứ quyết định VIDEO ra sao. */
      const moc2 = nhan('phim', 'Tuỳ chỉnh video', true);
      may.insertBefore(moc2, nangCao);
      tickLenMoc(moc2);
    }

    // Gói mọi thứ TRỪ cụm nút render vào một khối cuộn được, để cụm nút ghim đáy.
    const nut = may.querySelector('.render-primary-actions');
    if (nut) {
      const tt = document.getElementById('renderState');
      const than = document.createElement('div');
      than.className = 'rl-than';
      // Chuyển HẾT con vào vùng cuộn rồi mới đưa nút (và bảng tiến trình) ra
      // ngoài. Bản đầu chỉ chuyển những con ĐỨNG TRƯỚC nút, nên khối "Thông số"
      // — vốn nằm SAU nút trong DOM — ở lại ngoài và rơi xuống dưới nút ghim.
      // Kết quả: nút render nằm giữa cột, đúng chỗ nó không nên nằm.
      while (may.firstChild) than.appendChild(may.firstChild);
      may.appendChild(than);
      may.appendChild(nut);
      if (tt) may.appendChild(tt);
      /* ⚠ DÒNG THÔNG BÁO KHÔNG CÒN Ở ĐÂY — nó lên THANH TRÊN, bên trái nút
         Hướng dẫn. Chỗ dời nay nằm ở `render/thanh-tren.js#dung()`; đừng dời
         lại về cột phải, và đừng dời ở hai nơi (phần tử chỉ có một, hai chỗ
         cùng dời thì chỗ chạy sau thắng và chỗ kia im lặng vô tác dụng).

         Lịch sử bốn chỗ đã thử, để ai định đổi lần nữa khỏi thử lại từ đầu:
         · `tt.appendChild(st)` — cuối bảng tiến độ. Bảng đó ẩn hẳn khi chưa
           chạy gì (`panel.hidden = !title`), mà dòng này còn gánh những câu
           KHÔNG liên quan tới render ("Đã copy script của X", "Đã chuyển X vào
           Thùng rác", lỗi lưu API key). Mọi câu đó ghi ra rồi mất không dấu
           vết. Đo 12/09/2026: display: none, cha là renderState:none [hidden].
         · `may.appendChild(st)` — sau bảng. Hết ẩn, nhưng rơi xuống DƯỚI nút
           Tạo video đã ghim đáy cột: đo được top 841 trong cửa sổ cao 641.
         · NGAY SAU cụm nút (12/09/2026 → 20/09/2026) — đọc được, nhưng vẫn ở
           đáy cột phải nên phải cúi mắt xuống mới thấy, và nó cách xa chỗ người
           ta vừa bấm khi thao tác nằm ở cột trái (mở thư mục, chép phụ đề, xoá
           dự án — phần lớn câu báo đến từ đó).
         · THANH TRÊN, trái nút Hướng dẫn (20/09/2026, chủ dự án yêu cầu: "ở đấy
           user dễ đọc hơn") — chỗ đang dùng. */
    }

    // Bấm hai công tắc cũ (nếu ai đó vẫn tới được) thì hàng mới phải tô lại.
    document.querySelectorAll('[data-engine]').forEach((b) => b.addEventListener('click', () => setTimeout(to, 0)));
    document.querySelectorAll('input[name="elevenMode"]').forEach((r) => r.addEventListener('change', () => setTimeout(to, 0)));
    to();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
