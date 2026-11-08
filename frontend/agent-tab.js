'use strict';
/**
 * TAB "AI AGENT" ở cột trái — chat với Codex (gói ChatGPT) hoặc Claude (khoá API /
 * Beeknoee Platform) điều khiển Studio, giống màn "Choose your agent" của ChatCut.
 * Lõi ở `src/agentChat/` (tiến trình chính), cầu nối `window.beeknoee.agentChat`.
 *
 * DÙNG LẠI khung chat của tab "Tạo bằng AI" cũ (đã gỡ 16/10/2026 — kiểu dáng còn ở `css/ai-tao.css`): bong
 * bóng `.ait-tin-*`, khối việc gộp `.agt-nhom` (css/agent-tab.css), thanh nhập `.ait-thanh`, bộ vẽ markdown
 * `window.__beeVeMarkdown`, bộ chuyển tab `window.__beeMoTab` (cot-tab.js
 * vốn đã ẩn/hiện mọi `.rl-pane` theo `data-pane`).
 *
 * ⚠ MỌI CHỮ DO AI VIẾT đi qua `textContent` (hoặc `__beeVeMarkdown`, cũng chỉ dựng
 * bằng textContent) — KHÔNG BAO GIỜ `innerHTML`: câu trả lời có thể mang nguyên
 * văn nội dung deck hay trang web, tức là chữ không tin được.
 */
