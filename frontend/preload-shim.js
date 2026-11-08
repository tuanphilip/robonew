// preload-shim.js: Wails bridge shim replacing Electron IPC
(function () {
  'use strict';

  // Wait for Wails runtime to be ready if needed
  async function invokeGo(channel, ...args) {
    if (window.go && window.go.backend && window.go.backend.App && window.go.backend.App.HandleIPC) {
      try {
        const payloadStr = JSON.stringify(args);
        const resStr = await window.go.backend.App.HandleIPC(channel, payloadStr);
        if (resStr === undefined || resStr === null || resStr === '') return null;
        try {
          const res = JSON.parse(resStr);
          if (res && res.__error) {
            throw new Error(res.__error);
          }
          return res;
        } catch (e) {
          if (e && e.message && !e.message.startsWith('Unexpected token')) throw e;
          return resStr;
        }
      } catch (err) {
        console.error(`[IPC Error] ${channel}:`, err);
        throw err;
      }
    } else {
      console.warn(`[IPC Fallback] Wails backend not ready for ${channel}`);
      return null;
    }
  }

  const on = (channel) => (cb) => {
    if (window.runtime && window.runtime.EventsOn) {
      return window.runtime.EventsOn(channel, cb);
    }
    return () => {};
  };

  window.__PROJECTS__ = [];
  window.__PROJECT_SOURCE_ROOT__ = '';
  window.__INITIAL_PROJECT__ = '';

  window.beeknoee = {
    appInfo: () => invokeGo('app:info'),

    settings: {
      get: () => invokeGo('settings:get'),
      set: (patch) => invokeGo('settings:set', patch),
    },

    tts: {
      elevenConfig: () => invokeGo('tts:elevenConfig'),
      elevenSave: (patch) => invokeGo('tts:elevenSave', patch),
      beeConfig: () => invokeGo('tts:beeConfig'),
      beeSave: (patch) => invokeGo('tts:beeSave', patch),
      beeModels: () => invokeGo('tts:beeModels'),
      beePreview: (goi) => invokeGo('tts:beePreview', goi),
      elevenVoices: () => invokeGo('tts:elevenVoices'),
      elevenQuota: () => invokeGo('tts:elevenQuota'),
      elevenKiemVoice: (voiceId) => invokeGo('tts:elevenKiemVoice', voiceId),
      elevenThuFormat: (format) => invokeGo('tts:elevenThuFormat', format),
      elevenPreview: (url) => invokeGo('tts:elevenPreview', url),
      vbeeConfig: () => invokeGo('tts:vbeeConfig'),
      vbeeSave: (patch) => invokeGo('tts:vbeeSave', patch),
      vbeeVoices: () => invokeGo('tts:vbeeVoices'),
      vieneu: {
        status: () => invokeGo('tts:vieneuStatus'),
        check: () => invokeGo('tts:vieneuCheck'),
        voices: () => invokeGo('tts:vieneuVoices'),
        download: (ban) => invokeGo('tts:vieneuDownload', ban),
        cancel: () => invokeGo('tts:vieneuCancel'),
        importFolder: () => invokeGo('tts:vieneuImport'),
        remove: (ban) => invokeGo('tts:vieneuRemove', ban),
        choose: (ban) => invokeGo('tts:vieneuChoose', ban),
        bench: () => invokeGo('tts:vieneuBench'),
        preview: (voice, text) => invokeGo('tts:vieneuPreview', voice, text),
        onProgress: on('vieneu:progress'),
      },
    },

    sidecar: {
      health: () => Promise.resolve({ ok: true, version: 'robonew-go-1.0' }),
      onLog: on('sidecar:log'),
      onExit: on('sidecar:exit'),
    },

    projects: {
      list: (root) => invokeGo('projects:list', root),
      onDoi: on('du-an:doi'),
      pickRoot: () => invokeGo('projects:pickRoot'),
      read: (dir) => invokeGo('project:read', dir),
      reveal: (target) => invokeGo('project:reveal', target),
      deleteOutput: (dir) => invokeGo('output:delete', dir),
      scanRac: () => invokeGo('cleanup:scan'),
      runRac: (maNhom, tuyChon) => invokeGo('cleanup:run', maNhom, tuyChon),
      deleteProject: (dir) => invokeGo('project:delete', dir),
      writePreviewSettings: (dir, s) => invokeGo('previewSettings:write', dir, s),
      writeScript: (dir, lines, opts) => invokeGo('script:write', dir, lines, opts),
      writeBgm: (dir, audio) => invokeGo('bgm:write', dir, audio),
      writeVoiceover: (dir, audio) => invokeGo('voiceover:write', dir, audio),
      duongDanFile: (file) => file.path || file.name || '',
      map: (o) => invokeGo('project:map', o),
      applyText: (o) => invokeGo('project:applyText', o),
      applyScript: (o) => invokeGo('project:applyScript', o),
      validate: (o) => invokeGo('project:validate', o),
      createFromTemplate: (o) => invokeGo('project:createFromTemplate', o),
      generateAI: (topic) => invokeGo('project:generateAI', topic),
      createVideo: (o) => invokeGo('project:createVideo', o),
      themSlide: (o) => invokeGo('project:themSlide', o),
      taoBoSlide: (o) => invokeGo('project:taoBoSlide', o),
      thongTinTep: (duong) => invokeGo('tep:thongTin', duong),
      createWorkspace: () => invokeGo('workspace:create'),
    },

    renameProject: (cu, moi) => invokeGo('project:rename', cu, moi),

    preview: {
      build: (deck) => invokeGo('preview:build', deck),
      video: (deck, file) => invokeGo('preview:video', deck, file),
      videoInfo: (deck, o) => invokeGo('video:info', deck, o),
      timing: (deck) => invokeGo('project:timing', deck),
      songAm: (deck) => invokeGo('timeline:songAm', deck),
      anhSlide: (deck, ep) => invokeGo('preview:anhSlide', deck, ep),
      cleanup: (deck) => invokeGo('preview:cleanup', deck),
      watch: (deck) => invokeGo('preview:watch', deck),
      unwatch: () => invokeGo('preview:unwatch'),
      onChanged: on('preview:changed'),
    },

    openExternal: (url) => invokeGo('shell:openExternal', url),

    update: {
      status: () => Promise.resolve({ ok: true, version: '1.0.0' }),
      check: () => Promise.resolve({ ok: true, hasUpdate: false }),
      download: () => Promise.resolve({ ok: true }),
      install: () => Promise.resolve({ ok: true }),
      onState: on('update:state'),
    },

    ai: {
      config: () => invokeGo('ai:config'),
      save: (patch) => invokeGo('ai:save', patch),
      models: (patch) => invokeGo('ai:models', patch),
      test: (patch) => invokeGo('ai:test', patch),
    },

    agentChat: {
      trangThai: () => invokeGo('chat:trangThai'),
      dangNhap: (dongCo, tuyChon) => invokeGo('chat:dangNhap', dongCo, tuyChon),
      dangXuat: (dongCo) => invokeGo('chat:dangXuat', dongCo),
      phienMoi: (dongCo) => invokeGo('chat:phienMoi', dongCo),
      gui: (sessionId, chu, anh) => invokeGo('chat:gui', sessionId, chu, anh),
      dung: (sessionId) => invokeGo('chat:dung', sessionId),
      traLoiQuyen: (maQuyen, optionId) => invokeGo('chat:traLoiQuyen', maQuyen, optionId),
      datCauHinh: (sessionId, configId, value) => invokeGo('chat:datCauHinh', sessionId, configId, value),
      onCapNhat: on('chat:capNhat'),
      onXinQuyen: on('chat:xinQuyen'),
      onDongCoTat: on('chat:dongCoTat'),
      onDatLai: on('chat:datLai'),
      onMatKetNoi: on('chat:matKetNoi'),
    },

    models: {
      status: () => invokeGo('models:status'),
      download: (model) => invokeGo('models:download', model),
      importFromFile: () => invokeGo('models:importFromFile'),
      remove: (model) => invokeGo('models:remove', model),
      onProgress: on('models:progress'),
    },

    auth: {
      state: () => Promise.resolve({ signedIn: true, user: { name: 'Robonew Pro', email: 'pro@robonew.local' } }),
      google: () => Promise.resolve({ ok: true }),
      googleHuy: () => Promise.resolve({ ok: true }),
      logout: () => Promise.resolve({ ok: true }),
      skip: () => Promise.resolve({ ok: true }),
    },

    billing: {
      get: () => Promise.resolve({ plan: 'pro', active: true }),
      save: () => Promise.resolve({ ok: true }),
    },

    profile: {
      get: () => Promise.resolve({ name: 'Robonew User' }),
      savePersonal: () => Promise.resolve({ ok: true }),
      saveInvoice: () => Promise.resolve({ ok: true }),
    },

    templates: {
      list: () => invokeGo('templates:list'),
      luuMauDung: (o) => invokeGo('templates:luuMauDung', o),
      xoaCuaToi: (id) => invokeGo('templates:xoaCuaToi', id),
      videoHuongDan: () => Promise.resolve({}),
    },

    plans: {
      get: () => Promise.resolve({ plan: 'pro' }),
      bangGia: () => Promise.resolve([]),
      qr: () => Promise.resolve({}),
      checkOrder: () => Promise.resolve({ ok: true, paid: true }),
    },

    dung: {
      doc: (deck) => invokeGo('dung:doc', deck),
      onBoSlideMoi: on('dung:boSlideMoi'),
      ghi: (deck, duAn) => invokeGo('dung:ghi', deck, duAn),
      gianNen: (deck, ms) => invokeGo('dung:gianNen', deck, ms),
      kieuPhuDe: (deck, va) => invokeGo('dung:kieuPhuDe', deck, va),
      cssPhuDe: (deck) => invokeGo('dung:cssPhuDe', deck),
      taoGiong: (deck, o) => invokeGo('dung:taoGiong', deck, o),
      nhacSan: () => invokeGo('dung:nhacSan'),
      ngheNhacSan: (id) => invokeGo('dung:nhacSan:nghe', id),
      themNhacSan: (deck, id) => invokeGo('dung:nhacSan:them', deck, id),
      tiengHieuUng: () => invokeGo('dung:tiengHieuUng'),
      ngheTiengHieuUng: (id) => invokeGo('dung:tiengHieuUng:nghe', id),
      themTiengHieuUng: (deck, id) => invokeGo('dung:tiengHieuUng:them', deck, id),
      lopPhu: (doc) => invokeGo('dung:lopPhu', doc),
      themLopPhu: (deck, id, rong, cao) => invokeGo('dung:lopPhu:them', deck, id, rong, cao),
      phuDeTuDong: (deck, o) => invokeGo('dung:phuDeTuDong', deck, o),
      phuDeHuy: (deck) => invokeGo('dung:phuDeHuy', deck),
      onPhuDeTienTrinh: on('dung:phuDeTienTrinh'),
      nhap: (deck, duong) => invokeGo('dung:nhap', deck, duong),
      chonTep: (deck) => invokeGo('dung:chonTep', deck),
      cache: (deck, media) => invokeGo('dung:cache', deck, media),
      xuat: (deck, duAn) => invokeGo('dung:xuat', deck, duAn),
      onTienTrinh: on('dung:tienTrinh'),
      onCacheXong: on('dung:cacheXong'),
      onCacheBo: on('dung:cacheBo'),
      hoatDong: (deck) => invokeGo('dung:hoatDong', deck),
      coByte: (deck, rel) => invokeGo('dung:coByte', deck, rel),
      docByte: (deck, rel, tu, den) => invokeGo('dung:docByte', deck, rel, tu, den),
      ghiChu: (deck, vao) => invokeGo('dung:ghiChu', deck, vao),
      tvc: {
        ds: () => invokeGo('dung:tvc:ds'),
        chonTep: () => invokeGo('dung:tvc:chonTep'),
        tuDeck: (deck, ds) => invokeGo('dung:tvc:tuDeck', deck, ds),
        xoa: (id) => invokeGo('dung:tvc:xoa', id),
        doiTen: (id, ten) => invokeGo('dung:tvc:doiTen', id, ten),
        vaoDeck: (deck, ids) => invokeGo('dung:tvc:vaoDeck', deck, ids),
        luuMau: (deck, vao) => invokeGo('dung:mau:luu', deck, vao),
        xoaMau: (id) => invokeGo('dung:mau:xoa', id),
        mauVaoDeck: (deck, id) => invokeGo('dung:mau:vaoDeck', deck, id),
      },
    },

    render: {
      quota: () => Promise.resolve({ conLai: 999999, tong: 999999 }),
      start: (opts) => invokeGo('render:start', opts),
      cancel: () => invokeGo('render:cancel'),
      status: () => invokeGo('render:status'),
      onStep: on('render:step'),
      onDone: on('render:done'),
      onError: on('render:error'),
      boHang: (projectDir, loai) => invokeGo('render:boHang', projectDir, loai),
      xoaHang: () => invokeGo('render:xoaHang'),
      onHangDoi: on('render:hangdoi'),
    },

    baoLoi: {
      gui: () => Promise.resolve({ ok: true }),
    },

    zoom: {
      get: () => invokeGo('zoom:get'),
      set: (z) => invokeGo('zoom:set', z),
      onDoi: on('zoom:doi'),
    },
  };

  // Sync initial state on startup
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const s = await invokeGo('settings:get');
      if (s && s.sourceRoot) window.__PROJECT_SOURCE_ROOT__ = s.sourceRoot;

      const projects = await invokeGo('projects:list');
      if (Array.isArray(projects)) {
        window.__PROJECTS__ = projects;
        if (projects.length > 0 && !window.__INITIAL_PROJECT__) {
          window.__INITIAL_PROJECT__ = projects[0].name || '';
        }
      }

      if (window.__renderPage && typeof window.__renderPage.lamMoiDanhSach === 'function') {
        await window.__renderPage.lamMoiDanhSach();
        if (window.__INITIAL_PROJECT__ && window.__renderPage.setSelectedProject) {
          window.__renderPage.setSelectedProject(window.__INITIAL_PROJECT__, false);
        }
      }

      // Gắn sự kiện mở bảng Cài đặt AI
      const btnCaiDat = document.getElementById('btnCaiDatAI');
      if (btnCaiDat) {
        btnCaiDat.addEventListener('click', () => {
          if (window.__beeAI && typeof window.__beeAI.mo === 'function') {
            window.__beeAI.mo({ nha: 'tuongThich' });
          }
        });
      }

      // Gắn sự kiện nút "AI Tạo Video"
      const btnAITao = document.getElementById('btnAITaoVideo');
      if (btnAITao) {
        btnAITao.addEventListener('click', async () => {
          const topic = prompt('Nhập chủ đề video bạn muốn AI tự động viết kịch bản & dựng slide:', 'Tại sao AI Agent đang thay đổi hoàn toàn cách lập trình');
          if (!topic || !topic.trim()) return;

          btnAITao.disabled = true;
          const oldText = btnAITao.innerHTML;
          btnAITao.innerHTML = '<span>⏳ Đang sinh nội dung bằng AI...</span>';
          if (window.__renderPage && window.__renderPage.setStatus) {
            window.__renderPage.setStatus('Đang gọi AI viết kịch bản, thiết kế 6 slide và tạo giọng đọc...', 'warn');
          }

          try {
            const r = await window.beeknoee.projects.generateAI(topic.trim());
            if (r && r.ok) {
              if (window.__renderPage) {
                await window.__renderPage.lamMoiDanhSach();
                if (window.__renderPage.setSelectedProject) {
                  window.__renderPage.setSelectedProject(r.name, false);
                }
                window.__renderPage.setStatus(`✓ Đã tạo xong deck "${r.name}" bằng AI! Bấm "Tạo video" để render.`, 'good');
              }
            } else {
              alert('Lỗi tạo bằng AI: ' + ((r && r.loi) || 'Không thể tạo deck'));
            }
          } catch (e) {
            alert('Lỗi kết nối AI: ' + (e.message || e));
          } finally {
            btnAITao.disabled = false;
            btnAITao.innerHTML = oldText;
          }
        });
      }
    } catch (e) {
      console.warn('Initial project sync:', e);
    }
  });
})();
