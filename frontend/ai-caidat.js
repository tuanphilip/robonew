'use strict';
/**
 * Popup CÀI ĐẶT AI — chọn nhà cung cấp, dán khoá, chọn model, thử kết nối.
 *
 * ⚠ KHÔNG PHẢI MỘT TRANG TRONG `TRANG[]`. Chủ dự án chốt 16/09/2026: "cài API
 * không cần trang riêng, có nút cài đặt mở pop là được". Mở từ hàng "AI" trong
 * thẻ Cài đặt, và (từ Phase 6) từ chính tab Tạo bằng AI khi chưa kết nối.
 *
 * TỪ 03/10/2026 — GỘP VỀ MỘT CHỖ (chủ dự án: "thừa thãi quá, gộp toàn bộ"):
 * bánh răng ở hàng tab đã bỏ; bảng này BẬT LÊN NGAY CẠNH NÚT CHỌN AI dưới ô nhập
 * của cả hai tab — `mo({ neo })`: không phủ tối, khung neo vào nút. Tab "AI
 * agent" mở nó theo kiểu CHỈ KHOÁ — `mo({ neo, chiKhoa: ['anthropic', …] })`:
 * chỉ thẻ nhà + ô khoá, lưu khoá KHÔNG đổi nhà đang dùng của tab Tạo bằng AI
 * (`ai:save` với `chiKhoa`). Thay cho ô nhập khoá riêng trước đây của tab agent.
 *
 * ⚠ KHÔNG BAO GIỜ HIỆN LẠI API KEY. Kênh `ai:config` cố ý không trả khoá ra —
 * ô nhập luôn trống, bên cạnh chỉ có một chữ "Đã cấu hình / Chưa có". Muốn đổi
 * thì dán khoá mới đè lên. Đây là ranh giới đã đo: khoá không xuất hiện ở bất
 * kỳ đâu renderer chạm tới được (xem `ipc/ai.js`).
 */
