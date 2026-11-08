'use strict';
/**
 * Trang Dựng video — phần ĐIỀU PHỐI: mọi câu lệnh khởi động và gắn sự kiện,
 * giữ ĐÚNG thứ tự của bản một-file cũ (thứ tự này có ý nghĩa: buildProjectRows
 * trước setSelectedProject, resyncRender sau cùng…). Logic nằm ở render/:
 *   core.js · project-list.js · tts-panel.js · jobs.js
 * Tách 02/09/2026 (audit Phase 2.3). Xem chú thích đầu các module về `RP`.
 */
(() => {
  const RP = window.__renderPage;
  const { $, $all, MAX_AUDIO_BYTES, apiGoi, apiPost, applyTheme, currentProject, fallbackOutputUrl, fallbackProject, projectMap, projects, rowForProject, setButtonLabel, setStatus, state, toggleTheme } = RP;

  /* NHỚ NGUỒN GIỌNG giữa các lần mở app (03/10/2026, chủ dự án yêu cầu): nút đang chọn ở tab Âm thanh
     (ElevenLabs / Edge TTS / Beeknoee AI) và chế độ ElevenLabs (Tải file / API). Trước đây chỉ sống trong RAM —
     mở lại app là về ElevenLabs · Tải file, ai dùng API phải vào tab Âm thanh chọn lại trước MỖI lần tạo video.
     Lưu vào settings.json (khoá `giongChon`, phải có trong KHOA_GIAO_DIEN_DUOC_GHI của ipc/projects.js — thiếu là
     bị bỏ LẶNG LẼ). Chỉ nhận đúng các giá trị đã biết: settings hỏng không làm kẹt tab. */
  const ENGINE_HOP_LE = new Set(['elevenlabs', 'edgetts', 'beeknoee', 'vieneu']);
  const CHE_DO_HOP_LE = new Set(['upload', 'tts']);
  let daChonTay = false;   // người dùng bấm trước khi kịp đọc settings ⇒ KHÔNG đè lựa chọn của họ
  const luuGiongChon = () => {
    try {
      window.beeknoee.settings.set({ giongChon: { engine: state.engine, elevenMode: RP.currentElevenMode() } })
        .catch(() => {});
    } catch { /* không lưu được thì thôi — lần sau chọn lại */ }
  };

  $all('[data-engine]').forEach((button) => {
    button.addEventListener('click', () => {
      daChonTay = true;
      RP.setEngine(button.dataset.engine);
      luuGiongChon();
    });
  });

  $all('input[name="elevenMode"]').forEach((input) => {
    input.addEventListener('change', () => {
      daChonTay = true;
      RP.syncElevenMode();
      luuGiongChon();
    });
  });
  RP.syncElevenMode();

  (async () => {
    let g = null;
    try { g = ((await window.beeknoee.settings.get()) || {}).giongChon; } catch { g = null; }
    if (daChonTay || !g || typeof g !== 'object') return;
    /* Khôi phục bằng ĐÚNG đường người dùng bấm (sự kiện change / click), không gán thẳng trạng thái: hàng nút
       hiển thị `.rl-giong` (render-layout.js) chỉ tô lại khi nghe được hai sự kiện đó — gán thẳng thì trạng thái
       thật đúng mà nút trên màn hình vẫn sáng chỗ cũ. Nguồn đang TẠM ẨN (giong.js `an`, vd Edge TTS) thì bỏ qua:
       render-layout tự đẩy về nguồn đầu tiên còn hiện. */
    const an = new Set(((window.__beeGiong && window.__beeGiong.GIONG) || []).filter((x) => x.an).map((x) => x.engine));
    if (!ENGINE_HOP_LE.has(g.engine) || an.has(g.engine)) return;
    if (CHE_DO_HOP_LE.has(g.elevenMode)) {
      const radio = document.querySelector(`input[name="elevenMode"][value="${g.elevenMode}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    const nut = document.querySelector(`[data-engine="${g.engine}"]`);
    if (nut && state.engine !== g.engine) nut.click();
  })();

  // Không còn khôi phục/ghi nhớ trạng thái gập: khối luôn mở.
  RP.syncAdvancedSettings();
  RP.loadElevenLabsConfig();
  RP.loadBeeknoeeConfig();

  const elevenVoiceInput = $('#elevenVoice');

  /* ── Popup 'Tự điền ID giọng' ─────────────────────────────────────────────
     #elevenVoice nay là input ẩn giữ GIÁ TRỊ ĐÃ CHỐT, không gõ thẳng vào được
     nữa — nên hai bộ nghe `paste`/`input` cũ ở đây đã bỏ, chúng không bao giờ
     bắn được nữa. Đường duy nhất ghi vào nó: chọn một dòng trong danh sách,
     hoặc bấm Lưu trong popup này SAU KHI ElevenLabs xác nhận ID dùng được. */
  const idPop = $('#elevenIdPop');
  const idO = $('#elevenIdO');
  if (idPop) {
    $('#elevenVoiceIdMo')?.addEventListener('click', () => RP.moIdPop(true));
    $('#elevenIdKiem')?.addEventListener('click', () => { RP.kiemIdGiong(); });
    $('#elevenIdLuu')?.addEventListener('click', () => { RP.luuIdGiong(); });
    $('#elevenIdHuy')?.addEventListener('click', () => RP.moIdPop(false));
    // Bấm ra nền tối = huỷ. Chỉ nhận cú bấm trúng ĐÚNG lớp phủ, không nhận cú
    // bấm lọt từ trong hộp ra — bấm hụt cạnh nút Lưu mà popup đóng là mất công gõ lại.
    idPop.addEventListener('click', (e) => { if (e.target === idPop) RP.moIdPop(false); });
    if (idO) {
      // Enter = Lưu (đã gồm cả bước kiểm). Esc = huỷ.
      idO.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); RP.luuIdGiong(); }
        else if (e.key === 'Escape') { e.preventDefault(); RP.moIdPop(false); }
      });
    }
  }

  // Chọn trong danh sách = điền vào ô gõ tay rồi lưu. Giữ MỘT nguồn giá trị duy
  // nhất (ô #elevenVoice) — mọi chỗ khác đã đọc từ đó, thêm nguồn thứ hai là có
  // ngày hai bên lệch nhau.
  const voiceCur = $('#elevenVoiceCur');
  const voicePop = $('#elevenVoicePop');
  if (voiceCur && voicePop) {
    voiceCur.addEventListener('click', () => RP.moBoChonGiong(voicePop.hidden));

    voicePop.addEventListener('click', (e) => {
      /* ⚠ `preventDefault` LÀ BẮT BUỘC, và đây là lý do.
         Cả bộ chọn nằm trong <label class="field">, mà phần tử "control" của
         label lại chính là nút bật/tắt #elevenVoiceCur (button là phần tử
         labelable đầu tiên bên trong). Nên MỌI cú bấm trong label đều được
         trình duyệt chuyển tiếp thành một cú bấm lên nút đó — tức là danh sách
         vừa đóng xong liền bị mở lại trong cùng một lượt sự kiện.
         Đã dính thật: chọn giọng thì giá trị lưu đúng, nhãn đổi đúng, nhưng
         danh sách cứ đứng nguyên. `stopPropagation` KHÔNG cứu được vì đây là
         hành vi MẶC ĐỊNH của label, không phải chuyện nổi bọt. */
      e.preventDefault();
      /* Nút nghe thử nằm TRONG dòng, nên phải chặn trước: bấm ▶ là để nghe,
         không phải để chọn giọng rồi đóng danh sách. */
      const nut = e.target.closest('.voice-play');
      if (nut) { e.stopPropagation(); RP.ngheThuGiong(nut); return; }
      const dong = e.target.closest('.voice-row');
      if (!dong || !dong.dataset.id) return;
      if (elevenVoiceInput) elevenVoiceInput.value = dong.dataset.id;
      RP.danhDauGiongDangChon();
      RP.scheduleElevenLabsVoiceSave(80);
      RP.capNhatNutDung();
      RP.moBoChonGiong(false);
    });

    /* Cuộn hoặc đổi cỡ cửa sổ khi danh sách đang mở: toạ độ `fixed` không tự
       bám theo nút, nên phải tính lại. Thiếu phần này thì cuộn một cái là danh
       sách đứng lơ lửng giữa màn hình, rời hẳn khỏi ô chọn.
       `capture: true` để bắt được cả cuộn bên trong `.rl-than` — sự kiện scroll
       KHÔNG nổi bọt lên document. */
    window.addEventListener('scroll', RP.datViTriPop, { capture: true, passive: true });
    window.addEventListener('resize', RP.datViTriPop);

    // Bấm ra ngoài thì đóng. Không có dòng này thì danh sách nằm lì trên màn
    // hình, che mất mấy ô phía dưới.
    document.addEventListener('click', (e) => {
      if (voicePop.hidden) return;
      if (e.target.closest('#elevenVoiceBox')) return;
      RP.moBoChonGiong(false);
    });

    document.addEventListener('keydown', (e) => {
      if (voicePop.hidden) return;
      if (e.key === 'Escape') { RP.moBoChonGiong(false); voiceCur.focus(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
      const ds = [...voicePop.querySelectorAll('.voice-row')];
      if (!ds.length) return;
      e.preventDefault();
      let i = ds.findIndex((r) => r.classList.contains('hover'));
      if (e.key === 'Enter') {
        const dong = ds[i] || ds.find((r) => r.classList.contains('chon'));
        if (dong) {
          if (elevenVoiceInput) elevenVoiceInput.value = dong.dataset.id;
          RP.danhDauGiongDangChon();
          RP.scheduleElevenLabsVoiceSave(80);
          RP.capNhatNutDung();
          RP.moBoChonGiong(false);
        }
        return;
      }
      if (i < 0) i = ds.findIndex((r) => r.classList.contains('chon'));
      const ke = Math.max(0, Math.min(ds.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      ds.forEach((r) => r.classList.remove('hover'));
      ds[ke].classList.add('hover');
      ds[ke].scrollIntoView({ block: 'nearest' });
    });
  }

  const elevenFormatSelect = $('#elevenFormat');
  if (elevenFormatSelect) elevenFormatSelect.addEventListener('change', RP.saveElevenLabsFormat);

  /* ⚠ KHÔNG còn tự lưu khi dán hay khi gõ.
     Bản trước lưu ngầm sau 80ms kể từ lúc dán, 700ms kể từ lúc gõ. Hệ quả:
     dán hụt nửa chuỗi là khoá đang chạy bị ghi đè bằng chuỗi hỏng mà không ai
     kịp biết; và chính phép thử của mình bắn một sự kiện `input` lên ô rỗng
     cũng đủ thổi bay khoá. Nay phải bấm Lưu. */
  RP.khoiKeyEleven.noi();
  // ── Beeknoee Platform: cùng nếp nối như ElevenLabs ngay trên ──
  RP.khoiKeyBee.noi();
  const beeModelSel = $('#beeModel');
  const beeVoiceSel = $('#beeVoice');
  // Đổi model/giọng giữa lúc đang phát bản thử là bản đang phát hết còn đúng
  // với lựa chọn — dừng luôn cho khỏi gây hiểu nhầm.
  if (beeModelSel) beeModelSel.addEventListener('change', () => { RP.dungNgheThu(); RP.dungOBeeGiong(); RP.nhoBeeCauHinh(); });
  if (beeVoiceSel) beeVoiceSel.addEventListener('change', () => { RP.dungNgheThu(); RP.nhoBeeCauHinh(); });
  const beeNgheNut = $('#beeNghe');
  if (beeNgheNut) beeNgheNut.addEventListener('click', (e) => { e.preventDefault(); RP.ngheThuBee(beeNgheNut); });

  $all('.speed-preset[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      const speedInput = $('#renderSpeed');
      if (speedInput) speedInput.value = button.dataset.speed;
      // `chuanHoaOTocDo` chứ không `syncSpeedPresets`: bấm nút chọn nhanh cũng
      // phải DỌN lời báo còn sót từ lần gõ sai trước đó.
      RP.chuanHoaOTocDo();
    });
  });

  const speedInput = $('#renderSpeed');
  if (speedInput) {
    // Lúc đang gõ chỉ tô lại nút chọn nhanh — xem vì sao ở `chuanHoaOTocDo()`.
    speedInput.addEventListener('input', RP.syncSpeedPresets);
    /* `change` là đủ — nó bắn đúng lúc rời ô mà giá trị đã đổi, kể cả khi rời
       bằng cách bấm thẳng vào nút Tạo video. Đã thử thêm `blur`: trong phép thử
       thật nó KHÔNG bắn lần nào (ô chưa từng thực sự nhận focus), tức một tay
       nghe chưa bao giờ chạy — bỏ đi thay vì giữ một lớp không kiểm được. */
    speedInput.addEventListener('change', RP.chuanHoaOTocDo);
    // ↑/↓ bước 0,05 — thẻ `type="number"` cũ làm sẵn, ô chữ thì phải tự làm.
    speedInput.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      RP.buocTocDo(e.key === 'ArrowUp' ? 1 : -1);
    });
  }

  const elevenFileInput = $('#elevenFile');
  const elevenFileName = $('#elevenFileName');
  if (elevenFileInput && elevenFileName) {
    elevenFileInput.addEventListener('change', () => {
      const file = elevenFileInput.files?.[0];
      elevenFileName.textContent = file ? file.name : 'Chưa chọn file';
      // Nhớ file này CHO DỰ ÁN ĐANG CHỌN. Xem ghi chú ở `nhoMp3`.
      if (file && state.project) RP.nhoMp3(state.project, file);
      // Thẻ file (tên · dung lượng · thời lượng · nghe · bỏ) — xem `veTheFile`.
      RP.noiTheFile();
      RP.veTheFile(file || null);
      RP.capNhatNutDung();   // vừa có file thì mở khoá nút ngay
    });
  }

  const projectSelect = $('#projectSelect');
  if (projectSelect) {
    projectSelect.addEventListener('change', () => RP.setSelectedProject(projectSelect.value));
  }

  // Mọi thao tác trong danh sách dự án đi qua MỘT handler trên thẻ bao ngoài.
  //
  // Trước đây gắn thẳng vào từng nút bằng `$all('.copy-script-btn')...` — sao
  // chép y nguyên từ bản web, nơi các dòng do máy chủ dựng sẵn trong HTML nên
  // lúc gắn là đã có nút. Bản app này dựng dòng bằng `buildProjectRows()` chạy
  // MÃI phía dưới, nên `$all` khớp 0 phần tử: nút Copy Script và nút xoá video
  // trông vẫn bình thường mà bấm không ra gì, không báo lỗi, không log.
  //
  // Uỷ quyền sự kiện thì thứ tự chạy không còn quan trọng, và dòng dựng lại lúc
  // nào cũng vẫn bấm được.
  const projectListEl = $('#projectList');
  if (projectListEl) {
    projectListEl.addEventListener('click', (event) => {
      const copyNameButton = event.target.closest('.copy-name-btn[data-project]');
      if (copyNameButton) {
        RP.copyProjectName(copyNameButton.dataset.project, copyNameButton);
        return;
      }
      const copyButton = event.target.closest('.copy-script-btn[data-project]');
      if (copyButton) {
        RP.copyProjectScript(copyButton.dataset.project, copyButton);
        return;
      }
      const deleteButton = event.target.closest('.delete-project-btn[data-project]');
      if (deleteButton) {
        if (!deleteButton.disabled) RP.xoaDuAn(deleteButton.dataset.project);
        return;
      }
      // Bấm vào khoảng trống của dòng = chọn dự án. Nút và link đã xử lý ở trên
      // hoặc tự chạy (thẻ <a>), không được coi là chọn dòng.
      if (event.target.closest('a, button')) return;
      const row = event.target.closest('.project-row[data-project]');
      if (row) RP.setSelectedProject(row.dataset.project);
    });
  }

  /* Khối gắn sự kiện cho #deleteSelectedOutput ĐÃ GỠ cùng hàm deleteOutput.
     Nút đó không còn trong markup từ lâu nên `$()` trả null và khối không bao
     giờ chạy — nhưng nó vẫn tham chiếu tới hàm đã gỡ, để lại là một quả mìn
     chờ ngày ai đó thêm lại cái nút. */

  const revealOutputButton = $('#revealOutput');
  if (revealOutputButton) {
    revealOutputButton.addEventListener('click', () => RP.revealOutput(revealOutputButton.dataset.project || state.project));
  }

  const stopRenderButton = $('#stopRender');
  if (stopRenderButton) {
    stopRenderButton.addEventListener('click', RP.stopRender);
  }


  // Nút "Làm mới" nằm ở tiêu đề danh sách. Nạp lại trang để preload quét lại
  // thư mục nguồn — window.__PROJECTS__ chỉ dựng một lần lúc nạp (cạm bẫy #40).
  const workspaceBtn = $('#createWorkspace');
  if (workspaceBtn) {
    workspaceBtn.addEventListener('click', async () => {
      workspaceBtn.disabled = true;
      try {
        const r = await window.beeknoee.projects.createWorkspace();
        if (r && r.canceled) return;
        setStatus('Đã dựng ' + r.root + ' — chép ' + r.copied + ' file'
          + (r.skipped ? ', bỏ qua ' + r.skipped + ' file đã có' : '')
          + '. Đang nạp lại...', 'good');
        setTimeout(() => window.location.reload(), 1400);
      } catch (e) {
        setStatus(String((e && e.message) || e).replace(/^Error invoking remote method '[^']+':s*/, ''), 'bad');
      } finally {
        workspaceBtn.disabled = false;
      }
    });
  }

  const refreshList = $('#refreshList');
  if (refreshList) {
    refreshList.addEventListener('click', async () => {
      if (refreshList.disabled) return;
      refreshList.disabled = true;
      refreshList.classList.add('dang-quay');
      try {
        const n = await RP.lamMoiDanhSach();
        setStatus(`Đã quét lại thư mục nguồn — ${n} dự án.`, 'good');
      } catch (e) {
        setStatus('Không quét lại được: ' + String((e && e.message) || e), 'bad');
      } finally {
        refreshList.disabled = false;
        refreshList.classList.remove('dang-quay');
      }
    });
  }

  $all('[data-source-root-select]').forEach((button) => {
    button.addEventListener('click', RP.selectSourceRootFromFinder);
  });

  RP.buildProjectRows();
  RP.buildRenderSteps();
  // Vẽ bảng ở trạng thái chờ ngay khi mở app, không đợi bấm render.
  RP.setRenderState('', [], 'cho');

  /* Bản 1.2.0 trở về trước lưu nền sáng/tối dưới khoá mang tên sản phẩm cũ
     (`<tên>-theme`). Lần đầu mở bản mới: nhận giá trị đó sang `bee-theme` rồi xoá
     khoá cũ — không thì khách đang dùng nền tối bị trả về nền sáng ngay sau khi
     cập nhật. Dò theo DẠNG khoá thay vì ghi lại tên cũ trong mã; chỉ nhận đúng
     'light' / 'dark' và khoá không có dấu `:` nên khoá của deck
     (`preview-settings:<deck>`) không bao giờ lọt. */
  RP.nhanThemeCu = function nhanThemeCu(kho) {
    try {
      if (kho.getItem('bee-theme')) return;
      for (let i = 0; i < kho.length; i += 1) {
        const k = kho.key(i);
        if (!k || k === 'bee-theme' || !/^[a-z0-9]+-theme$/.test(k)) continue;
        const v = kho.getItem(k);
        if (v === 'light' || v === 'dark') {
          kho.setItem('bee-theme', v);
          kho.removeItem(k);
          return;
        }
      }
    } catch (e) { /* kho không đọc được thì thôi — mở bằng nền mặc định */ }
  };
  RP.nhanThemeCu(localStorage);
  const storedTheme = localStorage.getItem('bee-theme');
  applyTheme(storedTheme || 'light');
  $all('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', toggleTheme);
  });

  // Chọn dòng nay nằm trong handler uỷ quyền ở #projectList (xem phía trên).

  const startButton = $('#startRender');
  if (startButton) startButton.addEventListener('click', RP.startRender);

  const initialFromUrl = new URLSearchParams(window.location.search).get('project');
  const initialProject = window.__INITIAL_PROJECT__ || initialFromUrl || projects[0]?.name;
  if (initialProject) RP.setSelectedProject(initialProject, false);
  RP.syncSpeedPresets();

  // Hỏi hạn mức SAU khi dựng xong giao diện, không chờ nó: đây là một lượt gọi
  // mạng, để trước thì mở app bị treo trắng vài giây mỗi lần mạng chậm.
  RP.napHanMuc();

  // Bám lại job đang chạy nếu trang vừa tải lại giữa lúc render (đổi thư mục
  // nguồn, mở lại app). Không chờ — không được để nó làm treo màn hình đầu.
  // `.catch` phòng xa: đây là async bắn-rồi-quên, để reject sổng ra thì
  // `baoLoi.js` bắt nhầm thành lỗi tự động.
  /* Ô tìm kiếm và ô lọc → vẽ lại bảng.
     Ô lọc do render-layout.js dựng lúc chạy nên có thể chưa tồn tại ở thời
     điểm này — uỷ quyền lên `document` thay vì gắn thẳng vào phần tử. Gắn
     thẳng thì mất tác dụng mà không báo lỗi gì. */
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'timDuAn') {
      RP.datLaiSoDongHien();   // gõ từ khoá mới thì về lại 10 dòng đầu
      RP.buildProjectRows();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'locTrangThai') {
      RP.datLaiSoDongHien();
      RP.buildProjectRows();
    }
  });

  /* Nạp lại bản đồ mp3 đã chọn RỒI mới vẽ lại dự án đang chọn — không thì lần
     mở app đầu tiên ô file trống trong khi settings có nhớ. */
  RP.napMp3DaChon().then(() => {
    if (state.project) RP.veMp3DaChon(state.project);
  }).catch(() => {});

  if (window.beeknoee.render.onHangDoi) window.beeknoee.render.onHangDoi(RP.apHangDoi);

  RP.resyncRender().catch(() => {}).finally(RP.baoBiRender);
  window.setTimeout(RP.baoBiGhi, RP.CHO_DO_MS);
  /* CHỐT CHẶN. `fetch` không có thời hạn mặc định: máy chủ cục bộ chấp nhận kết
     nối rồi không bao giờ trả lời thì lời hứa treo vĩnh viễn, `finally` không
     bao giờ chạy, và cả bảng đứng ở "Đang kiểm tra…" cho tới khi tắt app —
     tệ hơn hẳn cái sai mà nó sinh ra để tránh.
     Quá hạn thì thà hiện trạng thái đọc từ đĩa (đúng với mọi deck không đang
     render và không đang bị ghi, tức gần như tất cả) còn hơn treo mãi. */
  window.setTimeout(RP.epKetThucDo, 8000);

  /* Thư mục nguồn đổi → nạp lại danh sách, không phải bấm "Làm mới".
   *
   * Main đã gộp sự kiện (800ms) và đã lọc bỏ `output/` nên lúc render ghi hàng
   * nghìn file cũng không bắn về đây. Vẫn thêm một lớp chặn nữa ở đây: đang
   * render thì BỎ QUA, vì `lamMoiDanhSach()` vẽ lại toàn bộ bảng và sẽ giật
   * ngay giữa lúc người dùng đang nhìn tiến độ. Render xong `resyncRender()`
   * tự nạp lại. */
  if (window.beeknoee && window.beeknoee.projects && window.beeknoee.projects.onDoi) {
    window.beeknoee.projects.onDoi(() => {
      if (state.busy) return;
      RP.lamMoiDanhSach().catch(() => {});
    });
  }

  // Mở ra cho login.js gọi lại sau khi đăng nhập, và cho pages.js gọi mỗi lần
  // quay lại tab Dựng video (khôi phục trạng thái render đang chạy).
  window.__beeRender = { napHanMuc: RP.napHanMuc, resync: RP.resyncRender };
})();