(function () {
  const pane = document.getElementById('paneAgent');
  const C = window.beeknoee && window.beeknoee.agentChat;
  if (!pane) return;
  if (!C) { pane.textContent = 'Không nối được với tiến trình chính. Mở lại app.'; return; }

  const tao = (the, lop, chu) => {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };
  const icon = (ten, lop = '') => { const s = tao('span', `btn-icon ${lop}`.trim()); s.dataset.icon = ten; return s; };
  const veIcon = (goc) => { if (window.__beeIcons) window.__beeIcons.apply(goc); };

  // ── khung (chỉ chữ cố định của app — không có chữ của AI ở đây) ─────────
  pane.innerHTML = `
    <div class="ait ait-doc-chat agt">
      <div class="agt-dau">
        <span class="agt-tt" data-tt></span>
        <button type="button" class="agt-nut" data-moi title="Bắt đầu cuộc chat mới">Chat mới</button>
      </div>
      <div class="agt-bao" data-bao hidden></div>
      <div class="ait-console" data-console></div>
      <div class="ait-chat" data-chat>
        <div class="agt-soan">
          <div class="agt-anh" data-anh hidden></div>
          <textarea data-chu rows="1" placeholder="Nhắn tin cho Beeknoee..."
            aria-label="Nhắn tin cho AI agent (Enter gửi, Shift+Enter xuống dòng)"></textarea>
          <div class="agt-soan-duoi">
            <button type="button" class="ait-thanh-gim" data-gim title="Đính kèm ảnh" aria-label="Đính kèm ảnh">
              <span class="btn-icon" data-icon="gim"></span>
            </button>
            <input type="file" data-tep hidden multiple accept="image/png,image/jpeg,image/webp,image/gif">
            <button type="button" class="agt-mo-menu" data-mo-menu aria-haspopup="menu" aria-expanded="false"
              title="Chọn AI agent, model, mức suy nghĩ, quyền">
              <span class="btn-icon agt-mo-menu-icon" data-icon-agent></span>
              <span class="agt-mo-menu-ten" data-nhan-agent></span>
              <span class="agt-mo-menu-phu" data-nhan-phu></span>
              <span class="btn-icon agt-mo-menu-xuong" data-icon="xuong"></span>
            </button>
            <span class="agt-gian"></span>
            <button type="button" class="ait-thanh-gui" data-gui title="Gửi" aria-label="Gửi">
              <span class="btn-icon" data-icon="gui"></span>
              <span class="ait-thanh-vuong" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  veIcon(pane);

  const $ = (sel) => pane.querySelector(sel);
  const oTt = $('[data-tt]');
  const oBao = $('[data-bao]');
  const bang = $('[data-console]');
  const oChu = $('[data-chu]');
  const nutGui = $('[data-gui]');
  const nutGim = $('[data-gim]');
  const oTep = $('[data-tep]');
  const oAnh = $('[data-anh]');
  const nutMenu = $('[data-mo-menu]');
  const oIconAgent = $('[data-icon-agent]');
  const oNhanAgent = $('[data-nhan-agent]');
  const oNhanPhu = $('[data-nhan-phu]');

  /* Giới hạn ảnh — KHỚP với chốt ở tiến trình chính (agentChat/index.js, chat:gui). */
  const LOAI_ANH = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const TOI_DA_ANH = 4;
  const CO_ANH = 5 * 1024 * 1024;

  const TT = {
    dsDongCo: [],
    dongCo: null,
    sessionId: null,
    dangChay: false,
    luot: null, // { dongChu, chu, tatCa, nhom, buoc: Map } — xem luotMoi
    anh: [], // [{ mimeType, data(base64), url(data:) }]
    cauHinh: [], // configOptions của phiên (ACP): model / thought_level / mode…
    /* THẾ HỆ của màn chat: tăng mỗi lần mở phiên mới / đổi agent / đăng xuất / mất kết nối. Mọi xử lý bất đồng bộ
       (gửi tin, mở phiên, đăng nhập, đổi cài đặt) so lại sau `await` — khác là kết quả của màn CŨ, bỏ. Trước
       24/10/2026 kết quả về muộn đè lên màn hiện tại: "Chat mới" giữa lượt thì lượt cũ xong mở lại nút Gửi giữa lượt
       mới, cắt đôi bong bóng chữ, ghi "Lỗi…" vào chat mới; đăng nhập Codex xong mở lại phiên cho Claude đang chat. */
    theHe: 0,
    /* Hội thoại ĐANG HIỆN, dạng chữ: [{ vai: 'toi' | 'ai', chu }]. Đổi agent (Codex ↔ Claude) phải mở phiên mới —
       phiên ACP không chuyển được giữa hai agent — nên tin đầu tiên gửi phiên mới mang kèm bản tóm này làm bối
       cảnh (`noiTiep`). Trước 24/10/2026 đổi agent là xoá trắng màn chat, mất luôn việc đang làm dở. */
    lichSu: [],
    noiTiep: false,
  };

  /* Khung tab theo màn hội thoại của ai-tao.css: pane thành flex dọc, bảng tin ăn hết chỗ. */
  pane.classList.add('rl-pane-chat');

  // ── tiện ích ──────────────────────────────────────────────────────────
  const oDay = () => bang.scrollHeight - bang.scrollTop - bang.clientHeight < 40;
  const xuongDay = () => { bang.scrollTop = bang.scrollHeight; };

  function bao(chu, loai = 'info', them) {
    oBao.textContent = '';
    oBao.className = `agt-bao agt-bao-${loai}`;
    if (!chu) { oBao.hidden = true; return; }
    oBao.appendChild(tao('div', '', chu));
    if (them) oBao.appendChild(them);
    oBao.hidden = false;
  }

  // ── lịch sử chat (giữ qua lần đổi agent / model) ─────────────────────────
  /** Xoá trắng màn chat — chỉ khi người dùng muốn thế ("Chat mới", đăng xuất). */
  function xoaChat() {
    bang.textContent = '';
    TT.lichSu = [];
    TT.noiTiep = false;
  }
  /** Vạch ngăn giữa hội thoại: "Đã chuyển sang Claude", "Model: GPT-5.5"… Màn trống thì khỏi vạch. Đổi liền hai
      lần cùng một thứ (Codex → Claude → Codex mà chưa nhắn gì) thì sửa vạch cuối, không chồng thêm vạch. */
  function vachChia(chu, loai) {
    if (!bang.childElementCount) return;
    const cuoi = bang.lastElementChild;
    if (cuoi.classList.contains('agt-chia') && cuoi.dataset.loai === loai) { cuoi.firstChild.textContent = chu; return; }
    const v = tao('div', 'agt-chia');
    v.dataset.loai = loai;
    v.appendChild(tao('span', '', chu));
    bang.appendChild(v);
    xuongDay();
  }
  /** Cất chữ AI của lượt vào `lichSu` (một lần) + khép mọi bước còn quay. Gọi khi hết lượt hoặc bỏ dở lượt. */
  function luuLuot(L) {
    if (!L) return;
    xongLuot(L);
    if (L.daLuu) return;
    L.daLuu = true;
    if (L.tatCa.trim()) TT.lichSu.push({ vai: 'ai', chu: L.tatCa.trim() });
  }
  /* Bối cảnh mang sang agent mới: các tin GẦN NHẤT, mỗi tin tối đa 2 000 ký tự, cả khối tối đa 12 000 — chừa chỗ
     cho tin của người dùng dưới trần 20 000 ký tự mỗi tin (agentChat/index.js, chat:gui). */
  function ganBoiCanh(chu) {
    const ngan = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
    const tran = Math.max(0, Math.min(12_000, 19_000 - chu.length));
    const dong = [];
    let dai = 0;
    for (let i = TT.lichSu.length - 1; i >= 0; i -= 1) {
      const m = TT.lichSu[i];
      const s = `${m.vai === 'toi' ? 'Người dùng' : 'AI'}: ${ngan(m.chu, 2000)}`;
      if (dai + s.length > tran) break;
      dong.unshift(s);
      dai += s.length + 2;
    }
    if (!dong.length) return chu;
    return '[Bối cảnh: người dùng vừa đổi AI agent trong Beeknoee Studio. Dưới đây là cuộc trò chuyện trước đó với '
      + 'agent cũ — đọc để làm tiếp cho liền mạch, không cần nhắc lại hay trả lời riêng phần này.]\n\n'
      + `${dong.join('\n\n')}\n\n[Hết bối cảnh — tin mới của người dùng ở dưới]\n\n${chu || 'Xem ảnh đính kèm.'}`;
  }

  /** Trạng thái trên hàng đầu; `quay` = có vòng tròn đang chạy (đăng nhập ngầm, khởi động). */
  function datTt(chu, quay = false) {
    oTt.textContent = '';
    if (quay) oTt.appendChild(tao('span', 'agt-quay'));
    oTt.appendChild(document.createTextNode(chu));
  }

  function datBan(ban) {
    TT.dangChay = ban;
    nutGui.classList.toggle('dang-chay', ban);
    nutGui.title = ban ? 'Dừng' : 'Gửi';
    nutGui.setAttribute('aria-label', nutGui.title);
    oChu.disabled = !TT.sessionId;
    nutGim.disabled = !TT.sessionId || ban;
  }

  // ── ảnh đính kèm ──────────────────────────────────────────────────────
  function veAnh() {
    oAnh.textContent = '';
    oAnh.hidden = !TT.anh.length;
    TT.anh.forEach((a, i) => {
      const o = tao('span', 'agt-anh-o');
      const img = tao('img');
      img.src = a.url;
      img.alt = '';
      const bo = tao('button', 'agt-anh-bo', '×');
      bo.type = 'button';
      bo.title = 'Bỏ ảnh này';
      bo.setAttribute('aria-label', bo.title);
      bo.onclick = () => { TT.anh.splice(i, 1); veAnh(); };
      o.append(img, bo);
      oAnh.appendChild(o);
    });
  }

  const docTep = (f) => new Promise((ok, hong) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ''));
    r.onerror = () => hong(r.error || new Error('Không đọc được tệp.'));
    r.readAsDataURL(f);
  });

  async function themAnh(tep) {
    for (const f of tep) {
      if (TT.anh.length >= TOI_DA_ANH) { bao(`Tối đa ${TOI_DA_ANH} ảnh mỗi tin nhắn.`, 'info'); break; }
      if (!LOAI_ANH.includes(f.type)) { bao(`"${f.name}" không phải ảnh PNG, JPEG, WebP hoặc GIF.`, 'info'); continue; }
      if (f.size > CO_ANH) { bao(`"${f.name}" lớn hơn 5 MB.`, 'info'); continue; }
      try {
        const url = await docTep(f);
        const data = url.slice(url.indexOf(',') + 1);
        TT.anh.push({ mimeType: f.type, data, url });
      } catch (e) { bao(`Không đọc được "${f.name}": ${e.message}`, 'loi'); }
    }
    veAnh();
  }

  function veMd(el, raw) {
    if (window.__beeVeMarkdown) window.__beeVeMarkdown(el, raw);
    else el.textContent = raw;
  }

  /* `tatCa` = toàn bộ chữ AI viết trong lượt (mọi bong bóng) — cất vào `TT.lichSu` khi hết lượt để đổi agent
     vẫn mang được hội thoại sang. */
  function luotMoi() {
    TT.luot = { dongChu: null, chu: '', tatCa: '', nhom: null, buoc: new Map() };
    return TT.luot;
  }
  const luot = () => TT.luot || luotMoi();

  // ── tên việc dễ đọc ───────────────────────────────────────────────────
  /* Agent đặt tên bước theo kiểu máy: "mcp__beeknoee-studio__studio_timeline_add_clip", "Tool: beeknoee-studio/
     studio_render", hoặc nguyên câu lệnh shell dài cả trăm ký tự không có dấu cách. Trước 24/10/2026 in nguyên
     văn ⇒ một chuỗi không ngắt được đẩy thẻ rộng quá khung, cột chat hiện thanh cuộn ngang. */
  const TEN_CONG_CU = {
    studio_get_editor_state: 'Xem trạng thái Studio',
    studio_get_state: 'Xem trạng thái Studio',
    studio_list_projects: 'Xem danh sách dự án',
    studio_get_project: 'Xem chi tiết dự án',
    studio_list_templates: 'Xem danh sách mẫu',
    studio_create_project: 'Tạo dự án từ mẫu',
    studio_add_slides: 'Thêm slide',
    studio_open_project: 'Mở dự án',
    studio_get_deck_map: 'Đọc sơ đồ slide',
    studio_read_file: 'Đọc tệp dự án',
    studio_update_text: 'Sửa chữ trên slide',
    studio_update_script: 'Sửa lời đọc',
    studio_write_file: 'Ghi tệp dự án',
    studio_validate_project: 'Kiểm tra dự án',
    studio_preview_slides: 'Xem trước slide',
    studio_render: 'Dựng video',
    studio_get_job_status: 'Xem tiến độ dựng',
    studio_cancel_job: 'Huỷ lượt dựng',
    studio_timeline_get: 'Đọc timeline',
    studio_timeline_add_clip: 'Thêm clip vào timeline',
    studio_timeline_update_clip: 'Sửa clip',
    studio_timeline_delete_clips: 'Xoá clip',
    studio_timeline_add_title: 'Thêm chữ tiêu đề',
    studio_timeline_update_title: 'Sửa chữ tiêu đề',
    studio_timeline_add_voice: 'Thêm giọng đọc',
    studio_timeline_add_music: 'Thêm nhạc nền',
    studio_timeline_replace_media: 'Thay tư liệu của clip',
    studio_timeline_add_sound_effect: 'Thêm hiệu ứng âm thanh',
    studio_timeline_add_overlay: 'Thêm lớp phủ',
    studio_timeline_set_settings: 'Đặt âm thanh và xuất video',
    studio_timeline_set_slide_sequence: 'Cắt / xếp lại slide',
    studio_subtitles_get: 'Đọc phụ đề',
    studio_subtitles_update: 'Sửa phụ đề',
    studio_export_edit: 'Xuất video',
    studio_media_import: 'Nhập tệp vào dự án',
    studio_library_list: 'Xem thư viện chung',
    studio_library_add: 'Thêm tư liệu từ thư viện',
    studio_template_insert: 'Chèn mẫu mở / kết',
  };
  const TEN_LOAI = {
    read: 'Đọc tệp', edit: 'Sửa tệp', delete: 'Xoá tệp', move: 'Chuyển tệp', search: 'Tìm kiếm',
    execute: 'Chạy lệnh', think: 'Suy nghĩ', fetch: 'Tải trang web',
  };
  /* Công cụ nội bộ của agent, tên cố định (thử thật 24/10/2026: Codex "Guardian Review", Claude "ToolSearch"). */
  const TEN_RIENG = {
    'Guardian Review': 'Rà soát an toàn',
    ToolSearch: 'Tìm công cụ',
    TodoWrite: 'Cập nhật danh sách việc',
    Task: 'Giao việc phụ',
  };
  /** `{ ten, chiTiet }` — tên ngắn để in đậm, chi tiết (lệnh, đường dẫn…) để in nhạt một dòng, cắt bằng "…". */
  function tenViec(u) {
    const goc = String((u && u.title) || '').trim();
    /* Duyệt MỌI cụm "studio_…": tên máy chủ "beeknoee-studio__" cũng chứa "studio_" và đứng trước tên công cụ. */
    const m = [...goc.matchAll(/studio_[a-z][a-z_]*/g)].map((x) => x[0]).find((k) => TEN_CONG_CU[k]);
    if (m) return { ten: TEN_CONG_CU[m], chiTiet: '' };
    /* Công cụ MCP khác: bỏ tiền tố "mcp__<máy chủ>__" / "Tool: <máy chủ>/", "_" thành cách. */
    const mcp = goc.match(/^mcp__.+?__([\w.-]+)/) || goc.match(/^Tool:\s*[^/\s]+\/([\w.-]+)/)
      || goc.match(/^mcp\.[^.\s]+\.([\w-]+)$/); // codex-acp: "mcp.<máy chủ>.<công cụ>"
    if (mcp) return { ten: mcp[1].replace(/_/g, ' '), chiTiet: '' };
    if (TEN_RIENG[goc]) return { ten: TEN_RIENG[goc], chiTiet: '' };
    const skill = goc.match(/^Load skill:?\s*(.*)$/i); // Claude Code nạp skill (bee-studio-basics…)
    if (skill) return { ten: 'Đọc hướng dẫn', chiTiet: skill[1].trim() };
    /* Bước có loại (đọc / sửa / chạy lệnh…): tên tiếng Việt theo loại, tiêu đề gốc (lệnh, đường dẫn) làm chi tiết. */
    const loai = TEN_LOAI[u && u.kind];
    if (loai && goc && goc !== loai) return { ten: loai, chiTiet: goc };
    return { ten: goc || loai || 'Công cụ', chiTiet: '' };
  }

  // ── khối việc gộp ─────────────────────────────────────────────────────
  /* Một chuỗi bước liền nhau (gọi công cụ + suy nghĩ) gộp thành MỘT khối, như Claude: hàng đầu chỉ hiện việc ĐANG
     chạy ("Đang suy nghĩ…", "Dựng video"), xong hết thì "Đã chạy 5 bước". Mũi tên xuống = mở xem từng bước, mũi tên
     lên = gập lại. Trước 24/10/2026 mỗi bước một thẻ riêng — một lượt hai chục bước là hai chục thẻ đẩy câu trả lời
     ra khỏi màn hình. Chữ trả lời, thẻ xin quyền hay kế hoạch chen vào thì khối khép lại; bước sau mở khối mới. */
  function nhomMoi(L) {
    const g = { viec: [], mo: false };
    g.el = tao('div', 'agt-nhom');
    g.dau = tao('button', 'agt-nhom-dau');
    g.dau.type = 'button';
    g.dau.setAttribute('aria-expanded', 'false');
    g.icon = icon('bolt', 'agt-nhom-icon');
    g.tom = tao('span', 'agt-nhom-tom');
    g.tt = tao('span', 'agt-nhom-tt');
    g.mui = icon('xuong', 'agt-nhom-mui');
    g.dau.append(g.icon, g.tom, g.tt, g.mui);
    g.ds = tao('div', 'agt-nhom-ds');
    g.ds.hidden = true;
    g.dau.onclick = () => {
      g.mo = !g.mo;
      g.ds.hidden = !g.mo;
      g.dau.setAttribute('aria-expanded', String(g.mo));
      g.mui.dataset.icon = g.mo ? 'len' : 'xuong';
      veIcon(g.dau);
    };
    g.el.append(g.dau, g.ds);
    /* Chữ sau khối là một tin mới — đừng nối vào bong bóng trước khối. */
    L.dongChu = null;
    L.chu = '';
    L.nhom = g;
    bang.appendChild(g.el);
    return g;
  }
  const nhomCua = (L) => L.nhom || nhomMoi(L);
  /** Khép khối đang mở (chữ trả lời / thẻ quyền / kế hoạch chen vào). Bước suy nghĩ dở thì coi là xong. */
  function khepNhom(L) {
    if (!L || !L.nhom) return;
    const g = L.nhom;
    if (g.nghi) { g.nghi.tt = 'xong'; veViec(g.nghi); g.nghi = null; }
    g.khep = true;
    L.nhom = null;
    veDauNhom(g);
  }

  function dongViec(g, v, tenIcon) {
    v.el = tao('div', 'agt-viec');
    const dau = tao('div', 'agt-viec-dau');
    v.elTen = tao('b', 'agt-viec-ten');
    v.elTt = tao('span', 'agt-viec-tt');
    dau.append(icon(tenIcon, 'agt-viec-icon'), v.elTen, v.elTt);
    v.el.appendChild(dau);
    g.ds.appendChild(v.el);
    g.viec.push(v);
  }

  function veViec(v) {
    v.elTen.textContent = v.ten;
    /* Đã trả lời thẻ xin quyền của bước này: thẻ gỡ đi, dấu vết còn lại là nhãn nhỏ cạnh tên. */
    if (v.quyen) {
      if (!v.elQuyen) { v.elQuyen = tao('span', 'agt-viec-quyen'); v.elTen.after(v.elQuyen); }
      v.elQuyen.textContent = v.quyen;
      v.elQuyen.classList.toggle('agt-viec-quyen-tu', !!v.tuChoi);
    }
    if (v.chiTiet) {
      if (!v.elCt) { v.elCt = tao('div', 'agt-viec-ct'); v.el.appendChild(v.elCt); }
      v.elCt.textContent = v.chiTiet;
      v.elCt.title = v.chiTiet;
    }
    const loi = v.tuChoi ? '' : v.loiChu || '';
    if (loi && !v.elLoi) { v.elLoi = tao('div', 'agt-viec-ct agt-viec-loi'); v.el.appendChild(v.elLoi); }
    if (v.elLoi) { v.elLoi.hidden = !loi; v.elLoi.textContent = loi; v.elLoi.title = loi; }
    v.elTt.className = 'agt-viec-tt';
    v.elTt.textContent = '';
    delete v.elTt.dataset.icon;
    if (v.tt === 'chay') v.elTt.classList.add('agt-chay');
    else if (v.tt === 'xong' && v.loai === 'cong') { v.elTt.classList.add('btn-icon', 'agt-viec-tich'); v.elTt.dataset.icon = 'ok'; }
    else if (v.tt === 'loi') { v.elTt.classList.add('btn-icon', 'agt-viec-x'); v.elTt.dataset.icon = 'loi'; }
    else if (v.tt === 'dung') { v.elTt.classList.add('agt-viec-quyen'); v.elTt.textContent = 'đã dừng'; }
    v.elTt.title = { chay: 'Đang chạy…', xong: 'Xong', loi: 'Lỗi', dung: 'Đã dừng' }[v.tt] || '';
    veIcon(v.el);
  }

  function veDauNhom(g) {
    /* Giữa hai bước (bước trước xong, bước sau chưa tới) khối vẫn MỞ và lượt vẫn chạy: giữ tên bước mới nhất + chấm
       nhịp. Thử thật 24/10/2026: Codex gọi công cụ xong trong tích tắc, nên dòng đầu cứ nhảy về "Đã chạy 2 bước"
       giữa lượt — đọc như đã xong hết. "Đã chạy N bước" chỉ khi khối đã khép. */
    const chay = [...g.viec].reverse().find((v) => v.tt === 'chay')
      || (!g.khep && TT.dangChay ? g.viec[g.viec.length - 1] : null);
    const soCong = g.viec.filter((v) => v.loai === 'cong').length;
    const soLoi = g.viec.filter((v) => v.tt === 'loi').length;
    let ten;
    if (chay) ten = chay.loai === 'nghi' ? 'Đang suy nghĩ…' : chay.choQuyen ? `Chờ bạn cho phép: ${chay.ten}` : chay.ten;
    else if (soCong) ten = `Đã chạy ${soCong} bước${soLoi ? ` · ${soLoi} lỗi` : ''}`;
    else ten = 'Đã suy nghĩ';
    g.tom.textContent = ten;
    g.dau.title = ten;
    g.icon.dataset.icon = (chay ? chay.loai === 'nghi' : !soCong) ? 'naoBo' : 'bolt';
    g.tt.className = `agt-nhom-tt${chay ? ' agt-chay' : ''}`;
    g.el.classList.toggle('agt-nhom-loi', !chay && soLoi > 0);
    veIcon(g.dau);
  }

  /** Câu lỗi của một bước hỏng. ACP để ở `content` ([{ content: { type: 'text', text } }]); Codex để lỗi công cụ MCP
      ở `rawOutput` (chuỗi, `{ content: [{ text }] }` của MCP, hoặc `{ error | message }`) — thử thật 24/10/2026 thì
      `content` rỗng, bước "Lỗi" không kèm lý do nào. */
  function chuLoi(u) {
    const tuContent = (Array.isArray(u.content) ? u.content : [])
      .map((c) => (c && c.content && c.content.type === 'text' ? c.content.text : '')).join(' ').trim();
    if (tuContent) return tuContent;
    /* codex-acp (McpToolReporter#resultFacts2): `rawOutput = { result: <CallToolResult MCP> | null, error: { message } | null }`. */
    const doc = (r, sau = 0) => {
      /* Cổng MCP của Studio trả lỗi dạng chuỗi JSON `{"error":{"code","message"}}` — rút câu `message` ra. */
      if (typeof r === 'string' && /^\s*\{/.test(r) && sau < 6) {
        try { const s = doc(JSON.parse(r), sau + 1); if (s) return s; } catch { /* không phải JSON — in nguyên */ }
      }
      if (typeof r === 'string') return r.trim();
      if (!r || typeof r !== 'object' || sau > 6) return '';
      if (Array.isArray(r.content)) {
        const s = r.content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join(' ').trim();
        if (s) return doc(s, sau + 1) || s;
      }
      for (const k of ['error', 'result', 'message', 'stderr']) {
        const s = doc(r[k], sau + 1);
        if (s) return s;
      }
      return '';
    };
    return doc(u.rawOutput);
  }

  function theBuoc(L, u) {
    const day = oDay();
    let v = L.buoc.get(u.toolCallId);
    if (!v) {
      const g = nhomCua(L);
      if (g.nghi) { g.nghi.tt = 'xong'; veViec(g.nghi); g.nghi = null; }
      v = { loai: 'cong', tt: 'chay', g, ten: '', chiTiet: '' };
      dongViec(g, v, 'bolt');
      L.buoc.set(u.toolCallId, v);
    }
    if (u.title) Object.assign(v, tenViec(u));
    else if (!v.ten) Object.assign(v, tenViec(u));
    if (u.status === 'completed') v.tt = 'xong';
    else if (u.status === 'failed') {
      v.tt = 'loi';
      /* Câu lỗi ngắn ngay dưới tên bước — mở khối ra là biết hỏng vì đâu. */
      /* Đã có nhãn "đã từ chối" thì thôi câu lỗi — Claude ghi "User refused permission to run tool", lặp ý. Bỏ rào
         ``` markdown quanh câu lỗi (đây là chữ thường, không qua bộ vẽ markdown). */
      const loi = chuLoi(u).replace(/```/g, '').trim();
      v.loiChu = loi.length > 300 ? `${loi.slice(0, 300)}…` : loi;
    }
    veViec(v);
    veDauNhom(v.g);
    if (day) xuongDay();
  }

  function themNghi(L, chu) {
    const day = oDay();
    const g = nhomCua(L);
    if (!g.nghi) {
      g.nghi = { loai: 'nghi', tt: 'chay', g, ten: 'Suy nghĩ', chiTiet: '', chu: '' };
      dongViec(g, g.nghi, 'naoBo');
      g.nghi.elChu = tao('div', 'agt-viec-nghi');
      g.nghi.el.appendChild(g.nghi.elChu);
    }
    g.nghi.chu += chu;
    /* Codex tóm lời nghĩ thành từng đoạn mở đầu bằng "**Tiêu đề**": tiêu đề mới nhất làm tên dòng (như Claude),
       thân bỏ dấu `**` — đây là chữ thường, không qua bộ vẽ markdown. */
    const tieuDe = [...g.nghi.chu.matchAll(/\*\*([^*\n]{2,80})\*\*/g)].pop();
    if (tieuDe) g.nghi.ten = tieuDe[1].trim();
    g.nghi.elChu.textContent = g.nghi.chu.replace(/\*\*/g, '').trim();
    veViec(g.nghi);
    veDauNhom(g);
    if (day) xuongDay();
  }

  /** Hết lượt: bước còn "đang chạy" (bấm Dừng, lỗi giữa chừng) thôi quay — khối không được kêu "đang chạy" mãi. */
  function xongLuot(L) {
    if (!L) return;
    khepNhom(L);
    for (const v of L.buoc.values()) {
      if (v.tt !== 'chay') continue;
      v.tt = 'dung';
      veViec(v);
      veDauNhom(v.g);
    }
  }

  // ── cập nhật từ agent (ACP session/update) ─────────────────────────────
  function themChu(L, mau) {
    const day = oDay();
    if (!L.dongChu) {
      L.dongChu = tao('div', 'ait-tin ait-tin-ai ait-md');
      bang.appendChild(L.dongChu);
      if (L.tatCa) L.tatCa += '\n\n';
    }
    L.chu += mau;
    L.tatCa += mau;
    /* Vẽ lại có nhịp — cùng lý do ai-tao.js#themChu: chữ về từng vài ký tự một. */
    if (!L.dongChu._hen) {
      veMd(L.dongChu, L.chu);
      const el = L.dongChu;
      el._hen = setTimeout(() => { el._hen = null; veMd(el, L.chu); if (oDay()) xuongDay(); }, 120);
    }
    if (day) xuongDay();
  }

  function nhanCapNhat(d) {
    if (!d || d.sessionId !== TT.sessionId) return;
    const u = d.update || {};
    const L = luot();
    switch (u.sessionUpdate) {
      case 'agent_message_chunk':
        if (u.content && u.content.type === 'text') { khepNhom(L); themChu(L, u.content.text); }
        break;
      case 'agent_thought_chunk':
        if (u.content && u.content.type === 'text') themNghi(L, u.content.text);
        break;
      case 'config_option_update':
        if (Array.isArray(u.configOptions)) veCauHinh(u.configOptions);
        break;
      case 'tool_call':
      case 'tool_call_update':
        theBuoc(L, u);
        break;
      case 'plan': {
        if (!Array.isArray(u.entries)) break;
        if (!L.keHoach) { khepNhom(L); L.keHoach = tao('ol', 'agt-kehoach'); bang.appendChild(L.keHoach); }
        L.keHoach.textContent = '';
        for (const m of u.entries) {
          const li = tao('li', '', String(m.content || ''));
          li.dataset.tt = m.status || '';
          L.keHoach.appendChild(li);
        }
        break;
      }
      default:
    }
  }

  // ── xin quyền ─────────────────────────────────────────────────────────
  function nhanXinQuyen(d) {
    if (!d || d.sessionId !== TT.sessionId) {
      if (d && d.maQuyen) C.traLoiQuyen(d.maQuyen, null);
      return;
    }
    const the = tao('div', 'agt-quyen');
    const tc = d.toolCall || {};
    if (tc.toolCallId) the.dataset.buoc = String(tc.toolCallId);
    /* KHÔNG khép khối việc: Claude hỏi quyền TỪNG công cụ, khép khối ở mỗi thẻ là màn hình thành "khối 3 bước / thẻ /
       khối 1 bước / thẻ…" (thử thật 24/10/2026). Thẻ nổi ở đáy chờ bấm; bấm xong thì GỠ thẻ, dấu vết thành nhãn nhỏ
       trên đúng bước đó trong khối, các bước sau vẫn vào khối đang mở. */
    const buocCua = () => (TT.luot && tc.toolCallId ? TT.luot.buoc.get(tc.toolCallId) : null);
    const v0 = buocCua();
    if (v0) { v0.choQuyen = true; veDauNhom(v0.g); }
    const { ten, chiTiet } = tc.title || tc.kind ? tenViec(tc) : (v0 || { ten: 'thực hiện một thao tác', chiTiet: '' });
    the.appendChild(tao('div', 'agt-quyen-tieude', `AI xin phép: ${ten}`));
    if (chiTiet) the.appendChild(tao('div', 'agt-viec-ct agt-quyen-ct', chiTiet));
    const hang = tao('div', 'agt-quyen-nut');
    /* Nhãn nút theo LOẠI lựa chọn của ACP — chữ agent gửi là tiếng Anh, dài ("Yes, and don't ask again for Studio
       List Projects commands"); để nguyên làm chú thích khi rê chuột. */
    const NHAN_QUYEN = { allow_once: 'Cho phép', allow_always: 'Luôn cho phép', reject_once: 'Từ chối', reject_always: 'Luôn từ chối' };
    for (const op of d.options || []) {
      const tu = /reject/.test(op.kind || '');
      const nhan = NHAN_QUYEN[op.kind] || op.name || op.optionId;
      const n = tao('button', `agt-nut${tu ? '' : ' agt-nut-chinh'}`, nhan);
      n.type = 'button';
      if (op.name && op.name !== nhan) n.title = op.name;
      n.onclick = async () => {
        for (const x of hang.querySelectorAll('button')) x.disabled = true;
        /* Đánh dấu từ chối TRƯỚC khi gửi: agent nhận "No" là gửi ngay bước "failed", có khi về trước cả lúc await này. */
        const v1 = buocCua();
        if (v1 && tu) v1.tuChoi = true;
        const r = await C.traLoiQuyen(d.maQuyen, op.optionId);
        /* Yêu cầu đã hết hiệu lực (bấm Dừng, quá 15 phút, agent tắt) thì main trả `daTra: false` — trước 24/10/2026
           vẫn hiện "Đã cho phép" dù agent đã nhận "huỷ". */
        const conHieuLuc = r && r.ok && r.daTra;
        const v = buocCua(); // tra LẠI: thẻ quyền có thể tới trước bước của nó
        if (conHieuLuc && v) {
          v.choQuyen = false;
          v.quyen = tu ? 'đã từ chối' : op.kind === 'allow_always' ? 'luôn cho phép' : 'đã cho phép';
          v.tuChoi = tu;
          the.remove();
          veViec(v);
          veDauNhom(v.g);
          return;
        }
        if (v) { v.choQuyen = false; v.tuChoi = false; veViec(v); veDauNhom(v.g); }
        hang.textContent = '';
        hang.appendChild(tao('span', 'agt-ghichu', !conHieuLuc ? 'Yêu cầu này đã hết hiệu lực (agent đã dừng hoặc quá giờ).'
          : tu ? 'Đã từ chối' : `Đã cho phép (${nhan})`));
      };
      hang.appendChild(n);
    }
    the.appendChild(hang);
    bang.appendChild(the);
    xuongDay();
  }

  // ── động cơ, đăng nhập, khoá, phiên ────────────────────────────────────
  const dc = () => TT.dsDongCo.find((x) => x.id === TT.dongCo) || null;

  async function napDongCo() {
    const r = await C.trangThai();
    if (!r.ok) { bao(r.loi, 'loi'); return; }
    TT.dsDongCo = r.dongCo;
    let nho = '';
    try { nho = localStorage.getItem('bee-agent-dongco') || ''; } catch { /* chế độ riêng tư */ }
    const dung = (id) => r.dongCo.find((d) => d.id === id && d.coNhiPhan);
    const chon = dung(TT.dongCo) || dung(nho) || r.dongCo.find((d) => d.coNhiPhan);
    TT.dongCo = chon ? chon.id : null;
    veNhanMenu();
    if (menu) veMenu();
  }

  // ── MENU AGENT (nút dưới ô gõ) — giống menu "Agent selection" của ChatCut ──
  /* Một nút cạnh nút ghim mở hộp: trên là danh sách AI agent (+ đăng xuất ChatGPT),
     dưới là CÀI ĐẶT của phiên (model, mức suy nghĩ, quyền) — mỗi dòng mở một hộp
     con bên cạnh. Mọi chữ đi qua textContent: tên model/tuỳ chọn là do agent gửi. */
  const ICON_DC = { codex: 'openai', claudeGoi: 'claude', claude: 'claude', claudeBee: 'bee' };
  /* Động cơ đăng nhập bằng TÀI KHOẢN (không dùng khoá): Codex (ChatGPT) và Claude gói Pro/Max (09/10/2026). */
  const TK = {
    codex: { ten: 'ChatGPT', nutDn: 'Đăng nhập ChatGPT', dangKetNoi: 'Đang kết nối ChatGPT…',
      gioiThieu: 'Codex chạy bằng gói ChatGPT của bạn. Đăng nhập một lần bằng tài khoản OpenAI (Studio không giữ mật khẩu).',
      khiDn: 'Nếu trình duyệt mở trang đăng nhập OpenAI, đăng nhập xong quay lại đây.',
      dxTieuDe: 'Đăng xuất ChatGPT?', dxChu: ['Tài khoản ChatGPT sẽ được đăng xuất khỏi Codex trong Studio.', 'Lần sau dùng Codex sẽ phải đăng nhập lại.'],
      dxNut: 'Đăng xuất ChatGPT khỏi Codex trong Studio' },
    claudeGoi: { ten: 'Claude', nutDn: 'Đăng nhập Claude', dangKetNoi: 'Đang kết nối Claude…',
      gioiThieu: 'Claude chạy bằng gói Pro/Max của bạn. Máy đã đăng nhập Claude Code thì bấm Đăng nhập là kết nối ngay; chưa có thì Studio mở cửa sổ Claude Code để bạn đăng nhập trên trang của Anthropic. Studio không thấy mật khẩu hay mã.',
      khiDn: 'Đã mở cửa sổ Claude Code — đăng nhập trên trang Anthropic vừa mở; được hỏi mã thì dán vào cửa sổ đó. Xong Studio tự kết nối.',
      dxTieuDe: 'Đăng xuất Claude?', dxChu: ['Tài khoản Claude sẽ được đăng xuất khỏi Studio.', 'Claude Code trên máy của bạn (nếu có) không bị ảnh hưởng.'],
      dxNut: 'Đăng xuất Claude khỏi Studio' },
  };
  /* "Codex · gói ChatGPT" → tên "Codex", nhãn phụ "gói ChatGPT". */
  const tachTen = (d) => {
    const [ten, ...phu] = String(d.ten || d.id).split(' · ');
    return { ten, phu: phu.join(' · ') };
  };
  const LOAI_CH = [['model', 'Model'], ['thought_level', 'Mức suy nghĩ'], ['mode', 'Quyền']];
  const loaiCua = (o) => o.category || o.id;
  /* Tuỳ chọn ACP có thể chia nhóm ({ group, name, options: [...] }) — trải phẳng. */
  const traiPhang = (ds) => (ds || []).flatMap((x) => (x && Array.isArray(x.options) ? traiPhang(x.options) : [x]));
  const chCua = (loai) => TT.cauHinh.find((o) => loaiCua(o) === loai) || null;
  const tenGiaTri = (o) => {
    const v = traiPhang(o.options).find((x) => x.value === o.currentValue);
    return v ? String(v.name || v.value) : String(o.currentValue || '');
  };

  function veCauHinh(opts) {
    TT.cauHinh = (opts || []).filter((o) => o && o.type === 'select' && traiPhang(o.options).length > 1);
    veNhanMenu();
    if (menu) veMenu();
  }

  /** Nhãn trên nút: biểu tượng + tên agent + "model · mức suy nghĩ". */
  function veNhanMenu() {
    const d = dc();
    oIconAgent.dataset.icon = (d && ICON_DC[d.id]) || 'bolt';
    veIcon(nutMenu);
    oNhanAgent.textContent = d ? tachTen(d).ten : 'Chọn AI agent';
    oNhanPhu.textContent = ['model', 'thought_level'].map(chCua).filter(Boolean).map(tenGiaTri).join(' · ');
  }

  let menu = null; // { goc, phu }
  function dongMenu() {
    if (!menu) return;
    menu.goc.remove();
    if (menu.phu) menu.phu.remove();
    menu = null;
    nutMenu.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', ngoaiMenu, true);
    document.removeEventListener('keydown', phimMenu, true);
    window.removeEventListener('resize', dongMenu);
    window.removeEventListener('blur', dongMenu);
  }
  function ngoaiMenu(e) {
    if (!menu || menu.goc.contains(e.target) || (menu.phu && menu.phu.contains(e.target)) || nutMenu.contains(e.target)) return;
    dongMenu();
  }
  function phimMenu(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (menu && menu.phu) { dongPhu(); return; }
    dongMenu();
    nutMenu.focus();
  }
  function dongPhu() {
    if (!menu || !menu.phu) return;
    menu.phu.remove();
    menu.phu = null;
    for (const x of menu.goc.querySelectorAll('.dang-mo')) x.classList.remove('dang-mo');
  }

  function moMenu() {
    if (menu) { dongMenu(); return; }
    menu = { goc: tao('div', 'agt-menu'), phu: null };
    menu.goc.setAttribute('role', 'menu');
    document.body.appendChild(menu.goc);
    veMenu();
    nutMenu.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', ngoaiMenu, true);
    document.addEventListener('keydown', phimMenu, true);
    window.addEventListener('resize', dongMenu);
    window.addEventListener('blur', dongMenu);
    const dau = menu.goc.querySelector('button:not(:disabled)');
    if (dau) dau.focus();
  }

  /* `position: fixed` + toạ độ tính tay: pane có `overflow: hidden`, hộp nằm trong
     pane sẽ bị cắt. Hộp chính mở LÊN TRÊN nút (khung soạn ở đáy cột); hộp con mở
     sang PHẢI dòng cha, hết chỗ thì sang trái. Luôn kẹp trong cửa sổ. */
  function datViTri(hop, neo, huong) {
    const r = neo.getBoundingClientRect();
    const w = hop.offsetWidth;
    const h = hop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const le = 8;
    let x;
    let y;
    if (huong === 'tren') {
      x = r.left;
      y = r.top - h - 6;
      if (y < le) y = r.bottom + 6;
    } else {
      x = r.right + 4;
      y = r.top - 4;
      if (x + w > vw - le) x = r.left - w - 4;
    }
    x = Math.max(le, Math.min(x, vw - w - le));
    y = Math.max(le, Math.min(y, vh - h - le));
    hop.style.left = `${Math.round(x)}px`;
    hop.style.top = `${Math.round(y)}px`;
  }

  function dongMenuMoi(lop, vaiTro) {
    const h = tao('button', `agt-menu-dong ${lop || ''}`.trim());
    h.type = 'button';
    h.setAttribute('role', vaiTro || 'menuitem');
    return h;
  }

  function veMenu() {
    if (!menu) return;
    const g = menu.goc;
    dongPhu();
    g.textContent = '';
    g.appendChild(tao('div', 'agt-menu-nhom', 'AI agent'));
    /* Mỗi agent một HÀNG: nút chọn (rộng hết) + nút icon bên phải. Không lồng nút
       trong nút. CHẤM XANH LÁ = sẵn sàng (Codex đã đăng nhập / Claude đã có khoá);
       agent đang dùng thì hàng có nền nhấn. Bên phải chấm: Codex có nút ĐĂNG XUẤT,
       hai agent Claude có nút KHOÁ (đổi / nhập khoá) — bấm chọn agent đang dùng thì
       không làm gì, nên đổi khoá phải có lối riêng. */
    for (const d of TT.dsDongCo) {
      const { ten, phu } = tachTen(d);
      const hang = tao('div', `agt-menu-hang${d.id === TT.dongCo ? ' dang-chon' : ''}`);
      const h = dongMenuMoi('', 'menuitemradio');
      h.setAttribute('aria-checked', String(d.id === TT.dongCo));
      h.disabled = !d.coNhiPhan;
      h.append(icon(ICON_DC[d.id] || 'bolt', 'agt-menu-icon'), tao('span', 'agt-menu-ten', ten));
      if (phu) h.appendChild(tao('span', 'agt-menu-the', phu));
      h.appendChild(tao('span', 'agt-gian'));
      const sanSang = d.coNhiPhan && !d.canDangNhap && d.coKhoa;
      if (!d.coNhiPhan) h.appendChild(tao('span', 'agt-menu-gt', 'Thiếu trong bộ cài'));
      else if (d.canDangNhap) h.appendChild(tao('span', 'agt-menu-nhan', 'Đăng nhập'));
      else if (!d.coKhoa) h.appendChild(tao('span', 'agt-menu-nhan', 'Nhập khoá'));
      else {
        const cham = tao('span', 'agt-menu-cham agt-menu-cham-ok');
        cham.title = TK[d.id] ? `Đã đăng nhập ${TK[d.id].ten}` : 'Đã có khoá';
        h.appendChild(cham);
      }
      h.onmouseenter = dongPhu;
      h.onclick = () => {
        dongMenu();
        chonDongCo(d.id);
        if (d.coNhiPhan && !d.canDangNhap && !d.coKhoa) moBangKhoa(d);
      };
      hang.appendChild(h);
      const nutIcon = (ten2, tieuDe, viec, lop = '') => {
        const n = tao('button', `agt-menu-nut-icon ${lop}`.trim());
        n.type = 'button';
        n.title = tieuDe;
        n.setAttribute('aria-label', tieuDe);
        n.appendChild(icon(ten2));
        n.onmouseenter = dongPhu;
        n.onclick = (e) => { e.stopPropagation(); dongMenu(); viec(); };
        hang.appendChild(n);
      };
      if (TK[d.id] && sanSang) {
        nutIcon('dangXuat', TK[d.id].dxNut, () => dangXuatTk(d), 'agt-nut-do');
      } else if (NHA_CUA[d.id] && sanSang) {
        nutIcon('khoa', d.id === 'claudeBee' ? 'Đổi khoá Beeknoee Platform' : 'Đổi khoá API Anthropic', () => moBangKhoa(d));
      }
      g.appendChild(hang);
    }
    const ds = LOAI_CH.map(([loai, nhan]) => [chCua(loai), nhan]).filter(([o]) => o);
    if (TT.sessionId && ds.length) {
      g.appendChild(tao('div', 'agt-menu-ke'));
      g.appendChild(tao('div', 'agt-menu-nhom', 'Cài đặt'));
      for (const [o, nhan] of ds) {
        const h = dongMenuMoi();
        h.setAttribute('aria-haspopup', 'menu');
        h.append(tao('span', 'agt-menu-ten', nhan), tao('span', 'agt-gian'),
          tao('span', 'agt-menu-gt', tenGiaTri(o)), icon('phai', 'agt-menu-mui'));
        h.onmouseenter = () => moMenuPhu(h, o);
        h.onclick = () => moMenuPhu(h, o, true);
        h.onkeydown = (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); moMenuPhu(h, o, true); } };
        g.appendChild(h);
      }
    }
    /* Khoá API cho agent dùng khoá (Custom LLM / OpenAI / Claude) — mở bảng Cài đặt AI đầy đủ. */
    g.appendChild(tao('div', 'agt-menu-ke'));
    const hCd = dongMenuMoi('agt-menu-phu-dong');
    hCd.append(icon('gear', 'agt-menu-icon'), tao('span', 'agt-menu-ten', 'Cài đặt AI (Base URL, Token, Model)…'));
    hCd.onmouseenter = dongPhu;
    hCd.onclick = () => { dongMenu(); moBangKhoa(dc()); };
    g.appendChild(hCd);
    veIcon(g);
    datViTri(g, nutMenu, 'tren');
  }

  function moMenuPhu(hang, o, focus = false) {
    if (!menu) return;
    if (!(menu.phu && menu.phu._id === o.id)) {
      dongPhu();
      hang.classList.add('dang-mo');
      const p = tao('div', 'agt-menu agt-menu-con');
      p._id = o.id;
      p.setAttribute('role', 'menu');
      for (const v of traiPhang(o.options)) {
        const h = dongMenuMoi('', 'menuitemradio');
        h.setAttribute('aria-checked', String(v.value === o.currentValue));
        h.append(tao('span', 'agt-menu-ten', String(v.name || v.value)), tao('span', 'agt-gian'));
        if (v.value === o.currentValue) h.appendChild(tao('span', 'agt-menu-cham'));
        if (v.description) h.title = String(v.description);
        h.onclick = () => { dongMenu(); doiCauHinh(o, v.value); };
        h.onkeydown = (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); dongPhu(); hang.focus(); } };
        p.appendChild(h);
      }
      document.body.appendChild(p);
      menu.phu = p;
      datViTri(p, hang, 'phai');
    }
    if (focus) {
      const chon = menu.phu.querySelector('[aria-checked="true"]') || menu.phu.querySelector('button');
      if (chon) chon.focus();
    }
  }

  /* Lên/xuống trong hộp bằng phím mũi tên. */
  function diChuyen(hop, e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const ds = [...hop.querySelectorAll('button:not(:disabled)')];
    if (!ds.length) return;
    e.preventDefault();
    const i = ds.indexOf(document.activeElement);
    const j = e.key === 'ArrowDown' ? (i + 1) % ds.length : (i - 1 + ds.length) % ds.length;
    ds[j].focus();
  }
  document.addEventListener('keydown', (e) => {
    if (!menu) return;
    if (menu.goc.contains(e.target)) diChuyen(menu.goc, e);
    else if (menu.phu && menu.phu.contains(e.target)) diChuyen(menu.phu, e);
  });

  /* Model / mức suy nghĩ / quyền người dùng đã chọn, NHỚ THEO TỪNG AGENT: { codex: { model: '…', … }, … }. Phiên mới
     (đổi agent rồi quay lại, Chat mới, mở lại app) agent trả về bộ MẶC ĐỊNH — thử thật 24/10/2026: chọn "6 Sol", sang
     Claude rồi về Codex là thành "6.1 Sol". Mở phiên xong áp lại những gì đã nhớ (`apCauHinhNho`). */
  const KHOA_CAU_HINH = 'bee-agent-cauhinh';
  function docCauHinhNho() {
    try { const v = JSON.parse(localStorage.getItem(KHOA_CAU_HINH) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  }
  function nhoCauHinh(dongCo, id, giaTri) {
    const tat = docCauHinhNho();
    tat[dongCo] = { ...(tat[dongCo] || {}), [id]: giaTri };
    try { localStorage.setItem(KHOA_CAU_HINH, JSON.stringify(tat)); } catch { /* chế độ riêng tư */ }
  }
  async function apCauHinhNho(dongCo, theHe) {
    const nho = docCauHinhNho()[dongCo] || {};
    /* Lần lượt, model TRƯỚC: đổi model có thể đổi luôn danh sách mức suy nghĩ của nó. */
    for (const id of Object.keys(nho).sort((a, b) => (a === 'model' ? -1 : b === 'model' ? 1 : 0))) {
      const o = TT.cauHinh.find((x) => x.id === id);
      if (!o || o.currentValue === nho[id] || !traiPhang(o.options).some((x) => x.value === nho[id])) continue;
      const r = await C.datCauHinh(TT.sessionId, o.id, nho[id]);
      if (theHe !== TT.theHe) return;
      if (!r.ok) continue; // giá trị cũ không còn hợp lệ (model bị gỡ…) — giữ mặc định, khỏi báo
      o.currentValue = nho[id];
      if (r.kq && Array.isArray(r.kq.configOptions) && r.kq.configOptions.length) veCauHinh(r.kq.configOptions);
      else veNhanMenu();
    }
  }

  async function doiCauHinh(o, giaTri) {
    if (!TT.sessionId || giaTri === o.currentValue) return;
    const cu = o.currentValue;
    o.currentValue = giaTri;
    veNhanMenu();
    const theHe = TT.theHe;
    const r = await C.datCauHinh(TT.sessionId, o.id, giaTri);
    if (theHe !== TT.theHe) return; // phiên đã đổi — cài đặt trả về là của phiên cũ
    if (!r.ok) {
      o.currentValue = cu;
      veNhanMenu();
      bao(`Không đổi được: ${r.loi}`, 'loi');
      return;
    }
    /* Đổi model có thể đổi luôn danh sách mức suy nghĩ / quyền — agent trả lại bộ mới. */
    if (r.kq && Array.isArray(r.kq.configOptions) && r.kq.configOptions.length) veCauHinh(r.kq.configOptions);
    nhoCauHinh(TT.dongCo, o.id, giaTri);
    /* CÙNG phiên, agent vẫn nhớ hết — chỉ đánh dấu chỗ đổi để đọc lại biết đoạn nào do model nào viết. */
    const nhan = (LOAI_CH.find(([loai]) => loai === loaiCua(o)) || [])[1] || o.name || o.id;
    vachChia(`${nhan}: ${tenGiaTri(o)}`, o.id);
  }

  function chonDongCo(id) {
    if (id === TT.dongCo && TT.sessionId) return;
    const doiAgent = id !== TT.dongCo;
    TT.dongCo = id;
    try { localStorage.setItem('bee-agent-dongco', id); } catch { /* chế độ riêng tư */ }
    /* KHÔNG xoá màn chat: lượt đang dở thì cất phần đã viết, rồi tin đầu tiên gửi agent mới mang theo hội thoại. */
    luuLuot(TT.luot);
    if (TT.lichSu.length) TT.noiTiep = true;
    const d = dc();
    if (doiAgent && d) {
      const { ten, phu } = tachTen(d);
      vachChia(`Đã chuyển sang ${ten}${phu ? ` · ${phu}` : ''}`, 'agent');
    }
    veNhanMenu();
    batPhien();
  }

  async function dangXuatTk(d) {
    const t = TK[d.id];
    /* Hộp xác nhận CỦA APP (ai-caidat.js#hoiXacNhan): cùng màu/nền sáng-tối với app,
       nằm giữa cửa sổ app — không dùng `window.confirm()` (hộp của Windows, nền
       trắng, giữa màn hình desktop). */
    const dongY = window.__beeHoi
      ? await window.__beeHoi({
        tieuDe: t.dxTieuDe,
        chu: t.dxChu,
        nutDong: 'Đăng xuất',
        nguyHiem: true,
      })
      // eslint-disable-next-line no-alert
      : window.confirm(`${t.dxTieuDe} ${t.dxChu[0]}`);
    if (!dongY) return;
    const theHe = TT.theHe;
    const r = await C.dangXuat(d.id);
    await napDongCo();
    if (theHe !== TT.theHe || TT.dongCo !== d.id) return; // đã sang agent / phiên khác lúc chờ
    xoaChat();
    if (!r.ok) bao(`Không đăng xuất được: ${r.loi}`, 'loi');
    batPhien();
  }

  /* KHOÁ LLM: mở bảng Cài đặt AI đầy đủ (cho phép cấu hình Base URL, Token, Model, Health check). */
  const NHA_CUA = { claude: 'anthropic', claudeBee: 'beeknoee', custom: 'tuongThich', codex: 'openai' };
  function moBangKhoa(d) {
    if (!window.__beeAI || !window.__beeAI.mo) return;
    window.__beeAI.mo({ nha: NHA_CUA[d && d.id] || 'tuongThich' });
  }
  function nutNhapKhoa(d) {
    const n = tao('button', 'agt-nut agt-nut-chinh', 'Nhập khoá');
    n.type = 'button';
    n.onclick = () => moBangKhoa(d);
    return n;
  }

  /* Máy đã đăng nhập Codex / Claude Code nhưng KHÁC email tài khoản Studio: hỏi một lần, bấm là kết nối (09/10/2026). */
  function nutDungMay(d) {
    const n = tao('button', 'agt-nut agt-nut-chinh', 'Dùng tài khoản này');
    n.type = 'button';
    n.onclick = async () => {
      n.disabled = true;
      datTt(TK[d.id].dangKetNoi, true);
      bao('');
      const theHe = TT.theHe;
      const r = await C.dangNhap(d.id, { dungMay: true });
      await napDongCo();
      if (theHe !== TT.theHe || TT.dongCo !== d.id) return; // người dùng đã sang agent / phiên khác lúc chờ
      if (!r.ok) { datTt('Lỗi'); bao(`Chưa kết nối được: ${r.loi}`, 'loi', nutDangNhap(d)); return; }
      batPhien();
    };
    return n;
  }
  function hoiDungMay(d) {
    const hang = tao('div', 'agt-hang-nut');
    const khac = nutDangNhap(d);
    khac.textContent = 'Tài khoản khác';
    khac.className = 'agt-nut';
    hang.append(nutDungMay(d), khac);
    bao(`Máy này đang đăng nhập ${d.id === 'codex' ? 'Codex' : 'Claude Code'} bằng ${d.mayCo} (khác email tài khoản Studio). Dùng luôn tài khoản này?`, 'info', hang);
  }

  function nutDangNhap(d) {
    const t = TK[d.id];
    const n = tao('button', 'agt-nut agt-nut-chinh', t.nutDn);
    n.type = 'button';
    n.onclick = async () => {
      n.disabled = true;
      datTt('Đang đăng nhập…', true);
      bao(t.khiDn, 'info');
      const theHe = TT.theHe;
      const r = await C.dangNhap(d.id);
      await napDongCo();
      /* Đăng nhập chờ tới 10 phút: người dùng đã sang agent khác và đang chat thì đừng mở lại phiên đè lên. */
      if (theHe !== TT.theHe || TT.dongCo !== d.id) return;
      if (!r.ok) { datTt('Lỗi'); bao(`Chưa đăng nhập được: ${r.loi}`, 'loi', nutDangNhap(d)); return; }
      batPhien();
    };
    return n;
  }

  async function batPhien() {
    /* Lượt của phiên cũ ĐANG CHẠY (bấm "Chat mới" / đổi agent giữa lượt): DỪNG nó trước. Trước 24/10/2026 chỉ bỏ
       phiên ở giao diện — agent vẫn chạy tiếp, vẫn gọi công cụ Studio (kể cả dựng video, tốn lượt + tiền giọng
       đọc) mà người dùng không còn nút Dừng nào cho lượt đó. */
    if (TT.dangChay && TT.sessionId) C.dung(TT.sessionId);
    const theHe = ++TT.theHe;
    TT.sessionId = null;
    TT.luot = null;
    datBan(false);
    veCauHinh([]);
    const d = dc();
    veNhanMenu();
    if (!d) { bao('Bộ cài này chưa có AI agent nào cho máy của bạn.', 'loi'); return; }
    if (d.canDangNhap && TK[d.id] && d.mayCo) { datTt('Chưa kết nối'); hoiDungMay(d); return; }
    if (d.canDangNhap) {
      datTt('Chưa đăng nhập');
      bao((TK[d.id] || TK.codex).gioiThieu, 'info', nutDangNhap(TK[d.id] ? d : { id: 'codex' }));
      return;
    }
    if (!d.coKhoa) {
      datTt('Thiếu khoá');
      bao(d.id === 'claudeBee' ? 'Cần khoá Beeknoee Platform (sk-bee-…) để dùng Claude qua ví Beeknoee.' : 'Cần khoá API Anthropic (console.anthropic.com).', 'info', nutNhapKhoa(d));
      return;
    }
    /* Codex đã có đăng nhập (kể cả lấy NGẦM từ Codex trên máy, cùng email tài khoản
       Studio — xem quanLy.js#nhapDangNhapCoSan): chỉ một vòng tròn quay, không mở
       trình duyệt, không hỏi gì — như ChatCut. */
    datTt(TK[d.id] ? TK[d.id].dangKetNoi : 'Đang khởi động…', true);
    bao('');
    const r = await C.phienMoi(d.id);
    if (theHe !== TT.theHe || TT.dongCo !== d.id) return; // đã mở phiên khác / đổi agent trong lúc chờ
    if (!r.ok) {
      datTt('Lỗi');
      if (r.ma === 'CAN_DANG_NHAP' && TK[d.id]) {
        await napDongCo();
        if (theHe !== TT.theHe) return;
        const d2 = dc();
        if (d2 && d2.mayCo) { hoiDungMay(d2); return; }
        bao(`Cần đăng nhập ${TK[d.id].ten} trước.`, 'info', nutDangNhap(d)); return;
      }
      if (r.ma === 'THIEU_KHOA' || r.ma === 'KHOA_SAI') {
        bao(`${r.loi} Nhập khoá khác:`, r.ma === 'KHOA_SAI' ? 'loi' : 'info', nutNhapKhoa(d));
        moBangKhoa(d); // khoá hỏng/thiếu: bật luôn bảng nhập khoá, như lúc chọn Claude chưa có khoá
        return;
      }
      if (r.ma === 'KHONG_DONG_Y') { bao('Cần cho phép AI agent điều khiển Studio thì mới chat được. Bấm "Chat mới" để được hỏi lại.', 'info'); return; }
      bao(`Không khởi động được AI: ${r.loi}`, 'loi');
      return;
    }
    TT.sessionId = r.sessionId;
    datTt('Sẵn sàng');
    /* Mở được phiên Codex = đã đăng nhập (có thể vừa lấy ngầm) — menu hiện chấm xanh + nút đăng xuất. */
    if (TK[d.id]) d.canDangNhap = false;
    veCauHinh(r.configOptions);
    datBan(false);
    await apCauHinhNho(d.id, theHe);
  }

  async function guiTin() {
    const chu = oChu.value.trim();
    if ((!chu && !TT.anh.length) || !TT.sessionId || TT.dangChay) return;
    const anh = TT.anh;
    TT.anh = [];
    veAnh();
    oChu.value = '';
    const tin = tao('div', 'ait-tin ait-tin-toi', chu || null);
    if (anh.length) {
      const hang = tao('div', 'agt-tin-anh');
      for (const a of anh) { const img = tao('img'); img.src = a.url; img.alt = ''; hang.appendChild(img); }
      tin.appendChild(hang);
    }
    bang.appendChild(tin);
    xuongDay();
    const L = luotMoi();
    datBan(true);
    datTt('Đang làm…', true);
    const theHe = TT.theHe;
    const guiDi = TT.noiTiep ? ganBoiCanh(chu) : chu;
    TT.lichSu.push({ vai: 'toi', chu: chu || '(gửi ảnh)' });
    const r = await C.gui(TT.sessionId, guiDi, anh.map((a) => ({ mimeType: a.mimeType, data: a.data })));
    if (theHe !== TT.theHe) return; // màn đã sang phiên khác trong lúc chờ — kết quả này không còn là của ai
    if (r.ok) TT.noiTiep = false; // agent mới đã nhận bối cảnh
    luuLuot(L);
    datBan(false);
    if (TT.sessionId) datTt('Sẵn sàng');
    const ghi = (lop, c) => { bang.appendChild(tao('div', lop, c)); xuongDay(); };
    if (!r.ok) {
      ghi('ait-dong ait-dong-loi', `Lỗi: ${r.loi}`);
      /* Phiên mới thay phiên đã mất: agent không còn nhớ gì — mang hội thoại sang như lúc đổi agent. */
      if (r.ma === 'MAT_PHIEN') { TT.noiTiep = true; batPhien(); }
      /* Đăng nhập gói hết hạn giữa phiên (quanLy.js#gui): nạp lại trạng thái — màn mời đăng nhập lại. */
      else if (r.ma === 'CAN_DANG_NHAP') { await napDongCo(); if (theHe === TT.theHe) batPhien(); }
    } else if (r.stopReason === 'cancelled') {
      ghi('ait-dong', 'Đã dừng.');
    } else if (r.stopReason === 'refusal') {
      ghi('ait-dong', 'AI từ chối yêu cầu này.');
    } else if (r.stopReason === 'max_tokens' || r.stopReason === 'max_turn_requests') {
      ghi('ait-dong', 'AI dừng vì chạm giới hạn — nhắn "tiếp tục" để làm tiếp.');
    }
    /* Quyền chỉ sống trong lượt: hết lượt (xong / Dừng / lỗi) mà thẻ còn nút thì khoá lại — bấm muộn cũng chỉ ra
       "hết hiệu lực", để nút sáng là mời bấm vào một thứ đã chết. */
    for (const the of bang.querySelectorAll('.agt-quyen')) {
      const hang = the.querySelector('.agt-quyen-nut');
      if (!hang || !hang.querySelector('button:not(:disabled)')) continue;
      /* Bước của thẻ nằm trong khối (đã ghi "đã dừng") ⇒ gỡ thẻ luôn cho gọn; không thì để lại một dòng ghi chú. */
      if (the.dataset.buoc && L.buoc.has(the.dataset.buoc)) { the.remove(); continue; }
      hang.textContent = '';
      hang.appendChild(tao('span', 'agt-ghichu', 'Lượt này đã kết thúc — yêu cầu không còn hiệu lực.'));
    }
    if (TT.luot === L) TT.luot = null;
  }

  // ── nối sự kiện ────────────────────────────────────────────────────────
  C.onCapNhat(nhanCapNhat);
  C.onXinQuyen(nhanXinQuyen);
  C.onDongCoTat((d) => {
    if (!d || d.dongCo !== TT.dongCo) return;
    TT.sessionId = null;
    datBan(false);
    datTt('Đã dừng');
    bao('AI agent đã dừng. Bấm "Chat mới" để mở lại.', 'info');
  });

  /* MỘT nút cho hai việc như tab "Tạo bằng AI": đang chạy thì bấm là DỪNG. */
  nutGui.onclick = () => {
    if (TT.dangChay) { if (TT.sessionId) C.dung(TT.sessionId); return; }
    guiTin();
  };
  $('[data-moi]').onclick = () => { xoaChat(); batPhien(); };
  nutMenu.onclick = moMenu;
  /* Bảng Cài đặt AI vừa lưu khoá: main đã tắt agent Claude đang giữ khoá cũ
     (agentChat/index.js#khiDoiKhoaAi) — nạp lại trạng thái, agent đang chọn dùng
     đúng nhà vừa đổi thì mở phiên mới. */
  window.addEventListener('bee:ai-caidat-luu', async (e) => {
    if (!daBatDau) return;
    const nha = e.detail && e.detail.nhaId;
    await napDongCo();
    const d = dc();
    /* Đổi khoá = agent tắt, phiên mới — giữ màn chat và mang hội thoại sang, như đổi agent. */
    if (d && NHA_CUA[d.id] && NHA_CUA[d.id] === nha) {
      luuLuot(TT.luot);
      if (TT.lichSu.length) TT.noiTiep = true;
      vachChia('Đã đổi khoá', 'khoa');
      batPhien();
    }
  });
  nutMenu.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !menu) { e.preventDefault(); moMenu(); }
  });
  /* Đăng xuất STUDIO: main đã đăng xuất ChatGPT và tắt agent của tài khoản đó —
     xoá hội thoại đang hiện và dựng lại tab (lần mở sau mới khởi động agent). */
  /* Mã kết nối Studio vừa đổi (agentChat/index.js#khiDoiMaKetNoi đã tắt agent): mời mở phiên mới. */
  if (C.onMatKetNoi) {
    C.onMatKetNoi(() => {
      TT.theHe += 1;
      TT.sessionId = null;
      TT.luot = null;
      datBan(false);
      datTt('Đã ngắt');
      bao('Mã kết nối Studio vừa đổi. Bấm "Chat mới" để mở lại cuộc chat.', 'info');
    });
  }
  if (C.onDatLai) {
    C.onDatLai(() => {
      TT.theHe += 1;
      TT.sessionId = null;
      TT.luot = null;
      TT.anh = [];
      veAnh();
      dongMenu();
      xoaChat();
      bao('');
      datBan(false);
      daBatDau = false;
      batDauNeuCan();
    });
  }
  /* Đặt SẴN một yêu cầu vào ô nhập — KHÔNG gửi (trang Mẫu → "Tạo dự án" ghép Nội dung + Lưu ý thành prompt; người
     dùng đọc lại rồi tự bấm Gửi). Phiên chưa sẵn sàng thì ô đang khoá nhưng chữ vẫn nằm đó, mở xong là gửi được. */
  window.__beeAgentChat = {
    dienChu(chu) {
      oChu.value = String(chu || '');
      if (!oChu.disabled) {
        oChu.focus();
        oChu.setSelectionRange(0, 0);
        oChu.scrollTop = 0;
      }
    },
  };
  nutGim.onclick = () => { if (!nutGim.disabled) oTep.click(); };
  oTep.onchange = () => { const ds = [...oTep.files]; oTep.value = ''; themAnh(ds); };
  /* Dán ảnh (Ctrl+V ảnh chụp màn hình) vào ô gõ = đính kèm. */
  oChu.addEventListener('paste', (e) => {
    const ds = [...((e.clipboardData && e.clipboardData.files) || [])].filter((f) => LOAI_ANH.includes(f.type));
    if (!ds.length || !TT.sessionId) return;
    e.preventDefault();
    themAnh(ds);
  });
  oChu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); guiTin(); }
  });

  /* Chỉ khởi động agent khi người dùng MỞ tab lần đầu — không chạy Codex/Claude
     ngầm mỗi lần mở app cho người chẳng bao giờ dùng tab này. */
  let daBatDau = false;
  async function batDauNeuCan() {
    if (daBatDau || pane.hidden) return;
    daBatDau = true;
    datBan(false);
    /* `napDongCo` có thể chờ `claude auth status` (tới 20 s / lượt) — có vòng tròn để khỏi trông như treo. */
    datTt('Đang kiểm agent…', true);
    await napDongCo();
    batPhien();
  }
  new MutationObserver(batDauNeuCan).observe(pane, { attributes: true, attributeFilter: ['hidden'] });
  batDauNeuCan();
}());
