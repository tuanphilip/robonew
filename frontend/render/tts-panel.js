'use strict';
/**
 * Giọng đọc: engine/mode, panel ElevenLabs (key, số dư, giọng, chất lượng), panel Beeknoee (key, model, giọng), nghe thử.
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

  let elevenVoiceSaveTimer = null;
  let elevenVoiceSaving = false;

  function setEngine(engine) {
    state.engine = engine;
    RP.capNhatNutDung();   // Edge TTS luôn dựng được, ElevenLabs thì còn tuỳ cấu hình
    $all('[data-engine]').forEach((button) => {
      button.classList.toggle('active', button.dataset.engine === engine);
    });
    /* ⚠ CHỈ ĐỤNG BA PANE CỦA BỘ GIỌNG. `[data-pane]` KHÔNG phải của riêng chỗ
       này: cột phải dùng đúng thuộc tính đó cho hai tab "Tạo bằng AI" / "Dự án"
       (hai nút `.rl-tab-nut[data-pane]` và hai khối `.rl-pane[data-pane]`, xem
       `index.html`). Quét cả tài liệu rồi gán `hidden` theo tên engine thì cả
       bốn thứ kia đều `!== 'elevenlabs'` nên bị ẩn sạch — bấm tab ElevenLabs là
       mất luôn danh sách dự án lẫn hai nút tab của cột phải (chủ dự án báo
       19/09/2026, đo lại đúng: paneAi + paneDuAn + hai nút cùng ẩn).
       Lọc theo TÊN ENGINE chứ không lọc theo tổ tiên: `.render-machine` bị dời
       qua lại giữa shell, tab Âm thanh và hộp Tạo video, nên mọi bộ chọn neo
       theo vị trí đều có ngày sai. */
    const PANE_GIONG = new Set(['elevenlabs', 'vbee', 'edgetts', 'beeknoee', 'vieneu']);
    $all('[data-pane]').forEach((pane) => {
      if (!PANE_GIONG.has(pane.dataset.pane)) return;
      pane.hidden = pane.dataset.pane !== engine;
    });
    syncAdvancedSettings();
  }

  function syncAdvancedSettings() {
    $all('[data-advanced-engine]').forEach((pane) => {
      pane.hidden = pane.dataset.advancedEngine !== state.engine;
    });
    // Khối nâng cao nay LUÔN mở, không còn <summary> nên cũng không còn nhãn
    // "Đang mở/Đang ẩn" để đồng bộ.
  }

  /**
   * Độ phân giải đang chọn.
   *
   * `#renderSize` nay là cụm nút chọn chứ không còn là thẻ `<select>`, nên
   * `.value` trả về `undefined` — im lặng rơi về mặc định 1080×1920 và người
   * dùng chọn 720 cũng không ăn thua. Đọc qua ô đang tick.
   */
  function currentRenderSize() {
    const picked = $('input[name="renderSize"]:checked');
    return picked ? picked.value : '1080x1920';
  }

  /**
   * Hiện đúng bộ kích thước cho khổ của deck đang chọn.
   *
   * ⚠ ĐỔI CẢ Ô ĐANG TICK, không chỉ ẩn/hiện. Ẩn một ô radio KHÔNG bỏ tick của
   * nó — `currentRenderSize()` vẫn đọc ra `1080x1920` từ một ô người dùng không
   * còn nhìn thấy, rồi `pipeline.js` chặn lượt dựng với câu "deck này thiết kế
   * cho khổ ngang". Người dùng không hề chọn sai mà vẫn bị chặn: lỗi tệ hơn cả
   * cái đang chữa.
   *
   * Nhớ lựa chọn RIÊNG cho từng khổ: ai chọn 720×1280 cho deck dọc thì lúc quay
   * lại deck dọc vẫn phải thấy 720×1280, đừng nhảy về mặc định.
   */
  const nhoKichThuoc = { doc: '1080x1920', ngang: '1920x1080' };

  function apKhungDeck(khung) {
    const ma = khung === 'ngang' ? 'ngang' : 'doc';
    const dangTick = $('input[name="renderSize"]:checked');
    const oCu = dangTick && dangTick.closest('label');
    /* ⚠ NHỚ LUÔN, không chỉ nhớ khi ĐỔI khổ.
       Bản đầu có thêm điều kiện `!== ma` nên bấm lại chính deck đang chọn là
       lựa chọn 720×1280 bị ném đi, nhảy về 1080×1920. Đo trong app thật
       (15/09/2026): chọn 720 → bấm lại cùng deck → tick về 1080. Mà hàm này
       chạy MỖI lần chọn deck, kể cả chọn lại deck cũ — tức lỗi rơi thẳng vào
       đường dọc, thứ tuyệt đối không được đụng. */
    if (oCu && oCu.dataset.khung) nhoKichThuoc[oCu.dataset.khung] = dangTick.value;
    let daTick = false;
    $all('#renderSize label[data-khung]').forEach((o) => {
      const hop = o.dataset.khung === ma;
      o.hidden = !hop;
      const radio = o.querySelector('input');
      if (!radio) return;
      radio.disabled = !hop;   // ô ẩn mà vẫn tick được bằng bàn phím thì vô lý
      if (hop && radio.value === nhoKichThuoc[ma]) { radio.checked = true; daTick = true; }
      else if (!hop) radio.checked = false;
    });
    // Giá trị nhớ không còn trong danh sách (ai đó sửa HTML) — tick ô đầu tiên.
    if (!daTick) {
      const dau = $(`#renderSize label[data-khung="${ma}"] input`);
      if (dau) { dau.checked = true; nhoKichThuoc[ma] = dau.value; }
    }
  }

  /* Khoảng tốc độ cho phép. ⚠ CHÉP LẠI từ `src/render/pipeline.js` — cửa chốt
     THẬT nằm ở đó (cả dòng lệnh cũng đi qua), chỗ này chỉ để người dùng thấy
     ngay tại ô nhập. Đổi khoảng thì phải đổi CẢ HAI. Không nhập được từ đó:
     pipeline chạy ở tiến trình chính, trang này chạy trong hộp cách ly. */
  const TOC_DO_MIN = 0.5;
  const TOC_DO_MAX = 2;
  const TOC_DO_MAC_DINH = 1.1;

  /**
   * Đọc ô Tốc độ thành một con số DÙNG ĐƯỢC, kèm câu giải thích nếu phải sửa.
   *
   * Cùng luật với `chuanTocDo()` ở `src/render/pipeline.js` — xem chú thích dài
   * ở đó để biết vì sao dấu phẩy và số ngoài khoảng lại nguy hiểm.
   */
  function docTocDo(raw) {
    if (raw == null || String(raw).trim() === '') return { so: TOC_DO_MAC_DINH, ly: null };
    const n = Number(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(n)) return { so: TOC_DO_MAC_DINH, ly: `Không đọc được "${raw}" — dùng ${TOC_DO_MAC_DINH}.` };
    if (n < TOC_DO_MIN) return { so: TOC_DO_MIN, ly: `Tốc độ thấp nhất là ${TOC_DO_MIN} — đã dùng ${TOC_DO_MIN}.` };
    if (n > TOC_DO_MAX) return { so: TOC_DO_MAX, ly: `Tốc độ cao nhất là ${TOC_DO_MAX} — đã dùng ${TOC_DO_MAX}.` };
    return { so: n, ly: null };
  }

  /* Bước nhảy của phím ↑/↓ — đúng `step="0.05"` mà thẻ `type="number"` cũ có. */
  const TOC_DO_BUOC = 0.05;

  /**
   * Tăng/giảm tốc độ một bước bằng phím ↑/↓.
   *
   * ⚠ Đổi ô sang `type="text"` (để nhận được dấu phẩy) thì MẤT sẵn tính năng
   * này — trình duyệt chỉ bước giá trị cho ô số. Trả lại bằng tay, kẻo người
   * quen dùng phím bấm mũi tên thấy ô "chết" và tưởng app hỏng.
   *
   * Nhảy sang NẤC kế tiếp trên lưới bội-của-bước, đúng cách ô số cũ làm: đang ở
   * 1.13 bấm lên thì ra 1.15 (nấc gần nhất phía trên), không phải 1.18 (cộng
   * thẳng) và cũng không phải 1.2 (làm tròn rồi mới cộng — đã đo, nó nhảy cóc
   * mất một nấc).
   *
   * ⚠ KHÔNG đi qua `chuanHoaOTocDo()`: bấm lên khi đang ở trần thì có sửa gì
   * của người dùng đâu mà báo. Lời báo chỉ được mang một nghĩa — "app vừa đổi
   * con số bạn gõ" — nói thêm là nó mất giá trị. Nên ở đây tự kẹp rồi DỌN lời
   * báo cũ, đúng như ô số cũ im lặng dừng ở biên.
   */
  function buocTocDo(huong) {
    const speedInput = $('#renderSpeed');
    if (!speedInput) return;
    const hienTai = docTocDo(speedInput.value).so;
    // 1e-9 để 1.15/0.05 = 22.999999999999996 vẫn rơi đúng nấc 23.
    const nac = huong > 0
      ? Math.floor(hienTai / TOC_DO_BUOC + 1e-9) + 1
      : Math.ceil(hienTai / TOC_DO_BUOC - 1e-9) - 1;
    const moi = Math.min(TOC_DO_MAX, Math.max(TOC_DO_MIN, nac * TOC_DO_BUOC));
    speedInput.value = String(Number(moi.toFixed(2)));
    const note = $('#renderSpeedNote');
    if (note) { note.textContent = ''; note.hidden = true; }
    syncSpeedPresets();
  }

  /**
   * Viết lại ô cho đúng chuẩn và báo nếu đã sửa.
   *
   * ⚠ Gọi lúc RỜI ô (`change`/`blur`), KHÔNG gọi lúc đang gõ: kẹp giữa chừng
   * thì gõ "0.75" tới ký tự "0" là ô nhảy ngay thành "0.5", không gõ tiếp được.
   */
  function chuanHoaOTocDo() {
    const speedInput = $('#renderSpeed');
    if (!speedInput) return;
    const kq = docTocDo(speedInput.value);
    speedInput.value = String(kq.so);
    const note = $('#renderSpeedNote');
    if (note) {
      note.textContent = kq.ly || '';
      note.hidden = !kq.ly;
    }
    syncSpeedPresets();
  }

  function syncSpeedPresets() {
    const speedInput = $('#renderSpeed');
    // Đọc qua `docTocDo` để "1,15" cũng sáng đúng nút 1.15.
    const value = speedInput ? docTocDo(speedInput.value).so : 0;
    $all('.speed-preset[data-speed]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.speed) === value);
    });
  }

  function currentElevenMode() {
    return document.querySelector('input[name="elevenMode"]:checked')?.value || 'upload';
  }

  function syncElevenMode() {
    RP.capNhatNutDung();   // đổi giữa Tải file / API là đổi điều kiện dựng được
    const mode = currentElevenMode();
    $all('[data-eleven-mode-pane]').forEach((pane) => {
      pane.hidden = pane.dataset.elevenModePane !== mode;
    });
  }

  /**
   * Có đủ nguồn giọng đọc để dựng chưa?
   *
   * VÌ SAO CẦN: trước đây thiếu file/khoá thì nút vẫn bấm được, `startRender`
   * chạy tới giữa chừng rồi ném lỗi — mà vạch tiến trình đã kịp nhảy sang
   * "Chuẩn bị", nên nhìn như app treo. Chặn ngay ở cái nút thì người dùng biết
   * phải làm gì trước khi bấm.
   *
   * @returns {{ok: boolean, lyDo?: string}}
   */
  function kiemNguonGiongDoc() {
    // Beeknoee Platform: model + giọng luôn có sẵn trong danh sách dựng sẵn,
    // thứ duy nhất phải có là API key.
    if (state.engine === 'beeknoee') {
      if (!state.beeCoKey) {
        return { ok: false, lyDo: 'Chưa cấu hình hoặc chọn audio cho video — chưa lưu API key Beeknoee (tab Beeknoee AI)' };
      }
      return { ok: true };
    }
    // Giọng TRÊN MÁY: phải có mô hình đã tải (render/vieneu-panel.js ghi `state.vieneuSanSang`).
    if (state.engine === 'vieneu') {
      if (!state.vieneuSanSang) {
        return { ok: false, lyDo: 'Chưa tải mô hình giọng trên máy — vào tab Âm thanh → Trên máy → bấm Tải' };
      }
      return { ok: true };
    }
    // Edge TTS: giọng nằm sẵn trong bộ cài, không cần cấu hình gì.
    if (state.engine !== 'elevenlabs') return { ok: true };

    if (currentElevenMode() === 'upload') {
      const coFile = Boolean($('#elevenFile')?.files?.[0]);
      const coNho = Boolean($('#elevenFileName')?.dataset.duong);
      if (coFile || coNho) return { ok: true };
      return { ok: false, lyDo: 'Chưa cấu hình hoặc chọn audio cho video — chọn file MP3 ở mục Giọng đọc' };
    }

    if (!state.elevenCoKey) {
      return { ok: false, lyDo: 'Chưa cấu hình hoặc chọn audio cho video — chưa lưu API key ElevenLabs' };
    }
    if (!($('#elevenVoice')?.value.trim())) {
      return { ok: false, lyDo: 'Chưa cấu hình hoặc chọn audio cho video — chưa chọn Voice ID' };
    }
    return { ok: true };
  }

  /* ══ Beeknoee Platform TTS ══════════════════════════════════════════════
   *
   * Một endpoint tương thích OpenAI cho nhiều nhà cung cấp — người dùng chỉ
   * cần dán API key rồi chọn model + giọng; mọi cấu hình còn lại (endpoint,
   * danh sách model/giọng, giới hạn ký tự, model nào nhận speed) dựng sẵn
   * theo tài liệu platform.beeknoee.com/docs/text-to-speech (đọc 29/08/2026).
   *
   * ⚠ Model `elevenlabs/*` của platform CHƯA mở production (ghi chú 08/08
   * trong tài liệu — gọi vào báo model không tồn tại) nên KHÔNG nằm trong
   * danh sách; platform mở thì thêm một dòng vào BEE_MODELS là xong.
   */
  /* KHÔNG kèm dòng ghi chú dưới ô chọn (giới hạn ký tự, nghe thử ở đâu…):
     chủ dự án chốt 29/08 — mấy thứ đó người dùng tự đọc ở tài liệu platform,
     bài hướng dẫn trong app cũng đã dẫn tới. Giới hạn ký tự vẫn được CHẶN
     THẬT ở phía Python với câu lỗi nêu rõ mức của từng model.

     Danh sách này là NHÃN ĐẸP cho các model đã biết, KHÔNG phải nguồn sự
     thật về model nào đang sống: `doiChieuBeeModels()` hỏi platform
     (GET /v1/models) rồi ẩn model chết / thêm model mới. Bằng chứng phải
     làm vậy: `google/standard` nằm trong tài liệu nhưng production đã vô
     hiệu (đo 29/08 — gọi vào báo "không tồn tại hoặc đã vô hiệu"). */
  const BEE_MODELS = [
    { id: 'google/gemini-2.5-flash-tts', ten: 'Gemini 2.5 Flash — tiếng Việt tự nhiên (khuyên dùng) · $18/1M', bo: 'gemini' },
    { id: 'google/gemini-3.1-flash-tts-preview', ten: 'Gemini 3.1 Flash (preview) — mới nhất · $20/1M', bo: 'gemini' },
    { id: 'google/gemini-2.5-pro-tts', ten: 'Gemini 2.5 Pro — cao cấp nhất · $32/1M', bo: 'gemini' },
    { id: 'google/google-tts', ten: 'Google dịch — MIỄN PHÍ', bo: 'gtts' },
    { id: 'openai/gpt-4o-mini-tts', ten: 'OpenAI 4o-mini — thông minh · $12/1M', bo: 'openai' },
    { id: 'openai/tts-1', ten: 'OpenAI TTS-1 — nhanh · $15/1M', bo: 'openai' },
    { id: 'openai/tts-1-hd', ten: 'OpenAI TTS-1 HD — nét nhất · $30/1M', bo: 'openai' },
  ];
  /* Danh sách ĐANG DÙNG để vẽ ô chọn — khởi đầu bằng bảng trên, được
     doiChieuBeeModels thay bằng bản đã đối chiếu với platform. */
  let beeModelDangCo = BEE_MODELS.slice();

  /* Giọng theo BỘ (mỗi model thuộc một bộ). Nhãn lấy từ bảng mô tả trong tài
     liệu; giọng Gemini không có mô tả chính thức thì để tên trần — vẫn chọn
     được, nghe thử ở geminitts.net. */
  const BEE_GIONG = {
    gemini: [
      { id: 'Kore', ten: 'Kore — trung tính, cân bằng (mặc định)' },
      { id: 'Leda', ten: 'Leda — nữ, sáng rõ' },
      { id: 'Aoede', ten: 'Aoede — nữ, ấm áp' },
      { id: 'Autonoe', ten: 'Autonoe — nữ, nhẹ nhàng' },
      { id: 'Zephyr', ten: 'Zephyr — điềm tĩnh' },
      { id: 'Puck', ten: 'Puck — sống động, biểu cảm' },
      { id: 'Fenrir', ten: 'Fenrir — nam, mạnh mẽ' },
      { id: 'Charon', ten: 'Charon — nam, trầm' },
      { id: 'Orus', ten: 'Orus — nam, trầm chuyên nghiệp' },
      ...['Callirrhoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome',
        'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux',
        'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager',
        'Sulafat'].map((t) => ({ id: t, ten: t })),
    ],
    gtts: [
      { id: 'vi', ten: 'Tiếng Việt — giọng nữ miền Bắc' },
      { id: 'en', ten: 'English (US)' },
      { id: 'ja', ten: '日本語 — Japanese' },
      { id: 'ko', ten: '한국어 — Korean' },
      { id: 'zh', ten: '中文 — Mandarin' },
      { id: 'fr', ten: 'Français' },
      { id: 'de', ten: 'Deutsch' },
      { id: 'es', ten: 'Español' },
      { id: 'pt', ten: 'Português' },
      { id: 'th', ten: 'ไทย — Thai' },
      { id: 'id', ten: 'Bahasa Indonesia' },
      { id: 'ru', ten: 'Русский — Russian' },
    ],
    standard: [
      { id: 'vi-VN-Standard-A', ten: 'vi-VN A — nữ miền Bắc' },
      { id: 'vi-VN-Standard-B', ten: 'vi-VN B — nam miền Bắc' },
      { id: 'vi-VN-Standard-C', ten: 'vi-VN C — nữ (giọng khác)' },
      { id: 'vi-VN-Standard-D', ten: 'vi-VN D — nam (giọng khác)' },
      { id: 'en-US-Standard-A', ten: 'en-US A — nam' },
      { id: 'en-US-Standard-B', ten: 'en-US B — nam' },
      { id: 'en-US-Standard-C', ten: 'en-US C — nữ' },
      { id: 'en-US-Standard-D', ten: 'en-US D — nam' },
    ],
    openai: [
      { id: 'nova', ten: 'nova — nữ, rõ ràng năng động (hợp tin tức)' },
      { id: 'alloy', ten: 'alloy — trung tính, cân bằng' },
      { id: 'coral', ten: 'coral — nữ, ấm áp thân thiện' },
      { id: 'shimmer', ten: 'shimmer — nữ, dịu dàng' },
      { id: 'ash', ten: 'ash — nam, mạnh mẽ tự tin' },
      { id: 'ballad', ten: 'ballad — nam, trầm ấm (kể chuyện)' },
      { id: 'echo', ten: 'echo — nam, trầm sâu' },
      { id: 'onyx', ten: 'onyx — nam, chuyên nghiệp' },
      { id: 'fable', ten: 'fable — sống động, biểu cảm' },
      { id: 'sage', ten: 'sage — điềm tĩnh, nhẹ nhàng' },
      { id: 'verse', ten: 'verse — nam, sáng rõ (e-learning)' },
    ],
  };

  function beeModelHienTai() {
    const id = $('#beeModel')?.value || '';
    return beeModelDangCo.find((m) => m.id === id) || beeModelDangCo[0] || BEE_MODELS[0];
  }
  /** id model mặc định khi ô chọn trống — cho dungPayloadRender (module jobs). */
  function beeModelMacDinh() { return beeModelDangCo[0] ? beeModelDangCo[0].id : BEE_MODELS[0].id; }

  /* Đoán BỘ GIỌNG cho model platform mới thêm mà app chưa có nhãn.
     Mọi provider của platform đều nhận alias giọng OpenAI (tài liệu ghi rõ,
     có bảng map riêng cho Gemini lẫn ElevenLabs) nên 'openai' là fallback
     an toàn khi không đoán được gì hơn. */
  function doanBoGiong(id) {
    if (/^google\/gemini/.test(id)) return 'gemini';
    if (id === 'google/google-tts') return 'gtts';
    if (/^google\/standard/.test(id)) return 'standard';
    return 'openai';
  }

  /* Đối chiếu danh sách dựng sẵn với model ĐANG SỐNG trên platform.
     - Model cứng không còn trong catalog → ẨN (đã có model chết thật).
     - Catalog có model TTS mới → THÊM cuối, nhãn thô từ id.
     - Hỏi hỏng (mạng, chưa key) → dùng bản đối chiếu THÀNH CÔNG gần nhất
       (settings.beeModelsSong); chưa từng có → giữ nguyên bảng cứng.
     Nhận diện model TTS trong catalog chung: đuôi -tts / -tts- ở giữa /
     google-tts / openai tts-1*, và loại hẳn nhóm -stt (nhận dạng giọng nói). */
  function locTtsIds(ids) {
    return (ids || []).filter((id) => !/-stt\b/.test(id) && (
      /-tts($|-)/.test(id) || id === 'google/google-tts' || /^openai\/tts-1(-hd)?$/.test(id)
    ));
  }

  function apBeeModels(idsSong) {
    const song = new Set(idsSong);
    const giu = BEE_MODELS.filter((m) => song.has(m.id));
    const daBiet = new Set(BEE_MODELS.map((m) => m.id));
    const them = idsSong.filter((id) => !daBiet.has(id))
      .map((id) => ({ id, ten: `${id} — mới trên platform`, bo: doanBoGiong(id) }));
    const moi = giu.concat(them);
    if (!moi.length) return;           // catalog rỗng bất thường — đừng vẽ ô trống
    beeModelDangCo = moi;
    const sel = $('#beeModel');
    const dangChon = sel ? sel.value : '';
    dungOBeeModel(dangChon);
    dungOBeeGiong();
  }

  async function doiChieuBeeModels() {
    if (!state.beeCoKey) return;
    let ids = [];
    try {
      const kq = await window.beeknoee.tts.beeModels();
      ids = locTtsIds(kq && kq.ids);
    } catch { ids = []; }
    if (ids.length) {
      apBeeModels(ids);
      window.beeknoee.settings.set({ beeModelsSong: ids }).catch(() => {});
      return;
    }
    try {
      const s = await window.beeknoee.settings.get();
      const cu = locTtsIds((s && s.beeModelsSong) || []);
      if (cu.length) apBeeModels(cu);
    } catch { /* giữ bảng cứng */ }
  }

  /* Đổ hai ô chọn. Đổi model là đổi BỘ giọng — giữ lại giọng cũ nếu nó vẫn
     thuộc bộ mới, không thì về giọng đầu bộ (giọng khuyên dùng). */
  function dungOBeeGiong(giongMuonGiu) {
    const sel = $('#beeVoice');
    if (!sel) return;
    const bo = BEE_GIONG[beeModelHienTai().bo] || [];
    sel.replaceChildren();
    /* ĐÁNH SỐ THỨ TỰ như danh sách giọng của ElevenLabs. Bộ Gemini có mấy chục
       giọng tên trần (Kore, Leda, Aoede…) chẳng gợi ra thứ gì; có số thì còn
       nói được với nhau "lấy giọng số 7" và dò lại được sau. */
    bo.forEach((g, i) => {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = `${i + 1}. ${g.ten}`;
      sel.appendChild(o);
    });
    const giu = giongMuonGiu || sel.dataset.giongNho || '';
    sel.value = bo.some((g) => g.id === giu) ? giu : (bo[0] ? bo[0].id : '');
  }

  function dungOBeeModel(modelMuonGiu) {
    const sel = $('#beeModel');
    if (!sel) return;
    sel.replaceChildren();
    /* ⚠ GOM THEO THƯƠNG HIỆU bằng `<optgroup>`, không phải chèn logo.
       Chủ dự án hỏi chèn logo hãng trước mỗi model: `<option>` của một
       `<select>` chuẩn CHỈ nhận văn bản — không nhét được `<img>` lẫn `<svg>`,
       trình duyệt bỏ qua sạch. Muốn có logo thật thì phải thay hẳn ô chọn này
       bằng một danh sách tự vẽ như bộ chọn giọng của ElevenLabs.
       `<optgroup>` là thứ gần nhất mà vẫn chạy bằng ô chọn chuẩn: tên hãng
       đứng thành một dòng đầu nhóm, ngay trước các model của hãng đó. */
    const NHOM = { gemini: 'Google Gemini', gtts: 'Google', openai: 'OpenAI', khac: 'Khác' };
    const daCo = new Map();
    for (const m of beeModelDangCo) {
      const khoa = NHOM[m.bo] ? m.bo : 'khac';
      let g = daCo.get(khoa);
      if (!g) {
        g = document.createElement('optgroup');
        g.label = NHOM[khoa];
        daCo.set(khoa, g);
        sel.appendChild(g);
      }
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.ten;
      g.appendChild(o);
    }
    sel.value = beeModelDangCo.some((m) => m.id === modelMuonGiu)
      ? modelMuonGiu : (beeModelDangCo[0] ? beeModelDangCo[0].id : '');
  }

  /* Nhớ model + giọng qua settings của app (cùng cơ chế `mp3DaChon`) — mở lại
     app vẫn đúng cấu hình cũ. KHÔNG nhớ key ở đây: key nằm trong kho mã hoá
     riêng bên main (`src/khoaBee.js`), không bao giờ đi qua settings thường. */
  function nhoBeeCauHinh() {
    const model = $('#beeModel')?.value || '';
    const voice = $('#beeVoice')?.value || '';
    const sel = $('#beeVoice');
    if (sel) sel.dataset.giongNho = voice;
    window.beeknoee.settings.set({ beeTts: { model, voice } }).catch(() => {});
  }

  /* ══ Khối API key — DÙNG CHUNG cho ElevenLabs và Beeknoee ═══════════════
   *
   * Hai panel giống nhau 90% (ô nhập, nút Lưu/Xoá thay nhau, Enter = Lưu,
   * nhãn trạng thái, cờ chống bấm đúp) — trước đây chép làm hai bản. Phần
   * KHÁC nhau đi qua `cfg`: chữ nhãn, câu báo, và ba móc `sauDongBo` /
   * `sauLuu` / `sauXoa` (ElevenLabs hỏi số dư + nạp lại giọng; Beeknoee đối
   * chiếu model).
   *
   * Ba nếp đã trả giá, giữ nguyên trong mọi cấu hình:
   *   - KHÔNG bao giờ đổ key thật ngược ra ô. Máy chủ chỉ trả cờ
   *     `api_key_configured`; thứ hiện ra là dấu sao thuần.
   *   - Đã lưu thì ô KHOÁ LẠI (readonly), muốn thay phải bấm Xoá — không ai
   *     gõ đè nửa vời lên khoá đang chạy rồi lưu nhầm một chuỗi hỏng.
   *   - ĐỪNG ẩn panel khi đã có key: lưu nhầm key sai là mất luôn chỗ sửa.
   *     Ô luôn hiện; đã lưu hay chưa nói bằng NHÃN và placeholder.
   *   - Không tự lưu khi dán/gõ (bản cũ lưu ngầm sau 80ms, dán hụt nửa chuỗi
   *     là khoá đang chạy bị ghi đè) — phải bấm Lưu hoặc Enter.
   */
  function taoKhoiApiKey(cfg) {
    let dangLuu = false;
    const o = () => ({ input: $(cfg.oNhap), nutLuu: $(cfg.nutLuu), nutXoa: $(cfg.nutXoa), nhan: $(cfg.nhan) });
    const datNhan = (chu, lop) => {
      const { nhan } = o();
      if (nhan) { nhan.textContent = chu; nhan.className = `config-state${lop ? ` ${lop}` : ''}`; }
    };

    function dongBo(configured) {
      configured = Boolean(configured);
      cfg.datCoKey(configured);       // cho kiemNguonGiongDoc() — đọc ngược từ class nhãn thì mong manh
      RP.capNhatNutDung();
      const { input, nutLuu, nutXoa, nhan } = o();
      if (input) {
        if (configured) {
          input.value = '••••••••••••••••';
          input.readOnly = true;
          input.placeholder = '';
          input.title = 'Đã lưu khoá — bấm Xoá để thay khoá khác';
        } else {
          if (input.readOnly) input.value = '';
          input.readOnly = false;
          input.placeholder = cfg.placeholder;
          input.title = '';
        }
      }
      // Đã lưu: chỉ còn đường Xoá. Chưa lưu: chỉ còn đường Lưu.
      if (nutLuu) nutLuu.hidden = configured;
      if (nutXoa) nutXoa.hidden = !configured;
      if (nhan) {
        // Nhãn NGẮN vì đứng ngay cạnh tiêu đề. Màu nói trạng thái: xanh = có key.
        nhan.textContent = configured ? cfg.nhanDaLuu : cfg.nhanChuaLuu;
        nhan.className = `config-state ${configured ? 'ok' : 'thieu'}`;
        nhan.title = '';
      }
      if (cfg.sauDongBo) cfg.sauDongBo(configured);
    }

    async function luu() {
      const { input } = o();
      const apiKey = input?.value.trim() || '';
      /* Bấm nút mà ô rỗng thì phải nói thành lời — lặng lẽ return là "bấm Lưu
         không thấy gì xảy ra". */
      if (!apiKey) { setStatus(cfg.chuThieuKey, 'bad'); return; }
      if (dangLuu) return;
      dangLuu = true;
      datNhan('Đang lưu…', '');
      try {
        const data = await apiPost(cfg.url, { api_key: apiKey });
        if (cfg.truocDongBo) cfg.truocDongBo();
        dongBo(data && data.api_key_configured);
        setStatus(cfg.chuLuuXong, 'good');
        if (cfg.sauLuu) cfg.sauLuu(data);
      } catch (e) {
        setStatus((e && e.message) || String(e), 'bad');
        datNhan('Lưu thất bại', 'thieu');
      } finally {
        dangLuu = false;
      }
    }

    /* Có bước hỏi lại: bấm nhầm là mất khoá, mà lấy lại thì phải sang tận
       trang nhà cung cấp tạo key mới — key cũ không xem lại được. */
    async function xoa() {
      if (!window.confirm(cfg.cauHoiXoa)) return;
      if (dangLuu) return;
      dangLuu = true;
      datNhan('Đang xoá…', '');
      try {
        const data = await apiPost(cfg.url, { xoa_api_key: true });
        if (cfg.truocDongBo) cfg.truocDongBo();
        dongBo(data && data.api_key_configured);
        setStatus(cfg.chuXoaXong, cfg.toneXoaXong || 'good');
        if (cfg.sauXoa) cfg.sauXoa(data);
      } catch (e) {
        setStatus((e && e.message) || String(e), 'bad');
        datNhan('Không xoá được', 'thieu');
      } finally {
        dangLuu = false;
      }
    }

    function noi() {
      const { input, nutLuu, nutXoa } = o();
      if (nutLuu) nutLuu.addEventListener('click', (e) => { e.preventDefault(); luu(); });
      if (nutXoa) nutXoa.addEventListener('click', (e) => { e.preventDefault(); xoa(); });
      // Enter trong ô = bấm Lưu. Ô nằm trong <form> nào đâu, nên phải tự nối.
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !input.readOnly) { e.preventDefault(); luu(); }
        });
      }
    }

    return { dongBo, luu, xoa, noi };
  }

  const khoiKeyBee = taoKhoiApiKey({
    url: '/api/tts/beeknoee/config',
    oNhap: '#beeApiKey', nutLuu: '#beeApiKeyLuu', nutXoa: '#beeApiKeyXoa', nhan: '#beeApiKeyState',
    placeholder: 'Dán API key (sk-bee-…)',
    nhanDaLuu: 'Đã lưu API key',
    nhanChuaLuu: 'Chưa lưu API key',
    chuThieuKey: 'Chưa có gì để lưu — dán API key Beeknoee vào ô trước.',
    chuLuuXong: 'Đã lưu API key Beeknoee.',
    cauHoiXoa: 'Xoá API key Beeknoee đang lưu? Bạn sẽ phải dán lại key để tạo được video bằng tab này.',
    chuXoaXong: 'Đã xoá API key Beeknoee.',
    toneXoaXong: 'warn',
    datCoKey: (co) => { state.beeCoKey = co; },
    // Có key rồi mới hỏi được catalog — đối chiếu model sống/chết/mới.
    sauLuu: () => doiChieuBeeModels(),
  });

  const khoiKeyEleven = taoKhoiApiKey({
    url: '/api/tts/elevenlabs/config',
    oNhap: '#elevenApiKey', nutLuu: '#elevenApiKeyLuu', nutXoa: '#elevenApiKeyXoa', nhan: '#elevenApiKeyState',
    placeholder: 'Dán API key',
    /* Đã lưu thì nhãn là SỐ CREDIT CÒN LẠI (chủ dự án chốt 29/08 — "đã lưu
       API key" không nói được điều người dùng thật sự muốn biết); con số do
       napElevenQuota điền sau vì phải hỏi ElevenLabs. */
    nhanDaLuu: 'Đang xem số dư…',
    nhanChuaLuu: 'Chưa lưu API key',
    chuThieuKey: 'Chưa có gì để lưu — dán API key vào ô trước.',
    chuLuuXong: 'Đã lưu API key ElevenLabs.',
    cauHoiXoa: 'Xoá API key đang lưu? Bạn sẽ phải dán lại key để tạo được video.',
    chuXoaXong: 'Đã xoá API key. Dán key mới rồi bấm Lưu.',
    datCoKey: (co) => { state.elevenCoKey = co; },
    sauDongBo: (configured) => {
      const panel = $('#elevenApiKeyPanel');
      if (panel) panel.hidden = false;
      if (configured) napElevenQuota();
    },
    /* Key MỚI (hoặc vừa xoá) = năng lực mới — sổ nhớ gói/kết quả thử định dạng
       của key cũ hết giá trị, xoá để lượt hỏi số dư kế thử lại cho đúng. */
    truocDongBo: () => {
      state.fmtChoPhep = {};
      state.elevenGoi = '';
      window.beeknoee.settings.set({ elevenFmtThu: null }).catch(() => {});
    },
    // Có khoá rồi mới hỏi được danh sách giọng.
    sauLuu: () => loadElevenLabsVoices(),
    // Danh sách giọng lùi về giọng ghim sẵn — vẽ lại cho khớp thực tế.
    sauXoa: () => { loadElevenLabsVoices(); const i = $('#elevenApiKey'); if (i) i.focus(); },
  });

  async function loadBeeknoeeConfig() {
    if (!$('#beeModel')) return;
    // Hai ô chọn dựng được ngay từ danh sách tĩnh — không chờ mạng.
    let nho = null;
    try {
      const s = await window.beeknoee.settings.get();
      nho = (s && s.beeTts) || null;
    } catch { nho = null; }
    dungOBeeModel(nho && nho.model);
    dungOBeeGiong(nho && nho.voice);
    try {
      const data = await apiGoi('/api/tts/beeknoee/config', { cache: 'no-store' });
      khoiKeyBee.dongBo(data && data.api_key_configured);
      // Có key rồi mới hỏi được catalog — đối chiếu model sống/chết/mới.
      doiChieuBeeModels();
    } catch (e) {
      setStatus((e && e.message) || String(e), 'bad');
    }
  }


  /* Số credit ElevenLabs còn lại — điền vào nhãn cạnh ô API key.
     Chống hai lượt chồng nhau bằng số thứ tự: lưu key mới ngay sau khi mở tab
     là hai fetch cùng bay, cái về sau thắng bất kể thứ tự về. */
  let lanQuota = 0;
  async function napElevenQuota() {
    const lan = ++lanQuota;
    const apiState = $('#elevenApiKeyState');
    if (!apiState) return;
    let q = null;
    try {
      const res = await fetch('/api/tts/elevenlabs/quota', { cache: 'no-store' });
      q = await res.json();
    } catch { q = null; }
    if (lan !== lanQuota) return;                    // đã có lượt mới hơn
    if (!state.elevenCoKey) return;                  // key vừa bị xoá trong lúc chờ
    if (q && q.api_key_configured && q.gioiHan > 0) {
      const so = (n) => Number(n).toLocaleString('vi-VN');
      apiState.textContent = `Còn ${so(q.conLai)} / ${so(q.gioiHan)} credit`;
      apiState.className = 'config-state ok';
      /* Gắn icon SAU khi ghi chữ: textContent vừa xoá sạch ruột phần tử. */
      if (window.__beeIcons) {
        const ic = document.createElement('span');
        ic.className = 'btn-icon';
        ic.dataset.icon = 'xu';
        apiState.insertBefore(ic, apiState.firstChild);
        window.__beeIcons.apply(apiState);
      }
      const reset = q.resetUnix ? new Date(q.resetUnix * 1000).toLocaleDateString('vi-VN') : '';
      apiState.title = `Đã dùng ${so(q.daDung)} credit${q.goi ? ` · gói ${q.goi}` : ''}${reset ? ` · reset ${reset}` : ''}`;
      // Cùng lượt hỏi này trả luôn TÊN GÓI — dùng để mờ/mở các định dạng
      // audio cần gói cao (xem apGoiChatLuong).
      state.elevenGoi = q.goi || '';
      apGoiChatLuong();
      return;
    }
    /* Không xem được số dư — thường là key thiếu quyền User → Read (hướng dẫn
       cũ dặn để No access mọi quyền phụ, nên key cũ đều vậy). KHÔNG phải lỗi:
       key vẫn dựng video bình thường. Nhãn phải NÓI lý do ngay (chủ dự án dán
       key thật, thấy "Đã lưu key" trơ trọi và tưởng tính năng hỏng — tooltip
       không ai rê vào), chi tiết cách sửa nằm ở tooltip. */
    state.elevenGoi = '';
    if (q && q.thieu_quyen) {
      apiState.textContent = 'Đã lưu key · cấp quyền User → Read để xem số dư';
      apiState.title = 'Key này chưa có quyền User → Read nên ElevenLabs không cho hỏi số dư. '
        + 'Tạo key mới (Developers → API Keys) bật thêm dòng User = Read rồi dán lại là hiện. '
        + 'Video vẫn dựng bình thường với key hiện tại.';
    } else {
      apiState.textContent = 'Đã lưu key · chưa xem được số dư';
      apiState.title = `Không hỏi được số dư${q && q.error ? `: ${q.error}` : ''}. `
        + 'Nếu vừa cập nhật app thì tắt hẳn app rồi mở lại (bộ dựng cần nạp bản mới). '
        + 'Video vẫn dựng bình thường.';
    }
    apiState.className = 'config-state ok';
    // Không đọc được gói thì đi đường thử thật để ô Chất lượng vẫn mờ/mở đúng.
    thuFormatBiKhoa();
  }

  async function loadElevenLabsConfig() {
    const input = $('#elevenVoice');
    if (!input) return;
    try {
      const data = await apiGoi('/api/tts/elevenlabs/config', { cache: 'no-store' });
      input.value = data.voice_id || '';
      input.placeholder = 'hoặc dán Voice ID';
      khoiKeyEleven.dongBo(data && data.api_key_configured);
      dungOChatLuong(data);
      loadElevenLabsVoices();
    } catch (error) {
      setStatus(error.message || String(error), 'bad');
    }
  }

  /**
   * Dựng ô "Chất lượng audio" từ danh sách máy chủ gửi xuống.
   *
   * ⚠ KHÔNG viết cứng bảng định dạng ở đây. Bên Python đã có `OUTPUT_FORMATS`
   * kèm lý do vì sao chỉ có MP3 (đường xử lý đặt tên tệp cứng là `.mp3`); chép
   * thêm một bảng nữa ở giao diện là hai bảng lệch nhau lúc nào không hay, mà
   * bên lệch sẽ cho người dùng chọn một mã máy chủ từ chối.
   */
  function dungOChatLuong(data) {
    const sel = $('#elevenFormat');
    if (!sel) return;
    const st = $('#elevenFormatState');
    const ds = Array.isArray(data.output_formats) ? data.output_formats : [];
    const hienTai = data.output_format || 'mp3_44100_128';

    sel.replaceChildren();
    if (ds.length) {
      for (const f of ds) {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.goi ? `${f.nhan} — cần gói ${f.goi}` : f.nhan;
        // Giữ lại phần thô để `apGoiChatLuong` vẽ lại nhãn khi đã biết gói thật.
        o.dataset.nhan = f.nhan;
        o.dataset.goiNhan = f.goi || '';
        o.dataset.canGoi = f.canGoi || '';
        sel.appendChild(o);
      }
      if (st) { st.textContent = ''; st.className = 'config-state'; }
    } else {
      // ⚠ KHÔNG ẩn hàng này khi máy chủ không gửi danh sách.
      //
      // Bản trước `setAttribute('hidden')` — và đúng cái cảnh đó đã xảy ra:
      // tiến trình Python khởi động TRƯỚC khi mã mới được ghi nên vẫn giữ
      // module cũ trong bộ nhớ, không có `output_formats`, thế là cả hàng biến
      // mất. Chủ dự án mở app ra tưởng tôi chưa làm gì.
      //
      // Vẫn hiện hàng, kèm một câu nói rõ phải làm gì.
      const o = document.createElement('option');
      o.value = hienTai;
      o.textContent = hienTai;
      sel.appendChild(o);
      if (st) { st.textContent = 'Khởi động lại app để đổi được'; st.className = 'config-state thieu'; }
    }
    sel.disabled = !ds.length;
    sel.value = hienTai;
    // Nếu số dư (kèm tên gói) đã về trước đó thì áp luôn — thứ tự hai lượt
    // fetch lúc mở trang không đảm bảo bên nào xong trước.
    apGoiChatLuong();
  }

  /* Mờ/mở các định dạng theo GÓI THẬT của tài khoản (đọc từ cùng lượt hỏi số
     dư — /v1/user/subscription trả `tier`). Chủ dự án chốt 29/08: chưa đủ gói
     thì dòng 192 kbps phải MỜ đi, đủ rồi mới rõ ra (và bỏ đuôi "cần gói…" cho
     đỡ rối). CHỈ làm khi biết chắc gói: key thiếu quyền User → Read thì không
     biết, cứ để nguyên như cũ — mờ nhầm của người có gói là tệ hơn không mờ. */
  const HANG_GOI = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, business: 5 };
  function apGoiChatLuong() {
    const sel = $('#elevenFormat');
    if (!sel) return;
    const hang = HANG_GOI[String(state.elevenGoi || '').toLowerCase()];
    Array.from(sel.options || []).forEach((o) => {
      const can = String(o.dataset.canGoi || '').toLowerCase();
      if (!can) return;
      /* Nguồn quyết định, theo độ tin: (1) tên gói đọc từ tài khoản; (2) kết
         quả THỬ THẬT một request tí hon (khi key không cho đọc gói — xem
         thuFormatBiKhoa); (3) không biết thì giữ nguyên như cũ. */
      let du;
      if (hang !== undefined) du = hang >= (HANG_GOI[can] ?? 99);
      else if (typeof state.fmtChoPhep[o.value] === 'boolean') du = state.fmtChoPhep[o.value];
      else return;
      /* Đang là lựa chọn ĐÃ LƯU thì không khoá — khoá là ô select rơi về
         trạng thái lơ lửng, mà máy chủ vẫn là nơi chốt thật khi render. */
      o.disabled = !du && sel.value !== o.value;
      o.textContent = du
        ? (o.dataset.nhan || o.textContent)
        : `${o.dataset.nhan} — cần gói ${o.dataset.goiNhan}`;
    });
  }

  /* Key KHÔNG cho đọc gói (thiếu quyền User → Read) thì vẫn phải "làm hẳn
     hoi": thử thật từng định dạng bị khoá gói bằng một request 1 ký tự
     (≤1 credit) rồi NHỚ kết quả vào settings — mỗi key chỉ tốn một lần thử
     trong đời, lưu/xoá key là sổ nhớ bị xoá theo (xem save/xoa bên dưới). */
  let dangThuFormat = false;
  async function thuFormatBiKhoa() {
    if (dangThuFormat) return;
    const sel = $('#elevenFormat');
    if (!sel || !state.elevenCoKey) return;
    const canThu = Array.from(sel.options || []).filter((o) => o.dataset.canGoi);
    if (!canThu.length) return;
    dangThuFormat = true;
    try {
      let nho = {};
      try {
        const s = await window.beeknoee.settings.get();
        nho = (s && s.elevenFmtThu) || {};
      } catch { nho = {}; }
      let doiSo = false;
      for (const o of canThu) {
        const id = o.value;
        if (typeof state.fmtChoPhep[id] === 'boolean') continue;
        if (typeof nho[id] === 'boolean') { state.fmtChoPhep[id] = nho[id]; continue; }
        let kq = null;
        try {
          const res = await fetch('/api/tts/elevenlabs/thu-format', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format: id }),
          });
          kq = await res.json();
        } catch { kq = null; }
        // Chỉ tin True/False; null (mạng hỏng, key sai...) thì lần sau thử lại.
        if (kq && typeof kq.duocPhep === 'boolean') {
          state.fmtChoPhep[id] = kq.duocPhep;
          nho[id] = kq.duocPhep;
          doiSo = true;
        }
      }
      if (doiSo) window.beeknoee.settings.set({ elevenFmtThu: nho }).catch(() => {});
      apGoiChatLuong();
    } finally {
      dangThuFormat = false;
    }
  }

  async function saveElevenLabsFormat() {
    const sel = $('#elevenFormat');
    const st = $('#elevenFormatState');
    if (!sel || !sel.value) return;
    if (st) { st.textContent = 'Đang lưu…'; st.className = 'config-state'; }
    try {
      const data = await apiPost('/api/tts/elevenlabs/config', { output_format: sel.value });
      if (st) { st.textContent = 'Đã lưu'; st.className = 'config-state ok'; }
    } catch (e) {
      // Trả ô về giá trị máy chủ ĐANG giữ, không để nó đứng ở lựa chọn vừa bị
      // từ chối — nhìn thì tưởng đã đổi, render ra lại là định dạng cũ.
      if (st) { st.textContent = 'Không lưu được'; st.className = 'config-state thieu'; }
      loadElevenLabsConfig();
      setStatus((e && e.message) || String(e), 'bad');
    }
  }

  /* Tên ElevenLabs có dạng "Roger - Laid-Back, Casual, Resonant": phần trước
     dấu gạch là TÊN, phần sau là mô tả. Tách ra để tên đứng riêng một dòng in
     đậm — liếc là thấy, khỏi phải đọc hết cả câu. Không có dấu gạch thì coi
     như cả chuỗi là tên. */
  function tachTenGiong(ten) {
    const chu = String(ten || '').trim();
    const m = chu.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    return m ? { ten: m[1].trim(), mo: m[2].trim() } : { ten: chu, mo: '' };
  }

  function dungDongGiong(v, stt, meta) {
    const { ten, mo } = tachTenGiong(v.name);
    const dong = document.createElement('div');
    dong.className = 'voice-row';
    dong.setAttribute('role', 'option');
    dong.setAttribute('aria-selected', 'false');
    dong.dataset.id = v.voice_id;
    dong.dataset.ten = ten;

    const so = document.createElement('span');
    so.className = 'voice-stt';
    so.textContent = String(stt);

    const info = document.createElement('span');
    info.className = 'voice-info';
    const nhanTen = document.createElement('span');
    nhanTen.className = 'voice-ten';
    nhanTen.textContent = ten;
    const nhanPhu = document.createElement('span');
    nhanPhu.className = 'voice-phu';
    nhanPhu.textContent = [mo, meta].filter(Boolean).join(' · ');
    info.append(nhanTen, nhanPhu);

    const nut = document.createElement('button');
    nut.type = 'button';
    nut.className = 'voice-play';
    /* ⚠ ICON LOA, KHONG PHAI TAM GIAC PLAY — va dat bang `data-icon` roi de
       `__beeIcons` ve, dung bo icon chung cua app. Tam giac play doc ra
       "chay video"; day la nghe THU MOT GIONG nen cai loa moi dung nghia.
       ⚠ TU DAY TRO DI KHONG AI DUOC GHI `textContent` len nut nay: ghi la xoa
       mat cai SVG vua ve. Trang thai (dang tai / dang phat) bao bang LOP. */
    nut.innerHTML = '<span class="btn-icon" data-icon="loa"></span>';
    if (window.__beeIcons) window.__beeIcons.apply(nut);
    nut.dataset.url = v.preview_url || '';
    if (v.preview_url) {
      nut.title = 'Nghe thử — không tốn credit';
    } else {
      // Giọng gợi ý ghim trong app không kèm link nghe thử: link đó có chuỗi
      // đã ký, ghim cứng vào mã là có ngày hết hạn rồi nút chết câm.
      nut.disabled = true;
      nut.title = 'Giọng này chưa có bản nghe thử — nhập API key để lấy';
    }

    dong.append(so, info, nut);
    return dong;
  }

  /* --- Nghe thử: mỗi lúc chỉ MỘT bản mẫu chạy --- */
  let amDang = null;
  let amUrl = '';
  let amNut = null;

  function dungNgheThu() {
    if (amDang) { try { amDang.pause(); } catch { /* đã dừng rồi */ } }
    // Không thu hồi là mỗi lần bấm giữ lại vài trăm KB trong bộ nhớ trang.
    if (amUrl) { try { URL.revokeObjectURL(amUrl); } catch { /* bỏ qua */ } }
    if (amNut) amNut.classList.remove('dang', 'dang-tai');
    amDang = null;
    amUrl = '';
    amNut = null;
  }

  /** Phát bản nghe thử {base64, kieu} do main tải hộ — dùng chung ElevenLabs/Beeknoee. */
  async function phatThuAudio(kq, nut) {
    const bin = atob((kq && kq.base64) || '');
    const byt = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) byt[i] = bin.charCodeAt(i);
    amUrl = URL.createObjectURL(new Blob([byt], { type: (kq && kq.kieu) || 'audio/mpeg' }));
    amDang = new Audio(amUrl);
    amDang.addEventListener('ended', dungNgheThu);
    amDang.addEventListener('error', dungNgheThu);
    nut.classList.remove('dang-tai');
    nut.classList.add('dang');
    await amDang.play();
  }

  async function ngheThuGiong(nut) {
    const url = nut.dataset.url || '';
    if (!url) return;
    if (amNut === nut) { dungNgheThu(); return; }   // bấm lại chính nó = tắt
    dungNgheThu();
    amNut = nut;
    nut.classList.add('dang-tai');
    try {
      // Main tải hộ: CSP của trang không cho renderer gọi ra mạng.
      const kq = await window.beeknoee.tts.elevenPreview(url);
      if (amNut !== nut) return;                    // người dùng đã bấm giọng khác
      await phatThuAudio(kq, nut);
    } catch (e) {
      if (amNut === nut) dungNgheThu();
      setStatus(`Không nghe thử được: ${(e && e.message) || e}`, 'bad');
    }
  }

  /* Nghe thử giọng Beeknoee — platform không có bản mẫu tĩnh như ElevenLabs
     nên đọc THẬT một câu chào ngắn bằng đúng model + giọng đang chọn (main
     cache theo phiên, mỗi giọng chỉ tốn một lần; Google dịch thì 0đ). Dùng
     chung bộ amDang/dungNgheThu với ElevenLabs để hai bên tự dừng nhau. */
  const BEE_CAU_MAU_GTTS = {
    vi: 'Xin chào, đây là giọng đọc thử của Beeknoee Studio.',
    en: 'Hello, this is a voice preview from Beeknoee Studio.',
    ja: 'こんにちは、これは音声のプレビューです。',
    ko: '안녕하세요, 음성 미리듣기입니다.',
    zh: '你好，这是语音试听。',
    fr: 'Bonjour, ceci est un aperçu de la voix.',
    de: 'Hallo, dies ist eine Sprachvorschau.',
    es: 'Hola, esta es una vista previa de la voz.',
    pt: 'Olá, esta é uma amostra da voz.',
    th: 'สวัสดี นี่คือตัวอย่างเสียงอ่าน',
    id: 'Halo, ini adalah pratinjau suara.',
    ru: 'Здравствуйте, это образец голоса.',
  };

  /* Nghe thử giọng TRÊN MÁY — đọc thật một câu ngay trên máy (miễn phí). Lần đầu chậm vài giây vì
     phải nạp mô hình; dùng chung bộ amDang/dungNgheThu với hai nguồn kia. */
  async function ngheThuVieneu(nut) {
    if (amNut === nut) { dungNgheThu(); return; }
    dungNgheThu();
    if (!state.vieneuSanSang) {
      setStatus('Tải mô hình giọng trên máy trước đã (nút Tải ở ngay trên).', 'bad');
      return;
    }
    const voice = $('#vnVoice')?.value || '';
    amNut = nut;
    nut.classList.add('dang-tai');
    try {
      const kq = await window.beeknoee.tts.vieneu.preview(voice, BEE_CAU_MAU_GTTS.vi);
      if (amNut !== nut) return;
      await phatThuAudio(kq, nut);
    } catch (e) {
      if (amNut === nut) dungNgheThu();
      setStatus(`Không nghe thử được: ${String((e && e.message) || e).replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')}`, 'bad');
    }
  }

  async function ngheThuBee(nut) {
    if (amNut === nut) { dungNgheThu(); return; }   // bấm lại chính nó = tắt
    dungNgheThu();
    if (!state.beeCoKey) {
      setStatus('Dán API key Beeknoee rồi bấm Lưu trước đã.', 'bad');
      return;
    }
    const model = $('#beeModel')?.value || '';
    const voice = $('#beeVoice')?.value || '';
    if (!model || !voice) return;
    const text = beeModelHienTai().bo === 'gtts'
      ? (BEE_CAU_MAU_GTTS[voice] || BEE_CAU_MAU_GTTS.vi)
      : BEE_CAU_MAU_GTTS.vi;
    amNut = nut;
    nut.classList.add('dang-tai');
    try {
      const kq = await window.beeknoee.tts.beePreview({ model, voice, text });
      if (amNut !== nut) return;                    // đã bấm sang thứ khác
      await phatThuAudio(kq, nut);
    } catch (e) {
      if (amNut === nut) dungNgheThu();
      setStatus(`Không nghe thử được: ${(e && e.message) || e}`, 'bad');
    }
  }

  /* Đồng bộ dấu chọn + chữ trên nút từ ô #elevenVoice — nguồn giá trị DUY NHẤT.
     Gọi lại sau mỗi lần dựng danh sách và mỗi lần người dùng gõ tay Voice ID. */
  function danhDauGiongDangChon() {
    const pop = $('#elevenVoicePop');
    if (!pop) return;
    const id = $('#elevenVoice')?.value.trim() || '';
    let ten = '';
    pop.querySelectorAll('.voice-row').forEach((r) => {
      const khop = Boolean(id) && r.dataset.id === id;
      r.classList.toggle('chon', khop);
      r.setAttribute('aria-selected', khop ? 'true' : 'false');
      if (khop) ten = r.dataset.ten || '';
    });
    const nhan = $('#elevenVoiceCurTen');
    if (nhan) nhan.textContent = ten || id || '— chọn từ tài khoản —';
  }

  /* Đặt toạ độ cho danh sách.
     Danh sách dùng `position: fixed` để thoát khỏi khung cuộn `.rl-than` và
     đè lên được thanh nút "Tạo video" — lý do đầy đủ ở khối CSS `.voice-pop`.
     Cái giá là toạ độ không còn tự bám theo nút nữa, phải tính tay. */
  function datViTriPop() {
    const pop = $('#elevenVoicePop');
    const nut = $('#elevenVoiceCur');
    if (!pop || !nut || pop.hidden) return;
    const o = nut.getBoundingClientRect();
    const rong = Math.max(o.width, 420);
    const choDuoi = window.innerHeight - o.bottom - 12;
    const choTren = o.top - 12;
    /* Gần đáy màn hình thì lật lên trên. Không lật thì danh sách chỉ còn vài
       chục pixel, cuộn trong một khe hẹp — đúng kiểu khó dùng. */
    const lat = choDuoi < 220 && choTren > choDuoi;
    pop.style.width = `${rong}px`;
    pop.style.maxHeight = `${Math.max(160, Math.min(340, lat ? choTren : choDuoi))}px`;
    // Kẹp trong bề ngang cửa sổ để danh sách rộng hơn nút không tràn ra ngoài.
    pop.style.left = `${Math.max(8, Math.min(o.left, window.innerWidth - rong - 8))}px`;
    if (lat) {
      pop.style.top = 'auto';
      pop.style.bottom = `${window.innerHeight - o.top + 4}px`;
    } else {
      pop.style.bottom = 'auto';
      pop.style.top = `${o.bottom + 4}px`;
    }
  }

  function moBoChonGiong(mo) {
    const pop = $('#elevenVoicePop');
    const nut = $('#elevenVoiceCur');
    if (!pop || !nut) return;
    pop.hidden = !mo;
    nut.setAttribute('aria-expanded', mo ? 'true' : 'false');
    if (mo) {
      datViTriPop();
      const dong = pop.querySelector('.voice-row.chon') || pop.querySelector('.voice-row');
      if (dong) dong.scrollIntoView({ block: 'nearest' });
    } else {
      // Đóng danh sách thì tắt luôn tiếng đang phát — để nó kêu tiếp sau khi
      // danh sách biến mất là không còn nút nào bấm để tắt.
      dungNgheThu();
    }
  }

  /**
   * Nạp danh sách giọng CỦA CHÍNH TÀI KHOẢN vào ô chọn.
   *
   * ⚠ KHÔNG viết cứng một bảng Voice ID "tiếng Việt" trong mã. ID là của từng
   * tài khoản và ElevenLabs đổi danh mục giọng theo thời gian — bảng cứng sẽ
   * mục, người dùng chọn xong nhận lỗi 404 mà không hiểu vì sao. Hỏi thẳng API
   * thì luôn đúng với tài khoản đang dùng.
   *
   * Chưa lưu khoá thì danh sách rỗng và ô gõ tay vẫn dùng được như cũ.
   */
  async function loadElevenLabsVoices() {
    const sel = $('#elevenVoicePop');
    const st = $('#elevenVoiceState');
    if (!sel) return;
    try {
      const res = await fetch('/api/tts/elevenlabs/voices', { cache: 'no-store' });
      const data = await res.json();
      /* ⚠ HỎNG DANH SÁCH TÀI KHOẢN THÌ VẪN PHẢI VẼ NHÓM GỢI Ý.
       *
       * Bản trước ném lỗi ngay tại đây, nên ô chọn giọng KHÔNG được dựng chút
       * nào — mất luôn cả mấy nhóm giọng gợi ý vốn nằm sẵn trong app và chẳng
       * cần API nào. Khoá thiếu quyền `voices_read` là người dùng mất sạch
       * đường chọn giọng, dù khoá đó dựng video hoàn toàn bình thường.
       *
       * Nay: lỗi chỉ làm rỗng phần "Giọng trong tài khoản", phần còn lại vẫn
       * dựng như thường, và câu báo nói đúng bệnh (xem `bao` bên dưới). */
      const loi = (!res.ok || (data && data.error))
        ? {
          chu: (data && data.error) || `Không gọi được chức năng này (mã ${res.status})`,
          thieuQuyen: Boolean(data && data.thieu_quyen),
        }
        : null;
      const tk = (!loi && Array.isArray(data.voices)) ? data.voices : [];
      const goiY = Array.isArray(window.__BEE_ELEVEN_VOICES__) ? window.__BEE_ELEVEN_VOICES__ : [];

      /* Tắt tiếng đang nghe thử TRƯỚC khi thay danh sách.
         Không tắt thì lưu khoá lúc đang nghe sẽ thay hết dòng cũ, nút ⏸ biến
         mất theo, mà tiếng vẫn kêu — không còn chỗ nào bấm để dừng. */
      dungNgheThu();
      sel.replaceChildren();

      const daCo = new Set();
      let stt = 0;
      const themNhom = (ten, ds, moTa) => {
        const con = (ds || []).filter((v) => v.voice_id && !daCo.has(v.voice_id));
        if (!con.length) return;
        const tieu = document.createElement('div');
        tieu.className = 'voice-nhom';
        tieu.textContent = ten;
        sel.appendChild(tieu);
        con.forEach((v) => {
          daCo.add(v.voice_id);
          sel.appendChild(dungDongGiong(v, ++stt, moTa(v)));
        });
      };

      /* Tách giọng tài khoản theo NGÔN NGỮ.
         Trước đây dồn cả 33 giọng vào một nhóm "Giọng trong tài khoản", nên
         giọng Việt nằm lẫn giữa hai chục giọng Anh — phải cuộn mò từng dòng.
         `language` do API trả về sẵn nên chia là chuyện hiển thị thuần tuý. */
      const theoTieng = { vi: [], en: [], khac: [] };
      tk.forEach((v) => {
        const l = String(v.language || '').trim().toLowerCase();
        (l === 'vi' ? theoTieng.vi : l === 'en' ? theoTieng.en : theoTieng.khac).push(v);
      });
      const metaTk = (v) => [v.accent, v.gender].filter(Boolean).join(' · ');

      // Tiếng Việt lên đầu: đây là thứ người dùng cần trong hầu hết lượt dựng.
      themNhom('Tiếng Việt · trong tài khoản', theoTieng.vi, metaTk);
      themNhom('Tiếng Anh · trong tài khoản', theoTieng.en, metaTk);
      themNhom('Ngôn ngữ khác · trong tài khoản', theoTieng.khac, (v) =>
        [v.language, v.accent, v.gender].filter(Boolean).join(' · '));
      // Rồi tới các nhóm gợi ý, giữ ĐÚNG thứ tự khai báo: tiếng Việt trước.
      goiY.forEach((n) => themNhom(n.nhom, n.ds, (v) => v.mo_ta || ''));

      if (!stt) {
        const trong = document.createElement('div');
        trong.className = 'voice-trong';
        trong.textContent = 'Chưa có giọng nào — nhập API key, hoặc dán thẳng Voice ID vào ô bên cạnh.';
        sel.appendChild(trong);
      }

      /* Số giọng thật sự chọn được, hiện ngay cạnh chữ "Giọng đọc".
         Đếm bằng `daCo` chứ không đếm số phần tử con: trong danh sách còn có
         cả dòng tiêu đề của từng nhóm. `daCo` là tập id đã thêm, đã trừ trùng
         giữa giọng tài khoản và giọng gợi ý — đúng con số người dùng thấy. */
      const dem = $('#elevenVoiceCount');
      if (dem) dem.textContent = daCo.size ? ` (${daCo.size})` : '';

      danhDauGiongDangChon();

      if (st) {
        if (!loi) { st.textContent = ''; st.className = 'config-state'; }
        else if (loi.thieuQuyen) {
          /* Khoá HỢP LỆ nhưng bị giới hạn quyền — nói đúng như vậy.
             Gọi nó là "không dùng được" là đuổi người dùng đi thay khoá trong
             khi khoá đó đọc được bình thường; họ chỉ cần tự chọn giọng. */
          st.textContent = 'Khoá thiếu quyền đọc danh sách giọng — vẫn tạo video được, chọn giọng gợi ý bên dưới hoặc dán Voice ID';
          st.className = 'config-state thieu';
        } else {
          st.textContent = /401|403|unauthor|invalid/i.test(loi.chu)
            ? 'API key không dùng được'
            : 'Không lấy được danh sách giọng của tài khoản';
          st.className = 'config-state thieu';
        }
      }
    } catch (e) {
      // ⚠ KHÔNG nuốt lỗi. Bản trước đặt `st.textContent = ''` rồi thôi: khoá
      // API sai thì ô chọn giọng đứng im, rỗng, không một chữ giải thích —
      // người dùng ngồi nhìn không biết là chưa có khoá, khoá sai, hay mất
      // mạng. Đây CŨNG LÀ chỗ duy nhất kiểm chứng được khoá: `elevenSave` chỉ
      // ghi vào tệp, không hỏi ElevenLabs câu nào.
      if (st) {
        st.textContent = /401|403|unauthor|invalid/i.test(String((e && e.message) || e))
          ? 'API key không dùng được'
          : 'Không lấy được danh sách giọng';
        st.className = 'config-state thieu';
      }
    }
  }

  async function saveElevenLabsVoice() {
    const input = $('#elevenVoice');
    const voiceId = input?.value.trim() || '';
    if (!voiceId) {
      return;
    }
    if (elevenVoiceSaving) return;
    elevenVoiceSaving = true;
    try {
      const data = await apiPost('/api/tts/elevenlabs/config', { voice_id: voiceId });
      if (input) input.value = data.voice_id || voiceId;
      setStatus('Đã lưu ElevenLabs voice ID.', 'good');
    } catch (error) {
      setStatus(error.message || String(error), 'bad');
    } finally {
      elevenVoiceSaving = false;
    }
  }

  /* ── Popup "Tự điền ID giọng" ─────────────────────────────────────────
   *
   * VÌ SAO PHẢI KIỂM TRƯỚC KHI LƯU. Ô chọn giọng trộn hai nguồn: giọng thật
   * của tài khoản (hỏi /v1/voices) và 20 giọng gợi ý ghim sẵn trong
   * eleven-voices.js. Giọng nhóm gợi ý có thể chưa được Add to my voices nên
   * gọi tới là 404. Trước đây ô ID nằm trần ngoài hàng, dán gì cũng nhận —
   * ID sai chỉ lộ ra GIỮA LÚC dựng video, sau khi người dùng đã chờ.
   * Nay bắt buộc hỏi ElevenLabs (không tốn credit) rồi mới cho lưu.
   *
   * `daDat` nhớ đúng chuỗi vừa kiểm ĐẠT. Sửa một ký tự trong ô là nó hết giá
   * trị ngay — không thì kiểm ID tốt rồi sửa thành ID rác vẫn bấm Lưu được.
   */
  let daDat = null;
  let dangKiem = false;

  function veKetQuaId(chu, loai) {
    const o = $("#elevenIdKq");
    if (!o) return;
    o.textContent = chu || "";
    o.className = "idpop-kq" + (loai ? " " + loai : "");
    o.hidden = !chu;
  }

  function moIdPop(mo) {
    const pop = $("#elevenIdPop");
    if (!pop) return;
    pop.hidden = !mo;
    if (!mo) return;
    const o = $("#elevenIdO");
    if (o) {
      o.value = $("#elevenVoice")?.value.trim() || "";
      o.focus();
      o.select();
    }
    daDat = null;
    veKetQuaId("", "");
  }

  /* Trả về true nếu ID trong ô dùng được. Tự vẽ kết quả lên popup. */
  async function kiemIdGiong() {
    const o = $("#elevenIdO");
    const id = o?.value.trim() || "";
    if (!id) { veKetQuaId("Chưa nhập Voice ID.", "hong"); return false; }
    if (daDat === id) return true;          // vừa kiểm đạt, khỏi hỏi lại
    if (dangKiem) return false;
    dangKiem = true;
    const nutK = $("#elevenIdKiem");
    const nutL = $("#elevenIdLuu");
    if (nutK) nutK.disabled = true;
    if (nutL) nutL.disabled = true;
    veKetQuaId("Đang hỏi ElevenLabs…", "");
    try {
      /* kiemLoiTrongThan = false: thân trả về CÓ trường `error` khi ID sai,
         nhưng đó là câu trả lời hợp lệ cần đọc, không phải lỗi gọi hàm. */
      const kq = await apiPost("/api/tts/elevenlabs/kiem-voice", { voiceId: id }, false);
      if (kq && kq.ok) {
        daDat = id;
        veKetQuaId("✓ Dùng được — " + (kq.ten || "giọng không tên"), "dat");
        return true;
      }
      daDat = null;
      veKetQuaId("✕ " + ((kq && kq.error) || "Không kiểm được Voice ID."), "hong");
      return false;
    } catch (e) {
      daDat = null;
      veKetQuaId("✕ " + ((e && e.message) || String(e)), "hong");
      return false;
    } finally {
      dangKiem = false;
      if (nutK) nutK.disabled = false;
      if (nutL) nutL.disabled = false;
    }
  }

  /* Bấm Lưu mà chưa kiểm thì kiểm luôn — người dùng không phải bấm hai nút.
     Kiểm không đạt thì KHÔNG lưu, popup ở nguyên để họ sửa. */
  async function luuIdGiong() {
    if (!(await kiemIdGiong())) return;
    const id = $("#elevenIdO")?.value.trim() || "";
    const kho = $("#elevenVoice");
    if (kho) kho.value = id;
    danhDauGiongDangChon();
    scheduleElevenLabsVoiceSave(80);
    RP.capNhatNutDung();
    moIdPop(false);
  }

  function scheduleElevenLabsVoiceSave(delay = 450) {
    const input = $('#elevenVoice');
    if (!input || !input.value.trim()) return;
    if (elevenVoiceSaveTimer) window.clearTimeout(elevenVoiceSaveTimer);
    elevenVoiceSaveTimer = window.setTimeout(() => {
      elevenVoiceSaveTimer = null;
      saveElevenLabsVoice();
    }, delay);
  }

  async function loadVbeeConfig() {
    try {
      const cfg = await apiGoi('/api/tts/vbee/config');
      if (cfg) {
        const appIdInput = $('#vbeeAppId');
        const tokenInput = $('#vbeeToken');
        if (appIdInput) appIdInput.value = cfg.appId || '';
        if (tokenInput) tokenInput.value = cfg.token || '';
      }
      const vResp = await apiGoi('/api/tts/vbee/voices');
      const sel = $('#vbeeVoiceSelect');
      if (sel && vResp && vResp.voices) {
        sel.replaceChildren();
        vResp.voices.forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v.code;
          opt.textContent = `${v.name} (${v.region} - ${v.gender})`;
          sel.appendChild(opt);
        });
        if (cfg && cfg.voiceCode) sel.value = cfg.voiceCode;
      }
    } catch (e) {
      console.warn('Load Vbee config error:', e);
    }
  }

  function setupVbeeEvents() {
    const btnLuu = $('#vbeeLuu');
    if (btnLuu) {
      btnLuu.onclick = async () => {
        const appId = $('#vbeeAppId')?.value.trim() || '';
        const token = $('#vbeeToken')?.value.trim() || '';
        const voiceCode = $('#vbeeVoiceSelect')?.value || '';
        try {
          await apiPost('/api/tts/vbee/config', { appId, token, voiceCode });
          RP.setStatus('Đã lưu cấu hình Vbee TTS!', 'good');
        } catch (e) {
          RP.setStatus('Lỗi lưu Vbee: ' + (e.message || e), 'bad');
        }
      };
    }
    const sel = $('#vbeeVoiceSelect');
    if (sel) {
      sel.onchange = async () => {
        const voiceCode = sel.value;
        await apiPost('/api/tts/vbee/config', { voiceCode });
      };
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadVbeeConfig();
    setupVbeeEvents();
  });

  Object.assign(RP, { BEE_CAU_MAU_GTTS, apKhungDeck, buocTocDo, chuanHoaOTocDo, docTocDo, BEE_GIONG, BEE_MODELS, HANG_GOI, apBeeModels, apGoiChatLuong, beeModelHienTai, beeModelMacDinh, currentElevenMode, currentRenderSize, danhDauGiongDangChon, datViTriPop, doanBoGiong, doiChieuBeeModels, dungDongGiong, dungNgheThu, dungOBeeGiong, dungOBeeModel, dungOChatLuong, khoiKeyBee, khoiKeyEleven, kiemIdGiong, kiemNguonGiongDoc, luuIdGiong, loadBeeknoeeConfig, loadElevenLabsConfig, loadElevenLabsVoices, locTtsIds, moBoChonGiong, moIdPop, napElevenQuota, ngheThuBee, ngheThuGiong, ngheThuVieneu, nhoBeeCauHinh, phatThuAudio, saveElevenLabsFormat, saveElevenLabsVoice, scheduleElevenLabsVoiceSave, setEngine, syncAdvancedSettings, syncElevenMode, syncSpeedPresets, tachTenGiong, taoKhoiApiKey, thuFormatBiKhoa, loadVbeeConfig });
})();
