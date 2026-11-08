;
'use strict';
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const config = require('../config');
const { khungCuaDeck } = require('../render/recordingHtml');

/**
 * Dự án: liệt kê, dạng legacy cho giao diện, deck đang được ghi, tìm deck, template, ffprobe.
 *
 * Tách từ main.js (02/09/2026, audit Phase 2.4/2.5). Cơ chế: main.js dựng `ctx`
 * (app, send, mainWindow(), sidecar()…) rồi gọi dangKy(ctx) từng module theo thứ
 * tự; hàm/hằng module này trả về được gộp vào ctx để module khác gọi qua
 * `ctx.tên`. Handler IPC đăng ký ngay trong dangKy — main.js gọi trước whenReady.
 */
function dangKy(ctx) {
  /** Quét thư mục nguồn, trả danh sách project. */
  /**
   * Deck nào đang được GHI DỞ — dùng để phân biệt "Đang thiết kế" với "Thiếu script".
   *
   * Cùng một deck thiếu `script-90s.txt` có thể là hai chuyện khác hẳn:
   *   - AI vừa tạo thư mục và đang ghi tiếp  → Đang thiết kế, đừng cho bấm Edit
   *   - deck cũ nằm đó lâu rồi, thiếu script → Thiếu script, cứ mở sửa bình thường
   *
   * Phân biệt bằng thời điểm ghi cuối, do watcher ở cuối file ghi vào map này.
   * Khoá là TÊN THƯ MỤC deck.
   */
  const deckDangGhi = new Map();
  const IM_LANG_MS = 3000;   // im chừng này thì coi như đã ghi xong

  /* Hàm này PHẢI thuần: không xoá khoá hết hạn ở đây.
     Nó được gọi cả trong câu log lẫn trong `listProjects`, mà một hàm vừa trả lời
     vừa đổi trạng thái thì kết quả phụ thuộc ai gọi trước. Map chỉ giữ một khoá
     mỗi deck nên để lại vài mục hết hạn không tốn gì. */
  function dangThietKe(name) {
    const t = deckDangGhi.get(name);
    return t != null && Date.now() - t <= IM_LANG_MS;
  }

  function listProjects(root) {
    if (!root || !fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'index.html')))
      .map((d) => {
        const dir = path.join(root, d.name);
        const scriptPath = path.join(dir, 'script-90s.txt');
        /* Dự án VIDEO TRỐNG (src/dung/duAnVideo.js): `timVideo` trả NỀN ĐEN cho trình dựng — ở
           danh sách thì "có video" nghĩa là ĐÃ XUẤT `<tên>.mp4`. */
        const laVideo = fs.existsSync(path.join(dir, 'du-an-video.json'));
        /* VIDEO CUỐI (src/dung/banCuoi.js): deck có chỉnh sửa timeline → `<tên>-dung.mp4` nếu còn hiệu
           lực, còn lại video slide (timVideo — cả tên mới lẫn tên cũ). ▶ / "Mở" của dòng mở đúng tệp này. */
        const video = require('../dung/banCuoi').timBanCuoi(dir);
        let lines = 0;
        try {
          lines = fs.readFileSync(scriptPath, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length;
        } catch { /* bỏ qua */ }
        /* Mốc sửa gần nhất — lấy theo TỆP NỘI DUNG, KHÔNG theo thư mục.
         *
         * ⚠ `statSync(dir).mtimeMs` sai từ 15/09/2026: mở một deck là app ghi
         * `_preview.html` vào chính thư mục đó, nên mốc thư mục nhảy lên thành
         * "lần cuối bạn MỞ", không phải "lần cuối bạn SỬA". Bảng xếp theo mốc
         * này nên cả thứ tự cũng sai theo. Lượt chụp ảnh thu nhỏ cũng dựng lại
         * `_preview.html` — càng sai.
         *
         * Năm tệp dưới đây là toàn bộ thứ người dùng (hoặc AI) sửa thật. Đo
         * trên 57 deck: 285 lượt statSync mất 3,1 ms — cùng hạng với những phép
         * stat mà hàm này vẫn làm. */
        let updatedAt = 0;
        for (const ten of ['index.html', 'script-90s.txt', 'style.css', 'app.js', 'preview-settings.json', 'dung/du-an.json']) {
          try {
            const m = fs.statSync(path.join(dir, ten)).mtimeMs;
            if (m > updatedAt) updatedAt = m;
          } catch { /* thiếu tệp nào thì bỏ qua tệp đó */ }
        }
        if (!updatedAt) {
          try { updatedAt = fs.statSync(dir).mtimeMs; } catch { /* bỏ qua */ }
        }

        /* Video có CŨ HƠN script không.
         *
         * Sửa lời thoại rồi quên dựng lại là lỗi âm thầm tệ nhất ở đây: bảng vẫn
         * ghi "Đã có video", bấm Mở ra vẫn có video chạy — chỉ là nội dung không
         * còn khớp script nữa. Không có dấu hiệu nào cho tới lúc đăng lên mới biết.
         *
         * So mtime của `script-90s.txt` với mtime của file video. Dựng lại luôn
         * ghi video mới nên bình thường video mới hơn; script mới hơn nghĩa là
         * đã sửa sau lần dựng gần nhất. */
        let videoCu = false;
        if (video) {
          try {
            // Dự án video: "cũ" = timeline sửa SAU lần xuất gần nhất.
            const nguonSua = laVideo ? path.join(dir, 'dung', 'du-an.json') : scriptPath;
            const mVideo = fs.statSync(video.path).mtimeMs;
            videoCu = fs.statSync(nguonSua).mtimeMs > mVideo;
            // Bản `-dung`: sửa timeline sau lần áp gần nhất cũng là cũ.
            if (!videoCu && video.banDung) {
              try { videoCu = fs.statSync(path.join(dir, 'dung', 'du-an.json')).mtimeMs > mVideo; } catch { /* không có */ }
            }
          } catch { /* thiếu file thì coi như không cũ */ }
        }
        /* Bộ slide PHỤ (GĐ3.7) đang dùng mà sửa sau lần dựng cuối ⇒ video của dự án cũng cũ ("Tạo video" sẽ dựng lại
           bộ đó). Chỉ dự án CÓ thư mục bo-slide mới tốn thêm một lượt đọc du-an.json. */
        if (video && !videoCu && fs.existsSync(path.join(dir, 'bo-slide'))) {
          try {
            videoCu = require('../dung/boSlide').coBoCu(dir, JSON.parse(fs.readFileSync(path.join(dir, 'dung', 'du-an.json'), 'utf8')));
          } catch { /* không đọc được thì thôi */ }
        }
        return {
          name: d.name,
          path: dir,
          // 'deck' (slide + giọng đọc) | 'video' (dự án video trống — chỉ timeline).
          loai: laVideo ? 'video' : 'deck',
          scriptLines: lines,
          hasScript: fs.existsSync(scriptPath),
          hasVideo: !!video,
          videoPath: video ? video.path : null,
          videoName: video ? video.name : null,
          migrated: fs.existsSync(path.join(dir, 'deck.config.js')),
          /* Khổ video mà deck khai (dọc 9:16 / ngang 16:9) — giao diện cần để
             hiện đúng bộ kích thước và đánh dấu deck ngang trong bảng.
             ⚠ Rẻ vì `khungCuaDeck()` nhớ theo mốc sửa `index.html`: lượt đầu
             35,9 ms cho 57 deck, các lượt sau 0,5 ms. Không có bộ nhớ đó thì
             46,3 ms MỖI nhịp watcher — xem chú thích ở chính hàm ấy. */
          khung: khungCuaDeck(dir).ma,
          hasLock: fs.existsSync(path.join(dir, 'output', 'timing.lock.json')),
          // AI (hoặc bất cứ ai) đang ghi dở thư mục này — xem `dangThietKe`.
          dangThietKe: dangThietKe(d.name),
          videoCu,
          updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /* ⚠ `anhDaiDien()` ĐÃ GỠ 13/09/2026 cùng với ảnh đại diện ở bảng danh sách
     dự án (CONTEXT §6.5E). Nó xét `qa/slide-*.png` → `preview-assets/bia.jpg` →
     `image.png` theo đúng thứ tự đó, và thứ tự ấy là thứ đã phải đo trên 52 deck
     thật mới chốt được — ai đưa ảnh trở lại thì đọc §6.5E rồi lấy lại nguyên bản,
     đừng viết lại từ đầu. `readDeckInfo()` bên dưới CŨNG có một trường `thumb`
     nhưng đó là ảnh của trang TEMPLATE, một tính năng khác, vẫn đang dùng. */

  /** Dạng dữ liệu mà giao diện gốc mong đợi. */
  function toLegacyProject(p) {
    return {
      name: p.name,
      // 'doc' | 'ngang' — xem `khungCuaDeck()`. Deck cũ không khai gì = 'doc'.
      khung: p.khung || 'doc',
      loai: p.loai || 'deck',
      url: `beeknoee://slide/${encodeURIComponent(p.name)}/`,
      source_path: p.path,
      has_script: p.hasScript,
      script_count: p.scriptLines,
      has_output: p.hasVideo,
      output_url: p.videoPath || null,
      video_url: p.videoPath || null,
      // Tên file thật để giao diện dựng liên kết "Mở" — deck cũ vẫn là
      // final_video.mp4, deck mới mang tên deck.
      video_file: p.videoName || null,
      dang_thiet_ke: !!p.dangThietKe,
      video_cu: !!p.videoCu,
      /* Mốc sửa gần nhất, mili-giây. Cột "Ngày cập nhật" ở bảng dự án đọc khoá
         này. ⚠ Thêm ở CẢ HAI `toLegacyProject` — xem cảnh báo ở bản kia. */
      updated_at: p.updatedAt || 0,
    };
  }

  // ------------------------------------------------------------------ template
  //
  // Đọc thư mục `template/` nằm ở GỐC thư mục app (cạnh .exe) — cùng chỗ mà AI
  // được trỏ vào khi gõ "Đọc kỹ workflow.md…". Quét hai tầng vì bộ công cụ có
  // `template/beeknoee-slide-starter` (một deck) và `template/vi-du/*`
  // (nhiều deck ví dụ).
  function templateRoots() {
    return [
      // Bản đã cài: `template/` nằm ngay cạnh .exe (extraFiles trong
      // electron-builder.yml) — cùng chỗ AI được trỏ vào.
      path.join(ctx.appRootDir(), 'template'),
      // Bản chạy từ mã nguồn: chưa qua bước đóng gói nên vẫn còn nằm trong
      // `resources/authoring/`. Thiếu dòng này thì `npm run dev` luôn thấy 0 mẫu
      // — đã đo, và rất dễ tưởng nhầm là hỏng chức năng.
      path.join(config.resourcesRoot(), 'authoring', 'template'),
    ].filter((p) => fs.existsSync(p));
  }

  /* ══ TẠO DỰ ÁN TỪ MẪU ═══════════════════════════════════════════════════
     Trước 16/09/2026 KHÔNG có đường nào tạo deck từ mẫu trong app: người dùng
     bấm "Copy prompt", rời app, nhờ một AI bên ngoài chép thư mục theo
     `workflow.md` Bước 3. Đó là lý do duy nhất phải mở Claude Desktop cho một
     việc chỉ là copy tệp.

     Hàm này làm đúng việc đó, trong app, một cách xác định. Nó cũng là nền cho
     AI Agent sau này: agent KHÔNG được tự chép thư mục bằng lệnh shell mà gọi
     vào đây, để chỉ có MỘT chỗ biết mẫu gồm những gì. */

  /** Bỏ dấu tiếng Việt rồi đưa về dạng `a-b-c` — trùng nếp đặt tên 58 deck thật. */
  function slug(chu) {
    return String(chu || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  /* ⚠ DANH SÁCH BỎ QUA, KHÔNG PHẢI DANH SÁCH CHO PHÉP.
     Đã đo cả 22 mẫu (16/09/2026): ngoài 6 tệp lõi, chúng còn mang theo ảnh
     riêng (`image.png` — CÓ 2 chỗ tham chiếu trong `index.html` của starter,
     bỏ là deck mới thủng hai ô ảnh), `flow_en.png`, `webui_en.png`, và nhạc nền
     `preview-assets/bgm/meta.mp3` (1,6 MB, 19/22 mẫu có). Dùng danh sách CHO
     PHÉP là mỗi mẫu có tệp riêng đều âm thầm mất tệp đó.

     `demo.mp4` thì ngược lại: CÓ Ở CẢ 22 MẪU, nặng 2–2,4 MB, và là video giới
     thiệu mẫu chứ không phải nội dung deck — chép sang là mỗi dự án mới cõng
     thêm 2 MB vô ích. */
  const BO_QUA_TEP = new Set(['demo.mp4', '_recording.html', '_preview.html',
    '.DS_Store', 'Thumbs.db']);
  // `dung`: media + cache của trình dựng — riêng từng dự án, có thể vài GB.
  const BO_QUA_THU_MUC = new Set(['output', 'qa', 'input_audio', 'node_modules', '.git', 'dung']);

  /**
   * Thư mục cho một dự án MỚI trong thư mục nguồn — dùng chung cho "từ mẫu" và "video trống".
   * Trả { ten, dich } (chưa tạo gì trên đĩa).
   */
  function chonThuMucMoi(tenNguoiDung, tenMacDinh) {
    const nguonTho = ctx.loadSettings().sourceRoot || '';
    if (!nguonTho || !fs.existsSync(nguonTho)) {
      throw new Error('Chưa chọn thư mục dự án. Bấm nút thư mục ở cột danh sách để chọn.');
    }
    /* ⚠ GIẢI ĐƯỜNG DẪN THẬT MỘT LẦN rồi dùng cho CẢ ghép lẫn kiểm. Bản trước
       ghép `dich` từ đường thô nhưng kiểm bằng `realpathSync(nguon)`: thư mục
       nguồn là junction/symlink (hay ổ mạng ánh xạ) thì hai vế khác gốc,
       `path.relative` ra `..` hoặc đường tuyệt đối, và MỌI tên đều bị chặn với
       câu "Tên dự án không hợp lệ" — sai bệnh. */
    const nguon = fs.realpathSync(nguonTho);

    const goc = slug(tenNguoiDung) || slug(tenMacDinh) || 'du-an-moi';
    /* Trùng tên thì thêm -2, -3… thay vì ghi đè. Ghi đè một deck đang có là mất
       trắng công của người ta mà không có đường lùi nào. */
    let ten = goc;
    for (let i = 2; fs.existsSync(path.join(nguon, ten)); i += 1) {
      ten = `${goc}-${i}`;
      if (i > 200) throw new Error('Quá nhiều dự án trùng tên.');
    }
    const dich = path.join(nguon, ten);

    /* Kiểm LẦN NỮA bằng đường dẫn đã giải: `slug()` đã lọc sạch, nhưng đây là
       thao tác ghi đĩa nên kiểm hai lớp. `path.relative` phải ra một đoạn, không
       bắt đầu bằng `..`, không phải đường tuyệt đối. */
    const rel = path.relative(nguon, dich);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
      throw new Error('Tên dự án không hợp lệ.');
    }
    return { ten, dich };
  }

  /**
   * DỰ ÁN VIDEO TRỐNG (src/dung/duAnVideo.js): không slide, không giọng đọc — chỉ timeline.
   * Tạo thư mục + `index.html` nền đen + tệp đánh dấu + dự án dựng rỗng + video nền đen 30 giây.
   * @param {{ ten?: string, khung?: 'doc' | 'ngang' }} o
   * @returns {Promise<{ ok: true, name: string, dir: string }>}
   */
  async function taoDuAnVideo(o) {
    const dv = require('../dung/duAnVideo');
    const khung = o && o.khung === 'ngang' ? 'ngang' : 'doc';
    const { ten, dich } = chonThuMucMoi(o && o.ten, 'video-moi');
    fs.mkdirSync(dich, { recursive: true });
    try {
      fs.writeFileSync(path.join(dich, 'index.html'), dv.htmlTrong(khung), 'utf8');
      // Kiểu phụ đề đọc rõ trên khổ của dự án (phụ đề tự động) — xem duAnVideo.thietLapMacDinh.
      fs.writeFileSync(path.join(dich, 'preview-settings.json'), JSON.stringify(dv.thietLapMacDinh(khung), null, 2), 'utf8');
      fs.writeFileSync(path.join(dich, dv.TEP_DANH_DAU),
        JSON.stringify({ loai: 'video', phienBan: 1, khung, taoLuc: new Date().toISOString() }, null, 2), 'utf8');
      const k = dv.KHUNG[khung];
      // Không khối slide (GĐ3.1); không dựng nền đen giả nữa (GĐ3.4 — đồng hồ + bản xuất tự lo phần đen).
      const kq = require('../dung/kho').ghiDuAn(dich, require('../dung/moHinh').moi({ rong: k.rong, cao: k.cao, fps: dv.FPS, khongSlide: true }));
      if (!kq.ok) throw new Error((kq.loi || []).join(' · ') || 'Không ghi được dự án dựng.');
    } catch (e) {
      // Tạo dở là để lại một thư mục app vẫn liệt kê như dự án thật — dọn rồi mới báo.
      try { fs.rmSync(dich, { recursive: true, force: true }); } catch { /* đành chịu */ }
      throw e;
    }
    return { ok: true, name: ten, dir: dich };
  }

  /** Thư mục của một mẫu theo mã (`ten` hoặc `nhom/ten`). Ném lỗi câu người đọc được. */
  function timMau(mauIdVao) {
    const mauId = String(mauIdVao || '').trim();
    if (!mauId) throw new Error('Thiếu mã mẫu.');
    /* ⚠ CHẶN THOÁT THƯ MỤC ngay ở đây, trước mọi thao tác đĩa. `mauId` đi từ
       giao diện xuống, và sau này sẽ đi từ AI xuống — không được tin. Chỉ nhận
       một hoặc hai đoạn, mỗi đoạn là chữ/số/gạch. Như vậy `..`, `\`, `C:` và
       đường dẫn tuyệt đối đều rớt ngay từ phép thử này. */
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(mauId)) {
      throw new Error(`Mã mẫu không hợp lệ: ${mauId}`);
    }
    // Mẫu của tôi (Lưu làm mẫu — userData/mau-cua-toi/<tên>): id `cua-toi/<tên>`.
    if (mauId.startsWith(`${TIEN_TO_CUA_TOI}/`)) {
      const thu = path.join(thuMucMauCuaToi(), mauId.slice(TIEN_TO_CUA_TOI.length + 1));
      if (mauId.split('/').length === 2 && fs.existsSync(path.join(thu, 'index.html'))) return thu;
      throw new Error(`Không tìm thấy mẫu "${mauId}".`);
    }
    for (const goc of templateRoots()) {
      const thu = path.join(goc, ...mauId.split('/'));
      if (fs.existsSync(path.join(thu, 'index.html'))) return thu;
    }
    throw new Error(`Không tìm thấy mẫu "${mauId}".`);
  }
  /** Chép nội dung một mẫu vào `dich` (bỏ thư mục / tệp không thuộc deck). @returns số tệp đã chép */
  function chepMau(mauDir, dich) {
    let soTep = 0;
    const chep = (tu, den) => {
      const st = fs.statSync(tu);
      if (st.isDirectory()) {
        if (BO_QUA_THU_MUC.has(path.basename(tu))) return;
        fs.mkdirSync(den, { recursive: true });
        for (const n of fs.readdirSync(tu)) chep(path.join(tu, n), path.join(den, n));
        return;
      }
      if (BO_QUA_TEP.has(path.basename(tu))) return;
      fs.mkdirSync(path.dirname(den), { recursive: true });
      fs.copyFileSync(tu, den);
      soTep += 1;
    };
    // `dung/` (dự án dựng) và `output/` nằm trong BO_QUA_THU_MUC — thêm bộ slide vào dự án có sẵn mà chép
    // chúng là đè mất timeline / video của người dùng (test-dung GĐ3.5 giữ điều này).
    for (const n of fs.readdirSync(mauDir)) chep(path.join(mauDir, n), path.join(dich, n));
    return soTep;
  }

  /**
   * Chép một MẪU thành một DỰ ÁN mới trong thư mục nguồn.
   *
   * @param {{ mauId: string, ten?: string }} o
   *   - `mauId`  id như `templates:list` trả về: `"beeknoee-slide-starter"` hoặc
   *              `"vi-du/tu-vi-phong-thuy"` (mẫu lồng một tầng)
   *   - `ten`    tên dự án người dùng gõ; bỏ trống thì lấy tên mẫu
   * @returns {{ ok: true, name: string, dir: string, soTep: number }}
   */
  /**
   * MẪU DỰNG VIDEO (23/10/2026): thư mục mẫu là một DỰ ÁN VIDEO hoàn chỉnh — tệp đánh dấu `du-an-video.json` +
   * `dung/du-an.json` (timeline có ô giữ chỗ) + `dung/media/` (ảnh / video demo, chữ, lớp phủ, tiếng, nhạc). Chép CẢ
   * `dung/` (chepMau bỏ nó — ở mẫu slide nó là của người khác), bỏ bộ đệm / bản lưu dự phòng / video xem trước.
   */
  const laMauDung = (mauDir) => fs.existsSync(path.join(mauDir, require('../dung/duAnVideo').TEP_DANH_DAU))
    && fs.existsSync(path.join(mauDir, 'dung', 'du-an.json'));
  function chepMauDung(mauDir, dich) {
    let soTep = 0;
    const boThuMuc = new Set(['output', 'cache', 'node_modules', '.git']);
    const boTep = (n) => BO_QUA_TEP.has(n) || /^image\.(jpg|png)$/.test(n) || /^du-an\.json\.bak/.test(n);
    const chep = (tu, den) => {
      const st = fs.statSync(tu);
      if (st.isDirectory()) {
        if (boThuMuc.has(path.basename(tu))) return;
        fs.mkdirSync(den, { recursive: true });
        for (const n of fs.readdirSync(tu)) chep(path.join(tu, n), path.join(den, n));
        return;
      }
      if (boTep(path.basename(tu))) return;
      fs.mkdirSync(path.dirname(den), { recursive: true });
      fs.copyFileSync(tu, den);
      soTep += 1;
    };
    for (const n of fs.readdirSync(mauDir)) chep(path.join(mauDir, n), path.join(dich, n));
    return soTep;
  }

  /* ══ MẪU CỦA TÔI (23/10/2026) ═══════════════════════════════════════════
     "Lưu làm mẫu" ở Thư viện → Mẫu: một DỰ ÁN VIDEO (không slide) thành mẫu dựng video của chính người dùng, cùng
     dạng thư mục với mẫu đi kèm app (xem laMauDung) + `mau.json` { ten, moTa, taoLuc }. Nằm trong userData — cập nhật
     app không đụng tới, cài lại không mất (khác `template/` cạnh .exe bị ghi đè mỗi bản). Trang Mẫu hiện ở nhóm
     "Mẫu của tôi"; tạo dự án / MCP dùng y như mẫu có sẵn (id `cua-toi/<tên>`). */
  const TIEN_TO_CUA_TOI = 'cua-toi';
  const thuMucMauCuaToi = () => path.join(app.getPath('userData'), 'mau-cua-toi');
  function mauCuaToi() {
    const goc = thuMucMauCuaToi();
    let ds = [];
    try { ds = fs.readdirSync(goc, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return []; }
    return ds.map((e) => {
      const dir = path.join(goc, e.name);
      if (!fs.existsSync(path.join(dir, 'index.html')) || !laMauDung(dir)) return null;
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'mau.json'), 'utf8')) || {}; } catch { /* thiếu thì lấy tên thư mục */ }
      return { id: `${TIEN_TO_CUA_TOI}/${e.name}`, dir, ten: String(meta.ten || e.name).slice(0, 80),
        moTa: String(meta.moTa || '').slice(0, 400), taoLuc: meta.taoLuc || '' };
    }).filter(Boolean).sort((a, b) => String(b.taoLuc).localeCompare(String(a.taoLuc)));
  }

  /** ffmpeg một lượt (ảnh bìa / video xem trước của mẫu). */
  function chayFfmpeg(args) {
    const { spawn } = require('node:child_process');
    return new Promise((ok, hong) => {
      const p = spawn(require('../dung/media').exe('ffmpeg'), args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (b) => { err = (err + b).slice(-2000); });
      p.on('error', hong);
      p.on('close', (ma) => (ma === 0 ? ok() : hong(new Error(`ffmpeg thoát mã ${ma}: ${err.slice(-300)}`))));
    });
  }

  /**
   * Lưu dự án video `o.ten` thành mẫu của tôi. `o.tenMau` (bắt buộc), `o.moTa`.
   * Chép: tệp khung dự án + `dung/du-an.json` đã đánh ô (moHinh.danhOMau) + CHỈ media đang có trên timeline. Ảnh bìa /
   * video xem trước lấy từ bản xuất `output/<tên>.mp4` nếu có (không có thì bìa là khung đầu của ô 1, không video).
   * @returns {Promise<{ ok: true, id: string, soO: number, coVideo: boolean }>}
   */
  async function luuMauDung(o) {
    const dir = resolveDeckDir(o && o.ten);
    const dv = require('../dung/duAnVideo');
    if (!dir || !dv.laDuAnVideo(dir)) throw new Error('Chỉ lưu được DỰ ÁN VIDEO làm mẫu (dự án đã thêm bộ slide thì chưa).');
    const tenMau = String((o && o.tenMau) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!tenMau) throw new Error('Đặt tên cho mẫu trước.');
    const kho = require('../dung/kho');
    const mh = require('../dung/moHinh');
    const r = kho.docDuAn(dir);
    if (r.chiDoc || !r.duAn) throw new Error('Dự án dựng do bản app mới hơn tạo — cập nhật app trước.');
    const { duAn, soO } = mh.danhOMau(r.duAn);
    if (!soO) throw new Error('Chưa có cảnh ảnh / video nào phủ kín khung để làm ô của mẫu.');
    const dung = new Set(duAn.khoi.map((c) => c.media));
    const ban = { ...duAn, media: duAn.media.filter((m) => dung.has(m.id)) };

    const goc = thuMucMauCuaToi();
    const nen = slug(tenMau) || 'mau';
    let ten = nen;
    for (let i = 2; fs.existsSync(path.join(goc, ten)); i += 1) ten = `${nen}-${i}`;
    const dich = path.join(goc, ten);
    fs.mkdirSync(path.join(dich, 'dung', 'media'), { recursive: true });
    try {
      for (const n of ['index.html', dv.TEP_DANH_DAU, 'preview-settings.json']) {
        if (fs.existsSync(path.join(dir, n))) fs.copyFileSync(path.join(dir, n), path.join(dich, n));
      }
      for (const m of ban.media) {
        const tu = path.join(dir, ...String(m.tep).split('/'));
        if (!fs.existsSync(tu)) throw new Error(`Thiếu tệp media "${m.ten}" — nhập lại rồi lưu mẫu.`);
        const den = path.join(dich, ...String(m.tep).split('/'));
        fs.mkdirSync(path.dirname(den), { recursive: true });
        fs.copyFileSync(tu, den);
      }
      const g = kho.ghiDuAn(dich, ban);
      if (!g.ok) throw new Error((g.loi || []).join(' · ') || 'Không ghi được dự án của mẫu.');
      fs.writeFileSync(path.join(dich, 'mau.json'), JSON.stringify({ ten: tenMau, moTa: String((o && o.moTa) || '').slice(0, 400),
        taoLuc: new Date().toISOString(), tuDuAn: path.basename(dir) }, null, 2), 'utf8');
      // Bìa + video xem trước (540 px bề ngắn — đủ cho thẻ mẫu, nhẹ). Hỏng thì mẫu vẫn dùng được, chỉ thiếu hình.
      const xuat = path.join(dir, 'output', `${path.basename(dir)}.mp4`);
      /* Chỉ khi bản xuất MỚI HƠN lần sửa cuối (`dung/du-an.json`) — bản cũ là video của timeline trước đó (chữ cũ,
         ảnh cũ), làm bìa thì mẫu nói sai về chính nó. */
      const moc = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
      const co = moc(xuat) > 0 && moc(xuat) + 2000 >= moc(path.join(dir, 'dung', 'du-an.json'));
      const tl = 'scale=\'if(gt(iw,ih),-2,540)\':\'if(gt(iw,ih),540,-2)\'';
      try {
        if (co) {
          await chayFfmpeg(['-v', 'error', '-y', '-ss', '1.5', '-i', xuat, '-frames:v', '1', '-vf', tl, '-q:v', '3', path.join(dich, 'image.jpg')]);
          await chayFfmpeg(['-v', 'error', '-y', '-i', xuat, '-vf', tl, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
            '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', path.join(dich, 'demo.mp4')]);
        } else {
          const c1 = ban.khoi.filter((c) => c.oCho).sort((a, b) => a.oCho.so - b.oCho.so)[0];
          const m1 = ban.media.find((m) => m.id === c1.media);
          await chayFfmpeg(['-v', 'error', '-y', ...(m1.loai === 'video' ? ['-ss', String((c1.vaoMs || 0) / 1000)] : []),
            '-i', path.join(dich, ...String(m1.tep).split('/')), '-frames:v', '1', '-vf', tl, '-q:v', '3', path.join(dich, 'image.jpg')]);
        }
      } catch (e) {
        console.warn('[luuMauDung] không làm được bìa / video xem trước:', e.message);
      }
      return { ok: true, id: `${TIEN_TO_CUA_TOI}/${ten}`, soO, coVideo: fs.existsSync(path.join(dich, 'demo.mp4')) };
    } catch (e) {
      try { fs.rmSync(dich, { recursive: true, force: true }); } catch { /* đành chịu */ }
      throw e;
    }
  }

  function xoaMauCuaToi(id) {
    const s = String(id || '');
    const m = /^cua-toi\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(s);
    if (!m) throw new Error(`Mã mẫu không hợp lệ: ${s}`);
    const dir = path.join(thuMucMauCuaToi(), m[1]);
    if (!fs.existsSync(path.join(dir, 'mau.json'))) throw new Error('Không tìm thấy mẫu này.');
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true };
  }

  function taoDuAnTuMau(o) {
    const mauDir = timMau(o && o.mauId);
    const { ten, dich } = chonThuMucMoi(o && o.ten, path.basename(mauDir));
    let soTep = 0;
    const dung = laMauDung(mauDir);
    fs.mkdirSync(dich, { recursive: true });
    try {
      soTep = dung ? chepMauDung(mauDir, dich) : chepMau(mauDir, dich);
    } catch (e) {
      /* Chép dở rồi hỏng là để lại một thư mục nửa vời mà app vẫn liệt kê ra
         như một dự án thật. Dọn rồi hãy ném lỗi. */
      try { fs.rmSync(dich, { recursive: true, force: true }); } catch { /* đành chịu */ }
      throw e;
    }

    /* Tệp mà đường dựng video BẮT BUỘC phải có: `project.read` bên Python ném
       lỗi ngay nếu thiếu `script-90s.txt` (handlers_project.py:26). Mẫu nào
       quên mang theo thì tạo một tệp rỗng còn hơn để người dùng bấm Tạo video
       rồi nhận một câu lỗi Python. */
    // Mẫu dựng video là dự án VIDEO (không slide) — không cần script; tạo vào là thành deck giả.
    if (dung) return { ok: true, name: ten, dir: dich, soTep, loai: 'dung' };
    const sc = path.join(dich, 'script-90s.txt');
    if (!fs.existsSync(sc)) fs.writeFileSync(sc, '', 'utf8');

    return { ok: true, name: ten, dir: dich, soTep };
  }

  /**
   * THÊM BỘ SLIDE vào một DỰ ÁN VIDEO TRỐNG (GĐ3.5 lộ trình gộp, 16/10/2026): chép mẫu vào CHÍNH thư mục dự án —
   * dự án thành deck, timeline giữ nguyên mọi khối (đứng yên theo giờ), thêm KHỐI SLIDE tại `batDauMs`. Bấm
   * "Tạo video" là dựng slide rồi áp timeline như mọi deck.
   *   · bỏ tệp đánh dấu dự án video + nền đen giả cũ (`_nen.mp4`, `timing.json` một "slide" — để lại thì deck đọc
   *     nhầm thành 1 slide đã dựng);
   *   · khung XUẤT ghim theo khổ cũ của dự án (mẫu khác khổ ⇒ slide đặt giữa, nền nhoè — không lật cả video);
   *   · phụ đề tự động của dự án video (giờ timeline) bỏ — "Tạo video" sinh phụ đề của slide (giờ video slide).
   * @param {{ ten: string, mauId: string, batDauMs?: number }} o
   */
  function themSlideVaoDuAnVideo(o) {
    const dir = resolveDeckDir(o && o.ten);
    const dv = require('../dung/duAnVideo');
    if (!dir || !dv.laDuAnVideo(dir)) throw new Error('Chỉ thêm bộ slide được vào dự án video.');
    // `ma: 'BAN'` — agent (MCP) nhận RENDER_BUSY (thử lại được) thay vì lỗi đầu vào.
    if (ctx.jobState && ctx.jobState.running) throw Object.assign(new Error('Đang dựng video — đợi xong rồi thêm bộ slide.'), { ma: 'BAN' });
    /* Đang tạo phụ đề tự động (dung:phuDeTuDong — giờ TIMELINE): xong sau khi chuyển là phụ đề đó rơi vào deck và
       bị đọc như giờ video slide (lệch theo khối slide) — rà GĐ3. */
    if (typeof ctx.dangTaoPhuDe === 'function' && ctx.dangTaoPhuDe()) {
      throw Object.assign(new Error('Đang tạo phụ đề tự động — đợi xong rồi thêm bộ slide.'), { ma: 'BAN_PHU_DE' });
    }
    const mauDir = timMau(o && o.mauId);
    if (laMauDung(mauDir)) throw new Error('Mẫu dựng video không thêm làm bộ slide được — dùng nó để tạo dự án mới.');
    const kho = require('../dung/kho');
    const mh = require('../dung/moHinh');
    const r = kho.docDuAn(dir);
    if (r.chiDoc) throw new Error('Dự án dựng do bản app mới hơn tạo — cập nhật app trước.');
    const khungCu = dv.docDanhDau(dir).khung;
    const duAn = r.duAn || mh.moi({ ...dv.khungDuAn(dir), khongSlide: true });
    const bd = Math.max(0, Math.round(Number(o && o.batDauMs) || 0));
    const coPhuDe = !!duAn.phuDe;
    /* Khối trong dự án video có thể mang neo slide 0 (moHinh.datChoMs khi chưa có mốc: lệch = giờ tuyệt đối — khối
       thả bằng công cụ MCP, khối của bản trước GĐ3.4 neo vào "slide" nền đen giả). Có slide thật rồi thì neo đó
       trỏ vào slide của MẪU ⇒ khối nhảy thêm `batDauMs` giây. Gỡ neo, giữ đúng giờ đang thấy. */
    const khoi = (duAn.khoi || []).map((k) => (k.neo ? { ...k, neo: null, batDauMs: mh.batDauMs(k, []) } : k));
    const moi = { ...duAn, khoi, slide: { batDauMs: bd, doan: null }, phuDe: null,
      xuat: { ...(duAn.xuat || {}), khung: khungCu === 'ngang' ? '16:9' : '9:16' } };
    /* THỨ TỰ (rà GĐ3): kiểm → ĐỔI TÊN bản xuất cũ → chép mẫu → ghi du-an.json → gỡ tệp đánh dấu.
       · Đổi tên TRƯỚC: tệp hay bị giữ nhất (đang xem bản xuất trong trình phát) — hỏng ở đây thì CHƯA đụng gì.
       · Chép hỏng giữa chừng (đầy đĩa…) thì dự án vẫn là dự án video nguyên timeline + phụ đề (du-an.json chưa ghi),
         bản xuất đổi tên lại như cũ — bấm lại là xong. Ghi du-an.json trước như bản đầu thì hỏng chép là mất phụ đề.
       BẢN XUẤT CŨ của dự án video là `output/<tên>.mp4` — đúng tên video SLIDE của deck (render/tenVideo.js). Để nguyên
       thì tới lần "Tạo video" đầu nó bị coi là video slide: xem trước chồng khối lên bản đã có khối (hiện hai lần), danh
       sách báo "đã có video", xuất bản dựng áp timeline lần nữa. Đổi tên (kèm hồ sơ .info.json) — không xoá. */
    const k = mh.kiem(moi);
    if (!k.ok) throw new Error((k.loi || []).join(' · ') || 'Dự án dựng không hợp lệ.');
    const out = path.join(dir, 'output');
    const tenXuat = require('../render/tenVideo').tenVideo(path.basename(dir));
    const doi = [];   // [[tên cũ, tên mới]] — để đổi lại khi bước sau hỏng
    let banXuatCu = null;
    if (fs.existsSync(path.join(out, tenXuat))) {
      const goc = tenXuat.replace(/\.mp4$/i, '');
      let ten = `${goc}-truoc-slide`;
      for (let i = 2; fs.existsSync(path.join(out, `${ten}.mp4`)); i += 1) ten = `${goc}-truoc-slide-${i}`;
      try {
        fs.renameSync(path.join(out, tenXuat), path.join(out, `${ten}.mp4`));
      } catch (e) {
        throw new Error(`Không đổi tên được bản xuất cũ output/${tenXuat} (đang mở ở đâu đó?) — đóng nó rồi thử lại (${e.code || 'lỗi tệp'}).`);
      }
      doi.push([tenXuat, `${ten}.mp4`]);
      banXuatCu = `${ten}.mp4`;
      try { fs.renameSync(path.join(out, `${goc}.info.json`), path.join(out, `${ten}.info.json`)); doi.push([`${goc}.info.json`, `${ten}.info.json`]); } catch { /* không có hồ sơ */ }
    }
    let soTep = 0;
    try {
      soTep = chepMau(mauDir, dir);
      const sc = path.join(dir, 'script-90s.txt');
      if (!fs.existsSync(sc)) fs.writeFileSync(sc, '', 'utf8');
      const g = kho.ghiDuAn(dir, moi);
      if (!g.ok) throw new Error((g.loi || []).join(' · ') || 'Không ghi được dự án dựng.');
    } catch (e) {
      doi.forEach(([cu, moiTen]) => { try { fs.renameSync(path.join(out, moiTen), path.join(out, cu)); } catch { /* đành để tên mới */ } });
      // Lỗi tệp của Node mang đường dẫn máy — câu này đi tới agent (MCP cấm đường dẫn máy) và người dùng: nói gọn.
      if (e && e.code) throw new Error(`Không chép được mẫu vào dự án (${e.code}) — dự án video giữ nguyên timeline + phụ đề; thử lại sau.`);
      throw e;
    }
    for (const f of [path.join(dir, dv.TEP_DANH_DAU), path.join(dir, 'output', dv.TEN_NEN),
      path.join(dir, 'output', '_nen.info.json'), path.join(dir, 'output', 'timing.json')]) {
      try { fs.unlinkSync(f); } catch { /* chưa có */ }
    }
    return { ok: true, name: path.basename(dir), soTep, boPhuDe: coPhuDe, banXuatCu };
  }

  /**
   * TẠO BỘ SLIDE PHỤ (GĐ3.7 — src/dung/boSlide.js): chép mẫu vào `<dự án>/bo-slide/<id>/`, dựng video ĐEN đứng chỗ dài
   * bằng thời lượng ước theo lời thoại, trả bản ghi media (`boSlide: id`) — giao diện đặt nó lên timeline thành một
   * clip (một bước hoàn tác, render/them-slide.js). Chưa có clip nào dùng thì bộ đó không được dựng / không tính lượt.
   * @param {{ ten: string, mauId: string }} o  `ten` = dự án (deck gốc, không phải dự án video, không phải bộ phụ)
   * @returns {Promise<{ ok: true, id: string, ten: string, media: object }>}
   */
  async function taoBoSlidePhu(o) {
    const bs = require('../dung/boSlide');
    const dv = require('../dung/duAnVideo');
    const dirCha = resolveDeckDir(o && o.ten);
    if (!dirCha || bs.laDirCon(dirCha)) throw new Error('Không thấy dự án để thêm bộ slide.');
    /* Đang dựng CHÍNH dự án này: lượt đó đã chốt danh sách bộ cần dựng — bộ mới chỉ có video đen đứng chỗ vào bản cuối
       (audit 3.7). `ma: 'BAN'` ⇒ MCP RENDER_BUSY. */
    const js = ctx.jobState;
    if (js && js.running && js.projectDir && path.resolve(js.projectDir) === path.resolve(dirCha)) {
      throw Object.assign(new Error('Dự án đang tạo video — đợi xong rồi thêm bộ slide.'), { ma: 'BAN' });
    }
    if (dv.laDuAnVideo(dirCha)) throw new Error('Dự án video chưa có bộ slide nào — "Thêm bộ slide" sẽ đặt bộ đầu tiên.');
    const mauDir = timMau(o && o.mauId);
    if (laMauDung(mauDir)) throw new Error('Mẫu dựng video không thêm làm bộ slide được — dùng nó để tạo dự án mới.');
    const khung = khungCuaDeck(dirCha).ma;
    if (khungCuaDeck(mauDir).ma !== khung) {
      throw new Error(`Mẫu khác khổ dự án — chọn mẫu ${khung === 'ngang' ? 'ngang 16:9' : 'dọc 9:16'}.`);
    }
    const id = bs.idMoi(dirCha);
    const dich = bs.dirCon(dirCha, id);
    fs.mkdirSync(dich, { recursive: true });
    try {
      chepMau(mauDir, dich);
      const sc = path.join(dich, 'script-90s.txt');
      if (!fs.existsSync(sc)) fs.writeFileSync(sc, '', 'utf8');
      const k = dv.KHUNG[khung];
      const f = await bs.taoChoTrong(dirCha, id, { rong: k.rong, cao: k.cao, fps: dv.FPS }, bs.uocMs(dich));
      const tenMau = path.basename(mauDir);
      const media = { id: `bs-${id}`, loai: 'video', ten: `Bộ slide ${id.slice(1)} · ${tenMau}`.slice(0, 255), boSlide: id,
        ...(await bs.thongSoMedia(dirCha, f)) };
      const kq = require('../dung/moHinh').kiem({ ...require('../dung/moHinh').moi(), media: [media] });
      if (!kq.ok) throw new Error(kq.loi.join(' · '));
      return { ok: true, id, ten: bs.tenBo(path.basename(dirCha), id), media: kq.duAn.media[0] };
    } catch (e) {
      // Tạo dở ⇒ dọn, kẻo thư mục nửa vời nằm lại (không clip nào dùng nên vô hại, nhưng rác).
      try { fs.rmSync(dich, { recursive: true, force: true }); } catch { /* đành chịu */ }
      if (e && e.code) throw new Error(`Không chép được mẫu vào bộ slide (${e.code}).`);
      throw e;
    }
  }

  function readDeckInfo(dir) {
    const name = path.basename(dir);
    let slides = 0;
    try {
      const s = path.join(dir, 'script-90s.txt');
      if (fs.existsSync(s)) {
        slides = fs.readFileSync(s, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length;
      }
    } catch { /* thiếu script thì để 0, không ném lỗi làm hỏng cả danh sách */ }

    // Ảnh xem trước: deck nào cũng có ít nhất một `qa-slide-*.png` sau khi validate.
    let thumb = '';
    try {
      const anh = fs.readdirSync(dir).filter((f) => /^qa-slide-.*\.png$/i.test(f)).sort();
      if (anh.length) thumb = pathToFileURL(path.join(dir, anh[0])).href;
    } catch { /* không có ảnh thì thôi */ }

    return { name, path: dir, slides, thumb, hasIndex: fs.existsSync(path.join(dir, 'index.html')) };
  }

  /**
   * Danh mục template, đọc từ `_templates.json`.
   *
   * Có file danh mục thay vì tự đoán từ tên thư mục: tên thư mục là mã (tiếng
   * Anh, không dấu, dùng cho đường dẫn), còn tên hiện cho người dùng là tiếng
   * Việt có dấu kèm mô tả. Hai thứ khác nhau, đừng ép làm một.
   */
  /**
   * Thư mục deck mà AI được trỏ vào: `<thư mục cài>/slide`.
   *
   * ⚠ Đây là chỗ HAI BÊN PHẢI GẶP NHAU và trước đây thì không:
   * trang Template bảo AI "làm việc ở thư mục cài", trong khi app lại liệt kê
   * deck từ `sourceRoot` — một thư mục người dùng tự chọn ở chỗ khác. Đo thật
   * trên máy chủ dự án: thư mục cài có 5 deck, `sourceRoot` có 6 deck KHÁC HẲN.
   * Nghĩa là AI tạo deck xong thì app không bao giờ thấy nó, mà chẳng ai báo lỗi.
   */
  function thuMucDeckMacDinh() {
    return path.join(ctx.appRootDir(), 'slide');
  }

  // ------------------------------------------------------------------ xem trước deck
  //
  // Nút "Xem" của giao diện gốc là `<a href="/slide/<tên>/" target="_blank">` —
  // đường dẫn của web_server.py cũ. App này KHÔNG có HTTP server, và `api-shim`
  // chỉ chặn `fetch('/api/*')` chứ không chặn điều hướng của thẻ <a>. Nên bấm vào
  // chỉ mở ra một cửa sổ trắng. Đây là hàm thay thế: dựng bản xem trước rồi trả
  // URL để giao diện mở NGAY TRONG APP.

  /**
   * Tìm thư mục deck theo TÊN, đọc từ thiết lập HIỆN TẠI.
   *
   * Cố ý KHÔNG nhận thư mục từ renderer nữa. Bản đầu để `slide-viewer.js` tra
   * `window.__PROJECTS__` — mà biến đó là **ảnh chụp lúc nạp trang** do preload
   * bơm vào một lần. Bảng deck thì render lại về sau (bấm "Làm mới", đổi thư mục
   * nguồn, hoặc thêm deck mới), nên DOM có thể chứa deck mà ảnh chụp không có →
   * "Không tìm thấy thư mục của deck". Đây là lỗi phụ thuộc thời điểm, chạy thử
   * bằng script tự động gần như không bao giờ tái hiện.
   *
   * Main đọc thẳng từ đĩa nên luôn đúng tại thời điểm bấm.
   */
  function resolveDeckDir(nameOrDir) {
    if (!nameOrDir) return null;
    // Bộ slide phụ `cha::id` (GĐ3.7) → `<nguồn>/<cha>/bo-slide/<id>`.
    const bo = require('../dung/boSlide').tachTen(nameOrDir);
    if (bo) {
      const cha = resolveDeckDir(bo.cha);
      const dirB = cha && require('../dung/boSlide').dirCon(cha, bo.id);
      return dirB && fs.existsSync(path.join(dirB, 'index.html')) ? dirB : null;
    }
    // Đã là đường dẫn thật thì dùng luôn.
    const asPath = path.resolve(String(nameOrDir));
    if (fs.existsSync(path.join(asPath, 'index.html'))) return asPath;

    const root = ctx.loadSettings().sourceRoot;
    if (!root) return null;
    const direct = path.join(root, String(nameOrDir));
    if (fs.existsSync(path.join(direct, 'index.html'))) return direct;

    const hit = listProjects(root).find((p) => p.name === nameOrDir);
    return hit ? hit.path : null;
  }

  /**
   * Hồ sơ video đã tạo — cho bảng thông tin ở cột phải.
   *
   * Ưu tiên `<deck>.info.json` do pipeline ghi lúc render (có độ dài, độ phân
   * giải, giọng đọc — thứ mà nhìn file MP4 không biết được). Không có thì vẫn trả
   * được tên/dung lượng/ngày tạo từ chính file: video render từ trước bản này
   * không có hồ sơ, mà vẫn phải hiện được cái gì đó.
   */
  /**
   * Đọc thông số kỹ thuật của một file MP4 bằng ffprobe (đã đóng gói sẵn).
   *
   * Dùng cho video render TỪ TRƯỚC bản có `<deck>.info.json`: độ dài, khung hình,
   * fps, bitrate không nằm ở đâu khác ngoài chính file. Kết quả được ghi lại vào
   * hồ sơ nên chỉ tốn một lần cho mỗi video.
   *
   * Trả về `{}` khi hỏng — bảng thông tin vẫn hiện được phần đọc từ thuộc tính
   * file, thà thiếu vài dòng còn hơn hiện lỗi.
   */
  function doThongSoVideo(file) {
    const dir = config.ffmpegDir();
    if (!dir) return {};
    const exe = path.join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    if (!fs.existsSync(exe)) return {};
    try {
      const { execFileSync } = require('node:child_process');
      const raw = execFileSync(exe, [
        '-v', 'error',
        '-show_entries', 'format=duration,bit_rate:stream=codec_type,codec_name,width,height,avg_frame_rate',
        '-of', 'json', file,
      ], { timeout: 15000, windowsHide: true, encoding: 'utf8' });
      const j = JSON.parse(raw);
      const v = (j.streams || []).find((x) => x.codec_type === 'video') || {};
      const a = (j.streams || []).find((x) => x.codec_type === 'audio') || {};
      // avg_frame_rate ra dạng "30/1" — chia ra rồi làm tròn, không in nguyên phân số.
      let fps = null;
      if (v.avg_frame_rate && v.avg_frame_rate.includes('/')) {
        const [t, m] = v.avg_frame_rate.split('/').map(Number);
        if (m) fps = Math.round((t / m) * 100) / 100;
      }
      return {
        duration: Number(j.format?.duration) || null,
        bitrate: Number(j.format?.bit_rate) || null,
        width: Number(v.width) || null,
        height: Number(v.height) || null,
        fps,
        codec: v.codec_name || null,
        codecAmThanh: a.codec_name || null,
      };
    } catch {
      return {};
    }
  }

  return { IM_LANG_MS, dangThietKe, deckDangGhi, doThongSoVideo, listProjects, luuMauDung, mauCuaToi, readDeckInfo, resolveDeckDir, taoBoSlidePhu, taoDuAnTuMau, taoDuAnVideo, themSlideVaoDuAnVideo, templateRoots, thuMucDeckMacDinh, toLegacyProject, xoaMauCuaToi };
}

module.exports = { dangKy }