(() => {
  const api = window.beeknoee;
  if (!api || !api.ai) return;

  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /**
   * HỎI XÁC NHẬN bằng popup của app — dùng chung cho cả tab "Tạo bằng AI".
   *
   * ⚠ Không dùng `window.confirm()`: nó vẽ hộp của hệ điều hành — phông khác,
   * nút khác, tiêu đề là "Beeknoee Studio", nền trắng kể cả khi app đang ở nền
   * tối, và không sửa được gì. Nó lạc hẳn khỏi giao diện.
   *
   * ⚠ Ở ĐÂY chứ không ở `ai-tao.js`: tệp này nạp TRƯỚC, và nó cũng là chủ của
   * bộ khung `.ai-hop/.ai-khung` mà hộp này dùng lại. Đặt ngược lại thì hai chỗ
   * cùng cần một hộp giống hệt nhau sẽ thành hai bản chép.
   */
  function hoiXacNhan({ tieuDe, chu, nutDong, nguyHiem }) {
    return new Promise((xong) => {
      const tao = (the, lop) => {
        const e = document.createElement(the);
        if (lop) e.className = lop;
        return e;
      };
      const h = tao('div', 'ai-hop');
      const nen = tao('div', 'ai-nen');
      const khung = tao('div', 'ai-khung');
      const dau = tao('div', 'ai-dau');
      /* Hộp NGUY HIỂM (xoá, đăng xuất…): tam giác cảnh báo màu VÀNG, không xanh. */
      const bi = tao('span', nguyHiem ? 'btn-icon ai-dau-canh' : 'btn-icon');
      bi.dataset.icon = nguyHiem ? 'warn' : 'info';
      const td = tao('b');
      td.textContent = tieuDe;
      dau.append(bi, td);
      const than = tao('div', 'ai-than');
      /* Mỗi câu một `<div>`: nhét cả khối chữ có xuống dòng vào `textContent`
         thì HTML gộp hết lại thành một dòng dài. */
      for (const dong of chu) {
        const d = tao('div', 'ait-hoi-dong');
        d.textContent = dong;
        than.append(d);
      }
      const chan = tao('div', 'ait-hoi-nut');
      const huy = tao('button', 'ait-hoi-phu');
      huy.type = 'button';
      huy.textContent = 'Hủy';
      const ok = tao('button', `ait-hoi-chinh${nguyHiem ? ' ait-hoi-xoa' : ''}`);
      ok.type = 'button';
      ok.textContent = nutDong || 'Đồng ý';
      chan.append(huy, ok);
      khung.append(dau, than, chan);
      h.append(nen, khung);
      document.body.append(h);
      /* Nút được focus sẵn là nút AN TOÀN — gõ Enter theo phản xạ thì không
         được biến thành lệnh xoá. */
      huy.focus();
      const dongLai = (kq) => {
        document.removeEventListener('keydown', phim, true);
        h.remove();
        xong(kq);
      };
      const phim = (e) => { if (e.key === 'Escape') { e.preventDefault(); dongLai(false); } };
      document.addEventListener('keydown', phim, true);
      nen.onclick = () => dongLai(false);
      huy.onclick = () => dongLai(false);
      ok.onclick = () => dongLai(true);
      if (window.__beeIcons) window.__beeIcons.apply(h);
    });
  }
  window.__beeHoi = hoiXacNhan;

  let hop = null;
  let duLieu = { cauHinh: {}, nha: [] };
  /* Chế độ của lượt mở hiện tại — xem `mo()`. */
  let tuyChon = {};   // { neo, chiKhoa: [id nhà], nha, tieuDe }
  let nhaXem = null;  // CHỈ KHOÁ: nhà đang xem (không lưu thành nhà đang dùng)

  /** id nhà → tên icon trong `icons.js`. Thiếu tên thì rơi về `khoi` (nhà tự cấu hình, không có logo). */
  const LOGO = {
    anthropic: 'claude',
    openai: 'openai',
    gemini: 'gemini',
    beeknoee: 'bee',
  };

  const nhaDangChon = () => duLieu.nha.find((n) => n.id === (nhaXem || duLieu.cauHinh.nhaId)) || duLieu.nha[0] || {};
  /** Tên hiển thị của một nhà. Chưa biết thì trả lại chính id, đừng trả rỗng —
      một đầu nhóm không tên thì người dùng không biết nhóm đó của ai. */
  const tenNha = (id) => (duLieu.nha.find((n) => n.id === id) || {}).ten || id;

  function dong() {
    /* Gỡ bộ nghe của hộp model TRƯỚC khi bỏ popup. Đóng popup lúc hộp đang mở
       mà không gỡ thì hai bộ nghe `pointerdown`/`focusin` ở `document` sống
       tiếp, và `dangNghe` kẹt ở `true` nên lần mở sau `nghe(true)` không gắn
       lại nữa. */
    nghe(false);
    if (hop) { hop.remove(); hop = null; }
    document.removeEventListener('keydown', phim, true);
    window.removeEventListener('resize', datChoKhung);
    tuyChon = {};
    nhaXem = null;
    /* Báo cho chỗ khác biết cấu hình có thể vừa đổi. Tab "Tạo bằng AI"
       (`ai-tao.js`) nghe sự kiện này để đọc lại `coKhoa`: người dùng vừa dán
       key xong mà nút "Tạo video bằng AI" vẫn xám thì họ tưởng app hỏng, và
       không có cách nào đoán ra là phải nạp lại trang. */
    window.dispatchEvent(new CustomEvent('bee:ai-caidat-dong'));
  }
  function phim(e) { if (e.key === 'Escape') { e.preventDefault(); dong(); } }

  /** Ghi một câu trạng thái dưới nút Kiểm tra. */
  function bao(chu, loai) {
    const o = hop && hop.querySelector('#aiKetQua');
    if (!o) return;
    o.hidden = !chu;
    o.textContent = chu || '';
    o.className = 'ai-kq' + (loai ? ' ai-kq-' + loai : '');
  }

  /** Báo cho các tab biết vừa lưu (khoá / nhà / model) — tab agent dựng lại phiên. */
  const baoDaLuu = (nhaId) => window.dispatchEvent(new CustomEvent('bee:ai-caidat-luu', { detail: { nhaId } }));

  /**
   * CHỈ KHOÁ (tab AI agent): thẻ nhà (chỉ các nhà agent cần) + ô khoá + Lưu/Xoá.
   * Không có model / địa chỉ / nâng cao — agent tự chọn model của nó.
   */
  function veKhoa() {
    const n = nhaDangChon();
    const ds = duLieu.nha.filter((x) => tuyChon.chiKhoa.includes(x.id));
    hop.querySelector('.ai-than').innerHTML = `
      <div class="ai-hang ai-hang-doc">
        <span><span class="btn-icon ai-nhan-icon" data-icon="khoi"></span>Nhà cung cấp</span>
        <div class="ai-nha-luoi">${ds.map((x) => `
          <button type="button" class="ai-nha${x.id === n.id ? ' dang-chon' : ''}"
                  data-nha="${esc(x.id)}" aria-pressed="${x.id === n.id}">
            <span class="btn-icon ai-nha-logo" data-icon="${esc(LOGO[x.id] || 'khoi')}"></span>
            <span class="ai-nha-ten">${esc(x.ten)}</span>
            ${x.coKhoa ? '<span class="ai-nha-cham" title="Đã có khoá"></span>' : ''}
          </button>`).join('')}</div>
      </div>
      <label class="ai-hang">
        <span><span class="btn-icon ai-nhan-icon" data-icon="khoa"></span>API key${n.coKhoa
          ? '<span class="btn-icon ai-tich" data-icon="ok" title="Đã cấu hình"></span>' : ''}</span>
        <span class="ai-khoa">
          <input id="aiKhoa" type="password" autocomplete="off" spellcheck="false"
                 ${n.coKhoa ? 'readonly title="Đã có khoá — bấm Xoá để nhập khoá khác"' : ''}
                 placeholder="${n.coKhoa ? '••••••••••••••••' : (n.id === 'beeknoee' ? 'sk-bee-…' : 'Dán API key')}">
          ${n.coKhoa ? '<button type="button" class="ai-xoa" id="aiXoaKhoa">Xoá</button>' : ''}
        </span>
      </label>
      <div class="ai-ghi">Khoá được mã hoá trên máy này — chỉ gửi tới chính nhà cung cấp đó.</div>
      <div class="ai-nut">
        <button type="button" class="ai-nut-chinh" id="aiLuu"${n.coKhoa ? ' disabled' : ''}>Lưu khoá</button>
      </div>
      <div class="ai-kq" id="aiKetQua" hidden></div>`;
    const $ = (x) => hop.querySelector(x);
    for (const b of hop.querySelectorAll('[data-nha]')) {
      b.onclick = () => { nhaXem = b.dataset.nha; veKhoa(); };
    }
    const luu = async (patch, xong) => {
      const r = await api.ai.save({ nhaId: n.id, chiKhoa: true, ...patch });
      if (!r || !r.ok) { bao((r && r.loi) || 'Không lưu được.', 'xau'); return; }
      duLieu = { cauHinh: r.cauHinh, nha: r.nha };
      veKhoa();
      bao(xong, 'tot');
      baoDaLuu(n.id);
    };
    $('#aiLuu').onclick = async () => {
      const k = $('#aiKhoa').value.trim();
      if (!k) { bao('Dán khoá vào ô trên trước đã.', 'xau'); return; }
      $('#aiLuu').disabled = true;
      bao('Đang lưu…');
      await luu({ khoa: k }, 'Đã lưu khoá.');
    };
    const xoa = $('#aiXoaKhoa');
    if (xoa) {
      xoa.onclick = async () => {
        const dongY = await hoiXacNhan({
          tieuDe: 'Xoá API key?',
          chu: [`Khoá của "${n.ten || ''}" sẽ bị xoá khỏi máy.`, 'Khoá đã mã hoá và không hiện lại được, nên xoá rồi thì phải dán khoá mới.'],
          nutDong: 'Xoá khoá',
          nguyHiem: true,
        });
        if (dongY) await luu({ xoaKhoa: true }, 'Đã xoá khoá.');
      };
    }
    if (window.__beeIcons) window.__beeIcons.apply(hop);
    datChoKhung();
    const o = $('#aiKhoa');
    if (o && !o.readOnly) o.focus();
  }

  function ve() {
    if (tuyChon.chiKhoa) { veKhoa(); return; }
    const c = duLieu.cauHinh;
    const n = nhaDangChon();
    /* ⚠ DỌN HỘP MODEL ĐÃ BỊ NHẤC RA khỏi `.ai-than` trước khi vẽ lại.
       `moDsModel()` chuyển `#aiModelDs` lên thẳng `.ai-hop` để thoát khối cuộn,
       nên nó KHÔNG nằm trong `.ai-than` nữa — ghi đè `innerHTML` không xoá được
       nó. Bỏ bước này thì mỗi lần vẽ lại đẻ thêm một hộp mang cùng `id`, và vì
       hộp mồ côi đứng TRƯỚC hộp mới trong thứ tự tài liệu nên `q('#aiModelDs')`
       trỏ nhầm vào cái rỗng: bấm ô Model không ra gì nữa.
       Đo 19/09/2026 trước khi vá: bấm Lưu → 2 hộp, đổi nhà cung cấp → 3 hộp,
       mở lại thì hộp đo được 0x0. `ve()` chạy ở CẢ hai đường đó. */
    hop.querySelectorAll(':scope > .ai-model-ds').forEach((x) => x.remove());
    nghe(false);
    iSang = -1;
    hop.querySelector('.ai-than').innerHTML = `
      ${/* Chọn nhà bằng THẺ CÓ LOGO, không bằng `<select>`. Một danh sách xổ
            toàn chữ thì "OpenAI" và "OpenAI (tương thích)" nhìn gần như nhau,
            phải đọc mới phân biệt được; logo thì nhận ra trước khi kịp đọc.
            (`<select>` không nhét ảnh vào `<option>` được, nên phải là nút.) */ ''}
      ${/* Icon trước mỗi nhãn — cùng nếp với hàng nhãn bên tab "Tạo bằng AI".
            Một bảng bốn năm hàng chữ giống hệt nhau thì mắt phải đọc từng dòng
            mới tìm ra hàng mình cần; icon cho phép nhắm thẳng. */ ''}
      <div class="ai-hang ai-hang-doc">
        <span><span class="btn-icon ai-nhan-icon" data-icon="khoi"></span>Nhà cung cấp</span>
        <div class="ai-nha-luoi" id="aiNhaLuoi">${duLieu.nha.map((x) => `
          <button type="button" class="ai-nha${x.id === c.nhaId ? ' dang-chon' : ''}"
                  data-nha="${esc(x.id)}" aria-pressed="${x.id === c.nhaId}">
            <span class="btn-icon ai-nha-logo" data-icon="${esc(LOGO[x.id] || 'khoi')}"></span>
            <span class="ai-nha-ten">${esc(x.ten)}</span>
            ${x.coKhoa ? '<span class="ai-nha-cham" title="Đã có khoá"></span>' : ''}
          </button>`).join('')}</div>
      </div>

      ${/* ĐỊA CHỈ API. Nhà nào đã biết địa chỉ thì KHÔNG hỏi nữa — trước đây ô
            này để trống ngay đầu bảng, trông như bắt buộc phải điền, trong khi
            `goc(cfg, diaChiMacDinh)` vốn đã tự dùng mặc định khi để trống. Bắt
            người ta đi tra một địa chỉ mà app biết thừa là việc thừa.
            Nhà "tương thích" thì ngược lại: nó KHÔNG có mặc định nào (mỗi máy
            chủ một địa chỉ), nên ô ở lại đây và là bắt buộc. */ ''}
      <div class="ai-hang ai-hang-doc">
        <span><span class="btn-icon ai-nhan-icon" data-icon="song"></span>Địa chỉ Base URL</span>
        <input id="aiDiaChi" type="text" spellcheck="false"
               value="${esc(c.diaChi || n.diaChiMacDinh || '')}" placeholder="https://api.openai.com/v1 hoặc http://localhost:11434/v1">
        <span class="ai-goi-nho">Nhập endpoint OpenAI-compatible (Ollama, LM Studio, vLLM, 9Router, DeepSeek...).</span>
      </div>

      ${/* ⚠ "Đã cấu hình" nay là một DẤU TÍCH cạnh nhãn, không phải một câu
            riêng bên dưới. Nó là trạng thái của đúng ô này, mà một dòng chữ
            nguyên vẹn bên dưới thì nặng ngang một hàng mới.
            ⚠ Và ô nhập hiện DẤU SAO thay cho câu "Đã cấu hình — dán khoá mới":
            một ô `type=password` mà bên trong là chữ thường thì đọc ra "chưa
            nhập gì"; dãy chấm mới đọc ra "đang có khoá, gõ đè để thay". Khoá
            THẬT vẫn không bao giờ rời tiến trình chính — đây chỉ là mấy ký tự
            giả, xem `ipc/ai.js`. */ ''}
      <label class="ai-hang">
        <span><span class="btn-icon ai-nhan-icon" data-icon="khoa"></span>API Token (Key)${n.coKhoa
          ? '<span class="btn-icon ai-tich" data-icon="ok" title="Đã cấu hình"></span>' : ''}</span>
        <span class="ai-khoa">
          <input id="aiKhoa" type="password" autocomplete="off" spellcheck="false"
                 placeholder="${n.coKhoa ? 'Đã có key — dán key mới để đổi' : 'Dán API Token (sk-...)'}">
          ${n.coKhoa ? '<button type="button" class="ai-xoa" id="aiXoaKhoa">Xoá</button>' : ''}
        </span>
      </label>
      ${n.coKhoa ? '<div class="ai-ghi" style="color:var(--text-good,#2ecc71);"><b class="ai-chua">✓ Đã lưu token</b>. Dán token mới để thay thế hoặc bấm Xoá.</div>' : '<div class="ai-ghi"><b class="ai-chua">Chưa có token</b> — dán vào ô trên rồi bấm Lưu.</div>'}

      <label class="ai-hang">
        ${/* HUY HIỆU NHÀ ngay cạnh nhãn: danh sách model nay gộp cả mấy nhà,
              nên nhìn vào ô model phải biết ngay model đang chọn là của ai —
              không thì phải ngước lên dò xem thẻ nào đang sáng. */ ''}
        <span><span class="btn-icon ai-nhan-icon" data-icon="bolt"></span>Model
          <span class="ai-model-nha">
            <span class="btn-icon" data-icon="${esc(LOGO[c.nhaId] || 'khoi')}"></span>${esc(n.ten || '')}
          </span></span>
        ${/* ⚠ KHÔNG dùng `<datalist>` nữa. Nó do TRÌNH DUYỆT vẽ nên không đặt
              được trần chiều cao, không gom nhóm, không tìm, và với 113 model
              thì nó đổ một danh sách dài tràn ra ngoài cửa sổ app (chủ dự án
              chụp lại 19/09/2026). Bộ chọn tự vẽ bên dưới lo cả ba việc đó. */ ''}
        <span class="ai-model">
          <span class="ai-model-o">
            <input id="aiModel" type="text" spellcheck="false" autocomplete="off"
                   role="combobox" aria-expanded="false" aria-autocomplete="list"
                   value="${esc(c.model || '')}" placeholder="tên model">
            <div class="ai-model-ds" id="aiModelDs" hidden>
              <div class="ai-model-tim">
                <span class="ai-model-tim-icon" data-icon="tim"></span>
                <input id="aiModelTim" type="text" spellcheck="false" autocomplete="off"
                       placeholder="Tìm model...">
              </div>
              <div class="ai-model-ls" id="aiModelLs" role="listbox"></div>
            </div>
          </span>
          <button type="button" class="ai-nut-phu" id="aiTaiModel">Tải danh sách</button>
        </span>
      </label>

      <details class="ai-nangcao">
        <summary>Nâng cao</summary>
        <label class="ai-hang">
          <span><span class="btn-icon ai-nhan-icon" data-icon="mucdo"></span>Temperature</span>
          <input id="aiNhiet" type="number" min="0" max="2" step="0.1"
                 value="${c.temperature == null ? '' : esc(c.temperature)}" placeholder="mặc định của nhà">
        </label>
        <label class="ai-hang">
          <span><span class="btn-icon ai-nhan-icon" data-icon="cochu"></span>Max tokens</span>
          <input id="aiToken" type="number" min="0" max="200000" step="256"
                 value="${esc(c.maxTokens || 0)}" placeholder="0 = không giới hạn">
        </label>
        <label class="ai-hang">
          <span><span class="btn-icon ai-nhan-icon" data-icon="dongho"></span>Thời gian chờ (giây)</span>
          <input id="aiCho" type="number" min="0" max="3600" step="10"
                 value="${Math.round((c.hanMs || 0) / 1000)}" placeholder="0 = chờ đến khi xong">
        </label>
        <label class="ai-hang">
          <span><span class="btn-icon ai-nhan-icon" data-icon="hoantac"></span>Số vòng tối đa</span>
          <input id="aiVong" type="number" min="0" max="60" step="1"
                 value="${esc(c.tranVong || 0)}" placeholder="0 = mặc định (24)">
        </label>
        ${/* LỜI DẶN THÊM — ô đáng giá nhất trong mục này. Mọi thứ còn lại ở đây
              là số; cái này là thứ người dùng vốn phải gõ lại mỗi lượt (giọng
              văn, từ cấm, đơn vị tiền), gõ lại thì có lượt nhớ có lượt quên. */ ''}
        <label class="ai-hang ai-hang-doc">
          <span><span class="btn-icon ai-nhan-icon" data-icon="but"></span>Lời dặn thêm cho AI</span>
          <textarea id="aiLoiDan" rows="3" maxlength="2000"
            placeholder="Ví dụ: xưng hô thân mật, không dùng emoji, tiền luôn ghi bằng VNĐ…">${esc(c.loiDan || '')}</textarea>
          <span class="ai-goi-nho">Đi kèm <b>mọi</b> lượt AI, nên viết ngắn — dài bao nhiêu
            thì tốn thêm bấy nhiêu, nhân với số vòng.</span>
        </label>
      </details>

      <div class="ai-nut">
        <button type="button" class="ai-nut-chinh" id="aiLuu">Lưu</button>
        <button type="button" class="ai-nut-phu" id="aiThu">Kiểm tra</button>
      </div>
      <div class="ai-kq" id="aiKetQua" hidden></div>`;

    noi();
    if (window.__beeIcons) window.__beeIcons.apply(hop);
    datChoKhung();
  }

  /** Gom giá trị đang gõ trên form — dùng cho cả Lưu lẫn Kiểm tra. */
  /* ══ BỘ CHỌN MODEL ═══════════════════════════════════════════════════════
   *
   * Thay cho `<datalist>`. Ba việc mà datalist không làm được, và đều là thứ
   * người dùng vấp phải với danh sách 113 model:
   *   · TRẦN CHIỀU CAO — datalist đổ hết ra, dài quá thì tràn khỏi cửa sổ app;
   *   · TÌM — gõ để lọc, không phải cuộn tay qua trăm dòng;
   *   · GOM NHÓM theo nhà cung cấp — cùng một model hiện ba lần dưới ba tiền tố
   *     (`gpt-5.6-luna`, `openai/gpt-5.6-luna`, `bee/gpt-5.6-luna`), không gom
   *     thì nhìn như ba model khác nhau.
   *
   * ⚠ Ô nhập VẪN LÀ Ô NHẬP THẬT. Người ta còn dán thẳng id model mới chưa có
   * trong danh sách — biến nó thành ô chỉ-chọn là chặn mất đường đó.
   */
  /* ⚠ `$` trong tệp này là biến CỤC BỘ của `ve()` và `noi()` (đóng theo `hop`),
     không phải helper chung — khối này ở phạm vi mô-đun nên không thấy nó. Dùng
     bộ tra riêng, bám vào chính `hop`. Bản đầu gọi `$` thẳng: popup mở ra chỉ
     còn dòng "Không đọc được cấu hình: $ is not defined" (đo 19/09/2026). */
  const q = (s2) => (hop ? hop.querySelector(s2) : null);

  let dsModel = [];
  let iSang = -1;          // dòng đang sáng (bàn phím)
  /* ⚠ TỪ KHOÁ LỌC LÀ MỘT BIẾN RIÊNG, KHÔNG PHẢI GIÁ TRỊ Ô MODEL. Ô model luôn
     sẵn tên model đang dùng, nên nếu coi giá trị có sẵn là từ khoá thì vừa bấm
     "Tải danh sách" xong danh sách đã rỗng ngay — chỉ còn dòng "Không có model
     nào khớp", trong khi vừa báo tải được 113 model (đo 19/09/2026). Mở ra là
     xem HẾT; chỉ khi gõ vào ô Tìm (hoặc sửa ô model) mới bắt đầu lọc. */
  let tuKhoa = '';
  let vuaChon = false;   // chặn onfocus mở lại ngay sau khi chọn
  let dangNghe = false;  // đã gắn bộ nghe cuộn/bấm-ngoài chưa

  /** Tiền tố nhà cung cấp. Không có dấu `/` thì xếp vào nhóm chung cuối bảng. */
  const nhaCua = (id) => (id.includes('/') ? id.slice(0, id.indexOf('/')) : '');

  function locModel() {
    const tu = tuKhoa.trim().toLowerCase();
    if (!tu) return dsModel.slice();
    /* Lọc theo chuỗi con, không phải khớp đầu: người ta nhớ "luna" chứ ít khi
       nhớ cả tiền tố nhà cung cấp đứng trước nó.
       Tìm cả theo TÊN NHÀ: danh sách nay gộp mấy nhà, gõ "openai" để xem riêng
       model của một nhà là việc đầu tiên người ta thử. */
    return dsModel.filter((m) => m.id.toLowerCase().includes(tu)
      || tenNha(m.nha).toLowerCase().includes(tu)
      || m.nha.toLowerCase().includes(tu));
  }

  /** Xoá từ khoá và ô Tìm — dùng mỗi lần MỞ MỚI để lần nào cũng thấy đủ danh sách. */
  function datLaiTim() {
    tuKhoa = '';
    const t = q('#aiModelTim');
    if (t) t.value = '';
  }

  function veDsModel() {
    /* ⚠ GHI VÀO `#aiModelLs`, KHÔNG PHẢI `#aiModelDs`. Ô Tìm là con của
       `#aiModelDs`; ghi đè `innerHTML` của hộp là xoá luôn ô Tìm ngay giữa lúc
       người dùng đang gõ vào đó. */
    const hop = q('#aiModelLs');
    if (!hop) return;
    const ds = locModel();
    if (!ds.length) {
      hop.innerHTML = '<div class="ai-model-trong">Không có model nào khớp</div>';
      iSang = -1;
      return;
    }
    /* Gom theo NHÀ CUNG CẤP. Giữ THỨ TỰ máy chủ trả về trong từng nhóm — đó
       là thứ tự nhà cung cấp xếp, thường model mới/khuyên dùng đứng trước. Chỉ
       gom, không sắp lại. */
    const nhom = new Map();
    for (const m of ds) {
      if (!nhom.has(m.nha)) nhom.set(m.nha, []);
      nhom.get(m.nha).push(m);
    }
    /* NHÀ ĐANG DÙNG LÊN ĐẦU, còn lại theo thứ tự thẻ nhà cung cấp ở trên. Xếp
       theo thứ tự máy chủ trả về thì mỗi lần tải lại danh sách nhóm nhảy chỗ
       khác; theo thứ tự thẻ thì mắt tìm ở đâu cũng đúng chỗ đó. */
    const dangDung = duLieu.cauHinh.nhaId;
    const thuTu = duLieu.nha.map((x) => x.id);
    const khoa = [...nhom.keys()].sort((a, b) => {
      if (a === dangDung) return -1;
      if (b === dangDung) return 1;
      return thuTu.indexOf(a) - thuTu.indexOf(b);
    });
    let i = 0;
    hop.innerHTML = khoa.map((k) => {
      const dong = nhom.get(k).map((m) => {
        /* Nhà kiểu tổng hợp (OpenRouter, máy chủ tương thích) trả id mang sẵn
           tiền tố `hang/ten`. Cắt tiền tố cho tên ngắn lại, rồi trả nó về làm
           một nhãn nhỏ bên phải — mất hẳn thì hai model cùng tên của hai hãng
           khác nhau nhìn y như nhau. */
        const tien = nhaCua(m.id);
        const html = `<div class="ai-model-dong" role="option" data-i="${i}"`
          + ` data-m="${esc(m.id)}" data-mnha="${esc(m.nha)}">`
          + `<span>${esc(tien ? m.id.slice(tien.length + 1) : m.id)}</span>`
          + (tien ? `<em class="ai-model-tien">${esc(tien)}</em>` : '')
          + '</div>';
        i += 1;
        return html;
      }).join('');
      return '<div class="ai-model-nhom"><span class="ai-model-nhom-ten">'
        + `<span class="btn-icon ai-model-nhom-logo" data-icon="${esc(LOGO[k] || 'khoi')}"></span>`
        + `${esc(tenNha(k))}</span><em>${nhom.get(k).length}</em></div>${dong}`;
    }).join('');
    /* ⚠ Bơm icon lại sau MỖI lượt vẽ — `data-icon` chỉ là chỗ đánh dấu, mà
       đầu nhóm vừa dựng lại từ chuỗi nên logo còn là vỏ rỗng. */
    if (window.__beeIcons) window.__beeIcons.apply(hop);
    iSang = -1;
  }

  /* Khoảng cách tối thiểu để một hộp còn đáng mở ra — dưới mức này thì lật lên
     trên. Đúng bằng chừng bốn dòng cộng một đầu nhóm. */
  const CHO_TOI_THIEU = 180;
  const LE = 12;     // chừa mép cửa sổ
  const KHE = 4;     // khe giữa ô nhập và hộp, bằng --sp-4
  const CAO_TOI_DA = 360;

  /**
   * Đặt hộp theo vị trí ô nhập.
   *
   * ⚠ HỘP PHẢI NẰM NGOÀI `.ai-than`. Thân popup có `overflow-y: auto`, mà một
   * khối con dù `position: absolute` vẫn bị khối cuộn cắt cụt — ảnh chủ dự án
   * gửi 19/09/2026 cho thấy danh sách đứt ngang ở mép dưới popup, mất hẳn phần
   * còn lại. Nâng hộp lên thẳng `.ai-hop` (lớp phủ `position: fixed` trùm cả
   * màn hình) rồi tự tính toạ độ: từ đó nó chỉ còn bị CỬA SỔ bó, đúng như yêu
   * cầu "chỉ trong khoảng app và không bị overflow".
   */
  function datChoDs() {
    const p = q('#aiModelDs');
    const o = q('#aiModel');
    if (!p || !o || p.hidden) return;
    const r = o.getBoundingClientRect();
    const duoi = window.innerHeight - r.bottom - LE;
    const tren = r.top - LE;
    /* Dưới hết chỗ thì lật lên trên — nhưng chỉ khi TRÊN rộng hơn, chứ lật vào
       chỗ còn chật hơn thì chẳng được gì. */
    const lat = duoi < CHO_TOI_THIEU && tren > duoi;
    const cho = Math.max(120, Math.floor(lat ? tren : duoi));
    p.style.left = Math.round(r.left) + 'px';
    p.style.width = Math.round(r.width) + 'px';
    p.style.maxHeight = Math.min(CAO_TOI_DA, cho) + 'px';
    if (lat) {
      p.style.top = 'auto';
      p.style.bottom = Math.round(window.innerHeight - r.top + KHE) + 'px';
    } else {
      p.style.bottom = 'auto';
      p.style.top = Math.round(r.bottom + KHE) + 'px';
    }
  }

  /* Bấm/đưa con trỏ ra ngoài thì khép hộp.
     ⚠ KHÔNG DÙNG `onblur` CỦA Ô MODEL NỮA. Ô Tìm nằm trong hộp, nên bấm vào nó
     là ô model `blur` — lối cũ sẽ khép hộp đúng lúc người dùng vừa định gõ tìm.
     Xét theo VÙNG (hộp + ô model) mới đúng. */
  const trongVung = (t) => {
    const p = q('#aiModelDs');
    const o = q('#aiModel');
    return (p && p.contains(t)) || t === o;
  };
  const bamNgoai = (e) => { if (!trongVung(e.target)) dongDsModel(); };
  const cuonLai = () => datChoDs();

  function nghe(bat) {
    if (bat === dangNghe) return;
    dangNghe = bat;
    const f = bat ? 'addEventListener' : 'removeEventListener';
    /* `true` = pha bắt: cuộn bên trong `.ai-than` không nổi bọt lên `window`,
       không bắt ở pha này thì hộp đứng yên còn ô nhập trôi đi. */
    window[f]('scroll', cuonLai, true);
    window[f]('resize', cuonLai);
    document[f]('pointerdown', bamNgoai, true);
    document[f]('focusin', bamNgoai, true);
  }

  function moDsModel() {
    const p = q('#aiModelDs');
    const o = q('#aiModel');
    if (!p || !o || !dsModel.length) return;
    if (p.parentNode !== hop) hop.appendChild(p);   // thoát khỏi khối cuộn
    p.hidden = false;
    o.setAttribute('aria-expanded', 'true');
    datChoDs();
    nghe(true);
  }
  function dongDsModel() {
    const p = q('#aiModelDs');
    const o = q('#aiModel');
    if (p) p.hidden = true;
    if (o) o.setAttribute('aria-expanded', 'false');
    nghe(false);
    iSang = -1;
  }

  function sang(n) {
    const hop = q('#aiModelLs');
    if (!hop) return;
    const dong = [...hop.querySelectorAll('.ai-model-dong')];
    if (!dong.length) return;
    iSang = (n + dong.length) % dong.length;
    dong.forEach((d, k) => d.classList.toggle('dang-sang', k === iSang));
    /* `block: 'nearest'` chứ không `center`: cuộn giật cả hộp mỗi lần bấm mũi
       tên thì mắt mất dấu chỗ đang đứng. */
    dong[iSang].scrollIntoView({ block: 'nearest' });
  }

  /**
   * @param {{nha: string, id: string}|string} m
   *
   * Model của nhà KHÁC thì đổi nhà luôn, và ghi CẢ HAI trong MỘT lượt lưu.
   * Ghi rời hai lượt là có một khoảnh khắc nhà mới đi với model cũ — đúng cái
   * trạng thái vừa phải chữa ở `ipc/ai.js`.
   */
  async function chonModel(m) {
    const o = q('#aiModel');
    if (!o) return;
    const id = typeof m === 'string' ? m : m.id;
    const nhaM = typeof m === 'string' ? '' : m.nha;
    if (nhaM && nhaM !== duLieu.cauHinh.nhaId) {
      dongDsModel();
      const r = await api.ai.save({ nhaId: nhaM, model: id });
      if (!r || !r.ok) { bao((r && r.loi) || 'Không đổi được nhà cung cấp.', 'xau'); return; }
      duLieu = { cauHinh: r.cauHinh, nha: r.nha };
      /* `ve()` dựng lại cả thân popup VÀ nối lại trình xử lý (`noi()` ở cuối
         `ve()`), nên không phải gắn tay gì thêm. `dsModel` là biến của module
         nên danh sách vừa tải vẫn còn nguyên sau lượt vẽ. */
      ve();
      bao(`Đã chuyển sang ${tenNha(nhaM)} · ${id}`, 'tot');
      return;
    }
    o.value = id;
    dongDsModel();
    /* ⚠ TRẢ CON TRỎ VỀ Ô MÀ KHÔNG MỞ LẠI HỘP. `focus()` bắn `onfocus`, mà
       `onfocus` lại mở hộp — chọn xong hộp bung ra ngay, nhìn như cú bấm không
       ăn (đo 19/09/2026: chọn xong `hidden` vẫn là false). Cờ này chặn đúng một
       nhịp đó rồi tự tắt. */
    vuaChon = true;
    o.focus();
    setTimeout(() => { vuaChon = false; }, 0);
  }

  /** Mở hộp ở trạng thái SẠCH: không từ khoá, thấy đủ danh sách. */
  function moMoi(timSang) {
    if (!dsModel.length) return;
    datLaiTim();
    veDsModel();
    moDsModel();
    if (timSang) { const t = q('#aiModelTim'); if (t) t.focus(); }
  }

  function noiOModel() {
    const o = q('#aiModel');
    const hop = q('#aiModelDs');
    const ls = q('#aiModelLs');
    const tim = q('#aiModelTim');
    if (!o || !hop || !ls || !tim) return;

    /** Phím đi lại dùng chung cho ô model và ô Tìm. */
    const phim = (e) => {
      if (hop.hidden) {
        if (e.key === 'ArrowDown' && dsModel.length) { e.preventDefault(); moMoi(false); sang(0); }
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); sang(iSang + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sang(iSang - 1); }
      else if (e.key === 'Enter' && iSang >= 0) {
        e.preventDefault();
        const d = ls.querySelectorAll('.ai-model-dong')[iSang];
        if (d) chonModel({ nha: d.dataset.mnha, id: d.dataset.m });
      } else if (e.key === 'Escape') {
        /* ⚠ CHẶN nổi bọt: popup Cài đặt AI cũng nghe Escape để tự đóng. Không
           chặn thì một cú Escape đóng luôn cả popup, trong khi người dùng chỉ
           muốn khép cái danh sách vừa bung ra. */
        e.preventDefault(); e.stopPropagation();
        dongDsModel();
        o.focus();
      }
    };

    /* Sửa thẳng ô model cũng lọc — và soi lại vào ô Tìm để chỉ có MỘT chỗ nói
       cho người dùng biết danh sách đang bị lọc bằng gì. */
    o.oninput = () => {
      tuKhoa = o.value;
      tim.value = o.value;
      veDsModel(); moDsModel();
    };
    o.onfocus = () => { if (!vuaChon) moMoi(false); };
    /* ⚠ CẦN CẢ `click`, KHÔNG CHỈ `focus`. Chọn xong một model thì con trỏ ở lại
       ô này, nên cú bấm tiếp theo vào chính nó KHÔNG bắn `focus` nữa — chỉ nghe
       `focus` thì người dùng phải bấm ra chỗ khác rồi bấm về mới mở lại được
       danh sách (đo 19/09/2026). */
    o.onclick = () => { if (hop.hidden) moMoi(false); };
    o.onkeydown = phim;

    tim.oninput = () => {
      tuKhoa = tim.value;
      veDsModel();
      /* Lọc xong hộp thấp đi — đặt lại chỗ, nếu không thì bản lật-lên-trên treo
         lơ lửng cách ô nhập một khoảng trống. */
      datChoDs();
    };
    tim.onkeydown = phim;

    ls.onmousedown = (e) => {
      const d = e.target.closest('.ai-model-dong');
      /* `mousedown` chứ không `click`: con trỏ rời ô nhập trước khi `click` kịp
         bắn, cú click rơi vào chỗ trống. */
      if (d) { e.preventDefault(); chonModel({ nha: d.dataset.mnha, id: d.dataset.m }); }
    };
  }

  function dangGo() {
    const $ = (s) => hop.querySelector(s);
    const nhiet = $('#aiNhiet').value.trim();
    return {
      /* Nhà đang chọn đọc từ CẤU HÌNH, không từ DOM: bấm thẻ là đã lưu và vẽ
         lại ngay (xem `noi`), nên `duLieu.cauHinh.nhaId` luôn là nguồn đúng. */
      nhaId: duLieu.cauHinh.nhaId,
      diaChi: $('#aiDiaChi').value.trim(),
      model: $('#aiModel').value.trim(),
      temperature: nhiet === '' ? null : Number(nhiet),
      /* 0 = KHÔNG GIỚI HẠN ở cả hai ô — xem `MAC_DINH` trong `ipc/ai.js`.
         ⚠ ĐỪNG viết `Number(x) || <mặc định>`: số 0 là giá trị HỢP LỆ và có
         nghĩa ở đây, mà `||` nuốt mất số 0 rồi thay bằng mặc định — người dùng
         gõ 0 xong lưu lại thấy 4096. */
      maxTokens: Math.max(0, Number($('#aiToken').value) || 0),
      hanMs: Math.max(0, Number($('#aiCho').value) || 0) * 1000,
      tranVong: Math.max(0, Number($('#aiVong').value) || 0),
      /* ⚠ KÈM KHOÁ ĐANG GÕ. Không kèm thì "Tải danh sách" / "Kiểm tra" chạy
         bằng khoá ĐÃ LƯU: người mới dán khoá vào ô rồi bấm thử là nhận "Chưa
         có API key" trong khi khoá hiện sờ sờ trong ô, và tưởng khoá sai. Khoá
         chỉ đi LÊN main cho đúng lượt gọi đó, không lưu, không quay xuống. */
      ...($('#aiKhoa') && $('#aiKhoa').value.trim() ? { khoa: $('#aiKhoa').value.trim() } : {}),
      loiDan: $('#aiLoiDan').value.trim(),
    };
  }

  function noi() {
    const $ = (s) => hop.querySelector(s);

    /* Đổi nhà là VẼ LẠI ngay: địa chỉ mặc định, trạng thái khoá và nút Xoá đều
       theo từng nhà. Lưu trước rồi vẽ, để lần mở sau nhớ đúng nhà đang chọn. */
    for (const b of hop.querySelectorAll('[data-nha]')) {
      b.onclick = async () => {
        if (b.classList.contains('dang-chon')) return;
        const r = await api.ai.save({ nhaId: b.dataset.nha });
        if (r && r.ok) { duLieu = { cauHinh: r.cauHinh, nha: r.nha }; ve(); baoDaLuu(b.dataset.nha); }
      };
    }

    /* "Đổi" địa chỉ: mở ô nhập ra, giấu dòng chữ. Không vẽ lại cả bảng — vẽ lại
       là mất cả mấy ô đang gõ dở bên dưới. */
    const doiDc = $('#aiDoiDiaChi');
    if (doiDc) {
      doiDc.onclick = () => {
        const o = $('#aiDiaChi');
        o.hidden = false;
        o.value = o.value || o.placeholder;
        doiDc.closest('.ai-diachi-san').hidden = true;
        o.focus();
        o.select();
      };
    }

    $('#aiLuu').onclick = async () => {
      const nut = $('#aiLuu');
      nut.disabled = true;
      bao('Đang lưu…');
      const patch = dangGo();
      const k = $('#aiKhoa').value.trim();
      if (k) patch.khoa = k;
      const r = await api.ai.save(patch);
      nut.disabled = false;
      if (!r || !r.ok) { bao((r && r.loi) || 'Không lưu được.', 'xau'); return; }
      duLieu = { cauHinh: r.cauHinh, nha: r.nha };
      ve();
      bao('Đã lưu.', 'tot');
      baoDaLuu(patch.nhaId);
    };

    const xoa = $('#aiXoaKhoa');
    if (xoa) {
      xoa.onclick = async () => {
        /* ⚠ HỎI LẠI. Khoá đã mã hoá trong máy và KHÔNG hiện lại được, nên xoá
           nhầm là phải đi lấy lại khoá từ trang nhà cung cấp — không có đường
           hoàn tác nào. */
        const dong = await hoiXacNhan({
          tieuDe: 'Xoá API key?',
          chu: [
            `Khoá của "${(nhaDangChon() || {}).ten || ''}" sẽ bị xoá khỏi máy.`,
            'Khoá đã mã hoá và không hiện lại được, nên xoá rồi thì phải dán khoá mới.',
            'Không lấy lại được.',
          ],
          nutDong: 'Xoá khoá',
          nguyHiem: true,
        });
        if (!dong) return;
        const r = await api.ai.save({ nhaId: duLieu.cauHinh.nhaId, xoaKhoa: true });
        if (r && r.ok) { duLieu = { cauHinh: r.cauHinh, nha: r.nha }; ve(); bao('Đã xoá khoá.', 'tot'); baoDaLuu(duLieu.cauHinh.nhaId); }
      };
    }

    $('#aiTaiModel').onclick = async () => {
      const nut = $('#aiTaiModel');
      nut.disabled = true;
      const goc = dangGo();
      /* HỎI MỌI NHÀ ĐÃ CÓ KHOÁ, không riêng nhà đang mở — danh sách gộp chung
         thì phải gom đủ mới gộp được. Nhà đang mở luôn nằm trong danh sách kể
         cả khi chưa lưu khoá, vì khoá vừa gõ trong ô cũng thử được.
         ⚠ Khoá đang gõ CHỈ kèm cho nhà đang mở. Gửi nó sang nhà khác là dùng
         khoá của Anthropic đi hỏi OpenAI — chắc chắn hỏng, mà câu lỗi lại đổ
         cho nhà kia. Nhà khác đi bằng kho khoá của chính nó. */
      const dsNha = duLieu.nha.filter((x) => x.coKhoa || x.id === goc.nhaId);
      bao(`Đang hỏi danh sách model của ${dsNha.length} nhà…`);
      /* ⚠ HỎI SONG SONG, đừng `await` trong vòng lặp. Mỗi lượt hỏi có hạn 60
         giây (`ai:models` tự đặt), nên hỏi lần lượt năm nhà là nút khoá cứng
         tới năm phút mà không có đường huỷ — tệ hơn hẳn bản một nhà trước đây.
         Năm lượt gọi này độc lập nhau hoàn toàn, chạy cùng lúc thì tổng thời
         gian bằng nhà CHẬM NHẤT chứ không phải tổng.
         `Promise.all` giữ nguyên thứ tự mảng, nên thứ tự nhóm vẫn định trước
         được, không phụ thuộc nhà nào trả lời trước. */
      const ketQua = await Promise.all(dsNha.map((x) =>
        api.ai.models(x.id === goc.nhaId ? goc : { nhaId: x.id })
          .then((r) => ({ x, r }))
          .catch((e) => ({ x, r: { ok: false, loi: (e && e.message) || String(e) } }))));
      const gom = [];
      const hong = [];
      for (const { x, r } of ketQua) {
        if (r && r.ok) {
          const list = (r.model || []).map((m) => {
            const id = typeof m === 'string' ? m : (m && m.id ? String(m.id) : String(m));
            return { nha: x.id, id };
          });
          gom.push(...list);
        } else {
          hong.push(`${x.ten}: ${(r && r.loi) || 'không lấy được'}`);
        }
      }
      nut.disabled = false;
      if (!gom.length) { bao(hong.join(' · ') || 'Không lấy được danh sách.', 'xau'); return; }
      dsModel = gom;
      /* Bung hộp và ĐẶT CON TRỎ VÀO Ô TÌM luôn: vừa tải trăm mấy model thì việc
         tiếp theo gần như chắc chắn là đi tìm một cái. */
      moMoi(true);
      const soNha = new Set(gom.map((m) => m.nha)).size;
      bao(`Có ${gom.length} model từ ${soNha} nhà — gõ để tìm, bấm để chọn.`
        + (hong.length ? ` Bỏ qua: ${hong.join(' · ')}` : ''), hong.length ? 'xau' : 'tot');
    };
    noiOModel();

    $('#aiThu').onclick = async () => {
      const nut = $('#aiThu');
      nut.disabled = true;
      bao('Đang thử một lượt hỏi…');
      const r = await api.ai.test(dangGo());
      nut.disabled = false;
      if (!r || !r.ok) { bao((r && r.loi) || 'Không kết nối được.', 'xau'); return; }
      const tre = r.treMs || r.treNhipDau || 0;
      bao(`Kết nối tốt · ${r.nha} · ${r.model} · ${tre} ms`
        + ` · Phản hồi: "${r.traLoi || 'OK'}"`, 'tot');
    };
  }

  /**
   * Chế độ NEO: khung đứng sát nút đã mở nó (dưới ô nhập ở đáy cột → bật LÊN
   * TRÊN nút; nút ở nửa trên → bật xuống), kẹp trong cửa sổ, cao theo chỗ thật
   * còn lại. Lớp nền vẫn còn (bấm ra ngoài là đóng) nhưng trong suốt.
   */
  function datChoKhung() {
    const neo = tuyChon.neo;
    const k = hop && hop.querySelector('.ai-khung');
    if (!neo || !k || !neo.isConnected) return;
    const r = neo.getBoundingClientRect();
    const le = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rong = Math.min(tuyChon.chiKhoa ? 420 : 560, vw - 2 * le);
    const tren = r.top - le - 6;
    const duoi = vh - r.bottom - le - 6;
    const lenTren = tren > duoi;
    const cao = Math.max(220, Math.floor(lenTren ? tren : duoi));
    k.style.width = `${rong}px`;
    k.style.maxHeight = `${cao}px`;
    k.style.left = `${Math.round(Math.max(le, Math.min(r.left, vw - rong - le)))}px`;
    /* Kẹp trong cửa sổ — nút có thể đang nằm sát/ngoài mép (bố cục hẹp, trang cuộn). */
    const caoThat = Math.min(k.offsetHeight || cao, cao);
    if (lenTren) {
      const day = Math.min(r.top - 6, vh - le); // mép dưới khung: sát trên nút, không quá đáy cửa sổ
      k.style.bottom = 'auto';
      k.style.top = `${Math.round(Math.max(le, day - caoThat))}px`;
    } else {
      k.style.bottom = 'auto';
      k.style.top = `${Math.round(Math.max(le, Math.min(r.bottom + 6, vh - le - caoThat)))}px`;
    }
  }

  /**
   * @param {object} [o]
   *  - neo     phần tử nút đã mở bảng → bảng bật lên cạnh nút (không có = hộp giữa màn)
   *  - chiKhoa [id nhà] → chế độ CHỈ KHOÁ (tab AI agent)
   *  - nha     nhà xem trước trong chế độ chỉ khoá
   *  - tieuDe  chữ trên đầu khung
   */
  async function mo(o = {}) {
    if (hop) {
      /* Bấm lại đúng nút đã mở = đóng (như mọi menu). Mở từ chỗ khác = mở lại ở đó. */
      const cung = o.neo && o.neo === tuyChon.neo && !!o.chiKhoa === !!tuyChon.chiKhoa;
      dong();
      if (cung) return;
    }
    // Trong Robonew Studio: LUÔN mở bảng Cài đặt AI đầy đủ (Base URL, Token, Model, Test)
    tuyChon = { ...o, chiKhoa: null };
    nhaXem = o.nha || null;
    const tieuDe = o.tieuDe || 'Cài đặt AI (Custom LLM Endpoint)';
    hop = document.createElement('div');
    hop.className = `ai-hop${tuyChon.neo ? ' ai-hop-neo' : ''}`;
    hop.id = 'aiCaiDat';
    hop.innerHTML = '<div class="ai-nen" data-dong></div>'
      + `<div class="ai-khung" role="dialog" aria-modal="true" aria-label="${esc(tieuDe)}">`
      + `<div class="ai-dau"><span class="btn-icon" data-icon="bee"></span><strong>${esc(tieuDe)}</strong>`
      + '<button class="ai-x" type="button" data-dong aria-label="Đóng">×</button></div>'
      + '<div class="ai-than"></div></div>';
    document.body.appendChild(hop);
    hop.querySelectorAll('[data-dong]').forEach((x) => { x.onclick = dong; });
    document.addEventListener('keydown', phim, true);
    if (tuyChon.neo) {
      /* Nút đang khuất (cột cuộn / bố cục hẹp) thì đưa nó vào tầm nhìn trước. */
      try { tuyChon.neo.scrollIntoView({ block: 'nearest' }); } catch { /* bỏ qua */ }
      window.addEventListener('resize', datChoKhung);
      datChoKhung();
    }

    hop.querySelector('.ai-than').innerHTML = '<div class="ai-cho">Đang đọc cấu hình…</div>';
    try {
      const c = await api.ai.config();
      duLieu = { cauHinh: c.cauHinh || {}, nha: c.nha || [] };
      ve();
    } catch (e) {
      hop.querySelector('.ai-than').innerHTML =
        `<div class="ai-cho">Không đọc được cấu hình: ${esc((e && e.message) || e)}</div>`;
    }
  }

  window.__beeAI = { mo, dong, dangMo: () => !!hop };
})();
