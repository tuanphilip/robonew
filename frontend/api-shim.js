'use strict';
/**
 * Chặn `fetch` và định tuyến `/api/*` sang IPC.
 *
 * Nhờ lớp này mà `render-page.js` (65 KB) và toàn bộ JS nội tuyến của giao diện
 * gốc giữ NGUYÊN VĂN — chúng vẫn tưởng đang nói chuyện với web_server.py.
 * Lấy bản giao diện mới từ source về là dùng được ngay, không phải sửa lại 18
 * chỗ gọi API.
 *
 * Chạy TRƯỚC mọi script khác (thẻ nạp nằm ngay đầu <head>).
 */
(() => {
  const bridge = window.beeknoee;
  if (!bridge) {
    console.error('[shim] thiếu window.beeknoee — preload chưa nạp?');
    return;
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  /** Gỡ vỏ `Error invoking remote method '...'` mà ipcRenderer bọc quanh lỗi. */
  const clean = (m) => String(m || 'Lỗi không rõ')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');

  /* ══ MỘT nguồn trạng thái job (audit Phase 3.4, 02/09/2026) ═══════════════
   *
   * Trước đây shim giữ một Map `jobs` riêng, nuôi bằng ba sự kiện render:step/
   * done/error — tức trạng thái job tồn tại ở BA lớp (main.jobState → Map này →
   * state của render-page), và cả rừng chú thích "đồng bộ lại với main", cùng
   * các cuộc đua khi tải lại trang, đều sinh ra từ đó. Nay mọi /api/jobs/* đọc
   * THẲNG ảnh chụp `render:status` của main: `id` luôn là 'current' vì main chỉ
   * chạy MỘT lượt cùng lúc (hàng đợi tuần tự); lượt xếp hàng thì giao diện
   * không poll (xepHang), tới lượt sẽ có sự kiện render:hangdoi bật poll lại.
   *
   * Còn giữ đúng MỘT thứ ở đây: lỗi KHÔNG KHỞI ĐỘNG được (tiến trình Python
   * không lên nổi) — lỗi này xảy ra TRƯỚC khi main kịp đặt jobState, nên ảnh
   * chụp vẫn là 'idle' và giao diện sẽ đứng ở "Đang chờ tới lượt…" mãi. Đã xảy
   * ra thật trên Mac M1 của khách. */
  let loiKhoiDong = '';
  let loiKhoiDongLuc = 0;   // mốc gửi lệnh bị lỗi — lượt nào bắt đầu SAU mốc này thì lỗi hết giá trị

  /** Tên deck từ đường dẫn thư mục. */
  const tenTuDuong = (d) => (d ? String(d).split(/[\\/]/).filter(Boolean).pop() : '');

  /** Dựng "job" theo mô hình cũ (render-page poll) TỪ trạng thái sống ở main. */
  function jobFromStatus(st) {
    return {
      id: 'current',
      project: tenTuDuong(st.projectDir),
      // 'dung' = lượt XUẤT BẢN DỰNG của trình dựng (render/queue.js) — giao diện nói khác "Tạo video".
      loai: st.loai || 'dung-video',
      // Đang chạy thì luôn là 'running'; xong rồi thì lấy trạng thái cuối
      // (done/failed/cancelled) để tab mở lại vẽ đúng kết quả.
      status: st.running ? 'running' : st.status,
      phase: st.phase || undefined,
      progress: typeof st.progress === 'number' ? st.progress : 0,
      // Giây. 0 = chưa tới bước timeline nên chưa biết — giao diện tự hiểu.
      voiceover_duration: Number(st.voiceoverDuration) || 0,
      logs: st.message ? `${st.phase || 'py'}: ${st.message}\n` : '',
      video_url: st.videoPath || undefined,
      ban_dung: st.banDungPath || undefined,
      error: st.error || undefined,
      started_at: st.startedAt ? st.startedAt / 1000 : undefined,
      finished_at: st.ketThucLuc ? st.ketThucLuc / 1000 : undefined,
    };
  }

  /** Ảnh chụp job hiện tại; null nếu không có gì (chưa chạy lượt nào). */
  async function jobHienTai() {
    const st = await bridge.render.status().catch(() => null);
    /* Lỗi khởi động luôn thuộc về LƯỢT MỚI NHẤT (đặt lại ở mỗi /api/render), nên
       hễ main không chạy là trả nó — kể cả khi ảnh chụp còn giữ 'done' của lượt
       trước. Bản đầu chỉ xét khi status === 'idle': lượt hai mà sidecar không
       lên nổi thì giao diện vẽ lại video của lượt một (rà soát Phase 3). */
    const coLuotMoiHon = Boolean(st && st.startedAt && st.startedAt > loiKhoiDongLuc);
    if (loiKhoiDong && !(st && st.running) && !coLuotMoiHon) {
      return { id: 'current', status: 'failed', error: loiKhoiDong, logs: `\nLỖI: ${loiKhoiDong}\n`, progress: 0 };
    }
    if (!st || (!st.running && st.status === 'idle')) return null;
    return jobFromStatus(st);
  }

  const ROUTES = [
    // ---------------------------------------------------------- đọc
    [/^\/api\/health$/, async () => {
      const h = await bridge.sidecar.health();
      return json({ ok: h.ok, root: h.resourcesDir, projects: 0 });
    }],

    [/^\/api\/source-root$/, async (_m, init) => {
      if (init && init.method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        const root = body.sourceRoot || body.source_root;
        if (root) await bridge.settings.set({ sourceRoot: root });
      }
      const s = await bridge.settings.get();
      const projects = await bridge.projects.list(s.sourceRoot);
      return json({
        source_root: s.sourceRoot || '',
        source_mode: 'collection',
        options: s.sourceRoot ? [{ label: 'Hiện tại', path: s.sourceRoot, mode: 'collection', projects: projects.length, active: true }] : [],
        projects: projects.map(toLegacyProject),
      });
    }],

    [/^\/api\/source-root\/select$/, async () => {
      const root = await bridge.projects.pickRoot();
      const s = await bridge.settings.get();
      const projects = await bridge.projects.list(root || s.sourceRoot);
      return json({
        source_root: root || s.sourceRoot || '',
        source_mode: 'collection',
        options: [],
        projects: projects.map(toLegacyProject),
      });
    }],

    [/^\/api\/projects$/, async () => {
      const s = await bridge.settings.get();
      const projects = await bridge.projects.list(s.sourceRoot);
      return json({ projects: projects.map(toLegacyProject) });
    }],

    [/^\/api\/slide-script$/, async (_m, init, url) => {
      // POST = Preview Editor trong deck lưu lời thoại đã sửa. Thiếu nhánh này
      // thì nó gọi POST mà nhận về nội dung của GET, tưởng lưu xong nhưng file
      // không đổi — hỏng trong im lặng.
      if (init && init.method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        const dir = await resolveProjectDir(body.project);
        try {
          const r = await bridge.projects.writeScript(dir, body.lines, {
            allowCountChange: !!(body.allowCountChange || body.allow_count_change),
          });
          return json({ project: body.project, lines: r.lines });
        } catch (e) {
          return json({ error: clean(e && e.message) }, 400);
        }
      }
      const name = url.searchParams.get('project');
      const dir = await resolveProjectDir(name);
      const d = await bridge.projects.read(dir);
      return json({ project: name, lines: d.lines, text: d.lines.join('\n') });
    }],

    [/^\/api\/preview-settings$/, async (_m, init, url) => {
      if (init && init.method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        const dir = await resolveProjectDir(body.project);
        await bridge.projects.writePreviewSettings(dir, body.settings || {});
        return json({ ok: true, project: body.project, settings: body.settings || {} });
      }
      const name = url.searchParams.get('project');
      const dir = await resolveProjectDir(name);
      const d = await bridge.projects.read(dir);
      return json({ project: name, settings: d.previewSettings || {} });
    }],

    // ---------------------------------------------------------- render
    [/^\/api\/render$/, async (_m, init) => {
      const body = JSON.parse(init.body || '{}');
      const tuyChon = await tuyChonRenderTu(body);
      if (tuyChon.loi) return json({ error: tuyChon.loi }, 400);

      /* Đang bận thì lượt này ĐI VÀO HÀNG ĐỢI, không còn bị từ chối.
       *
       * Trước đây chỗ này trả về CHÍNH job đang chạy để giao diện bám tiếp —
       * đúng ở thời điểm chưa có hàng đợi, nhưng nay sẽ nói dối: người dùng bấm
       * cho deck B mà màn hình vẽ tiến trình của deck A.
       *
       * Vẫn hỏi trạng thái TRƯỚC để biết mà trả lời cho đúng, nhưng NGƯỜI QUYẾT
       * ĐỊNH là main (`render:start`) — nó mới biết chắc lúc nhận lệnh còn bận
       * hay không. Job vừa xong đúng khe giữa hai lệnh này thì main cho chạy
       * luôn, giao diện lỡ hiện "đã xếp hàng" một nhịp rồi sự kiện
       * `render:hangdoi` sửa lại ngay. */
      const dangChay = await bridge.render.status().catch(() => null);
      const banRon = Boolean(dangChay && dangChay.running);

      loiKhoiDong = '';
      const tGui = Date.now();
      bridge.render
        .start(tuyChon.opts)
        .catch(async (e) => {
          /* ⚠ render:start từ chối với MỌI lượt hỏng hay bị dừng (main ném lại
             lỗi sau khi đã ghi jobState.status = failed/cancelled), không chỉ
             lỗi khởi động. Chỉ được nhớ câu lỗi khi main CHƯA HỀ nhận lượt này —
             tức ảnh chụp không có lượt nào bắt đầu từ mốc gửi trở đi (lỗi ném
             trước chayMotLuot: hàng đợi đầy, tham số hỏng). Nhớ nhầm là bấm
             Dừng xong giao diện vẽ "không thành công" thay vì "đã dừng", hoặc
             lượt xếp hàng sau đó xong rồi vẫn hiện lỗi của lượt trước. */
          if (banRon) { console.warn('[render] không xếp hàng được:', e && e.message); return; }
          const st = await bridge.render.status().catch(() => null);
          if (st && (st.running || (st.startedAt && st.startedAt >= tGui))) return;   // main đã nhận → lỗi đã ở jobState
          loiKhoiDong = clean(e && e.message) || 'Không khởi động được bộ dựng video.';
          loiKhoiDongLuc = tGui;
        });
      return json({ id: 'current', project: body.project, status: 'queued', logs: '', xepHang: banRon }, 202);
    }],

    [/^\/api\/jobs\/[^/]+\/cancel$/, async () => {
      await bridge.render.cancel();
      const j = await jobHienTai();
      if (!j) return json({ error: 'Không thấy job' }, 404);
      if (j.status === 'running') j.status = 'cancelling';
      return json(j);
    }],
    // `id` nào cũng là lượt hiện tại — xem chú thích ở jobFromStatus.
    [/^\/api\/jobs\/[^/]+$/, async () => {
      const j = await jobHienTai();
      return j ? json(j) : json({ error: 'Không có job' }, 404);
    }],
    [/^\/api\/output\/reveal$/, async (_m, init) => {
      const body = JSON.parse(init.body || '{}');
      const dir = await resolveProjectDir(body.project);
      // Hỏi bên chính đường dẫn thật thay vì ghép cứng 'final_video.mp4':
      // deck render từ bản mới mang tên deck, ghép cứng là mở nhầm chỗ trống.
      const v = await bridge.preview.video(body.project, null).catch(function () { return null; });
      await bridge.projects.reveal(v && v.path ? v.path : `${dir}\\output`);
      return json({ ok: true });
    }],

    [/^\/api\/project\/delete$/, async (_m, init) => {
      const body = JSON.parse(init.body || '{}');
      if (!body.confirm) return json({ error: 'Thiếu xác nhận xoá' }, 400);
      const dir = await resolveProjectDir(body.project);
      try {
        const r = await bridge.projects.deleteProject(dir);
        // Bộ nhớ đệm danh sách dự án giờ đã cũ — xoá đi, nếu không lần render
        // sau `resolveProjectDir` vẫn trả về thư mục vừa bị bốc vào Thùng rác.
        projectCache = null;
        return json({ ok: true, project: r.ten || body.project });
      } catch (e) {
        return json({ error: clean(e && e.message) }, 400);
      }
    }],

    // ------------------------------------------------- chưa hỗ trợ (v1.1)
    [/^\/api\/output\/delete$/, async (_m, init) => {
      const body = JSON.parse(init.body || '{}');
      if (!body.confirm) return json({ error: 'Thiếu xác nhận xoá' }, 400);
      const dir = await resolveProjectDir(body.project);
      const r = await bridge.projects.deleteOutput(dir);
      return json({ ok: true, project: body.project, deleted: r.deleted });
    }],
    [/^\/api\/preview-bgm$/, async (_m, init) => {
      const body = JSON.parse(init.body || '{}');
      const dir = await resolveProjectDir(body.project);
      try {
        const audio = await bridge.projects.writeBgm(dir, body.audio);
        return json({ project: body.project, audio });
      } catch (e) {
        return json({ error: clean(e && e.message) }, 400);
      }
    }],
    [/^\/api\/tts\/elevenlabs\/config$/, async (_m, init) => {
      try {
        if (init && init.method === 'POST') {
          const body = JSON.parse(init.body || '{}');
          return json(await bridge.tts.elevenSave(body));
        }
        return json(await bridge.tts.elevenConfig());
      } catch (e) {
        return json({ error: clean(e && e.message) }, 400);
      }
    }],

    [/^\/api\/tts\/vbee\/config$/, async (_m, init) => {
      try {
        if (init && init.method === 'POST') {
          const body = JSON.parse(init.body || '{}');
          return json(await bridge.tts.vbeeSave(body));
        }
        return json(await bridge.tts.vbeeConfig());
      } catch (e) {
        return json({ error: clean(e && e.message) }, 400);
      }
    }],

    [/^\/api\/tts\/vbee\/voices$/, async () => {
      try {
        return json(await bridge.tts.vbeeVoices());
      } catch (e) {
        return json({ error: clean(e && e.message) }, 400);
      }
    }],

    [/^\/api\/tts\/elevenlabs\/voices$/, async () => {
      try {
        return json(await bridge.tts.elevenVoices());
      } catch (e) {
        return json({ voices: [], error: clean(e && e.message) });
      }
    }],

    // Kiểm một Voice ID gõ tay trước khi lưu. KHÔNG tốn credit — bên ElevenLabs
    // đây là endpoint đọc. Phải hỏi API chứ đừng dò trong danh sách đang hiện:
    // danh sách ấy còn trộn 20 giọng gợi ý ghim sẵn trong app, giọng nhóm đó có
    // thể chưa được thêm vào tài khoản nên dò ra "có" mà gọi thì 404.
    [/^\/api\/tts\/elevenlabs\/kiem-voice$/, async (_m, init) => {
      try {
        const body = JSON.parse((init && init.body) || '{}');
        return json(await bridge.tts.elevenKiemVoice(body.voiceId));
      } catch (e) {
        return json({ ok: false, ten: '', error: clean(e && e.message) });
      }
    }],

    [/^\/api\/tts\/elevenlabs\/quota$/, async () => {
      try {
        return json(await bridge.tts.elevenQuota());
      } catch (e) {
        return json({ error: clean(e && e.message) });
      }
    }],

    // Thử tài khoản có dùng được một định dạng audio không — chỉ gọi khi key
    // thiếu quyền đọc gói (xem thuFormatBiKhoa trong render-page.js).
    [/^\/api\/tts\/elevenlabs\/thu-format$/, async (_m, init) => {
      try {
        const body = JSON.parse((init && init.body) || '{}');
        return json(await bridge.tts.elevenThuFormat(body.format));
      } catch (e) {
        return json({ duocPhep: null, error: clean(e && e.message) });
      }
    }],

    // Beeknoee Platform TTS: main chỉ giữ khoá; model/giọng là danh sách dựng
    // sẵn ở giao diện nên không có gì phải hỏi Python.
    [/^\/api\/tts\/beeknoee\/config$/, async (_m, init) => {
      try {
        if (init && init.method === 'POST') {
          const body = JSON.parse(init.body || '{}');
          return json(await bridge.tts.beeSave(body));
        }
        return json(await bridge.tts.beeConfig());
      } catch (e) {
        return json({ error: clean(e && e.message) }, 400);
      }
    }],
    // `/api/social/*` (YouTube/Facebook của bản web) đã gỡ 02/09/2026 cùng với
    // toàn bộ mã upload trong render-page.js — bản desktop chưa từng nối.
  ];

  function toLegacyProject(p) {
    return {
      name: p.name,
      /* ⚠ CÓ HAI HÀM TÊN `toLegacyProject`: một ở `main/duAn.js`, một ở đây.
         Giao diện đọc `/api/projects` nên chạy qua BẢN NÀY — thêm khoá vào bản
         kia mà quên bản này thì dữ liệu tới renderer vẫn thiếu, và không có lỗi
         nào báo. Đã dính đúng vậy với khoá `khung` (15/09/2026): nhãn 16:9 không
         bao giờ hiện. */
      khung: p.khung || 'doc',
      loai: p.loai || 'deck',
      url: `beeknoee://slide/${encodeURIComponent(p.name)}/`,
      source_path: p.path,
      has_script: p.hasScript,
      script_count: p.scriptLines,
      has_output: p.hasVideo,
      output_url: p.videoPath || null,
      video_url: p.videoPath || null,
      // Tên tệp video CUỐI (deck có chỉnh sửa timeline: `<tên>-dung.mp4`) — xem src/dung/banCuoi.js.
      video_file: p.videoName || null,
      // Deck đang được ghi dở (AI dựng chưa xong) — giao diện dùng để hiện
      // trạng thái "Đang thiết kế" và ẩn nút Edit.
      dang_thiet_ke: !!p.dangThietKe,
      video_cu: !!p.videoCu,
      // Mốc sửa gần nhất (ms) cho cột "Ngày cập nhật" — xem cảnh báo hai hàm ở trên.
      updated_at: p.updatedAt || 0,
    };
  }

  let projectCache = null;
  /**
   * Dịch payload của FORM thành tuỳ chọn thật của `render:start`.
   *
   * ⚠ MỘT bản dịch, HAI nơi gọi: nút "Tạo video" (qua `/api/render`) và tab
   * "Tạo bằng AI" (trước đây: `ai-tao.js` → `ai.batDau({tuyChonDung})`; từ
   * 18/09/2026 AI thôi dựng video nên đường đó đã gỡ). Viết bản thứ hai
   * cho đường AI là chắc chắn lệch — chỗ này mang cả ánh xạ engine, cả đường
   * ghi file voiceover ra đĩa, cả cái bẫy "đừng ép số tốc độ ở đây".
   *
   * Trả `{opts}` khi dịch được, `{loi}` khi không — để phía gọi tự chọn cách
   * báo (mã 400 của shim, hay một dòng đỏ trong bảng chạy của AI).
   */
  async function tuyChonRenderTu(body) {
    let dir;
    try {
      /* "Tạo video" khi đang mở một BỘ SLIDE PHỤ (GĐ3.7): dựng CẢ DỰ ÁN mẹ — bộ phụ chỉ là một clip của nó, dựng
         chung một lượt (render/queue.js). */
      const bo = /^(.+?)::[a-z0-9][a-z0-9-]{0,39}$/.exec(String(body.project || ''));
      // Giọng tải lên chọn khi đang mở bộ phụ: nó sẽ thành giọng của bộ ĐẦU — không đoán, báo (rà 3.7).
      if (bo && (body.audio || body.audioPath)) return { loi: `Đang mở bộ slide phụ — về dự án "${bo[1]}" rồi chọn giọng tải lên và bấm "Tạo video".` };
      dir = await resolveProjectDir(bo ? bo[1] : body.project);
    } catch (e) {
      return { loi: clean(e && e.message) || 'Không thấy dự án.' };
    }

    // Ánh xạ engine giao diện → engine của main/pipeline: một bảng ở giong.js.
    const engine = window.__beeGiong.engineMainTu(body.engine, body.mode);

    // Chế độ "Tải file": giao diện gửi audio dạng base64 ngay trong thân yêu
    // cầu này (đường của web_server.py cũ). PHẢI ghi ra đĩa rồi đưa đường dẫn
    // thật xuống dưới — bản trước bỏ quên hẳn `body.audio`, nên Python nhận
    // `audioPath = None` và chết ở `Path(None)`.
    //
    // Ghi TRƯỚC khi tạo job: hỏng ở đây thì báo lỗi ngay tại nút bấm, chứ
    // đừng tạo một job chắc chắn thất bại rồi bắt người dùng đi đọc log.
    let audioPath;
    if (engine === 'upload') {
      /* `audioPath` = file đã nhớ từ lần trước, đưa thẳng đường dẫn xuống,
         không phải chép lại vào deck. Đường này dùng khi vừa mở lại app hoặc
         vừa đổi dự án: ô input trống nhưng giao diện còn nhớ đã chọn gì. */
      if (body.audioPath) {
        audioPath = body.audioPath;
      } else if (body.audio) {
        try {
          const saved = await bridge.projects.writeVoiceover(dir, body.audio);
          audioPath = saved.path;
        } catch (e) {
          return { loi: clean(e && e.message) };
        }
      } else {
        return { loi: 'Chưa chọn file voiceover.' };
      }
    }

    return {
      opts: {
        projectDir: dir,
        engine,
        /* Chuyển NGUYÊN, đừng ép số ở đây. `Number(x) || 1.1` chính là cái bẫy
           đang chữa: nó biến mọi thứ không đọc được — kể cả "1,25" kiểu Việt —
           thành 1.1 mà không ai hay. Một nơi duy nhất được quyền quyết định là
           `chuanTocDo()` trong `src/render/pipeline.js`, và nó NÓI RA khi phải sửa. */
        speed: body.speed,
        size: body.size || '1080x1920',
        quality: 'balanced',
        voice: body.voice || undefined,
        modelId: body.model || undefined,
        audioPath,
        subtitles: true,
        force: Boolean(body.force),
      },
    };
  }

  async function resolveProjectDir(name) {
    /* Bộ slide phụ `cha::id` (GĐ3.7 — src/dung/boSlide.js): thư mục `<cha>/bo-slide/<id>`. */
    const bo = /^(.+?)::([a-z0-9][a-z0-9-]{0,39})$/.exec(String(name || ''));
    if (bo && !/[\\/:]/.test(bo[1])) {
      const cha = await resolveProjectDir(bo[1]);
      const sep = cha.includes('\\') ? '\\' : '/';
      return `${cha}${sep}bo-slide${sep}${bo[2]}`;
    }
    const s = await bridge.settings.get();
    if (!projectCache) projectCache = await bridge.projects.list(s.sourceRoot);
    const hit = projectCache.find((p) => p.name === name);
    if (hit) return hit.path;
    projectCache = await bridge.projects.list(s.sourceRoot);
    const hit2 = projectCache.find((p) => p.name === name);
    if (!hit2) throw new Error(`Không thấy project: ${name}`);
    return hit2.path;
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function shimmedFetch(input, init) {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    if (!raw.includes('/api/')) return nativeFetch(input, init);

    const url = new URL(raw, 'http://local');
    for (const [re, handler] of ROUTES) {
      const m = re.exec(url.pathname);
      if (m) {
        try {
          return await handler(m, init, url);
        } catch (e) {
          return json({ error: e.message || String(e) }, 400);
        }
      }
    }
    return json({ error: `Không có endpoint: ${url.pathname}` }, 404);
  };

  /* `tuyChonRenderTu` TỪNG được lộ ra `window.__beeShim` cho tab "Tạo bằng
     AI" đọc tuỳ chọn dựng video. Từ 18/09/2026 AI thôi dựng video nên không còn
     ai gọi — gỡ cửa toàn cục đó (19/09/2026). Hàm vẫn dùng cho `/api/render`. */

  console.log('[shim] đã định tuyến /api/* sang IPC');
})();
