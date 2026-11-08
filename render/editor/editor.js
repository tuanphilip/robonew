}
(function () {
  var done = false;

  /* ── Icon ─────────────────────────────────────────────────────────────
     Lấy từ BỘ CHUNG `window.__beeIcons` — cùng tệp `icons.js` mà giao
     diện app dùng, do previewHtml.js bơm vào tài liệu này. Trang xem trước
     nằm trong iframe nên không thấy `window` của app, nhưng đó là lý do để
     bơm CHÍNH tệp đó vào, không phải để chép một bộ icon thứ hai. */
  function veIcon(ten) {
    var s = document.createElement("span");
    s.className = "ed-ic";
    s.setAttribute("aria-hidden", "true");
    var bo = window.__beeIcons;
    s.innerHTML = (bo && bo.ICONS[ten]) || "";
    return s;
  }
  /* Gắn icon vào ĐẦU một phần tử, bỏ qua nếu đã gắn — hàm sắp xếp lại bảng
     có thể chạy lại khi deck dựng lại editor. */
  function ganIcon(el, ten) {
    if (!el || el.querySelector(":scope > .ed-ic")) return;
    el.insertBefore(veIcon(ten), el.firstChild);
  }

  /* ── Đổi bộ icon FONT AWESOME của deck sang bộ chung ───────────────────
     Markup của deck dùng Font Awesome (`<i class="fa-solid fa-sun">`), vẽ theo
     lối TÔ ĐẶC. Bộ của app là Lucide, vẽ NÉT RỖNG. Trong cùng một bảng sửa thì
     hai lối đứng cạnh nhau, mắt đọc ngay ra là chắp vá — và đó đúng là chỗ
     người dùng chỉ ra.

     ⚠ GIỮ NGUYÊN thẻ <i>, chỉ thay ruột và tên lớp. CSS của deck neo vào thẻ
     (`.tone-mode-toggle i`, `.side-btn i` … đặt font-size cho từng chỗ), nên
     thay bằng thẻ khác là mất hết cỡ; để SVG rộng 1em thì nó ăn đúng cỡ mà
     deck đã định cho ký tự cũ.

     ⚠ KHÔNG đụng gì trong `.slide-container` — icon trong đó là NỘI DUNG SLIDE,
     lên hình trong video. (Đo được: 0 icon FA nằm trong đó, nhưng deck của người
     dùng có thể khác nên vẫn chặn.) Tệp này chỉ được bơm vào _preview.html, còn
     trang quay là _recording.html — video không đi qua đây.

     Sửa Ở ĐÂY chứ không sửa app.js của deck, cùng lý do như chỗ đổi nhãn quầng
     sáng: thư mục authoring là bản sao do prepare:authoring sinh lại, mà deck
     người dùng đã tạo từ trước vẫn mang markup cũ. */
  var BANG_FA = {
    'fa-scroll': 'cuon',
    'fa-sliders': 'truot',
    'fa-music': 'nhac',
    'fa-forward': 'tua',
    'fa-wand-magic-sparkles': 'nen',
    'fa-moon': 'moon',
    'fa-sun': 'sun',
    'fa-volume-high': 'loa',
    'fa-volume-xmark': 'loatat',
    'fa-chevron-up': 'len',
    'fa-chevron-down': 'xuong',
    'fa-chevron-left': 'trai',
    'fa-chevron-right': 'phai',
    'fa-circle-half-stroke': 'tuongphan',
    'fa-upload': 'upload',
    'fa-trash': 'trash',
    'fa-rotate-left': 'hoantac'
  };

  function quetFA() {
    var bo = window.__beeIcons;
    if (!bo) return;
    var ds = document.querySelectorAll('i[class*="fa-"]');
    for (var i = 0; i < ds.length; i++) {
      var e = ds[i];
      if (e.closest('.slide-container')) continue;
      var lop = String(e.getAttribute('class') || '').split(/\s+/);
      var ten = null;
      for (var j = 0; j < lop.length && !ten; j++) ten = BANG_FA[lop[j]] || null;
      if (!ten || !bo.ICONS[ten]) continue;
      e.setAttribute('class', 'ed-fa');
      e.innerHTML = bo.ICONS[ten];
    }
  }

  function doiIconFA() {
    quetFA();
    /* Deck dựng lại vài chỗ LÚC CHẠY: toggleMute() ghi đè innerHTML nút loa,
       còn applyVisualSettings() đặt lại className của icon nút Dark/Cream —
       cả hai đều trả icon FA về. Rình hai gốc đó rồi quét lại.
       KHÔNG rình cả body: khung slide có canvas hiệu ứng chạy liên tục, rình
       trúng nó là mỗi khung hình một lần gọi. */
    var hen = 0;
    var obs = new MutationObserver(function () {
      if (hen) return;
      hen = setTimeout(function () { hen = 0; quetFA(); }, 0);
    });
    var goc = document.querySelectorAll('.theme-editor-panel, .side-controls');
    for (var i = 0; i < goc.length; i++) {
      obs.observe(goc[i], { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ── Mách nhỏ hiện NGAY khi rê chuột ───────────────────────────────────
     `title` của trình duyệt đợi khoảng một giây mới hiện và vẽ theo kiểu của
     hệ điều hành. Nút chỉ còn mỗi cái icon thì một giây ấy là một giây người
     dùng không biết nút làm gì — nên tự vẽ.
     Đặt thẳng vào body theo lối `fixed`: thẻ chứa nút có `overflow: hidden`
     (để bo góc) và vùng bảng thì cuộn dọc, đặt tuyệt đối bên trong là bị cắt. */
  var oMach = null;
  function hienMach(nut) {
    if (!oMach) {
      oMach = document.createElement('div');
      oMach.className = 'ed-mach';
      document.body.appendChild(oMach);
    }
    oMach.textContent = nut.getAttribute('data-ed-mach') || '';
    oMach.classList.add('hien');
    var b = nut.getBoundingClientRect();
    var t = oMach.getBoundingClientRect();
    var x = Math.min(Math.max(6, b.left + b.width / 2 - t.width / 2), window.innerWidth - t.width - 6);
    var y = b.top - t.height - 7;
    if (y < 6) y = b.bottom + 7;
    oMach.style.left = Math.round(x) + 'px';
    oMach.style.top = Math.round(y) + 'px';
  }
  function tatMach() { if (oMach) oMach.classList.remove('hien'); }
  function ganMach(nut, chu) {
    if (!nut || nut.getAttribute('data-ed-mach')) return;
    nut.setAttribute('data-ed-mach', chu);
    nut.addEventListener('mouseenter', function () { hienMach(nut); });
    nut.addEventListener('mouseleave', tatMach);
    nut.addEventListener('click', tatMach);
  }

  /* ── Nút "Xoá slide": bỏ chữ, chỉ còn cái thùng rác ────────────────────
     Chữ "Xoá slide" đứng cạnh chữ "Khôi phục" ở cuối một thẻ vốn đã đầy ô nhập.
     Cái thùng rác đỏ một mình đã nói đủ, mà rê chuột vào là có mách chữ ngay.
     Bỏ ĐÚNG các nút văn bản, giữ thẻ <i> — icon vừa dựng nằm trong đó. */
  function nutXoaChiIcon() {
    var n = document.getElementById('deleteSlideBtn');
    if (!n || n.classList.contains('ed-chi-icon')) return;
    var con = [].slice.call(n.childNodes);
    for (var i = 0; i < con.length; i++) {
      if (con[i].nodeType === 3) n.removeChild(con[i]);
    }
    n.classList.add('ed-chi-icon');
    n.setAttribute('aria-label', 'Xoá slide');
    ganMach(n, 'Xoá slide');
  }


  /* Nhãn của một lưới con trong bảng quầng sáng: [icon] TÊN … chú thích mờ. */
  function nhanMuc(o, icon, ten, chu) {
    if (!o) return;
    o.appendChild(veIcon(icon));
    var b = document.createElement('b');
    b.textContent = ten;
    o.appendChild(b);
    var s = document.createElement('small');
    s.textContent = chu;
    o.appendChild(s);
  }

  function moveToneToggle() {
    var toggle = document.getElementById('toneModeToggle');
    var side = document.querySelector('.side-controls');
    var mute = document.getElementById('muteBtn');
    if (!toggle || !side || !mute) return false;
    // Đặt NGAY TRÊN nút loa, kèm đường kẻ ngăn cho khỏi dính vào nhau.
    var sep = document.createElement('div');
    sep.className = 'side-divider';
    toggle.classList.add('side-tone-toggle');
    side.insertBefore(sep, mute);
    side.insertBefore(toggle, sep);
    return true;
  }

  /**
   * Gộp PHỤ ĐỀ và SCRIPT thành MỘT thẻ.
   *
   * Hai khối vốn nói về cùng một slide: phụ đề là hình thức, script là nội dung.
   * Tách đôi thì người dùng phải nhìn hai chỗ, mà mỗi chỗ lại có một ô "Slide
   * N / M" riêng — hai lần cùng một thông tin.
   *
   * Bố cục sau khi gộp:
   *   [PHỤ ĐỀ + mô tả] ................................ [Slide 1 / 10]
   *   [Bật subtitle | Chữ nền | Chữ chạy | Cỡ chữ | Vị trí đáy]
   *   SCRIPT
   *   [ô nhập]
   *   [tự lưu / trạng thái] ................ [Xoá slide] [Khôi phục]
   */
  function mergeSubtitleAndScript() {
    var sub = document.querySelector('.theme-editor-section-subtitles');
    var script = document.querySelector('.theme-editor-section-script');
    if (!sub || !script) return false;

    var subTitle = sub.querySelector('.theme-editor-section-title');
    var slideBadge = document.getElementById('slideDeleteBadge');
    var scriptTitle = script.querySelector('.theme-editor-section-title');
    var scriptBadge = document.getElementById('scriptEditorBadge');
    var scriptText = document.getElementById('scriptEditorText');
    var scriptHint = script.querySelector('.script-editor-hint');
    var scriptStatus = document.getElementById('scriptEditorStatus');
    var actions = sub.querySelector('.theme-editor-slide-actions');
    if (!subTitle || !scriptText || !actions) return false;

    // 1. Đầu thẻ: tiêu đề + mô tả bên trái, số slide bên phải.
    var head = document.createElement('div');
    head.className = 'merged-head';
    sub.insertBefore(head, sub.firstChild);
    var titleWrap = document.createElement('div');
    titleWrap.className = 'merged-title';
    head.appendChild(titleWrap);
    titleWrap.appendChild(subTitle);
    // Bỏ dòng mô tả: tiêu đề PHỤ ĐỀ + nhãn công tắc đã nói đủ.
    // Dùng ô số của PHỤ ĐỀ; ô của SCRIPT chỉ ẨN, KHÔNG XOÁ.
    //
    // updateScriptEditor() của deck mở đầu bằng
    //     if (!badge || !text) return;
    // nên xoá #scriptEditorBadge là hàm thoát ngay ở dòng đầu — ô script
    // không bao giờ được nạp lại, chuyển slide thì chữ đứng im. Đã dính thật.
    // Giữ phần tử trong DOM, ẩn bằng CSS, thì hàm vẫn chạy trọn.
    if (slideBadge) head.appendChild(slideBadge);
    if (scriptBadge) {
      // PHẢI CHUYỂN sang thẻ mới, không chỉ gắn class: cuối hàm có
      // script.remove() xoá cả khối SCRIPT, mà ô này vẫn là con của nó.
      // Lần đầu tôi chỉ gắn class nên nó vẫn bị xoá theo, và lỗi tái diễn y hệt.
      scriptBadge.classList.add('is-hidden-dup');
      head.appendChild(scriptBadge);
    }

    // 2. Công tắc BẬT PHỤ ĐỀ lên ngay dòng tiêu đề, dạng gạt.
    //
    // Nó là cái bật/tắt cả khối bên dưới — đứng lẫn giữa mấy ô màu thì trông
    // ngang hàng với chúng, trong khi thực ra nó quyết định chúng có tác dụng
    // hay không.
    //
    // Nhãn ghi luôn "mọi slide": bỏ dòng chú thích phạm vi riêng theo yêu cầu
    // chủ dự án, nhưng thông tin đó KHÔNG được mất — chỉnh cỡ chữ ở slide 3 mà
    // tưởng chỉ slide 3 đổi là hiểu nhầm đắt nhất ở thẻ này.
    var controls = document.createElement('div');
    controls.className = 'merged-controls';
    var check = sub.querySelector('.theme-editor-check');
    var colorRow = sub.querySelector('.subtitle-color-row');
    var fields = [].slice.call(sub.querySelectorAll(':scope > label.theme-editor-field'));
    var anchor = sub.querySelector('.theme-editor-status');
    sub.insertBefore(controls, anchor);
    if (check) {
      check.classList.add('merged-switch');
      var nhan = check.querySelector('span');
      if (nhan) nhan.textContent = 'Bật phụ đề · mọi slide';
    }
    if (colorRow) controls.appendChild(colorRow);
    fields.forEach(function (f) { controls.appendChild(f); });

    // 3. Phần script chuyển sang, đặt trước cụm nút.
    var body = document.createElement('div');
    body.className = 'merged-script';
    sub.insertBefore(body, actions);
    // Hàng tiêu đề của ô nhập: tên bên trái, công tắc bật phụ đề bên phải.
    //
    // Công tắc trước ở hàng tiêu đề THẺ, cách ô nhập cả một khối điều khiển —
    // trong khi thứ nó bật/tắt chính là đám chữ gõ ở đây. Để cạnh nhau thì
    // quan hệ giữa hai cái tự hiện ra, không phải giải thích.
    var hangTitle = document.createElement('div');
    hangTitle.className = 'merged-script-head';
    body.appendChild(hangTitle);
    if (scriptTitle) {
      // "SCRIPT" là chữ của dân dựng. Cái gõ ở đây chính là lời đọc hiện lên
      // dưới màn hình — gọi đúng tên nó, kèm luôn cách lưu để khỏi ai đi tìm
      // nút Lưu (không có nút nào, gõ xong 0,9 giây là tự ghi ra file).
      scriptTitle.textContent = 'Phụ đề tự lưu sau khi sửa';
      ganIcon(scriptTitle, 'luu');
      hangTitle.appendChild(scriptTitle);
    }
    // Ô "Slide N / M" xuống theo. Nó đếm slide ĐANG xem, mà thứ đổi theo slide
    // chính là đoạn chữ ngay dưới — để cạnh nhau thì đọc một mạch.
    // Nối theo ĐÚNG THỨ TỰ, không insertBefore(check): lúc này check chưa phải
    // con của hangTitle nên insertBefore ném NotFoundError — mà lỗi đó rơi ra
    // giữa run(), done không bao giờ được đặt, MutationObserver gọi lại run()
    // liên tục và renderer chết. Đúng cái đã xảy ra.
    if (slideBadge) hangTitle.appendChild(slideBadge);
    if (check) hangTitle.appendChild(check);
    body.appendChild(scriptText);

    // Hàng đầu thẻ nay rỗng: tiêu đề đã bỏ (tab đã gọi tên), công tắc và ô số
    // slide đều chuyển xuống. Để lại là một dải trắng cao 40px không nội dung.
    //
    // #scriptEditorBadge phải theo xuống chứ KHÔNG xoá cùng: updateScriptEditor
    // mở đầu bằng một phép kiểm "không có badge thì thoát" — mất nó là chữ
    // đứng im khi chuyển slide. Nó vẫn mang is-hidden-dup nên không hiện.
    if (scriptBadge) hangTitle.appendChild(scriptBadge);
    head.remove();

    // 4. Chân thẻ: chú thích/trạng thái bên trái, nút bên phải.
    // Nút "Xoá slide" / "Khôi phục" lên HÀNG ĐIỀU KHIỂN phía trên, cạnh cỡ chữ
    // và vị trí đáy. Ở đáy thẻ chúng đứng một mình dưới ô script rất dài, phải
    // cuộn xuống mới thấy — mà đó là hai nút tác động tới cả slide.
    if (actions) {
      actions.classList.add('merged-actions-top');
      controls.appendChild(actions);
    }

    var foot = document.createElement('div');
    foot.className = 'merged-foot';
    sub.appendChild(foot);
    var left = document.createElement('div');
    left.className = 'merged-foot-left';
    foot.appendChild(left);
    // KHÔNG hiện scriptHint: đó là dòng "Đã lưu trên trình duyệt" của bản web
    // cũ — từ thời chưa ghi được ra đĩa. Nay script lưu THẲNG vào file
    // script-90s.txt (xem setupRealAutosave), nên câu đó vừa thừa vừa sai.
    // Vẫn giữ phần tử trong DOM: mã của deck có ghi vào nó.
    if (scriptHint) { scriptHint.classList.add('is-hidden-dup'); left.appendChild(scriptHint); }
    // scriptStatus cũng ẩn: nội dung nó ghi ra là "Đã lưu trên trình duyệt" —
    // câu của bản web cũ, nay sai vì script lưu thẳng ra file. Vẫn giữ trong
    // DOM vì mã của deck ghi vào nó.
    if (scriptStatus) { scriptStatus.classList.add('is-hidden-dup'); left.appendChild(scriptStatus); }

    // 5. Bỏ khối SCRIPT rỗng và mấy đường kẻ thừa.
    script.remove();
    [].slice.call(sub.querySelectorAll('.theme-editor-divider')).forEach(function (d) { d.remove(); });
    return true;
  }

  /**
   * Tự lưu script XUỐNG FILE.
   *
   * Hàm lưu của deck có chốt:
   *     if (!project || !location.protocol.startsWith('http')) { ...localStorage...; return; }
   * Bản xem trước chạy file:// nên LUÔN rơi vào nhánh đó — script chỉ nằm trong
   * localStorage, script-90s.txt không đổi, và render vẫn đọc bản cũ. Nhãn
   * "Đã lưu" của deck vì thế nói quá.
   *
   * Không sửa được chốt đó từ ngoài (nó đọc location.protocol), nên tự lưu lấy:
   * đọc số slide từ nhãn, GET danh sách dòng hiện có, thay đúng một dòng, POST
   * lại. Đường /api/* đi qua cầu postMessage lên khung cha rồi xuống IPC.
   */
  /**
   * Ô nhập tự cao theo số dòng.
   *
   * Đặt height về auto trước khi đọc scrollHeight — không thì lần gõ sau chỉ
   * đọc lại chiều cao cũ và ô không bao giờ thu nhỏ lại được.
   */
  function tuCao() {
    var t = document.getElementById('scriptEditorText');
    if (!t) return true;
    // PHẢI hạ rows trước. Deck để rows="8", mà height:auto của textarea rơi về
    // rows × chiều cao dòng chứ không phải chiều cao nội dung — nên scrollHeight
    // luôn ra 185px dù chỉ có một dòng chữ, và ô không bao giờ nhỏ lại được.
    // Đã đo: gõ dài hay xoá bớt đều đứng nguyên 187px.
    t.rows = 2;
    var do_ = function () {
      t.style.height = 'auto';
      t.style.height = Math.min(260, Math.max(96, t.scrollHeight + 2)) + 'px';
    };
    t.addEventListener('input', do_);
    // Chuyển slide thì deck gán thẳng t.value, KHÔNG phát sự kiện input và
    // cũng không đổi thuộc tính nào trên chính ô nhập — nên không rình được ô.
    // Bám vào dấu hiệu có thật: class .active nhảy sang slide khác. Đợi một
    // nhịp cho deck kịp ghi chữ mới vào rồi mới đo.
    // Gộp về một lần mỗi khung hình. Rình cả cây body thì mỗi nhịp hiệu ứng
    // của deck sinh hàng chục lượt, mà mỗi lượt lại ép trình duyệt tính lại bố
    // cục (đặt height:auto rồi đọc scrollHeight) — đủ để giết renderer.
    var cho = 0;
    new MutationObserver(function () {
      if (cho) return;
      cho = 1;
      requestAnimationFrame(function () { cho = 0; do_(); });
    }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    do_();
    return true;
  }

  function setupRealAutosave() {
    var text = document.getElementById('scriptEditorText');
    var status = document.getElementById('scriptEditorStatus');
    var badge = document.getElementById('scriptEditorBadge');
    if (!text || !status || !badge) return;

    // Tên deck = tên thư mục chứa _preview.html.
    var parts = decodeURIComponent(location.pathname).split('/').filter(Boolean);
    var project = parts[parts.length - 2] || '';
    if (!project) return;

    var show = function (msg) { status.textContent = msg; status.hidden = false; };
    var timer = null;
    // Nối chuỗi để hai lần lưu KHÔNG BAO GIỜ chạy song song.
    //
    // Mỗi lần lưu là đọc-sửa-ghi (GET danh sách dòng → thay một dòng → POST).
    // Hai lượt chồng nhau thì lượt sau đọc phải bản CHƯA có thay đổi của lượt
    // trước, ghi đè lên và làm mất sửa đổi. Đã dựng lại được: gõ hai lần liền
    // nhau, file ra một nội dung không giống lần gõ nào.
    var chain = Promise.resolve();

    var save = function () {
      var m = /(\d+)\s*\/\s*(\d+)/.exec(badge.textContent || '');
      if (!m) return;
      var idx = parseInt(m[1], 10) - 1;
      var line = (text.value || '').replace(/\s+/g, ' ').trim();
      if (!line) { show('Dòng script đang trống — chưa lưu'); return; }

      show('Đang lưu…');
      chain = chain.catch(function () {}).then(function () {
        // Đọc LẠI ngay trước khi ghi, không dùng bản đọc từ lượt trước.
        return fetch('/api/slide-script?project=' + encodeURIComponent(project))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var lines = (d && d.lines) || [];
            if (idx < 0 || idx >= lines.length) throw new Error('Số slide không khớp');
            if (lines[idx] === line) { show('Đã lưu script mới nhất'); return null; }
            lines[idx] = line;
            return fetch('/api/slide-script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ project: project, lines: lines })
            }).then(function (r) { return r.json(); }).then(function (res) {
              if (res && res.error) throw new Error(res.error);
              show('Đã lưu script mới nhất');
            });
          })
          .catch(function (e) { show('Chưa lưu được: ' + (e.message || e)); });
      });
    };

    text.addEventListener('input', function () {
      show('Đang gõ…');
      clearTimeout(timer);
      timer = setTimeout(save, 900);
    });
  }

  /**
   * Xếp các khối theo PHẠM VI ẢNH HƯỞNG, không phải theo chủ đề.
   *
   * Đọc preview-settings.json thấy rõ hai nhóm khác hẳn nhau:
   *
   *   cả deck (một giá trị duy nhất):  theme · visuals · bgm · subtitles
   *   theo slide (mảng N phần tử):     slides.scriptLines
   *                                    slides.transitionSounds
   *                                    slides.revealSounds
   *
   * Nên KHÔNG gộp tất cả vào một khung "đổi theo slide": làm thế thì người dùng
   * chỉnh cỡ chữ phụ đề lúc đang ở slide 3 sẽ tưởng chỉ slide 3 đổi, trong khi
   * thực tế cả 10 slide đổi theo. Thà tách hai nhóm và ghi rõ phạm vi.
   */
  function groupByScope() {
    var panel = document.querySelector('.theme-editor-panel');
    var theme = document.querySelector('.theme-editor-section-theme');
    var bgm = document.querySelector('.theme-editor-section-bgm');
    var audio = document.querySelector('.theme-editor-section-audio');
    var merged = document.querySelector('.theme-editor-section-subtitles');
    if (!panel || !theme || !bgm || !audio || !merged) return false;

    // HAI NHÓM xếp dọc, KHÔNG chia thẻ.
    //
    // Bản trước chia ba thẻ. Nhìn lại thì mỗi thẻ chỉ có một hai ô chỉnh, mở ra
    // là một mảng trống lớn — chia thẻ chỉ đáng khi mỗi thẻ đủ đầy. Ở đây gộp
    // lại vẫn vừa một màn hình, mà đỡ một cú bấm để tới chỗ cần sửa.
    //
    // Vẫn tách theo PHẠM VI vì đó là điều dễ hiểu nhầm nhất: cỡ chữ phụ đề đổi
    // cả deck chứ không riêng slide đang xem.
    var mkGroup = function (label, note, icon, ma) {
      var g = document.createElement('div');
      g.className = 'scope-group';
      /* data-nhom để CSS kẻ khung khác nhau cho hai nhóm: nhóm trên chỉ kẻ
         TRÊN, nhóm dưới kẻ cả trên lẫn dưới — hai đường kẻ liền nhau ở giữa
         thì thành một đường phân cách chung, thay vì hai cái hộp chồng lên. */
      if (ma) g.setAttribute('data-nhom', ma);
      var h = document.createElement('div');
      h.className = 'scope-head';
      h.innerHTML = '<span class="scope-label"></span><span class="scope-note"></span>';
      var nhanNhom = h.querySelector('.scope-label');
      nhanNhom.textContent = label;
      if (icon) ganIcon(nhanNhom, icon);
      h.querySelector('.scope-note').textContent = note;
      g.appendChild(h);
      var body = document.createElement('div');
      body.className = 'scope-body';
      g.appendChild(body);
      panel.appendChild(g);
      return body;
    };

    /**
     * Gộp nhiều thẻ thành MỘT thẻ có tab.
     *
     * Khác lần trước (đã gỡ): lần đó chia BA tab cho cả bảng nên mỗi tab chỉ có
     * một hai ô, mở ra là mảng trống. Ở đây mỗi nhóm chỉ hai tab và chúng nằm
     * TRONG một thẻ — bảng gọn lại còn hai thẻ thay vì bốn, mà không tab nào
     * trống trải.
     *
     * Tab đầu là thứ hay chỉnh nhất: Tone màu, và Phụ đề.
     */
    var gopTab = function (body, ds) {
      var the = document.createElement('div');
      the.className = 'theme-editor-section tab-card';
      var bar = document.createElement('div');
      bar.className = 'tab-bar';
      the.appendChild(bar);

      ds.forEach(function (m, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tab-btn' + (i === 0 ? ' active' : '');
        b.textContent = m.nhan;
        bar.appendChild(b);

        // Bỏ viền/nền riêng của thẻ con — nó nay là RUỘT của thẻ ngoài, giữ
        // viền nữa thành hai khung lồng nhau.
        m.el.classList.add('tab-pane');
        if (i !== 0) m.el.hidden = true;
        the.appendChild(m.el);

        b.onclick = function () {
          for (var k = 0; k < ds.length; k++) {
            bar.children[k].classList.toggle('active', k === i);
            ds[k].el.hidden = k !== i;
          }
        };
      });
      body.appendChild(the);
    };

    var deckBody = mkGroup('Toàn bộ video', '(Chỉnh sửa này áp dụng cho toàn bộ video)', 'khoi', 'deck');
    gopTab(deckBody, [
      { nhan: 'Màu sắc video', el: theme },
      { nhan: 'Nhạc nền', el: bgm },
    ]);

    /* Tiêu đề mang luôn SỐ slide đang xem. Số vốn nằm ở ô #slideDeleteBadge
       ('Slide 3 / 10') nhưng ô đó ở tít cuối thẻ, trong khi người đọc tiêu đề
       là đang muốn biết mình sửa slide nào. */
    var slideBody = mkGroup('Slide hiện tại', '(Chỉnh sửa này áp dụng cho Slide đang được chọn)', 'slide', 'slide');
    bamSoSlide();
    gopTab(slideBody, [
      { nhan: 'Phụ đề', el: merged },
      { nhan: 'Âm thanh slide', el: audio },
    ]);
    return true;
  }

  /**
   * Việt hoá nhãn của bảng editor.
   *
   * Làm ở ĐÂY chứ không sửa app.js của từng deck: có 7 template, mỗi cái một
   * bản app.js riêng — sửa 7 chỗ rồi deck thứ 8 lại quên. Lớp này áp cho mọi
   * deck, kể cả deck cũ chưa migrate.
   *
   * Hai nhãn quan trọng nhất: "Chuyển slide" và "Hiện element" nằm trong thẻ
   * ÂM THANH SLIDE và các lựa chọn là TÊN TIẾNG ĐỘNG (Gong, Bass, Chime...),
   * không phải hiệu ứng hình. Nhãn cũ không nói ra điều đó nên người dùng chọn
   * xong không hiểu vừa đổi cái gì.
   */
  function vietHoa() {
    var NHAN = {
      'Animation nền': 'Hiệu ứng nền',
      'Chuyển slide': 'Tiếng chuyển slide',
      'Hiện element': 'Tiếng hiện từng phần',
      'BGM': 'Nhạc nền',
      'Test slide': 'Nghe thử tiếng chuyển',
      'Test reveal': 'Nghe thử tiếng hiện',
      'Upload BGM': 'Tải nhạc lên',
      'Bật subtitle': 'Bật phụ đề',
      'Volume': 'Âm lượng',
      'Chữ nền': 'Màu chữ nền',
      'Chữ chạy': 'Màu chữ đang đọc'
    };
    var OPT = {
      'Custom upload': 'Nhạc tự tải lên',
      'Particles': 'Particles — hạt bay',
      'Gong': 'Gong — cồng',
      'Rise': 'Rise — dâng lên',
      'Bass': 'Bass — trầm',
      'Chime': 'Chime — chuông gió',
      'Sweep': 'Sweep — quét',
      'Boom': 'Boom — nổ',
      'Alarm': 'Alarm — báo động',
      'Chord': 'Chord — hợp âm',
      'Ascending': 'Ascending — đi lên',
      'Retro': 'Retro — cổ điển',
      'Minimal': 'Minimal — tối giản',
      'Dramatic': 'Dramatic — kịch tính',
      'Ping': 'Ping — tinh',
      'Pop': 'Pop — bụp',
      'Click': 'Click — tách',
      'Bubble': 'Bubble — bong bóng',
      'Woosh': 'Woosh — vút',
      'Sparkle': 'Sparkle — lấp lánh',
      'Drop': 'Drop — rơi',
      'Tick': 'Tick — tích',
      'Bell': 'Bell — chuông',
      'Blip': 'Blip — bíp',
      'Snap': 'Snap — búng'
    };

    // Duyệt NÚT VĂN BẢN, không duyệt phần tử.
    //
    // Bản đầu bỏ qua mọi phần tử có con, nên "Upload BGM" — nằm trong
    // <span><i class="fa-upload"></i> Upload BGM</span> — không đổi được, mà
    // nhìn qua thì tưởng đã dịch hết. Đi theo nút văn bản thì icon giữ nguyên.
    var goc = document.querySelector('.theme-editor-panel');
    if (goc) {
      var w = document.createTreeWalker(goc, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = w.nextNode())) {
        var t = (n.nodeValue || '').trim();
        if (NHAN[t]) n.nodeValue = n.nodeValue.replace(t, NHAN[t]);
      }
    }
    var op = document.querySelectorAll('.theme-editor-panel option');
    for (var j = 0; j < op.length; j++) {
      var o = op[j];
      var k = (o.textContent || '').trim();
      if (OPT[k]) o.textContent = OPT[k];
    }
    return true;
  }

  /**
   * Ô chọn HIỆU ỨNG VIDEO, đặt cạnh "Hiệu ứng nền".
   *
   * Khác nhau ở chỗ: "Hiệu ứng nền" là hoạ tiết chạy phía SAU slide, còn cái
   * này áp lên chính NỘI DUNG — ảnh trôi, số đếm, ánh kim quét.
   *
   * Lưu vào previewSettings.videoFx (cả deck), rồi ghi ra file
   * preview-settings.json qua đúng API mà mọi thiết lập khác đang dùng —
   * không tự viết đường lưu riêng.
   */
  function themVideoFx() {
    var DECK = __BEE_DECK__;
    var oNen = document.getElementById('backgroundFxSelect');
    if (!oNen || document.getElementById('videoFxSelect')) return true;
    var boc = oNen.closest('label') || oNen.parentElement;
    if (!boc || !boc.parentElement) return true;

    var lab = document.createElement('label');
    lab.className = boc.className;
    var sp = document.createElement('span');
    sp.textContent = 'Hiệu ứng video';
    var sel = document.createElement('select');
    sel.id = 'videoFxSelect';
    var DS = __BEE_FX_LIST__;
    DS.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.key;
      op.textContent = o.nhan;
      sel.appendChild(op);
    });
    lab.appendChild(sp);
    lab.appendChild(sel);
    boc.parentElement.insertBefore(lab, boc.nextSibling);

    // Trạng thái đọc từ FILE, không từ window.previewSettings — biến đó là
    // biến cục bộ trong app.js của deck, ngoài không thấy (đã đo: undefined).
    fetch('/api/preview-settings?project=' + encodeURIComponent(DECK))
      .then(function (r) { return r.json(); })
      .then(function (d) { sel.value = (d && d.settings && d.settings.videoFx) || 'none'; })
      .catch(function () { /* không đọc được thì để 'Không' */ });

    sel.addEventListener('change', function () {
      // Áp NGAY để xem trước thấy liền, không phải mở lại deck.
      //
      // Dùng classList chứ KHÔNG cắt chuỗi className: bản đầu cắt bằng regex và
      // lớp bị nhân đôi trên thẻ html (đã đo). classList thì thêm/bớt từng lớp,
      // không có chỗ cho sai sót đó.
      // Danh sách lớp lấy TỪ CHÍNH DS — không viết cứng.
      // Bản đầu liệt kê tay ba lớp; thêm bốn hiệu ứng mới vào videoFx.js xong
      // thì ô chọn hiện đủ chín mục nhưng bấm "Trọn bộ" vẫn chỉ gắn ba lớp cũ,
      // và không hiệu ứng mới nào chạy. Đã đo: lopHtml chỉ có kenburns/count/
      // shimmer.
      var h = document.documentElement;
      var moiLop = DS.map(function (o) { return o.key; })
        .filter(function (k) { return k !== 'none' && k !== 'all'; });
      moiLop.forEach(function (k) { h.classList.remove('bee-fx-' + k); });
      if (sel.value === 'all') {
        moiLop.forEach(function (k) { h.classList.add('bee-fx-' + k); });
      } else if (sel.value !== 'none') {
        h.classList.add('bee-fx-' + sel.value);
      }

      // CHỈ gửi khoá videoFx. Bản đầu gửi cả window.previewSettings — vốn
      // undefined nên thành {} — và ghi đè mất toàn bộ theme/visuals/bgm/
      // subtitles/slides của deck. Bên nhận nay cũng gộp thay vì thay (xem
      // previewSettings:write), nhưng gửi đúng phần mình sửa vẫn là gốc.
      fetch('/api/preview-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: DECK, settings: { videoFx: sel.value } })
      }).catch(function () { /* mất mạng nội bộ thì thôi, lần sau lưu lại */ });
    });
    return true;
  }

  /**
   * Hai bảng vị trí đèn SONG SONG, bỏ bước phải chọn đèn trước.
   *
   * Bản gốc chỉ có MỘT bảng, đổi nội dung theo đèn đang chọn. Sau khi gộp tab,
   * thẻ Tone màu rộng ra nên chứa được cả hai — mà bỏ được luôn một bước bấm và
   * hết cảnh nhìn bảng không biết nó đang là đèn nào.
   *
   * Cách làm: KHÔNG viết lại logic của deck. Hai bảng ở đây chỉ là mặt hiển
   * thị; bấm vào ô nào thì chọn đèn tương ứng rồi BẤM HỘ đúng nút thật của
   * deck. Trạng thái đọc từ previewSettings.visuals — nguồn thật, nên không có
   * chuyện hai bên lệch nhau.
   */
  function haiBangDen() {
    var card = document.querySelector('.tone-position-card');
    var grid = document.getElementById('tonePositionGrid');
    var row = document.getElementById('toneIntensityRow');
    if (!card || !grid || !row || document.querySelector('.den-doi')) return true;

    var VITRI = [].slice.call(grid.querySelectorAll('[data-tone-position]'))
      .map(function (b) { return { k: b.dataset.tonePosition, nhan: b.title || '' }; });
    var CUONG = [].slice.call(row.querySelectorAll('[data-tone-intensity]'))
      .map(function (b) { return { k: b.dataset.toneIntensity, nhan: b.title || '' }; });

    /* Đếm cột theo KHOÁ: mọi bảng đều gồm đúng ba hàng — top… / center… /
       bottom… — nên số khoá bắt đầu bằng "top" chính là số cột (9 vị trí → 3,
       15 vị trí → 5). Bảng lạ không theo lối đặt tên đó thì chia ba làm tròn. */
    var soCot = VITRI.filter(function (v) { return /^top/.test(v.k); }).length
      || Math.max(1, Math.ceil(VITRI.length / 3));

    /* ⚠ NHÃN "Ánh sáng nền 1 / 2", KHÔNG phải "Đèn chính / Đèn phụ".
     *
     * Tên đầu tiên mượn từ nhiếp ảnh (key light / fill light) nhưng ở đây THỨ
     * BẬC ĐÓ KHÔNG CÓ THẬT: hai thứ này giống hệt nhau về khả năng — cùng bảng
     * màu, cùng lưới vị trí, cùng nấc sáng, không cái nào phụ thuộc cái kia.
     * Người dùng hoàn toàn có thể để "đèn phụ" sáng hơn "đèn chính", lúc đó cái
     * tên nói ngược với thứ họ đang nhìn.
     *
     * Tên thứ hai là "Quầng sáng", bỏ vì "quầng" là chữ sách vở — đọc xong vẫn
     * phải đoán nó là cái gì trên màn hình. "Ánh sáng NỀN" trả lời đúng câu hỏi
     * người mở bảng này đang hỏi: nó hiện Ở ĐÂU. Và nó vào cùng họ với "Hiệu
     * ứng nền" ngay phía trên — mấy ô cạnh nhau thì cùng nói về cái nền.
     *
     * ⚠ Khoá dữ liệu (ma) và tên biến mainLight/softLight GIỮ NGUYÊN: chúng nằm
     * trong preview-settings.json của mọi deck đã tạo. Đổi là deck cũ mất sạch
     * thiết lập ánh sáng, im lặng. Đây chỉ đổi CHỮ HIỆN RA. */
    var TEN_DEN = ['Ánh sáng nền 1', 'Ánh sáng nền 2'];

    var boc = document.createElement('div');
    boc.className = 'den-doi';
    card.parentElement.insertBefore(boc, card);
    card.classList.add('is-hidden-dup');

    /* ẨN HÀNG Ô MÀU GỐC của deck (.tone-color-row), ô màu sẽ được bê vào trong
     * từng thẻ bên dưới.
     *
     * Bản trước để hàng đó hiện và chỉ đổi chữ cho khớp, nhưng như thế màn hình
     * có HAI dòng "Ánh sáng nền 1" cách nhau đúng một khoảng — một dòng mang ô
     * màu, một dòng mang lưới. Người đọc phải tự nối hai dòng ấy lại. Dồn hết
     * vào một thẻ thì mỗi thẻ là trọn một thứ: tên, màu, độ sáng, vị trí.
     *
     * ⚠ ẨN chứ KHÔNG xoá. Trong hàng đó có hai nút [data-tone-light-select] —
     * chonDen() bấm hộ chúng để chuyển đèn đang chỉnh. Xoá là cả bảng đứng im.
     * Nút ẩn vẫn nhận .click() của mã, nên phần đó chạy nguyên.
     *
     * Ẩn Ở ĐÂY chứ không sửa app.js của từng deck vì hai lẽ: thư mục authoring
     * là bản sao do prepare:authoring sinh lại nên sửa ở đó là mất, và deck NGƯỜI
     * DÙNG đã tạo từ trước vẫn mang markup cũ — chỉ chỗ này với tay tới được cả
     * hai. */
    var hangMau = document.querySelector('.tone-color-row');
    if (hangMau) hangMau.classList.add('is-hidden-dup');

    var dangTo = 0;
    /* Tên lấy từ TEN_DEN khai ở đầu hàm — một chỗ khai, hai nơi dùng. Viết tên
       ở cả hai nơi thì sớm muộn lệch nhau, mà lệch ở đây nghĩa là màn hình có
       hai tên cho cùng một thứ, đứng ngay cạnh nhau. */
    var DEN = [
      { ma: 'main', nhan: TEN_DEN[0], o: 'mainLightColor' },
      { ma: 'soft', nhan: TEN_DEN[1], o: 'softLightColor' }
    ];

    DEN.forEach(function (d, iDen) {
      /* Vạch dọc giữa hai thẻ. Hai thẻ nay dùng chung một khung kẻ trên-dưới
         nên nếu không có gì ngăn ở giữa, mắt đọc ra MỘT khối có hai cột chứ
         không phải HAI thứ đặt cạnh nhau. Là phần tử thật chứ không phải
         border-left của thẻ sau: lưới của .den-doi đã chừa sẵn một cột 1px,
         và làm thế thì lúc xếp dọc chỉ cần giấu đúng một phần tử. */
      if (iDen) {
        var vach = document.createElement('i');
        vach.className = 'den-vach';
        vach.setAttribute('aria-hidden', 'true');
        boc.appendChild(vach);
      }
      var hop = document.createElement('div');
      hop.className = 'den-hop';
      hop.setAttribute('data-den', d.ma);
      /* ĐỘ SÁNG lên trên, VỊ TRÍ xuống dưới, mỗi thứ một nhãn riêng.
         Bản trước xếp hai lưới liền nhau dưới một câu chú thích chung, nên
         hàng chấm to dần ở cuối không ai đoán ra là gì — nhìn như hàng vị trí
         thứ tư bị lỗi. Tách nhãn ra thì mỗi lưới tự nói nó chỉnh cái gì; và để
         lưới vị trí NẰM CUỐI vì nó là hình thu nhỏ của khung hình, đặt sát đáy
         thẻ thì mắt đọc từ thông số xuống hình, không phải ngược lại. */
      hop.innerHTML =
        '<div class="den-dau"><b></b><div class="den-mau"></div></div>'
        + '<div class="den-muc" data-muc="sang"></div><div class="den-cuong"></div>'
        + '<div class="den-muc" data-muc="cho"></div><div class="den-luoi"></div>';
      hop.querySelector('b').textContent = d.nhan;
      /* CÙNG một icon cho cả hai, cố ý. Hai ánh sáng nền ngang hàng nhau về
         khả năng (xem ghi chú ở TEN_DEN) — cho mỗi cái một hình khác nhau là
         vẽ ra một thứ bậc không có thật. Số 1/2 đã đủ để phân biệt. */
      ganIcon(hop.querySelector('.den-dau b'), 'sun');
      /* BÊ nguyên thẻ <input type="color"> của deck vào, không dựng thẻ mới:
         deck đã gắn listener input/change lên đúng phần tử đó, và chính nó là
         thứ deck đọc .value khi đổi slide. Dời phần tử thì listener đi theo. */
      var oMau = document.getElementById(d.o);
      if (oMau) hop.querySelector('.den-mau').appendChild(oMau);
      nhanMuc(hop.querySelector('[data-muc="sang"]'), 'mucdo', 'Độ sáng', 'Mờ → Sáng');
      nhanMuc(hop.querySelector('[data-muc="cho"]'), 'vitri', 'Vị trí', 'Chọn vị trí hiển thị');
      var luoi = hop.querySelector('.den-luoi');
      var cuong = hop.querySelector('.den-cuong');
      /* Số cột đặt Ở ĐÂY chứ không trong CSS: chỉ chỗ này biết deck đang mở có
         mấy vị trí, mấy nấc sáng. */
      luoi.style.gridTemplateColumns = 'repeat(' + soCot + ', 1fr)';
      cuong.style.gridTemplateColumns = 'repeat(' + Math.max(1, CUONG.length) + ', 1fr)';

      VITRI.forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tone-position-dot';
        b.title = v.nhan;
        b.setAttribute('data-v', v.k);
        b.innerHTML = '<span></span>';
        b.onclick = function () { bam(d, 'data-tone-position', v.k); };
        luoi.appendChild(b);
      });
      CUONG.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tone-intensity-dot';
        b.title = c.nhan;
        b.setAttribute('data-c', c.k);
        b.innerHTML = '<span></span>';
        b.onclick = function () { bam(d, 'data-tone-intensity', c.k); };
        cuong.appendChild(b);
      });
      boc.appendChild(hop);
    });

    /** Chọn đèn rồi bấm hộ đúng nút thật trong bảng gốc (đang ẩn). */
    function bam(d, thuocTinh, gt) {
      chonDen(d.ma);
      var that = card.querySelector('[' + thuocTinh + '="' + gt + '"]');
      if (that) that.click();
      to();
    }

    function chonDen(ma) {
      var nut = document.querySelector('[data-tone-light-select="' + ma + '"]');
      // Deck vẽ lại bảng NGAY trong handler (setActiveToneLight →
      // updateVisualControls), nên đọc ngay sau click là đã đúng đèn.
      if (nut && !nut.classList.contains('active')) nut.click();
    }

    /**
     * Đồng bộ trạng thái sáng của hai bảng.
     *
     * ⚠ KHÔNG đọc previewSettings: nó là biến cục bộ trong app.js của deck,
     * không có trên window — bản đầu đọc window.previewSettings nên hai bảng
     * trống trơn, không ô nào sáng (đã đo: viTriTruoc = [[],[]]). Nguồn thật
     * duy nhất lấy được từ ngoài là chính bảng gốc của deck, và nó cũng đã tính
     * sẵn phần đè theo từng slide. Nên: lần lượt chọn từng đèn, đọc ô đang
     * sáng, rồi trả lại đèn ban đầu.
     */
    function to() {
      // Cờ chống vòng lặp: to() tự nó bấm nút nên làm đổi class trong bảng gốc,
      // mà MutationObserver bên dưới lại rình đúng class đó. Không chặn thì
      // to() → observer → to() chạy mãi.
      if (dangTo) return;
      dangTo = 1;
      setTimeout(function () { dangTo = 0; }, 0);
      var cu = (document.querySelector('[data-tone-light-select].active') || {}).dataset;
      cu = cu ? cu.toneLightSelect : 'main';
      DEN.forEach(function (d) {
        chonDen(d.ma);
        var v = card.querySelector('[data-tone-position].active');
        var c = card.querySelector('[data-tone-intensity].active');
        v = v ? v.dataset.tonePosition : null;
        c = c ? c.dataset.toneIntensity : null;
        var hop = boc.querySelector('[data-den="' + d.ma + '"]');
        if (!hop) return;
        // Ô đang sáng ăn ĐÚNG màu của đèn đó. CSS của deck đọc
        // --tone-selected-light, mà biến ấy chỉ đặt trên thẻ gốc — hai bảng ở
        // ngoài nên rơi về màu mặc định, hai đèn sáng y hệt nhau và mất luôn
        // cái để phân biệt.
        var oMau = document.getElementById(d.o);
        if (oMau && oMau.value) hop.style.setProperty('--tone-selected-light', oMau.value);
        [].slice.call(hop.querySelectorAll('[data-v]')).forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-v') === v);
          // Chấm sáng to nhỏ theo cường độ — CSS của deck bám vào data-intensity
          // chứ không phải class, thiếu nó thì mọi mức nhìn y hệt nhau.
          if (c) b.setAttribute('data-intensity', c); else b.removeAttribute('data-intensity');
        });
        [].slice.call(hop.querySelectorAll('[data-c]')).forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-c') === c);
        });
      });
      chonDen(cu);
    }

    to();
    // Đổi màu đèn thì ô đang sáng phải đổi theo — sự kiện này không đụng tới
    // class nên MutationObserver bên dưới không bắt được.
    DEN.forEach(function (d) {
      var oMau = document.getElementById(d.o);
      if (oMau) oMau.addEventListener('input', to);
    });
    // Đổi slide thì đèn có thể khác (deck cho đè theo từng slide) — bám vào
    // chính bảng gốc để vẽ lại.
    new MutationObserver(function () { if (!dangTo) to(); })
      .observe(card, { attributes: true, subtree: true, attributeFilter: ['class'] });
    return true;
  }

  /**
   * Chặn dòng "Đã lưu trên trình duyệt" của #themeEditorStatus.
   *
   * Nó là ô trạng thái CHUNG của bảng, nằm ngoài các nhóm nên groupByScope đẩy
   * mọi nhóm xuống dưới và ô này nổi lên TRÊN CÙNG — đổi tone màu một cái là có
   * dòng chữ nhảy ra ngay trên đầu "CẢ DECK".
   *
   * Câu đó vừa thừa vừa sai: deck chỉ ghi được localStorage khi chạy file://,
   * nên "đã lưu" không nói lên điều người đọc tưởng. Nhưng KHÔNG ẩn cả ô —
   * setThemeStatus còn dùng để báo lỗi thật ("Không lưu được"). Chỉ nuốt đúng
   * câu vô nghĩa, còn lại vẫn hiện.
   */
  function chanDongDaLuu() {
    // Áp cho MỌI ô trạng thái, không riêng #themeEditorStatus: bảng có 6 ô
    // .theme-editor-status (theme, bgm, âm thanh slide, phụ đề, xoá slide,
    // script) và mỗi ô lại nổi lên ở một chỗ khác nhau sau khi xếp lại nhóm.
    // Bịt đúng một ô thì lần sau câu đó lòi ra ở ô kế bên — đã dính đúng thế.
    var ds = [].slice.call(document.querySelectorAll('.theme-editor-status'));
    ds.forEach(mot);
    return true;
  }

  function mot(o) {
    var loc = function () {
      // PHẢI kiểm o.hidden trước khi gán. Gán lại đúng giá trị cũ vẫn sinh một
      // bản ghi mutation, mà chính observer này đang rình thuộc tính hidden —
      // không chặn thì loc() tự gọi lại mình vô hạn và treo cứng trang.
      if (o.hidden) return;
      if (/lưu trên trình duyệt/i.test(o.textContent || '')) o.hidden = true;
    };
    loc();
    new MutationObserver(loc).observe(o, {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden']
    });
  }

  /**
   * Xếp hai thẻ ÂM THANH SLIDE và NHẠC NỀN thành hàng ngang.
   *
   * Cả hai vốn xếp dọc từng ô một, mỗi ô ăn trọn bề ngang thẻ — mà thẻ nay rộng
   * gấp đôi sau khi gộp tab, nên ô chọn kéo dài gần 700px cho một danh sách
   * chục chữ. Ghép đôi lại thì cả thẻ gọn còn hai hàng và thẳng cột với thẻ
   * Tone màu ngay trên.
   */
  function xepHangNgang() {
    var am = document.querySelector('.theme-editor-section-audio');
    if (am && !am.querySelector('.doi-hang')) {
      var o = [].slice.call(am.querySelectorAll(':scope > label.theme-editor-field'));
      if (o.length === 2) {
        var hang = document.createElement('div');
        hang.className = 'doi-hang';
        am.insertBefore(hang, o[0]);
        o.forEach(function (x) { hang.appendChild(x); });
        /* Hai nút nghe thử vốn nằm chung một hàng ở TẬN CUỐI thẻ, cách xa ô
           chọn mà chúng nghe thử. Đưa mỗi nút về đứng ngay cạnh ô của nó và
           thu lại thành cái loa: chữ 'Nghe thử tiếng chuyển' dài hơn cả tên
           tiếng đang chọn, mà nó chỉ là một việc phụ. */
        var thu = am.querySelector('.theme-editor-actions');
        if (thu) {
          var nutThu = [].slice.call(thu.querySelectorAll('button'));
          o.forEach(function (x, i) {
            var chon = x.querySelector('select');
            var nut = nutThu[i];
            if (!chon || !nut) return;
            x.classList.add('am-doc');
            var doi_ = document.createElement('span');
            doi_.className = 'am-hang';
            x.appendChild(doi_);
            doi_.appendChild(chon);
            nut.className = 'am-thu';
            nut.title = i === 0 ? 'Nghe thử tiếng chuyển slide' : 'Nghe thử tiếng hiện từng phần';
            nut.setAttribute('aria-label', nut.title);
            nut.textContent = '';
            nut.appendChild(veIcon('loa'));
            doi_.appendChild(nut);
          });
          thu.remove();
        }
      }
    }

    /* Hai nút chuyển slide lên HÀNG TAB của nhóm 'Slide hiện tại'.
       Chúng gọi goToSlide() nên đổi luôn slide của CẢ hai tab (Phụ đề lẫn Âm
       thanh slide) — nằm lọt trong một tab thì đọc ra là chỉ đổi tab đó. */
    var nav = document.querySelector('.audio-slide-nav');
    var thanhTab = document.querySelectorAll('.tab-bar');
    var tabSlide = thanhTab[thanhTab.length - 1];
    if (nav && tabSlide && !tabSlide.querySelector('.audio-slide-nav')) {
      tabSlide.appendChild(nav);
    }

    var nn = document.querySelector('.theme-editor-section-bgm');
    if (nn && !nn.querySelector('.doi-hang')) {
      var oNn = [].slice.call(nn.querySelectorAll(':scope > label.theme-editor-field'));
      var chon = oNn[0];
      var am_ = oNn[1];
      var tai = nn.querySelector(':scope > label.theme-editor-upload');
      /* CẢ BA thứ lên một hàng, nhãn ở trên và ô điều khiển ở dưới — đúng lối
         thẻ "Âm thanh slide" bên cạnh (lớp am-doc / am-hang). Bản trước để ô
         chọn nhạc ăn trọn một hàng riêng rồi âm lượng + nút tải một hàng nữa:
         thẻ dài gấp đôi mà hàng trên gần như trống.
         Nút tải đứng NGAY CẠNH thanh kéo, cùng chỗ nút loa đứng ở tab kia. */
      if (chon && am_ && tai) {
        var h2 = document.createElement('div');
        h2.className = 'doi-hang';
        nn.insertBefore(h2, chon);
        chon.classList.add('am-doc');
        h2.appendChild(chon);
        am_.classList.add('am-doc');
        h2.appendChild(am_);
        var hangAm = document.createElement('span');
        hangAm.className = 'am-hang';
        am_.appendChild(hangAm);
        var keo = am_.querySelector('input[type="range"]');
        if (keo) hangAm.appendChild(keo);
        hangAm.appendChild(tai);

        /* Nút tải nhạc CHỈ có nghĩa khi đang chọn "Nhạc tự tải lên". Sáu lựa
           chọn còn lại là nhạc app tự sinh — tải file lên lúc đó chẳng đi đâu
           cả, mà nút vẫn nằm đó mời bấm. Dòng tên file cũng giấu theo: để lại
           thì nó nói "đang dùng meta.mp3" trong khi thứ đang phát là bản tổng
           hợp, tức là nói sai.

           Đồng bộ bằng ĐỒNG HỒ chứ không chỉ nghe sự kiện: deck đặt select.value
           bằng mã mỗi lần nạp lại thiết lập (updateBgmControls), mà gán .value
           KHÔNG bắn change và cũng không đổi thuộc tính nào cho MutationObserver
           bắt — đúng cái bẫy đã gặp ở ô mã màu. */
        var oNhac = chon.querySelector('select');
        var oTenFile = document.getElementById('bgmCustomName');
        var dongTai = function () {
          var tuTai = !!oNhac && oNhac.value === 'custom';
          if (tai.hidden !== !tuTai) tai.hidden = !tuTai;
          var boc = oTenFile && oTenFile.closest('.bgm-nhan');
          if (boc && boc.hidden !== !tuTai) boc.hidden = !tuTai;
        };
        if (oNhac) oNhac.addEventListener('change', dongTai);
        setTimeout(dongTai, 0);
        setInterval(dongTai, 400);
      }

      /* Tên file nhạc: thêm NHÃN dẫn. Trước đây nó là một dòng trơ "meta.mp3"
         đứng giữa thẻ, không ai đoán ra đó là bài nhạc đang phát trong video —
         đã bị hỏi đúng câu "cái này là gì, không có giá trị gì thì bỏ đi".
         KHÔNG bỏ: đó là file nhạc nền thật, deck nào cũng có, nằm ở
         preview-assets/bgm/. Chỉ thiếu mỗi cái tên gọi. */
      var oTen = document.getElementById('bgmCustomName');
      if (oTen && !oTen.closest('.bgm-nhan')) {
        var nhan = document.createElement('div');
        nhan.className = 'bgm-nhan';
        nhan.appendChild(veIcon('nhac'));
        var chuNhan = document.createElement('b');
        chuNhan.textContent = 'File nhạc đang dùng';
        nhan.appendChild(chuNhan);
        oTen.parentNode.insertBefore(nhan, oTen);
        nhan.appendChild(oTen);
      }
    }
    return true;
  }

  /**
   * Trả lời khung cha về SLIDE ĐANG XEM, và nhảy tới slide theo yêu cầu.
   *
   * Dùng khi nạp lại bản xem trước: nạp xong mà rơi về slide 1 thì đang sửa
   * slide 8 phải bấm tám lần để quay lại. Chỉ hai câu lệnh, đọc/ghi qua đúng
   * hàm goToSlide() của deck chứ không đụng vào biến trong nó.
   */
  function noiVoiCha() {
    if (window.parent === window) return true;
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || !d.__beeSlide) return;
      if (d.__beeSlide === 'hoi') {
        var ds = [].slice.call(document.querySelectorAll('.slide'));
        var i = ds.indexOf(document.querySelector('.slide.active'));
        e.source.postMessage({ __beeSlide: 'dap', chiSo: i, tong: ds.length }, '*');
        return;
      }
      if (d.__beeSlide === 'toi' && typeof window.goToSlide === 'function') {
        window.goToSlide(d.chiSo | 0);
      }
    });
    return true;
  }

  /* Ghi số slide đang xem vào tiêu đề nhóm: 'Slide hiện tại (3)'.
     Bám bằng MutationObserver vì deck tự viết lại ô đó mỗi lần đổi slide và
     không bắn sự kiện nào. */
  function bamSoSlide() {
    var badge = document.getElementById('slideDeleteBadge');
    var ds = document.querySelectorAll('.scope-label');
    var nhan = ds[ds.length - 1];
    if (!badge || !nhan) return;
    var so = document.createElement('span');
    so.className = 'scope-so';
    nhan.appendChild(so);
    var dong = function () {
      var m = (badge.textContent || '').match(/(\d+)/);
      so.textContent = m ? ' (' + m[1] + ')' : '';
    };
    dong();
    new MutationObserver(dong).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  /* Icon dẫn nhãn. Khớp theo ĐẦU chuỗi vì vài nhãn kèm giá trị đang chọn trong
     thẻ <b> ('Cỡ chữ 18px'). Phải chạy SAU vietHoa(): bảng dưới đây là nhãn ĐÃ
     Việt hoá, không phải nhãn gốc của engine. */
  function ganIconNhan() {
    var BANG = [
      ['Hiệu ứng nền', 'nen'],
      ['Hiệu ứng video', 'phim'],
      ['Màu chữ nền', 'chu'],
      ['Màu chữ đang đọc', 'but'],
      ['Cỡ chữ', 'cochu'],
      ['Vị trí đáy', 'doc'],
      ['Tiếng chuyển slide', 'loa'],
      ['Tiếng hiện từng phần', 'song'],
      ['Nhạc nền', 'nhac'],
      ['Âm lượng', 'amluong']
    ];
    var o = document.querySelectorAll('.theme-editor-panel label.theme-editor-field > span');
    for (var i = 0; i < o.length; i++) {
      var t = (o[i].textContent || '').trim();
      for (var j = 0; j < BANG.length; j++) {
        if (t.indexOf(BANG[j][0]) === 0) { ganIcon(o[i], BANG[j][1]); break; }
      }
    }
  }

  /* Hai ô màu phụ đề: chấm tròn + MÃ MÀU bên cạnh.
     Ô color trần chỉ là một mảng màu — nhìn xong vẫn không biết mã để chép
     sang chỗ khác. Giữ NGUYÊN thẻ input (deck đọc/ghi .value của nó), chỉ bọc
     thêm phần hiển thị quanh nó.
     Đồng bộ bằng đồng hồ 400ms chứ không nghe sự kiện: deck đặt .value bằng mã
     khi đổi slide, mà gán .value KHÔNG bắn input/change và cũng không đổi
     thuộc tính nào cho MutationObserver bắt. */
  function oMauCoMa() {
    /* Bốn ô: hai của phụ đề, hai của ánh sáng nền (haiBangDen đã bê chúng vào
       trong thẻ trước khi hàm này chạy — xem thứ tự gọi trong run()). */
    var ids = ['subtitleColor', 'subtitleActiveColor', 'mainLightColor', 'softLightColor'];
    var cap = [];
    for (var i = 0; i < ids.length; i++) {
      var inp = document.getElementById(ids[i]);
      if (!inp || inp.parentNode.classList.contains('ed-mau')) continue;
      var boc = document.createElement('span');
      boc.className = 'ed-mau';
      inp.parentNode.insertBefore(boc, inp);
      boc.appendChild(inp);
      var ma = document.createElement('span');
      ma.className = 'ed-mau-ma';
      boc.appendChild(ma);
      cap.push([inp, ma]);
    }
    if (!cap.length) return;
    var dong = function () {
      for (var k = 0; k < cap.length; k++) {
        var v = (cap[k][0].value || '').toUpperCase();
        if (cap[k][1].textContent !== v) cap[k][1].textContent = v;
      }
    };
    dong();
    setInterval(dong, 400);
  }

  function run() {
    if (done) return false;
    if (!moveToneToggle()) return false;
    if (!mergeSubtitleAndScript()) return false;
    if (!groupByScope()) return false;
    themVideoFx();
    haiBangDen();
    xepHangNgang();
    noiVoiCha();
    chanDongDaLuu();
    vietHoa();
    doiIconFA();
    ganIconNhan();
    nutXoaChiIcon();
    oMauCoMa();
    setupRealAutosave();
    tuCao();
    done = true;
    return true;
  }

  if (run()) return;
  var obs = new MutationObserver(function () { if (run()) obs.disconnect(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { obs.disconnect(); }, 10000);
})(