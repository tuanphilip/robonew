'use strict';
/**
 * Lượt dựng: hạn mức, vạch 5 bước, dải đang dựng, payload, start/stop, poll, hàng đợi, bám lại job.
 *
 * Tách từ render-page.js (02/09/2026, audit Phase 2.3). Các module của trang
 * Dựng video dùng chung một không gian tên `window.__renderPage` (RP): core.js
 * đặt state/$/setStatus/apiGoi…; mỗi module đăng ký hàm của mình vào RP ở cuối
 * file; gọi sang module KHÁC qua `RP.tên()` — vì thứ tự nạp không đảm bảo module
 * kia đã có lúc file này chạy. Câu lệnh khởi động/gắn sự kiện nằm ở render-page.js.
 */
(() => {
  const RP = window.__renderPage;
  const { $, $all, MAX_AUDIO_BYTES, apiGoi, apiPost, applyTheme, currentProject, fallbackOutputUrl, fallbackProject, projectMap, projects, rowForProject, setButtonLabel, setStatus, state, toggleTheme } = RP;

  /**
   * Nút chính đổi chữ theo việc dự án đã có video hay chưa.
   *
   * Cùng một nút mà hai nghĩa khác nhau: lần đầu là "làm ra video", lần sau là
   * "ghi đè video đang có". Không nói ra thì người dùng bấm nhầm rồi mất bản cũ.
   */
  /**
   * Hạn mức đọc được từ máy chủ. `null` = chưa biết (chưa hỏi, mất mạng, hoặc
   * chưa đăng nhập) — khác hẳn với "biết là còn 0 lượt", nên đừng gộp chung.
   */
  let hanMuc = null;

  /** "2/3 lần miễn phí" — chuỗi rỗng nếu gói trả phí hoặc chưa biết. */
  function chuHanMuc() {
    if (!hanMuc || hanMuc.khongGioiHan) return '';
    const gioiHan = Number(hanMuc.gioiHan);
    if (!Number.isFinite(gioiHan) || gioiHan <= 0) return '';
    /* ⚠ KHÔNG BIẾT còn mấy lượt thì ĐỪNG GHI SỐ NÀO.
       Bản cũ `Number(hanMuc.conLai) || 0` biến `null`/`undefined` thành 0, nên
       nút ghi "(0/10 lần miễn phí)" — đọc ra là "đã dùng hết 10 lượt", trong
       khi sự thật chỉ là app chưa hỏi được máy chủ. Chủ dự án gặp đúng cảnh đó
       19/09/2026: nút ghi 0/10 mà câu lỗi lại là "Phiên đã hết hạn", hai câu
       chọi nhau nên không biết mình hết lượt hay phiên chết. */
    /* ⚠ PHẢI kiểm KIỂU, không được `Number()` rồi kiểm. `Number(null)` ra **0**
       chứ không phải NaN, `Number('')` cũng vậy — nên bản vá đầu 19/09/2026
       vẫn để lọt đúng cái ca đang chữa, và chỉ chặn được `undefined`. Bắt
       được nhờ chạy thử chính hàm này với cả năm kiểu giá trị máy chủ có thể
       trả về. Chỉ NHẬN một con số thật. */
    const con = hanMuc.conLai;
    if (typeof con !== 'number' || !Number.isFinite(con) || con < 0) return '';
    return ` (${con}/${gioiHan} lần miễn phí)`;
  }

  // Nhớ lại trạng thái để `napHanMuc()` vẽ lại nhãn mà không phải đọc ngược chữ
  // trên nút — đọc ngược thì đổi câu chữ một lần là hỏng.
  let nutDangLaTaoLai = false;

  function capNhatNutTao(daCo) {
    if (daCo !== undefined) nutDangLaTaoLai = !!daCo;
    const nut = $('#startRender');
    if (!nut) return;
    const chu = nut.querySelector('span:last-child');
    // "Tạo lại" chứ không phải "Tạo lại video": lúc này nút đứng cạnh "Mở video
    // cuối" và "Mở trong thư mục", cả hàng ba nút đều đang nói về một video —
    // chữ "video" ở đây chỉ làm nút dài thêm mà không thêm nghĩa. Phần
    // `chuHanMuc()` GIỮ NGUYÊN, vẫn hiện "(1/3 lần miễn phí)".
    if (chu) chu.textContent = (nutDangLaTaoLai ? 'Tạo lại' : 'Tạo video') + chuHanMuc();
    nut.title = nutDangLaTaoLai
      ? 'Tạo lại — video cũ sẽ bị ghi đè'
      : 'Tạo video từ deck đang chọn';
  }

  /**
   * Hỏi máy chủ số lượt còn lại rồi vẽ lại nhãn nút.
   *
   * ⚠ KHÔNG chặn gì cả nếu hỏi hỏng. Nhãn này chỉ để người dùng biết mình còn
   * mấy lượt; chốt thật nằm ở `/render/begin` phía máy chủ. Chặn ở đây thì vừa
   * thừa vừa nguy hiểm — mất mạng một giây là không render được nữa.
   */
  async function napHanMuc() {
    try {
      const q = await window.beeknoee?.render?.quota?.();
      /* ⚠ `null` LÀ "KHÔNG BIẾT", PHẢI XOÁ SỐ CŨ.
         `render:quota` trả `null` cho cả hai cảnh: chưa đăng nhập, và hỏi
         không được (mất mạng, phiên hết hạn — xem `ipc/account.js`). Bản trước
         `return` sớm nên giữ nguyên con số của lần hỏi trước: phiên chết rồi
         mà nút vẫn quả quyết "còn 0/10 lần miễn phí". */
      hanMuc = q || null;
      capNhatNutTao();
    } catch { hanMuc = null; capNhatNutTao(); }
  }

  /**
   * Năm bước render hiện ra cho người dùng.
   *
   * Bên trong máy có TÁM chặng (project · tts · split · subtitle · page ·
   * timeline · record · mux). Gộp còn năm vì ba chặng giữa — dựng trang, tính
   * mốc thời gian, quay — với người xem chỉ là một việc: "đang quay hình".
   * Tách ra chỉ tổ khoe cấu trúc nội bộ chứ không giúp họ biết còn bao lâu.
   *
   * `note` là câu mô tả bằng tiếng người, KHÔNG phải log. Log gốc có dạng
   * "split: Nhận dạng xong 31 từ, đang căn với script" — đọc thì hiểu, nhưng
   * đó là tiếng của hệ thống nói với lập trình viên, không phải với người dùng.
   */
  const RENDER_STEPS = [
    { key: 'chuan-bi', label: 'Chuẩn bị dự án', note: 'Đọc nội dung và kiểm tra thông số', phases: ['start', 'project'] },
    { key: 'giong-doc', label: 'Xử lý giọng đọc', note: 'Chuẩn bị file lồng tiếng', phases: ['tts'] },
    { key: 'khop-loi', label: 'Khớp lời thoại', note: 'Chia giọng đọc theo từng phần và tạo phụ đề', phases: ['split', 'subtitle'] },
    { key: 'quay-hinh', label: 'Quay hình', note: 'Ghi lại từng phần theo đúng nhịp lời thoại', phases: ['page', 'timeline', 'record'] },
    { key: 'xuat-video', label: 'Xuất video', note: 'Ghép hình và tiếng thành video hoàn chỉnh', phases: ['mux', 'done'] },
  ];

  /** phase của máy → chỉ số bước hiện cho người dùng. */
  /* Tiền tố mà api-shim ghép vào đầu mỗi dòng log ("tts: ...") — đúng các khoá
     khai ở RENDER_STEPS phía trên, cộng vài phase chỉ dùng để báo tin. */
  const PHAN_DAU_PHASE = /^(start|project|tts|split|subtitle|page|timeline|record|mux|done|cancel|py):\s*/;

  /* Icon cho dòng chi tiết cuối bảng. Tông thắng phase (xem chỗ dùng). */
  const ICON_LOG_TONE = { failed: 'warn', cancelled: 'stop' };
  const ICON_LOG_PHASE = {
    start: 'khoi', project: 'khoi',
    tts: 'mic',
    split: 'song', subtitle: 'chu',
    page: 'slide', timeline: 'dongho', record: 'slide',
    mux: 'phim', done: 'ok',
    cancel: 'stop', py: 'info',
  };

  function stepIndexForPhase(phase) {
    const i = RENDER_STEPS.findIndex((s) => s.phases.includes(phase));
    return i < 0 ? 0 : i;
  }

  /* Mốc thời gian của TỪNG bước, đo ở máy khách.
   *
   * Máy chủ chỉ gửi `phase` đang chạy, không gửi mỗi bước mất bao lâu. Nên tự
   * bấm giờ: bước đổi thì đóng sổ bước cũ, mở sổ bước mới. Đây là số ĐO THẬT,
   * không phải ước lượng — bước nào chưa chạy thì để trống, không bịa. */
  let mocBuoc = [];
  /* Mốc sống thuộc về ĐÚNG MỘT deck. Thiếu tên này thì mở một deck cũ cũng
     được đóng dấu giờ của lúc vẽ, và năm bước cùng ghi "0s" — một con số bịa
     ra tại chỗ chứ không phải số đo. Đúng lỗi chủ dự án chụp lại 12/09/2026. */
  let mocDeck = '';
  function datLaiMocBuoc(deck) {
    mocBuoc = RENDER_STEPS.map(() => ({ batDau: 0, xong: 0 }));
    mocDeck = deck || '';
  }
  datLaiMocBuoc();

  /* Mốc của một lượt CŨ, đọc từ `buoc` trong <deck>.info.json (pipeline.js ghi).
     Giữ RIÊNG chứ không đổ đè lên `mocBuoc`: máy có thể đang dựng deck A trong
     lúc người dùng mở xem deck B — đè là mất đồng hồ của A, mà `duKienConLai()`
     đang dựa vào đúng mốc đó để đoán còn bao lâu. */
  let mocHoSo = null;
  let mocHoSoDeck = '';
  let mocDangNap = '';

  /** Mốc dùng để VẼ cho deck đang xem: sống trước, hồ sơ sau, không có thì trống. */
  function mocDeVe() {
    const deck = state.project;
    if (deck && mocDeck === deck) return { moc: mocBuoc, song: true };
    if (deck && mocHoSoDeck === deck && mocHoSo) return { moc: mocHoSo, song: false };
    return { moc: null, song: false };
  }

  /**
   * Nạp mốc từng bước của lượt đã chạy xong, từ hồ sơ video.
   *
   * Giao diện tự bấm giờ khi đang dựng, nhưng số đó chết theo trang: đóng app,
   * đổi thư mục nguồn, hay chỉ là mở lại deck hôm qua, là mất sạch. Pipeline
   * ghi mốc từng chặng vào hồ sơ cạnh file mp4 nên số sống cùng video.
   *
   * Chặng của máy (8 cái) gộp về 5 bước của người dùng bằng CHÍNH
   * `stepIndexForPhase` mà đường sống đang dùng — không chép lại bảng ánh xạ,
   * hai bản sao là hai thứ sẽ lệch nhau.
   *
   * Video dựng từ bản app cũ không có `buoc` → không làm gì, cột giờ để trống.
   * Trống là đúng: chúng ta thật sự không biết lượt đó chạy bao lâu.
   */
  async function napMocTuHoSo(deck) {
    if (!deck || mocDeck === deck || mocHoSoDeck === deck || mocDangNap === deck) return;
    mocDangNap = deck;
    try {
      const hs = await window.beeknoee?.preview?.videoInfo?.(deck);
      const buoc = hs && Array.isArray(hs.buoc) ? hs.buoc : null;
      if (!buoc || !buoc.length) return;
      const moi = RENDER_STEPS.map(() => ({ tu: null, den: null, giay: null }));
      buoc.forEach((b) => {
        const m = moi[stepIndexForPhase(b.ma)];
        if (!m) return;
        const tu = Number(b.tu) || 0;
        const den = Number(b.den) || 0;
        if (den < tu) return;
        /* Một bước gộp nhiều chặng liền nhau (quay hình = page+timeline+record):
           lấy mép NGOÀI hai đầu, không cộng dồn — cộng dồn thì khe hở giữa các
           chặng biến mất và tổng không khớp với thời gian thật. */
        if (m.tu == null || tu < m.tu) m.tu = tu;
        if (m.den == null || den > m.den) m.den = den;
      });
      moi.forEach((m) => { m.giay = m.tu == null ? null : (m.den - m.tu) / 1000; });
      mocHoSo = moi;
      mocHoSoDeck = deck;
      if (state.project === deck) paintRenderSteps(RENDER_STEPS.length - 1, true, 'done');
    } catch { /* không đọc được hồ sơ thì cột giờ để trống, không bịa */ }
    finally { mocDangNap = ''; }
  }

  /* ── Dự kiến thời gian còn lại ──────────────────────────────────────────
   *
   * KHÔNG phải số bịa. Dựa trên hai chỗ neo ĐO ĐƯỢC:
   *
   *  1. Bước "Quay hình" chạy đúng THỜI GIAN THỰC của giọng đọc. Độ dài đó do
   *     bước timeline báo về (`voiceover_duration`, giây) nên biết trước cả
   *     khi bắt đầu quay.
   *  2. Bước "Xuất video" (ghép ffmpeg) tốn thêm khoảng 1/4 thời gian quay.
   *     Đo thật 11/09/2026 trên hai deck: quay 51,4s → đuôi 11s (0,21×);
   *     quay 34,6s → đuôi 10,1s (0,29×). Lấy 0,25 cho giữa.
   *
   * Đang quay mà có phần trăm thì DÙNG SỐ ĐO thay cho dự báo: tổng thời gian
   * quay thật = đã quay / phần trăm. Máy yếu quay chậm hơn thời gian thực,
   * lúc đó con số ở (1) sẽ thấp hơn sự thật.
   *
   * Chưa tới bước timeline thì TRẢ 0 — chưa có gì để dựa vào thì không đoán.
   */
  const TY_LE_XUAT = 0.25;
  function duKienConLai(job) {
    const quayDuKien = Number(job.voiceover_duration) || 0;
    const iQuay = RENDER_STEPS.findIndex((x) => x.key === 'quay-hinh');
    const moc = mocBuoc[iQuay] || {};
    const daQuay = moc.batDau ? (Date.now() - moc.batDau) / 1000 : 0;
    const p = Number(job.progress);

    if (job.phase === 'record' && p > 0.02 && p < 1 && daQuay > 3) {
      const tongQuay = daQuay / p;
      return Math.max(0, tongQuay - daQuay) + tongQuay * TY_LE_XUAT;
    }
    if (quayDuKien > 0) {
      const conQuay = Math.max(0, quayDuKien - daQuay);
      return conQuay + quayDuKien * TY_LE_XUAT;
    }
    return 0;
  }

  function buildRenderSteps() {
    const list = $('#renderSteps');
    if (!list) return;
    list.replaceChildren();
    RENDER_STEPS.forEach((step, i) => {
      const li = document.createElement('li');
      li.dataset.step = step.key;

      const so = document.createElement('span');
      so.className = 'rs-so';
      so.textContent = String(i + 1);

      const noi = document.createElement('span');
      noi.className = 'rs-noi';
      const ten = document.createElement('span');
      ten.className = 'rs-ten';
      ten.textContent = step.label;
      const note = document.createElement('span');
      note.className = 'step-note';
      note.textContent = step.note;
      noi.append(ten, note);

      const trang = document.createElement('span');
      trang.className = 'rs-trang';

      const gio = document.createElement('span');
      gio.className = 'rs-gio';

      li.append(so, noi, trang, gio);
      list.appendChild(li);
    });
  }

  /**
   * Tô lại vạch 5 bước.
   *
   * `active < 0` = chưa chạy gì (mọi bước đều mờ). Xong hết thì KHÔNG để bước
   * nào ở trạng thái "đang chạy" — dấu tích cả năm, không còn chấm nhấp nháy.
   */
  /* Chữ trên viên trạng thái của bước ĐANG DỞ, theo tông của cả bảng. */
  const TRANG_DANG_DO = { failed: 'Không thành công', cancelled: 'Đã dừng' };
  const ICON_DANG_DO = { failed: 'warn', cancelled: 'stop' };

  function paintRenderSteps(active, finished = false, tone = 'running') {
    const list = $('#renderSteps');
    if (!list) return;
    const bay = Date.now();
    const { moc, song } = mocDeVe();

    /* Bấm giờ TRƯỚC khi vẽ. Mọi bước đứng trước bước đang chạy coi như đã xong
       — phase có thể nhảy cóc (tts -> split -> subtitle gộp chung một bước),
       nên đừng chỉ đóng sổ đúng bước liền trước.

       ⚠ CHỈ khi mốc là của chính deck đang xem (`song`). Mở lại một deck cũ
       cũng đóng dấu thì cả năm bước nhận mốc "bây giờ" cho cả hai đầu, hiệu
       bằng 0, và bảng ghi "0s" năm lần — đọc ra là "xong tức thì" trong khi
       sự thật là chúng ta không còn giữ số đo nữa. */
    if (song && active >= 0) {
      for (let i = 0; i <= active && i < moc.length; i++) {
        if (!moc[i].batDau) moc[i].batDau = bay;
        if (i < active && !moc[i].xong) moc[i].xong = bay;
      }
    }
    if (song && finished) moc.forEach((m) => { if (m.batDau && !m.xong) m.xong = bay; });

    Array.from(list.children).forEach((li, i) => {
      const xong = finished || i < active;
      const dangChay = !finished && i === active;
      li.classList.toggle('done', xong);
      li.classList.toggle('current', dangChay);

      /* Huy hiệu: số khi chưa xong, DẤU TÍCH khi đã xong. Vẽ bằng icon của bộ
         chung chứ không phải ký tự ✓ — ký tự ăn theo font hệ thống nên mỗi máy
         một chiều cao, đo được nó thấp hơn tâm ô. */
      const so = li.querySelector('.rs-so');
      if (so) {
        const muon = xong ? 'tich' : 'so';
        if (so.dataset.kieu !== muon) {
          so.dataset.kieu = muon;
          if (xong && window.__beeIcons) {
            so.textContent = '';
            const ic = document.createElement('span');
            ic.className = 'rs-so-ic';
            ic.innerHTML = window.__beeIcons.ICONS.check || '';
            so.appendChild(ic);
          } else {
            so.textContent = String(i + 1);
          }
        }
      }

      const trang = li.querySelector('.rs-trang');
      if (trang) {
        trang.textContent = xong ? 'Hoàn thành'
          : dangChay ? (TRANG_DANG_DO[tone] || 'Đang thực hiện')
          : 'Chờ xử lý';
        /* KHÔNG dùng data-icon: apply() của icons.js quét đúng thuộc tính đó và
           ghi đè nguyên ruột phần tử — mất luôn chữ vừa đặt. Viên này tự vẽ lấy
           icon ở veIconTrang() bên dưới. */
        trang.dataset.icTrang = xong ? 'ok'
          : dangChay ? (ICON_DANG_DO[tone] || 'refresh')
          : 'cho';
      }

      const gio = li.querySelector('.rs-gio');
      if (gio) {
        const m = (moc && moc[i]) || {};
        /* Hai dạng mốc: hồ sơ cho sẵn số GIÂY, đo sống cho hai mốc thời điểm. */
        let giay = null;
        if (m.giay != null) giay = m.giay;
        else if (m.batDau) giay = ((m.xong || bay) - m.batDau) / 1000;
        /* Không có số đo thì để TRỐNG, không hiện "0s": 0s đọc ra là "xong tức
           thì", trong khi sự thật là chưa tới lượt — hoặc là lượt đã chạy từ
           bản app chưa ghi mốc vào hồ sơ.

           Dưới một giây thì ghi "<1s" chứ không làm tròn thành "0s": bước
           chuẩn bị dự án đo được 7ms, bước giọng đọc 361ms khi dùng file tải
           lên — đó là số đo THẬT, mà viết "0s" thì trông y hệt ô không có dữ
           liệu. Hai thứ khác nhau, đừng để chúng hiện ra giống nhau. */
        gio.textContent = giay == null ? ''
          : giay < 1 ? '<1s'
          : formatElapsed(giay);
      }
    });
    veIconTrang(list);
  }

  /* Viên trạng thái dùng icon của bộ chung. Vẽ lại sau mỗi lần tô vì chữ vừa bị
     ghi đè — `apply()` chỉ thay ruột phần tử mang data-icon. */
  function veIconTrang(goc) {
    if (!window.__beeIcons) return;
    goc.querySelectorAll('.rs-trang').forEach((el) => {
      const ten = el.dataset.icTrang;
      const hinh = window.__beeIcons.ICONS[ten];
      if (!hinh) return;
      const chu = el.textContent;
      el.replaceChildren();
      const i = document.createElement('span');
      i.className = 'rs-trang-ic';
      i.innerHTML = hinh;
      el.append(i, document.createTextNode(chu));
    });
  }

  function setRenderState(title = '', steps = [], tone = 'running') {
    const panel = $('#renderState');
    const titleEl = $('#stateTitle');
    const list = $('#stateList');
    if (!panel || !titleEl || !list) return;
    /* ẨN HẲN khi chưa chạy gì (đổi 10/09/2026 theo yêu cầu chủ dự án).
     *
     * Trước đây luôn hiện, vì bản trước nữa ẩn cả bảng 5 bước nên cột phải
     * trống trơn rồi đột nhiên mọc ra một khối. Nhưng ở trạng thái chờ, CSS
     * `.render-state.cho` đã gập bảng lại còn đúng một dòng "Chưa tạo video" —
     * mà dòng đó không nói thêm điều gì: chưa bấm thì đương nhiên là chưa tạo.
     * Bỏ chữ mà giữ khung thì còn tệ hơn: một ô xám rỗng.
     * Khối nằm cuối cột nên hiện ra lúc bấm không đẩy thứ gì bên dưới.
     */
    panel.hidden = !title;
    panel.className = `render-state ${tone}${title ? '' : ' cho'}`;

    /* Tên trạng thái nay là MỘT CÂU CỐ ĐỊNH theo tone, còn `title` (vốn là
       "Quay hình · 23% (đã chạy 2m49s)") tách ra hai viên bên cạnh. Trước đây
       cả chuỗi đó nằm ở tiêu đề nên tiêu đề đổi liên tục — đọc lướt không biết
       khối này đang nói gì. */
    const TEN_TRANG = {
      running: 'Đang tạo video',
      done: 'Đã tạo xong video',
      failed: 'Tạo video không thành công',
      cancelled: 'Đã dừng tạo video',
    };
    /* Tách "nhãn bước · %" khỏi "(đã chạy ...)" — renderTitle() ghép chúng.
       CHỈ tách với bốn tone của một lượt render. Tone khác — ví dụ 'cho', là
       deck đang XẾP HÀNG với tiêu đề "Đang chờ trong hàng đợi (thứ 2)" — thì
       giữ nguyên câu gốc ở tiêu đề: nhét nó vào viên rồi ghi tiêu đề là "Đang
       tạo video" là nói sai, deck đó chưa chạy dòng nào. */
    const laLuotRender = Boolean(TEN_TRANG[tone]);
    const m = laLuotRender ? /^(.*?)\s*\(đã chạy ([^)]+)\)\s*$/.exec(title || '') : null;
    titleEl.textContent = TEN_TRANG[tone] || title || 'Trạng thái tạo video';
    const viecDangLam = laLuotRender ? (m ? m[1] : title) : '';
    const daChay = m ? m[2] : '';
    const oTienDo = $('#rsTienDo');
    if (oTienDo) {
      oTienDo.textContent = viecDangLam || '';
      oTienDo.hidden = !viecDangLam;
    }
    const oDaChay = $('#rsDaChay');
    if (oDaChay) {
      /* Ưu tiên DỰ KIẾN CÒN LẠI — đó là thứ người ta đang muốn biết. Chưa tính
         được (chưa tới bước timeline) thì lùi về tổng giờ đã chạy, chứ không
         hiện một con số đoán. */
      const chu = duKienGiay > 0 && tone === 'running'
        ? `Dự kiến còn ~${formatElapsed(duKienGiay)}`
        : (daChay ? `Đã chạy ${daChay}` : '');
      oDaChay.textContent = chu;
      oDaChay.hidden = !chu;
      oDaChay.classList.toggle('rs-dukien', duKienGiay > 0 && tone === 'running');
    }

    const chan = $('#rsChan');
    const oDuAn = $('#rsDuAn');
    const deck = state.deckDangDung || state.project || '';
    if (chan && oDuAn) {
      oDuAn.textContent = deck ? `"${deck}"` : '';
      chan.hidden = !deck || tone !== 'running';
    }
    if (window.__beeIcons) window.__beeIcons.apply(panel);

    /* Bảng của một lượt ĐÃ XONG mà mốc không còn trong bộ nhớ: đi đọc hồ sơ
       video. Không chờ — vẽ ngay bây giờ với cột giờ trống, đọc xong thì
       napMocTuHoSo() tự gọi vẽ lại. */
    if (tone === 'done') napMocTuHoSo(state.project);
    paintRenderSteps(state.renderStep ?? -1, tone === 'done', tone);

    /* DÒNG CHI TIẾT của lượt đang chạy — thứ bảng năm bước không nói được:
       "11 slide", "Tạo giọng đọc (elevenlabs)", "Dùng lại căn chỉnh đã khoá",
       "34 caption", "Gói miễn phí, còn 7 lượt tạo video"… và khi hỏng thì chính
       là LÝ DO hỏng.

       Đường đi của nó vốn đã có sẵn: pipeline gọi onStep(phase, message) →
       api-shim ghép thành "phase: message" → renderTitle() lấy dòng cuối → vào
       đây qua tham số `steps`. Bản trước xoá trắng (`list.textContent = ''`)
       nên cả đường ống đó chạy không để làm gì.

       Chỉ lấy DÒNG CUỐI: đây là chỗ liếc xem "đang làm gì", không phải sổ nhật
       ký. Bỏ tiền tố `phase:` vì cột bên trái đã ghi tên bước rồi — và chỉ bỏ
       ĐÚNG các khoá phase đã biết, không dùng biểu thức chung: câu lỗi thật hay
       mở đầu bằng "ElevenLabs:" hoặc "Whisper:", cắt mất là mất ngữ cảnh.

       ⚠ Chỗ gọi KHÔNG được đồng thời gọi setStatus() với cùng câu này — hai
       dòng y hệt nhau cách nhau vài chục pixel, chủ dự án đã chỉ ra đúng lỗi đó
       trên ảnh chụp. */
    list.replaceChildren();
    const chiTiet = (steps || [])
      .map((d) => String(d == null ? '' : d).trim())
      .filter(Boolean)
      .pop();
    if (chiTiet) {
      const li = document.createElement('li');
      /* Icon chọn theo LOẠI dòng, hai bậc:
           1. tông của cả bảng thắng trước — hỏng thì là dấu cảnh báo, dừng thì
              là dấu dừng, bất kể lúc ấy đang ở bước nào;
           2. không thì theo PHASE phát ra dòng đó, để mỗi loại việc có một hình
              riêng: đọc giọng khác cắt tiếng, khác quay hình.
         Lấy phase TRƯỚC khi cắt tiền tố — cắt xong là mất căn cứ. */
      const khop = PHAN_DAU_PHASE.exec(chiTiet);
      const ten = ICON_LOG_TONE[tone] || ICON_LOG_PHASE[khop ? khop[1] : ''] || 'info';
      const bo = window.__beeIcons;
      if (bo && bo.ICONS[ten]) {
        const ic = document.createElement('span');
        ic.className = 'sl-ic';
        ic.innerHTML = bo.ICONS[ten];
        li.appendChild(ic);
      }
      const chu = document.createElement('span');
      chu.className = 'sl-chu';
      chu.textContent = chiTiet.replace(PHAN_DAU_PHASE, '');
      li.appendChild(chu);
      list.appendChild(li);
    }
  }

  function formatElapsed(seconds) {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    if (hours) return `${hours}h${minutes}m${remainingSeconds}s`;
    if (minutes) return `${minutes}m${remainingSeconds}s`;
    return `${remainingSeconds}s`;
  }

  function elapsedForJob(job) {
    const startedAt = Number(job.started_at || job.created_at || 0);
    if (!startedAt) return '0s';
    const finishedAt = Number(job.finished_at || 0);
    const endedAt = ['done', 'failed', 'cancelled'].includes(job.status) && finishedAt ? finishedAt : Date.now() / 1000;
    return formatElapsed(endedAt - startedAt);
  }

  function renderTitle(label, job) {
    return `${label} (đã chạy ${elapsedForJob(job)})`;
  }

  /* ⚠ TỪNG CÓ `chuDangDung(job)` Ở ĐÂY — hàm dựng câu "Đang tạo video cho dự
     án X". Gỡ 16/09/2026: từ lúc đổi sang DẢI MỎNG, `veDaiDangDung()` tự dựng
     câu của nó ('⏳ Đang dựng "…"'), nên đây là bản thứ hai của cùng một câu mà
     không chỗ nào gọi — sửa chữ ở một bản thì bản kia lệch đi. */

  /* ══ Dải "đang dựng" ════════════════════════════════════════════════════
     Bảng 5 bước thuộc về DỰ ÁN ĐANG CHỌN — muốn theo dõi lượt đang chạy trong
     lúc xem deck khác thì nhìn dải mỏng này (bấm vào là nhảy về deck đó). Nó
     thế chỗ cho thiết kế cũ "bảng dùng chung bám lượt đang chạy": vẫn không
     mất dấu tiến độ, mà deck đã có video không còn bị màn hình dựng của deck
     khác đè lên (người dùng bấm vào dự án xong là mất cả ba nút). Cũng là nơi
     báo "lượt vừa xong/lỗi" khi kết thúc rơi vào lúc đang xem deck khác. */
  function veDaiDangDung() {
    let dai = $('#daiDangDung');
    if (!dai) {
      const neo = $('#renderState');
      if (!neo || !neo.parentElement) return;
      // CSS của dải nằm ở css/render-page.css (tách 02/09/2026).
      dai = document.createElement('div');
      dai.id = 'daiDangDung';
      dai.className = 'dai-dang-dung';
      dai.hidden = true;
      const chu = document.createElement('span');
      chu.className = 'ddd-chu';
      const xem = document.createElement('span');
      xem.className = 'ddd-xem';
      xem.textContent = 'bấm để xem';
      dai.append(chu, xem);
      dai.addEventListener('click', () => {
        const deck = dai.dataset.deck;
        if (deck && projectMap.has(deck)) RP.setSelectedProject(deck);
      });
      neo.parentElement.insertBefore(dai, neo);
    }
    const chu = dai.querySelector('.ddd-chu');

    // Ưu tiên 1: máy đang dựng deck KHÁC deck đang xem → tiến độ live.
    if (state.busy && state.deckDangDung && state.deckDangDung !== state.project) {
      const td = state.tienDoCuoi && state.tienDoCuoi.deck === state.deckDangDung
        ? state.tienDoCuoi.title : '';
      // Nối chuỗi thường, KHÔNG template lồng template — verify:tpl quét backtick
      // theo kiểu phẳng nên backtick lồng bị đọc là "đóng chuỗi sớm".
      chu.textContent = '⏳ Đang dựng "' + state.deckDangDung + '"' + (td ? ' — ' + td : '');
      dai.dataset.deck = state.deckDangDung;
      dai.className = 'dai-dang-dung';
      dai.hidden = false;
      return;
    }
    // Ưu tiên 2: một lượt vừa kết thúc trong lúc đang xem deck khác.
    const kq = state.ketQuaCho;
    if (!state.busy && kq && kq.deck && kq.deck !== state.project) {
      chu.textContent = `${kq.icon} ${kq.chu} "${kq.deck}"`;
      dai.dataset.deck = kq.deck;
      dai.className = `dai-dang-dung ${kq.tone}`;
      dai.hidden = false;
      return;
    }
    dai.hidden = true;
    dai.dataset.deck = '';
  }

  function latestRawLogLine(logs = '') {
    const lines = String(logs).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.length ? lines[lines.length - 1] : '';
  }

  /**
   * Tiêu đề + bước hiện tại, lấy từ `job.phase`.
   *
   * Bản cũ đoán bước bằng bảy biểu thức chính quy dò chuỗi tiếng Anh trong log
   * ("Speeding up audio", "Whisper transcription"...) — di sản từ thời chỉ có
   * log thô để bám. Log của app nay đã tiếng Việt nên **không mẫu nào khớp
   * nữa**: mọi lần render đều đứng nguyên ở "Đang tạo video...". App phát ra
   * `phase` có cấu trúc rồi, đọc thẳng vào đó thì đúng và không bao giờ lệch vì
   * ai đó sửa một câu log.
   */
  /* KHÔNG tự ghi `state.renderStep` ở đây nữa — trả `step` để CHỖ VẼ quyết.
     Vạch 5 bước nay thuộc về deck ĐANG CHỌN: poll của deck A chạy trong lúc
     người dùng xem deck B mà ghi thẳng vào state là vạch của B nhảy theo A. */
  /* Giây còn lại của lượt đang chạy; 0 = chưa tính được. setRenderState đọc
     biến này — nó không nhận `job` nên không tự tính được. */
  let duKienGiay = 0;

  function renderProgressForJob(job) {
    const rawLine = latestRawLogLine(job.logs || '');
    duKienGiay = job.status === 'running' ? duKienConLai(job) : 0;

    if (job.status === 'done') {
      return { title: 'Đã xong', log: rawLine, step: RENDER_STEPS.length - 1 };
    }
    if (job.status === 'failed') return { title: 'Tạo video không thành công', log: job.error || rawLine };
    if (job.status === 'cancelled') return { title: 'Đã dừng', log: rawLine || 'Đã dừng tạo video.' };
    if (job.status === 'cancelling') return { title: 'Đang dừng...', log: rawLine };

    const idx = stepIndexForPhase(job.phase);
    const step = RENDER_STEPS[idx];

    // Riêng lúc quay thì kèm phần trăm: đây là bước lâu nhất (chạy đúng bằng độ
    // dài video) nên không có con số thì trông như treo.
    const pct = Number(job.progress);
    const suffix = job.phase === 'record' && pct > 0 && pct <= 1
      ? ` · ${Math.round(pct * 100)}%`
      : '';
    return { title: `${step.label}${suffix}`, log: rawLine, step: idx };
  }

  /* Hàm deleteOutput ĐÃ GỠ. Nút #deleteSelectedOutput không còn trong markup
     (đã kiểm: 0 lần xuất hiện ở index.html và render-layout.js), còn nút thùng rác
     ở danh sách nay xoá CẢ dự án — xem RP.xoaDuAn. Giữ một hàm không ai gọi, lại nhắm
     vào class .delete-output-btn đã đổi tên, chỉ tổ đánh lừa người đọc sau.
     Đường IPC output:delete bên main.js vẫn còn nếu sau này cần dùng lại. */

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',', 2)[1] : result);
      };
      reader.onerror = () => reject(reader.error || new Error('Không đọc được file audio.'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Gom thông số của lượt dựng từ giao diện.
   *
   * Tách khỏi `startRender()` vì đường XẾP HÀNG cũng cần y hệt bộ thông số này.
   * Chép làm hai bản thì thêm một ô tick mới là có ngày nhớ sửa một bên — đúng
   * cái đã xảy ra với `force` (xem chú thích ở `render:start` bên main.js).
   *
   * @param {boolean} veTienTrinh  có được viết lên vạch tiến trình không.
   *   Đường xếp hàng phải truyền `false`: lúc đó vạch đang hiện tiến độ của
   *   lượt ĐANG CHẠY, ghi đè lên là xoá mất màn hình của người ta.
   */
  async function dungPayloadRender(veTienTrinh) {
    const noiTrangThai = (chu) => { if (veTienTrinh) setRenderState(chu, []); };
    const project = currentProject();
    if (!project) throw new Error('Vui lòng chọn một dự án trước.');

    const payload = {
      project: project.name,
      engine: state.engine,
      // Qua `docTocDo` chứ không `Number()`: ô nay là ô CHỮ nên nhận được cả
      // "1,25". `pipeline.js` còn một cửa chốt nữa cho đường dòng lệnh.
      speed: RP.docTocDo($('#renderSpeed')?.value).so,
      size: RP.currentRenderSize(),
    };

    if (state.engine === 'elevenlabs') {
      payload.mode = RP.currentElevenMode();
      if (payload.mode === 'upload') {
        const file = $('#elevenFile')?.files?.[0];
        const duongNho = $('#elevenFileName')?.dataset.duong || '';
        if (file) {
          if (file.size > MAX_AUDIO_BYTES) throw new Error('File audio lớn hơn 200 MB.');
          noiTrangThai(`Đang nạp ${file.name}`);
          payload.audio = { name: file.name, data: await fileToBase64(file) };
        } else if (duongNho) {
          /* Vừa mở lại app hoặc vừa đổi dự án: ô input trống nhưng ta còn nhớ
             đường dẫn. Gửi thẳng đường dẫn, KHỎI đọc file lên base64 — nhanh
             hơn hẳn và không nạp cả trăm MB vào bộ nhớ trang. */
          noiTrangThai('Dùng lại file giọng đọc đã chọn');
          payload.audioPath = duongNho;
        } else {
          throw new Error('Vui lòng chọn file audio ElevenLabs trước.');
        }
      } else {
        payload.voice = $('#elevenVoice')?.value.trim() || '';
        payload.force = Boolean($('#elevenForce')?.checked);
        noiTrangThai('Chuẩn bị dự án');
      }
    } else if (state.engine === 'vieneu') {
      // Giọng trên máy: chỉ cần tên giọng; mô hình đã nằm trên máy (vieneu-panel.js chặn khi chưa có).
      payload.voice = $('#vnVoice')?.value || '';
      payload.force = Boolean($('#vieneuForce')?.checked);
      noiTrangThai('Chuẩn bị dự án');
    } else if (state.engine === 'beeknoee') {
      payload.model = $('#beeModel')?.value || RP.beeModelMacDinh();
      payload.voice = $('#beeVoice')?.value || '';
      payload.force = Boolean($('#beeForce')?.checked);
      noiTrangThai('Chuẩn bị dự án');
    } else {
      payload.voice = $('#edgeVoice').value.trim() || 'vi-VN-HoaiMyNeural';
      payload.force = $('#edgeForce').checked;
      payload.edgePerSlide = Boolean($('#edgePerSlide')?.checked);
      noiTrangThai('Chuẩn bị dự án');
    }
    return payload;
  }

  /**
   * Thêm dự án đang chọn vào hàng đợi. KHÔNG đụng vạch tiến trình.
   *
   * Thông số được chốt NGAY LÚC BẤM (giọng đọc, tốc độ, kích thước) chứ không
   * đọc lại lúc tới lượt: người dùng xếp 3 deck rồi đổi giọng thì 3 deck đó vẫn
   * dùng đúng giọng họ đã chọn cho từng cái.
   * Riêng NỘI DUNG deck thì đọc từ đĩa lúc chạy — sửa script khi đang chờ là
   * video ra theo bản mới.
   */
  async function xepVaoHangDoi() {
    const ten = state.project;
    if (!ten) { setStatus('Vui lòng chọn một dự án trước.', 'bad'); return; }
    if (ten === state.deckDangDung) { setStatus(`"${ten}" đang được dựng.`, 'warn'); return; }
    if (state.hangDoi.includes(ten)) { setStatus(`"${ten}" đã ở trong hàng đợi.`, 'warn'); return; }
    try {
      const payload = await dungPayloadRender(false);
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Không thêm được vào hàng đợi (mã ${res.status})`);
      setStatus(`Đã thêm "${ten}" vào hàng đợi.`, 'good');
    } catch (e) {
      setStatus(e.message || String(e), 'bad');
    }
  }

  async function startRender() {
    /* ⚠ ĐANG CÓ LƯỢT CHẠY → đây là yêu cầu XẾP HÀNG, đi đường khác hẳn.
     *
     * Phải rẽ NGAY ĐẦU HÀM, trước mọi dòng bên dưới: chúng đặt `state.busy`,
     * `state.deckDangDung` và gọi `setRenderState('Chuẩn bị dự án')` — tức xoá
     * sạch màn hình tiến trình của lượt ĐANG chạy và gắn nhãn "Đang dựng" sang
     * deck vừa bấm. Người dùng xếp hàng deck B sẽ thấy tiến trình của A biến
     * mất và B bị ghi là đang dựng, cả hai đều sai. */
    // Đang trong hàng thì nút này là "Bỏ khỏi hàng đợi" — xem `capNhatNutDung`.
    if (state.project && state.hangDoi.includes(state.project)) {
      const p = projectMap.get(state.project);
      // Dự án video trống: lượt trong hàng là loại 'dung' (xuất timeline) — boHang phải nói đúng loại.
      const ok = await window.beeknoee.render.boHang(p && p.source_path, p && p.loai === 'video' ? 'dung' : undefined).catch(() => false);
      setStatus(ok ? `Đã bỏ "${state.project}" khỏi hàng đợi.` : 'Không bỏ được khỏi hàng đợi.', ok ? 'good' : 'bad');
      return;
    }
    if (state.busy) return xepVaoHangDoi();

    const startButton = $('#startRender');
    const stopButton = $('#stopRender');
    const videoLink = $('#videoLink');
    if (startButton) startButton.disabled = true;
    if (stopButton) {
      stopButton.hidden = true;
      stopButton.disabled = true;
    }
    if (videoLink) videoLink.hidden = true;
    RP.setRevealOutputButton(state.project, false);
    state.busy = true;
    /* Ghi RIÊNG deck đang dựng, không dùng `state.project`.
       Bấm vào một dòng khác giữa lúc render vẫn đổi `state.project` được (xem
       handler ở cuối file — không có chốt chặn theo `busy`). Dùng nó để gắn
       nhãn "Đang dựng" thì nhãn chạy theo dòng vừa bấm, chỉ sai deck. */
    state.deckDangDung = state.project;
    state.canceling = false;
    state.daBamKetQua = false;
    state.deckLoi = null;    // lượt mới bắt đầu — bảng lỗi cũ hết nhiệm vụ
    state.ketQuaCho = null;  // thông báo "vừa xong/lỗi" của lượt trước hết hạn
    state.tienDoCuoi = null;
    state.renderStep = 0;    // sáng ngay bước 1, đừng để vạch trống lúc bấm
    // Đồng hồ từng bước bắt đầu lại từ 0 — không thì lượt này cộng dồn giờ
    // của lượt trước và bước 1 hiện ra vài phút ngay lúc vừa bấm.
    datLaiMocBuoc(state.project);
    capNhatNutDung();        // "Tạo video" → "Đang dựng…" ngay, không đợi sự kiện
    setRenderState('Chuẩn bị dự án', []);
    veDaiDangDung();

    try {
      const payload = await dungPayloadRender(true);

      const data = await apiPost('/api/render', payload);

      /* ⚠ MÁY CHỦ BẢO ĐÃ XẾP HÀNG → ĐỪNG bám như một lượt vừa bắt đầu.
       *
       * Nhánh này trông không thể xảy ra vì `startRender` đã rẽ sang
       * `xepVaoHangDoi()` khi `state.busy`, nhưng `state.busy` là ảnh chụp phía
       * giao diện và có thể LỖI THỜI: một sự kiện hàng đợi tới đúng khe giữa
       * hai lần bấm là nó bị hạ xuống false trong khi main vẫn đang dựng.
       * Không chốt ở đây thì giao diện vẽ vạch tiến trình của deck A rồi gán
       * cho deck B, và bấm Dừng sẽ dừng nhầm deck.
       *
       * Main mới là nơi biết chắc, nên tin nó và lùi lại trạng thái vừa đặt. */
      if (data.xepHang) {
        state.busy = true;               // main đang bận thật
        state.deckDangDung = null;       // sự kiện hàng đợi sẽ điền đúng tên
        state.renderStep = -1;
        setStatus(`Đã thêm "${payload.project}" vào hàng đợi.`, 'good');
        dongBoHangDoi().catch(() => {});
        capNhatNutDung();
        veDaiDangDung();
        return;
      }

      state.jobId = data.id;
      if (stopButton) {
        stopButton.hidden = false;
        stopButton.disabled = false;
      }
      const progress = renderProgressForJob(data);
      setStatus(`Đã bắt đầu tạo video: ${data.id}`, 'good');
      setRenderState(renderTitle(progress.title, data), [progress.log]);
      await pollJob();
      if (state.pollTimer) window.clearInterval(state.pollTimer);
      state.pollTimer = window.setInterval(pollJob, 1500);
    } catch (error) {
      state.busy = false;
      state.deckDangDung = null;
      /* Hai dòng trên vừa tuyên bố "không có gì chạy" dựa trên MỘT lỗi ở phía
         giao diện — mà lỗi đó có thể chỉ là hỏng lúc dựng thông số, trong khi
         main vẫn đang dựng một deck khác. Hỏi lại main cho chắc. */
      dongBoHangDoi().catch(() => {});
      RP.lamMoiDanhSach().catch(() => {});
      setRenderState('Không tạo được video', [error.message || String(error)], 'failed');
      /* Hỏi lại hạn mức NGAY sau khi hỏng. Phần lớn lỗi ở cửa này là lỗi tài
         khoản (hết lượt · phiên hết hạn), mà nhãn nút thì vẫn mang con số của
         lần hỏi gần nhất — để nguyên là nút nói một đằng, câu lỗi nói một nẻo,
         đúng chỗ chủ dự án kêu khó hiểu. */
      napHanMuc().catch(() => {});
      veDaiDangDung();
      if (startButton) startButton.disabled = false;
      capNhatNutDung();   // nhãn nút phải khớp trạng thái mới (hàng đợi / rảnh)
      if (stopButton) {
        stopButton.hidden = true;
        stopButton.disabled = true;
      }
    }
  }

  async function stopRender() {
    if (!state.jobId || state.canceling) return;
    /* ⚠ NÓI RÕ HÀNG ĐỢI VẪN CHẠY TIẾP.
       Dừng lượt đang chạy KHÔNG dừng cả dây chuyền: `chayTiepHangDoi()` bên main
       gọi lượt kế ngay trong `finally`. Không nói ra thì người dùng bấm Dừng,
       thấy máy vẫn quay tiếp và tưởng nút hỏng. */
    const con = state.hangDoi.length;
    const confirmed = window.confirm(
      con
        ? `Dừng việc tạo video đang chạy?\n\nCòn ${con} video trong hàng đợi — video kế tiếp sẽ TỰ chạy ngay sau đó.\nAudio/video đang làm dở có thể còn lại trong thư mục output.`
        : 'Dừng việc tạo video đang chạy? Audio/video đang làm dở có thể còn lại trong thư mục output.',
    );
    if (!confirmed) return;
    /* Hỏi riêng về hàng đợi — người muốn dừng HẲN thì phải có một đường làm việc
       đó trong cùng một lần bấm, chứ không phải đi bỏ từng dự án một. */
    if (con && window.confirm(`Xoá luôn ${con} video đang chờ trong hàng đợi?`)) {
      await window.beeknoee.render.xoaHang().catch(() => {});
    }
    const stopButton = $('#stopRender');
    if (stopButton) stopButton.disabled = true;
    state.canceling = true;
    setStatus('Đang dừng...', 'warn');
    setRenderState('Đang dừng...', ['Đang gửi tín hiệu dừng.']);
    try {
      const job = await apiPost(`/api/jobs/${state.jobId}/cancel`, {}, false);
      const progress = renderProgressForJob(job);
      setRenderState(renderTitle(progress.title, job), [progress.log], job.status === 'cancelled' ? 'cancelled' : 'running');
    } catch (error) {
      state.canceling = false;
      if (stopButton) stopButton.disabled = false;
      setRenderState('Không dừng được', [error.message || String(error)], 'failed');
    }
  }

  /**
   * Dọn trạng thái khi một lượt KẾT THÚC — xong, lỗi, dừng, hay mất liên lạc.
   * Trước đây bốn nhánh của `pollJob` chép nguyên khối này (kèm cùng một đoạn
   * chú thích), sửa một chỗ quên ba chỗ.
   *
   * Đồng bộ lại với main: kết quả "xong" này có thể là của lượt TRƯỚC, về
   * đúng lúc lượt kế đã khởi động — lúc đó ta vừa tắt poll oan và màn hình
   * sẽ đứng ở kết quả cũ trong khi máy vẫn đang dựng. Hỏi lại main là biết
   * ngay, và apHangDoi sẽ bật poll lại nếu thật sự còn chạy.
   *
   * @param {boolean} daBamKetQua  true = đã vẽ được kết quả cuối (done/failed/
   *   cancelled); false = mất liên lạc, chưa có kết quả nào để "đã bấm".
   */
  function ketThucJob(daBamKetQua) {
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.busy = false;
    state.deckDangDung = null;
    dongBoHangDoi().catch(() => {});
    RP.lamMoiDanhSach().catch(() => {});
    state.canceling = false;
    if (daBamKetQua) state.daBamKetQua = true;
    const startButton = $('#startRender');
    const stopButton = $('#stopRender');
    if (startButton) startButton.disabled = false;
    capNhatNutDung();   // nhãn nút phải khớp trạng thái mới (hàng đợi / rảnh)
    if (stopButton) {
      stopButton.hidden = true;
      stopButton.disabled = true;
    }
  }

  async function pollJob() {
    if (!state.jobId) return;
    const startButton = $('#startRender');
    const stopButton = $('#stopRender');
    const videoLink = $('#videoLink');

    try {
      const job = await apiGoi(`/api/jobs/${state.jobId}`, { cache: 'no-store' }, false);

      const progress = renderProgressForJob(job);
      /* Deck của JOB so với deck ĐANG XEM: bảng/nút/status chỉ được vẽ khi
         trùng nhau — poll của deck A không có quyền đè lên màn hình của deck
         B mà người dùng đang mở. Phần A muốn nói nằm ở dải mỏng. */
      const deckJob = job.project || state.deckDangDung || state.project;
      const xemDeckJob = deckJob === state.project;
      if (job.status === 'done') {
        ketThucJob(true);
        // "Tạo video" có áp chỉnh sửa timeline: video CUỐI là bản `-dung` (render/queue.js), không phải video slide.
        const finalUrl = job.ban_dung || job.video_url || state.outputUrl;
        const laXuat = job.loai === 'dung';   // xuất bản dựng (trình dựng), không phải dựng video slide
        /* Dự án VIDEO TRỐNG (src/dung/duAnVideo.js): lượt xuất CHÍNH là video của dự án (`<tên>.mp4`). */
        const laVideoPj = !!(RP.projectMap && RP.projectMap.get(deckJob) && RP.projectMap.get(deckJob).loai === 'video');
        if (xemDeckJob) {
          /* "Tạo video" có áp chỉnh sửa timeline (render/queue.js) thì nói rõ video CUỐI là tệp nào. */
          const tenBanDung = job.ban_dung ? String(job.ban_dung).split(/[\\/]/).pop() : '';
          setStatus(laVideoPj ? `Xuất video hoàn tất — output/${String(job.video_url || '').split(/[\\/]/).pop()}`
            : laXuat ? 'Xuất bản dựng hoàn tất — tệp nằm trong output/ của dự án.'
            : (tenBanDung ? `Tạo video hoàn tất — đã áp chỉnh sửa timeline: ${tenBanDung}` : 'Tạo video hoàn tất. Video đã sẵn sàng.'), 'good');
          if (progress.step !== undefined) state.renderStep = progress.step;
          setRenderState(renderTitle(progress.title, job), [progress.log], 'done');
          if (videoLink) {
            videoLink.href = finalUrl;
            videoLink.hidden = false;
          }
          RP.setRevealOutputButton(deckJob, true);
          capNhatNutTao(true);
        } else {
          /* Xong trong lúc người dùng đang xem deck khác: đừng đè kết quả lên
             màn hình của họ — dải mỏng báo, dòng trong danh sách đổi màu. */
          state.ketQuaCho = { deck: deckJob, icon: '✅', chu: laVideoPj ? 'Đã xuất video' : laXuat ? 'Đã xuất bản dựng' : 'Đã tạo xong', tone: 'done' };
        }
        // Vừa tiêu một lượt — hỏi lại máy chủ thay vì tự trừ ở máy khách. Tự
        // trừ thì render hỏng giữa chừng (đã trả lượt) sẽ hiện sai mãi cho tới
        // lần mở app sau.
        napHanMuc();
        /* Bản dựng (`<deck>-dung.mp4`) KHÔNG phải video của deck: ghi nó làm "đầu ra" là nút ▶
           của dòng deck mở nhầm bản dựng tới lần nạp lại danh sách (audit 10/10/2026). */
        if (!laXuat || laVideoPj) RP.markProjectHasOutput(deckJob, finalUrl);
        state.tienDoCuoi = null;
        veDaiDangDung();
      } else if (job.status === 'failed') {
        /* Ghi nhớ deck nào vừa hỏng: ngay sau đây `lamMoiDanhSach()` chạy và
           `setSelectedProject` sẽ vẽ lại — thiếu cờ này nó lau luôn câu lỗi
           (máy rảnh + deck chưa có video ⇒ nó reset bảng về trống). Đo thật:
           câu lỗi chỉ sống được vài trăm mili giây rồi biến mất, người dùng
           chỉ kịp thấy màn hình chớp một cái. */
        // Lượt XUẤT BẢN DỰNG hỏng không phải lỗi "Tạo video" của deck — đừng đẩy bảng Tạo video sang lỗi.
        const xuatHong = job.loai === 'dung';
        /* Dự án video trống: lượt xuất CHÍNH là việc của dự án — giữ bảng lỗi như "Tạo video" hỏng, kẻo
           lamMoiDanhSach → setSelectedProject lau mất câu lỗi sau vài trăm ms (rà 16/10/2026). */
        const laVideoHong = !!(RP.projectMap && RP.projectMap.get(deckJob) && RP.projectMap.get(deckJob).loai === 'video');
        if (!xuatHong || laVideoHong) state.deckLoi = deckJob;
        /* Lượt vừa được HOÀN (pipeline trả xong trước khi tin lỗi tới đây) —
           hỏi lại máy chủ để nhãn "(x/10)" khỏi hiện thiếu một lượt oan. */
        napHanMuc();
        ketThucJob(true);
        if (xemDeckJob) {
          setRenderState(renderTitle(progress.title, job), [progress.log || (laVideoHong ? 'Xuất video thất bại.' : xuatHong ? 'Xuất bản dựng thất bại.' : 'Tạo video thất bại.')], 'failed');
        } else {
          /* Hỏng trong lúc đang xem deck khác: dải mỏng báo; bấm vào deck lỗi
             là thấy bảng lỗi nhờ `state.deckLoi` ở trên. */
          state.ketQuaCho = { deck: deckJob, icon: '❌', chu: laVideoHong ? 'Xuất video lỗi ở' : xuatHong ? 'Xuất bản dựng lỗi ở' : 'Tạo video lỗi ở', tone: 'failed' };
        }
        state.tienDoCuoi = null;
        veDaiDangDung();
      } else if (job.status === 'cancelled') {
        ketThucJob(true);
        napHanMuc();   // dừng tay cũng được hoàn lượt — vẽ lại nhãn cho đúng
        if (xemDeckJob) {
          setRenderState(renderTitle(progress.title, job), [progress.log || 'Đã dừng tạo video.'], 'cancelled');
        } else {
          state.ketQuaCho = { deck: deckJob, icon: '■', chu: 'Đã dừng', tone: 'cancelled' };
        }
        state.tienDoCuoi = null;
        veDaiDangDung();
      } else {
        /* Đang chạy: LUÔN cập nhật ảnh chụp tiến độ (cho dải mỏng + để khôi
           phục bảng khi quay lại deck đang dựng), nhưng chỉ VẼ lên bảng khi
           người dùng đang xem đúng deck của job. */
        state.tienDoCuoi = {
          deck: deckJob,
          title: renderTitle(progress.title, job),
          logs: [progress.log],
          tone: 'running',
          step: progress.step,
          /* Chuỗi rỗng khi đang chạy: chân bảng nói câu đó rồi (xem ghi chú ở
             setStatus phía dưới). Giữ riêng câu XẾP HÀNG vì bảng không nói. */
          status: job.status === 'queued' ? 'Đang chờ tới lượt…' : '',
        };
        if (xemDeckJob) {
          if (stopButton) {
            stopButton.hidden = false;
            stopButton.disabled = job.status === 'cancelling' || state.canceling;
          }
          if (progress.step !== undefined) state.renderStep = progress.step;
          setStatus(job.status === 'queued' ? 'Đang chờ tới lượt…' : '', 'warn');
          setRenderState(renderTitle(progress.title, job), [progress.log]);
        } else if (stopButton) {
          stopButton.hidden = true;
        }
        veDaiDangDung();
      }
    } catch (error) {
      ketThucJob(false);
      setRenderState('Lỗi khi đọc trạng thái tạo video', [error.message || String(error)], 'failed');
      state.tienDoCuoi = null;
      veDaiDangDung();
    }
  }

  /**
   * Bám lại job render đang chạy (hoặc kết quả cuối) từ tiến trình chính.
   *
   * Vì sao cần: trạng thái render thật nằm ở main (xem `jobState` trong
   * main.js), còn giao diện chỉ giữ trong bộ nhớ renderer — mất sạch mỗi lần
   * trang tải lại (đổi thư mục nguồn, mở lại app). Không có hàm này thì bấm Tạo
   * video, rời đi rồi quay lại có thể thấy vạch tiến trình trống hoặc đứng hình
   * dù video vẫn đang dựng. Gọi lúc mở trang VÀ mỗi lần quay lại tab Dựng video.
   */
  /**
   * Đọc lại hàng đợi từ tiến trình chính.
   *
   * ⚠ BẮT BUỘC CÓ. Sự kiện `render:hangdoi` chỉ bắn KHI HÀNG ĐỔI, nên trang vừa
   * nạp lại giữa chừng sẽ không nhận được gì: hàng đợi vẫn chạy ngon ở main
   * nhưng màn hình không còn dòng "Đang chờ" nào, và nút thì mời bấm "Tạo video"
   * cho một deck đang xếp hàng. Trang NẠP LẠI thật ở vài đường có sẵn — dựng thư
   * mục làm việc, đổi thư mục nguồn.
   */
  async function dongBoHangDoi() {
    try {
      const st = await window.beeknoee.render.status();
      if (!st) return;
      apHangDoi({ dangChay: st.running ? st.projectDir : null, hang: st.hangDoi || [] });
    } catch { /* không đọc được thì thôi, sự kiện sau sẽ sửa */ }
  }

  async function resyncRender() {
    // Hàng đợi phải đồng bộ dù có job chạy hay không — làm TRƯỚC cái chốt bên
    // dưới, vì chốt đó thoát sớm khi đang tự theo dõi.
    dongBoHangDoi().catch(() => {});
    // Đang tự theo dõi trong phiên này rồi (poll đang chạy, hoặc đã vẽ kết quả
    // cuối) thì thôi — tránh gọi lại napHanMuc mỗi lần bấm tab.
    if (state.pollTimer || state.busy || state.daBamKetQua) return;

    let job;
    try {
      const res = await fetch('/api/jobs/current', { cache: 'no-store' });
      if (!res.ok) return;   // 404 = không có job đang chạy, giữ nguyên trạng thái chờ
      job = await res.json();
    } catch { return; }
    if (!job || job.error) return;

    state.jobId = 'current';

    const dangChay = job.status === 'running' || job.status === 'queued' || job.status === 'cancelling';
    if (dangChay) {
      state.busy = true;
      // Ghi lại deck đang dựng ngay từ đây — sự kiện hàng đợi có thể tới sau,
      // mà `setSelectedProject`/dải mỏng cần tên này để chia màn hình cho đúng.
      state.deckDangDung = job.project || state.deckDangDung || null;
      datLaiMocBuoc(state.deckDangDung);
      const startButton = $('#startRender');
      const stopButton = $('#stopRender');
      if (startButton) startButton.disabled = true;
      const progress = renderProgressForJob(job);
      state.tienDoCuoi = {
        deck: state.deckDangDung,
        title: renderTitle(progress.title, job),
        logs: [progress.log],
        tone: 'running',
        step: progress.step,
        status: '',
      };
      const xemDeckJob = !state.deckDangDung || state.deckDangDung === state.project;
      if (xemDeckJob) {
        if (stopButton) { stopButton.hidden = false; stopButton.disabled = job.status === 'cancelling'; }
        if (progress.step !== undefined) state.renderStep = progress.step;
        setStatus('', 'warn');
        setRenderState(renderTitle(progress.title, job), [progress.log]);
      } else if (stopButton) {
        // Đang xem deck khác: tiến độ nằm ở dải mỏng, nút Dừng thuộc màn kia.
        stopButton.hidden = true;
      }
      veDaiDangDung();
      if (state.pollTimer) window.clearInterval(state.pollTimer);
      state.pollTimer = window.setInterval(pollJob, 1500);
    } else {
      // done/failed/cancelled: để pollJob vẽ đúng kết quả một lần (nó tự đặt
      // link video, nút "Tạo lại", hỏi lại hạn mức…) rồi tự dừng.
      await pollJob();
    }
  }

  /* Dò trạng thái ban đầu — xem chú thích trong `tinhTrangThai()`.
   *
   * `finally` chứ không phải `then`: `resyncRender()` thoát sớm ở nhiều nhánh
   * (không có job, fetch hỏng, 404) và mọi nhánh đó ĐỀU là câu trả lời hợp lệ
   * cho câu hỏi "có đang render không". Dùng `then` là lúc mất mạng thì nhãn
   * "Đang kiểm tra…" đứng mãi. */
  /* ══ HÀNG ĐỢI ══════════════════════════════════════════════════════════
   *
   * Main gửi ĐƯỜNG DẪN thư mục, giao diện làm việc theo TÊN dự án — phải ánh xạ
   * qua `source_path`. Deck nào không tra ra tên (vừa bị đổi tên, hoặc danh sách
   * chưa kịp nạp lại) thì bỏ qua, thà thiếu một dòng còn hơn gắn nhãn sai deck.
   */
  const tenTheoDuong = (duong) => {
    const d = String(duong || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    if (!d) return '';
    const p = projects.find((x) => String(x.source_path || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === d);
    return p ? p.name : '';
  };

  function apHangDoi(tin) {
    const truocDangChay = state.deckDangDung;
    state.hangDoi = (tin && Array.isArray(tin.hang) ? tin.hang : []).map(tenTheoDuong).filter(Boolean);
    /* Lượt XUẤT của dự án VIDEO TRỐNG đi hàng `hangDung` (loại 'dung') nhưng với người dùng nó CHÍNH là
       "Tạo video" của dự án đó — cho vào hàng hiển thị để dòng dự án hiện "Đang chờ · N" (rà 16/10/2026). */
    (tin && Array.isArray(tin.hangDung) ? tin.hangDung : []).map(tenTheoDuong).filter(Boolean).forEach((ten) => {
      const p = RP.projectMap && RP.projectMap.get(ten);
      if (p && p.loai === 'video' && !state.hangDoi.includes(ten)) state.hangDoi.push(ten);
    });

    /* ⚠ MAIN LÀ NGUỒN THẬT về "có đang chạy không", KHÔNG suy từ việc tra được
     * tên hay không.
     *
     * `tenTheoDuong()` trả rỗng khi đường dẫn không khớp dự án nào trong danh
     * sách — deck vừa đổi tên, hoặc danh sách chưa kịp nạp lại. Bản trước chỉ
     * xét `if (dangChay)`, nên đúng lúc đó giao diện tưởng KHÔNG có gì chạy
     * trong khi máy đang dựng: mất nhãn "Đang dựng", nút mở ra mời bấm tiếp.
     *
     * Cũng là chỗ duy nhất hạ `busy` xuống khi lượt cuối xong mà poll đã tắt. */
    const coChay = Boolean(tin && tin.dangChay);
    state.busy = coChay;
    const dangChay = tenTheoDuong(tin && tin.dangChay);
    state.deckDangDung = coChay ? (dangChay || null) : null;

    if (dangChay) {
      /* ⚠ LƯỢT KẾ TỰ KHỞI ĐỘNG THÌ PHẢI BẬT LẠI POLL.
         Giao diện ngừng poll khi job trước xong (xem các nhánh kết thúc trong
         `pollJob`). Không bật lại thì video thứ hai chạy âm thầm: vạch tiến
         trình đứng im ở kết quả của cái thứ nhất, người dùng tưởng treo. */
      if (dangChay !== truocDangChay) {
        state.daBamKetQua = false;
        state.canceling = false;
        state.jobId = 'current';
        state.ketQuaCho = null;   // lượt mới đè lên thông báo "vừa xong" cũ
        state.tienDoCuoi = null;  // tiến độ cache là của lượt trước — bỏ
        /* CHỈ nói phần hàng đợi. Câu "Đang tạo video cho dự án X" đã nằm ở chân
           bảng tiến độ ngay trên, kèm bước và phần trăm — nhắc lại ở đây là một
           dòng thừa nói ít hơn dòng trên nó. Còn số video đang chờ thì bảng
           không nói, nên giữ. CHỈ ghi khi đang xem đúng deck đó. */
        if (!state.project || state.project === dangChay) {
          setStatus(state.hangDoi.length ? `Còn ${state.hangDoi.length} video trong hàng đợi` : '', 'warn');
        }
        if (state.pollTimer) window.clearInterval(state.pollTimer);
        state.pollTimer = window.setInterval(pollJob, 1500);
        pollJob().catch(() => {});
      }
    }
    capNhatNutDung();
    RP.buildProjectRows();
    veDaiDangDung();
  }

  /** Nhãn nút "Tạo video" đổi theo việc đang có gì chạy. */
  function capNhatNutDung() {
    /* Nút "Tạo video" trên THANH TRÊN đổi theo cùng nhịp — xem
       `thanh-tren.js#veNutTao`. ⚠ Gọi ở ĐẦU hàm: bên dưới có hai nhánh
       `return` sớm (đang dựng · đang trong hàng đợi), mà đó đúng là hai lúc
       nút trên thanh cần đổi nhất. */
    if (RP.thanhTren && RP.thanhTren.veNutTao) RP.thanhTren.veNutTao();
    const nut = $('#startRender');
    if (!nut) return;
    const ten = state.project;
    if (state.busy && ten && ten === state.deckDangDung) {
      setButtonLabel(nut, 'Đang dựng…');
      nut.disabled = true;
      return;
    }
    if (ten && state.hangDoi.includes(ten)) {
      setButtonLabel(nut, 'Bỏ khỏi hàng đợi');
      nut.disabled = false;
      nut.title = 'Bỏ dự án này khỏi hàng đợi';
      return;
    }
    /* ⚠ PHẢI hỏi lại `nutDangLaTaoLai`. Dòng này trước đây ghi thẳng chữ
       "Tạo video", mà nó chạy sau MỌI lượt đồng bộ giao diện (dựng lại bảng
       dự án, đổi hàng đợi…) nên nó luôn ĐÈ LÊN nhãn "Tạo lại" mà
       `capNhatNutTao(true)` vừa đặt. Hệ quả: deck đã có video chỉ hiện "Tạo
       lại" trong đúng khoảnh khắc sau khi dựng xong, mở lại app là mất —
       chủ dự án nhớ đúng, nút ấy từng có (16/09/2026). */
    setButtonLabel(nut, state.busy
      ? 'Thêm vào hàng đợi'
      : (nutDangLaTaoLai ? 'Tạo lại' : 'Tạo video') + chuHanMuc());

    /* Thiếu nguồn giọng đọc thì MỜ NÚT, và nói lý do bằng tooltip.
       `title` chứ không phải một dòng chữ đỏ dưới nút: chỗ đó chật, mà lỗi này
       chỉ liên quan tới đúng cái nút — rê chuột vào là biết. */
    const nguon = RP.kiemNguonGiongDoc();
    nut.disabled = !nguon.ok;
    nut.classList.toggle('thieu-nguon', !nguon.ok);
    nut.title = nguon.ok
      ? (state.busy ? 'Thêm dự án này vào hàng đợi' : 'Bắt đầu tạo video')
      : nguon.lyDo;

    /* ⚠ ĐẶT `title` LÊN CẢ THẺ BAO NGOÀI khi nút bị khoá.
     *
     * Nút `disabled` KHÔNG nhận hit-test chuột, nên tooltip của chính nó có hiện
     * hay không là tuỳ phiên bản Chromium — mà tooltip lại chính là chỗ nói cho
     * người dùng biết vì sao không bấm được. Thẻ cha vẫn nhận chuột bình thường,
     * nên rê vào vùng nút là chắc chắn thấy chữ.
     * Gỡ ra khi nút sáng lại, không thì tooltip của cha đè lên tooltip của nút. */
    const boc = nut.parentElement;
    if (boc) {
      if (nguon.ok) boc.removeAttribute('title');
      else boc.title = nguon.lyDo;
    }
  }

  Object.assign(RP, { RENDER_STEPS, apHangDoi, buildRenderSteps, capNhatNutDung, datLaiMocBuoc, capNhatNutTao, chuHanMuc, dongBoHangDoi, dungPayloadRender, elapsedForJob, fileToBase64, formatElapsed, ketThucJob, latestRawLogLine, napHanMuc, paintRenderSteps, pollJob, renderProgressForJob, renderTitle, resyncRender, setRenderState, startRender, stepIndexForPhase, stopRender, tenTheoDuong, veDaiDangDung, xepVaoHangDoi });
})();
