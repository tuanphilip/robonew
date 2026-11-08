'use strict';
/**
 * Trang hướng dẫn trong app.
 *
 * Hai nút ở hàng tiêu đề trước đây trỏ `/elevenlabs-guide#...` — đường của bản
 * web cũ. Bản desktop không có máy chủ web nên bấm vào chỉ ra một ô thông báo
 * "trang này thuộc bản web cũ". Nay nội dung nằm ngay trong app.
 *
 * Nội dung chép NGUYÊN VĂN từ `web_server.py` của bản gốc (mục #api-credit,
 * #api-key, #voice-id) — cùng câu chữ, cùng thứ tự bước, cùng đường liên kết.
 *
 * ⚠ KHÔNG chép mấy khung "ảnh chụp giả" của bản gốc: chúng là hình vẽ lại giao
 * diện ElevenLabs bằng CSS, kéo theo vài trăm dòng style cho một thứ sẽ lạc hậu
 * ngay khi ElevenLabs đổi giao diện. Chữ và liên kết mới là phần dùng được.
 */
(() => {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /** Video tổng quan CŨ trên YouTube — chỉ còn là đường lùi khi bản dựng thiếu tệp video đi kèm (xem xemVideo). */
  const VIDEO_HD = 'https://youtu.be/fyJav1Xf4fc';

  /**
   * Loạt video hướng dẫn (24/10/2026) — ĐI KÈM BỘ CÀI, phát ngay trong app (không YouTube): tệp ở
   * `docs/video-huong-dan/<khoá>.mp4`, đường dẫn hỏi main qua `templates.videoHuongDan()`. Mục nào khai
   * `video: { khoa, giay }` thì có nút "Xem đoạn này trong video" mở ĐÚNG giây đó. Khoá chưa có tệp thì nút ẩn.
   * `giay` = đầu câu phụ đề trừ 1 giây, đọc ở timeline.json của từng video (workspace video-huong-dan/tutorials/<khoá>/)
   * — dựng lại video là giờ đổi, phải soát lại các `giay`.
   */
  const VIDEO_DS = [
    { khoa: 'bat-dau', ten: 'Bắt đầu với Beeknoee Studio', mo: 'Chọn mẫu, thay ảnh, sửa chữ, xuất video' },
    { khoa: 'timeline', ten: 'Dựng video trên timeline', mo: 'Cắt ghép, chuyển cảnh, chữ, nhạc nền' },
    { khoa: 'mau-dung', ten: 'Mẫu dựng video', mo: 'Thay từng ô, lưu video làm mẫu riêng' },
    { khoa: 'slide-timeline', ten: 'Video slide có giọng đọc', mo: 'Lời thoại, nền, giọng trên máy' },
    { khoa: 'ai-agent', ten: 'AI agent', mo: 'Nhắn bằng lời thường để AI dựng hộ' },
  ];
  let videoTai = null;
  /** `{ khoá: file:// }` — hỏi main MỘT lần; lỗi thì coi như không có video (nút ẩn, không vỡ trang). */
  const napVideo = () => videoTai || (videoTai = Promise.resolve()
    .then(() => window.beeknoee.templates.videoHuongDan())
    .then((d) => d || {}, () => ({})));

  /** Hiện nút video của những khoá CÓ tệp (nút vẽ sẵn `hidden` — vẽ bài không phải đợi IPC). */
  function hienNutVideo(goc) {
    napVideo().then((ds) => {
      goc.querySelectorAll('[data-hd-xem]').forEach((b) => { b.hidden = !ds[b.dataset.hdXem]; });
    });
  }

  /**
   * Trình phát trong app: lớp phủ cả cửa sổ, tua sẵn tới `giay`. Esc / bấm nền / × là đóng.
   * Esc nghe ở WINDOW pha bắt: popup Hướng dẫn nghe Esc ở document pha bắt — nghe cùng chỗ thì Esc đóng luôn
   * cả bài đang đọc chứ không chỉ video.
   */
  async function xemVideo(khoa, giay) {
    const ds = await napVideo();
    if (!ds[khoa]) {
      // Bản dựng thiếu tệp video: video tổng quan cũ trên YouTube vẫn hơn một nút bấm không ra gì.
      if (khoa === 'bat-dau' && window.beeknoee && window.beeknoee.openExternal) window.beeknoee.openExternal(VIDEO_HD);
      return;
    }
    const v = VIDEO_DS.find((x) => x.khoa === khoa);
    const lop = document.createElement('div');
    lop.className = 'hd-xem';
    lop.innerHTML = `
      <div class="hd-xem-khung" role="dialog" aria-modal="true" aria-label="${esc(v ? v.ten : 'Video hướng dẫn')}">
        <div class="hd-xem-dau"><b>${esc(v ? v.ten : 'Video hướng dẫn')}</b>
          <button class="hd-xem-x" type="button" data-dong-xem aria-label="Đóng">×</button></div>
        <video controls autoplay playsinline preload="metadata"></video>
      </div>`;
    const vid = lop.querySelector('video');
    vid.src = ds[khoa] + (giay > 0 ? `#t=${Math.floor(giay)}` : '');
    const dongXem = () => {
      vid.pause(); vid.removeAttribute('src'); vid.load();
      lop.remove(); window.removeEventListener('keydown', phimXem, true);
    };
    const phimXem = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dongXem(); } };
    lop.addEventListener('click', (e) => { if (e.target === lop || e.target.closest('[data-dong-xem]')) dongXem(); });
    window.addEventListener('keydown', phimXem, true);
    document.body.appendChild(lop);
    vid.focus();
  }

  /** Mỗi mục = một thẻ trong trang. `moc` khớp với anchor của bản web cũ. */
  const NOI_DUNG = {
    /**
     * Hướng dẫn tổng quan, lấy VIDEO làm chính.
     *
     * ⚠ KHÔNG nhúng YouTube bằng iframe. CSP của app là
     * `frame-src 'self' file:` nên khung nhúng bị chặn thẳng — mà chặn thì
     * không có lỗi nào hiện ra, chỉ là một ô trắng. Ảnh thu nhỏ của YouTube
     * cũng không lấy được vì `img-src` không cho miền ngoài.
     * Nên: mở bằng trình duyệt hệ thống qua `data-ngoai` (xem `noiLinkNgoai`),
     * vừa đúng CSP vừa xem được toàn màn hình.
     *
     * Phần chữ CỐ Ý ngắn: video đã nói đủ, chép lại từng bước ở đây thì hai bản
     * lệch nhau ngay lần cập nhật app kế tiếp. Chỉ giữ những mốc mà người xem
     * cần tra nhanh sau khi đã xem video một lần.
     */
    'su-dung-app': {
      tieuDe: 'Hướng dẫn sử dụng App Beeknoee Studio',
      moTa: 'Xem video dưới đây một lượt là dùng được app. Phần chữ bên dưới chỉ '
        + 'để tra lại nhanh khi quên một bước.',
      nhanh: {
        ten: 'Xem video hướng dẫn đầy đủ',
        chu: 'Video đi hết một lượt: chọn mẫu, thay ảnh của bạn, sửa chữ, xuất video — phát ngay trong app. '
          + 'Bốn video còn lại (timeline, mẫu, video slide, AI agent) ở trang chủ Hướng dẫn và trong từng bài.',
        nut: 'Xem video hướng dẫn',
      },
      muc: [
        {
          moc: 'lam-slide',
          video: { khoa: 'bat-dau', giay: 31 },
          icon: 'copy',
          nhan: 'Bước 1',
          ten: 'Bắt đầu một dự án — chọn một trong ba cách',
          buoc: [
            'TỪ MẪU DỰNG VIDEO: trang Mẫu → nhóm "Mẫu dựng video" → "Tạo dự án". Có sẵn cảnh, chữ, chuyển cảnh, nhạc — '
              + 'chỉ việc thay ảnh / video của bạn (bài "Mẫu dựng video").',
            'DỰ ÁN TRỐNG: nút "Dự án mới" trên thanh trên cùng → timeline trống, tự thả ảnh, video, nhạc, chữ '
              + '(bài "Timeline và phím tắt").',
            'DỰ ÁN SLIDE có giọng đọc: nhờ AI agent ngay trong app (Cách 1) hoặc Copy prompt ra Claude / Codex Desktop (Cách 2) — '
              + 'hai mục ngay dưới đi từng bước.',
            'Dự án nào cũng hiện trong hộp "Dự án" trên thanh trên cùng, không phải bấm Làm mới.',
          ],
        },
        /* CÁCH 1 — AI agent trong app. Tab "Tạo bằng AI" (nối API key, chọn model) đã gỡ 16/10/2026:
           AI agent dùng gói Codex / Claude sẵn có của người dùng, làm được cả việc tab cũ làm. */
        {
          moc: 'ai-trong-app',
          icon: 'bolt',
          nhan: 'Cách 1',
          ten: 'Làm video bằng AI agent ngay trong app',
          buoc: [
            'Cột AI agent nằm bên trái trang Dựng video. Bấm nút chọn agent dưới ô nhập: Codex (gói ChatGPT) hoặc Claude (gói Pro/Max). '
              + 'Máy đã đăng nhập Codex / Claude Code thì bấm là kết nối; chưa có thì app mở trang đăng nhập của OpenAI / Anthropic.',
            'Nhắn như nói với người: "làm video dọc từ mẫu Mẫu khởi đầu về 5 mẹo ngủ ngon", kèm nội dung hoặc đường link bài viết. '
              + 'Agent tạo dự án từ mẫu, viết chữ và lời thoại cho từng slide, tự kiểm lỗi.',
            'Nhắn tiếp để sửa: "đổi tiêu đề slide 2", "rút ngắn slide 4"… Agent chỉ sửa đúng chỗ được nhờ.',
            'Ưng rồi thì bấm "Tạo video" ở thanh trên — hoặc bảo agent dựng (mỗi lượt dựng tốn một lượt hạn mức).',
            'Agent làm được cả dự án video: "tạo dự án từ mẫu Hành trình với ảnh trong D:\\Anh", "thêm nhạc Lo-fi rồi xuất video". '
              + 'Chi tiết ở bài "AI agent".',
          ],
          video: { khoa: 'ai-agent', giay: 34 },
          luuY: 'Agent chạy bằng tài khoản ChatGPT / Claude của chính bạn, không trừ vào lượt dựng video của '
            + 'Beeknoee Studio (trừ khi bạn bảo nó dựng video). Muốn dùng khoá Beeknoee Platform thay gói thì chọn '
            + '"Claude · Beeknoee Platform".',
          luuYTone: 'tin',
        },
        /* Chuyển từ trang Template sang (10/09/2026). Trước đây đây là một bảng
           bung ra ngay trong trang Template; nút ở đó nay dẫn thẳng vào mục này.
           Để MỘT chỗ vì hai bản sẽ lệch nhau ở lần cập nhật app kế tiếp — đúng
           lý do đã ghi ở đầu bài này. */
        {
          moc: 'lam-bang-ai',
          icon: 'bolt',
          nhan: 'Cách 2',
          ten: 'Copy prompt cho Claude Desktop hoặc Codex Desktop',
          buoc: [
            'Mở Claude Desktop hoặc Codex Desktop (Claude CLI / Codex CLI cũng được). '
              + 'Cho phần mềm đó quyền làm việc trong ĐÚNG thư mục dưới đây — chỗ app đã cài, '
              + 'nơi có mẫu và tài liệu để AI đọc.',
            'Vào trang Mẫu dọc 9:16 hoặc Mẫu ngang 16:9, chọn mẫu, bấm "Copy prompt". '
              + 'Prompt đã kèm sẵn đường dẫn thư mục, luật vùng an toàn, phụ đề và các yêu cầu chất lượng.',
            'Dán vào cửa sổ chat của phần mềm AI, thay dòng [DÁN URL HOẶC NỘI DUNG Ở ĐÂY] bằng nội dung '
              + 'hoặc đường link bài viết của bạn, rồi gửi.',
            'Để AI làm. Nó sẽ đọc workflow.md, chép mẫu thành dự án mới, viết chữ và lời thoại, '
              + 'rồi tự chạy kiểm. Xong thì dự án hiện ngay trong danh sách của app.',
            'Bấm vào dự án để xem trên sân khấu. Đổi màu, hiệu ứng, phụ đề ngay ở bảng bên phải; '
              + 'sửa sâu hơn thì nhờ tiếp AI ở phần mềm kia hoặc nhắn cho tab "AI agent" trong app.',
            'Ưng rồi thì bấm "Tạo video" ở thanh trên: chọn giọng đọc, tốc độ, độ phân giải.',
          ],
          // Hiện đường dẫn THẬT của thư mục app + nút copy — xem dienDuongApp().
          duongApp: true,
          luuY: 'Cách này không cần API key trong app — dùng tài khoản Claude/Codex sẵn có của bạn. '
            + 'Đổi lại phải chuyển qua lại giữa hai cửa sổ.',
          luuYTone: 'tin',
        },
        {
          moc: 'giong-doc',
          icon: 'mic',
          nhan: 'Bước 2',
          ten: 'Chọn giọng đọc',
          buoc: [
            'Tải file: dùng file đọc có sẵn (MP3, WAV, M4A) — bấm Chọn file. App nhớ riêng cho từng dự án.',
            'ElevenLabs: nối thẳng tài khoản ElevenLabs — xem bài "Lấy API key + Voice ID".',
            'Beeknoee AI: tạo tài khoản ở Beeknoee Platform theo nút dưới đây, '
              + 'lấy API key rồi dán vào app. Nhiều model và giọng để chọn, trả tiền theo lượt dùng.',
            'Trên máy — miễn phí, đọc ngay trên máy không cần mạng: bấm Tải một lần '
              + '(app tự kiểm máy có chạy được không, tải ~210–520 MB tuỳ CPU), rồi chọn giọng Bắc / Trung / Nam.',
          ],
          hinh: [{ anh: 'assets/huong-dan/dk-giong.webp', chu: 'Bốn nguồn giọng: Tải file, ElevenLabs, Beeknoee AI, Trên máy.' }],
          luuY: 'Nhóm Giọng đọc nằm ở cuối tab Âm thanh của dự án slide (bảng bên phải). Dự án video thì thêm giọng bằng nút "+ Giọng" dưới timeline.',
          luuYTone: 'tin',
          link: 'https://platform.beeknoee.com/',
          linkNhan: 'Mở Beeknoee Platform',
        },
        {
          moc: 'dung-video',
          icon: 'play',
          nhan: 'Bước 3',
          ten: 'Dựng video',
          buoc: [
            'Dự án slide: bấm "Tạo video" ở góc phải thanh trên → chọn Tốc độ và Độ phân giải → Tạo video. Bảng năm bước hiện tiến trình.',
            'Dự án video: bấm "Xuất video" — ra tệp output/<tên dự án>.mp4.',
            'Xong thì dùng nút ⓘ (thông tin video) và nút thư mục cạnh tên dự án để xem / lấy tệp.',
          ],
          hinh: [{ anh: 'assets/huong-dan/dk-tao-video.webp', chu: 'Hộp Tạo video của dự án slide sau một lượt dựng xong.' }],
        },
      ],
      cuoi: 'Sửa script sau khi đã dựng thì dự án hiện "Video cũ" — nhớ dựng lại '
        + 'để nội dung khớp lời thoại.',
    },
    /* ══ ĐỢT BÀI 23/10/2026 — chụp từ app thật (giao diện sáng, dữ liệu thử), số ①②③ trên ảnh khớp thứ tự
       gạch đầu dòng. Ảnh nguồn + công cụ chụp: workspace tools/huong-dan/. */
    'giao-dien': {
      tieuDe: 'Bản đồ giao diện: mỗi vùng làm gì',
      moTa: 'Một màn hình làm hết mọi việc: chọn mẫu, dựng timeline, nhờ AI, xuất video. Bài này đi qua từng vùng '
        + 'và từng nút — số trên ảnh khớp với số thứ tự trong chữ.',
      muc: [
        {
          moc: 'gd-tong',
          video: { khoa: 'bat-dau', giay: 95 },
          icon: 'slide',
          nhan: 'Tổng quan',
          ten: 'Sáu vùng của trang Dựng video',
          buoc: [
            'Thanh dọc bên trái: chuyển trang — Dựng video, Mẫu dọc, Mẫu ngang, Nâng cấp, Hướng dẫn. Bánh răng ở đáy là Cài đặt.',
            'Thanh trên cùng: dự án đang mở, đổi tên, tạo dự án mới, trợ giúp và nút Xuất video / Tạo video.',
            'Cột AI agent: nhắn bằng lời thường để AI làm hộ — tạo dự án từ mẫu, thay ảnh, sửa chữ, dựng video.',
            'Khung xem: hình ảnh tại đầu phát. Bấm vào một hình để chọn khối, kéo để dời chỗ, kéo góc để đổi cỡ.',
            'Bảng bên phải: tab Thư viện (media, nhạc, hiệu ứng, mẫu) và tab Thuộc tính (chỉnh khối đang chọn).',
            'Timeline: các track xếp chồng, khối ảnh / video / chữ / tiếng, đầu phát và bộ công cụ cắt, kéo.',
          ],
          hinh: [{ anh: 'assets/huong-dan/gd-toan.webp', rong: true,
            chu: 'Trang Dựng video với một dự án tạo từ mẫu "Hành trình" — sáu vùng đánh số.' }],
        },
        {
          moc: 'gd-loai',
          icon: 'info',
          nhan: 'Khái niệm',
          ten: 'Hai loại dự án',
          buoc: [
            'DỰ ÁN VIDEO: chỉ có timeline — thả ảnh, video, nhạc, chữ rồi bấm "Xuất video". Tạo bằng nút "Dự án mới" '
              + 'hoặc từ một mẫu dựng video (nhóm "Mẫu dựng video" ở trang Mẫu).',
            'DỰ ÁN SLIDE: một bộ slide có giọng đọc, tạo từ mẫu slide. Bấm "Tạo video" để dựng slide + giọng + phụ đề. '
              + 'Phía trên vẫn có timeline để chèn thêm B-roll, logo, chữ, nhạc.',
            'Nhãn khổ cạnh tên dự án cho biết khổ: hình điện thoại là dọc 9:16 (Shorts, Reels, TikTok), '
              + 'hình màn ngang là 16:9 (YouTube).',
          ],
          luuY: 'Dự án video thêm được bộ slide về sau (Thuộc tính → "Thêm bộ slide…"), và dự án slide thêm được '
            + 'khối trên timeline — hai loại không tách biệt hẳn.',
          luuYTone: 'tin',
        },
        {
          moc: 'gd-thanh-tren',
          icon: 'cuon',
          nhan: 'Thanh trên',
          ten: 'Thanh trên cùng',
          buoc: [
            'Dự án: mở danh sách dự án để chuyển sang dự án khác (gõ để tìm).',
            'Nhãn khổ: dọc 9:16 hoặc ngang 16:9.',
            'Bút: đổi tên dự án ngay tại chỗ — Enter lưu, Esc bỏ.',
            'Dự án mới: tạo dự án video trống (chọn tên + khổ).',
            'Dấu hỏi: mở trang Hướng dẫn này.',
            'Xuất video (dự án video) hoặc Tạo video (dự án slide). Khi đang chạy nút đổi thành "Đang xuất / Đang tạo video" — bấm để xem tiến trình.',
          ],
          hinh: [{ anh: 'assets/huong-dan/gd-thanh-tren.webp', rong: true, chu: 'Thanh trên cùng khi đang mở một dự án video.' }],
          luuY: 'Dự án đã có video thì cạnh bút hiện thêm hai nút: ⓘ (thông tin video — rê chuột để xem) và thư mục (mở chỗ chứa video).',
          luuYTone: 'tin',
        },
        {
          moc: 'gd-thanh-doc',
          video: { khoa: 'bat-dau', giay: 9 },
          icon: 'play',
          nhan: 'Thanh dọc',
          ten: 'Thanh dọc bên trái',
          buoc: [
            'Dựng video: trang làm việc chính.',
            'Mẫu dọc 9:16: kho mẫu cho Shorts / Reels / TikTok.',
            'Mẫu ngang 16:9: kho mẫu cho YouTube, bài giảng.',
            'Nâng cấp: các gói và lượt tạo video.',
            'Hướng dẫn: các bài như bài này.',
          ],
          hinh: [{ anh: 'assets/huong-dan/gd-thanh-doc.webp', chu: 'Năm nút chuyển trang.' }],
          luuY: 'Bánh răng ở đáy thanh dọc là Cài đặt: giao diện sáng / tối, cỡ chữ, Cài đặt AI, phiên bản và kiểm tra cập nhật, đăng xuất.',
          luuYTone: 'tin',
        },
        {
          moc: 'gd-du-an',
          icon: 'folder',
          nhan: 'Hộp Dự án',
          ten: 'Danh sách dự án',
          buoc: [
            'Ô tìm: gõ vài chữ của tên dự án.',
            'Đổi thư mục nguồn: chọn thư mục CHA chứa các dự án.',
            'Chép tên dự án (rê chuột lên một dòng để hiện).',
            'Xoá dự án — chuyển vào Thùng rác của Windows, lấy lại được.',
            'Dọn dẹp: xoá tệp dựng dở còn sót trong thư mục nguồn.',
          ],
          hinh: [{ anh: 'assets/huong-dan/gd-du-an.webp', chu: 'Mỗi dòng: tên, khổ, trạng thái (Video · Sẵn sàng / 6 slide · Đã có video) và giờ sửa.' }],
          luuY: 'Bấm vào một dòng là mở dự án đó. Esc hoặc bấm lại nút "Dự án" để đóng hộp. Vừa chép dự án vào thư mục bằng tay mà chưa thấy '
            + 'thì bấm ↻ (Làm mới) ở góc trên phải khung xem — nút đó quét lại cả danh sách.',
          luuYTone: 'tin',
        },
        {
          moc: 'gd-du-an-moi',
          video: { khoa: 'timeline', giay: 7 },
          icon: 'cong',
          nhan: 'Tạo mới',
          ten: 'Hộp "Dự án mới"',
          buoc: [
            'Tên dự án (bỏ trống thì app đặt "video-moi"; trùng tên thì tự thêm -2, -3).',
            'Dọc 9:16 · 1080×1920 — Shorts, Reels, TikTok.',
            'Ngang 16:9 · 1920×1080 — YouTube.',
            'Tạo dự án: mở ngay timeline trống để thả media vào.',
          ],
          hinh: [{ anh: 'assets/huong-dan/gd-du-an-moi.webp', chu: 'Dự án mới = timeline trống, không cần slide hay giọng đọc.' }],
          luuY: 'Muốn bắt đầu từ một video dựng sẵn thì vào trang Mẫu → nhóm "Mẫu dựng video" → "Tạo dự án" (xem bài Mẫu dựng video).',
          luuYTone: 'nhac',
        },
      ],
    },

    'timeline': {
      tieuDe: 'Timeline: công cụ, track, cắt ghép và phím tắt',
      moTa: 'Timeline làm việc giống Premiere / CapCut: mỗi track là một lớp, khối nằm trên track, đầu phát chỉ giờ '
        + 'đang xem. Mọi thao tác đều hoàn tác được bằng Ctrl+Z.',
      muc: [
        {
          moc: 'tl-thanh',
          icon: 'cuon',
          nhan: 'Thanh công cụ',
          ten: 'Từng nút trên thanh công cụ',
          buoc: [
            'Đồng hồ: giờ:phút:giây:khung của đầu phát; bên cạnh là tổng thời lượng sẽ xuất.',
            'Về đầu slide trước (phím ↑).',
            'Chạy / dừng (Space).',
            'Tới đầu slide sau (↓).',
            'Tắt / bật tiếng bản xem trước.',
            'Công cụ Chọn (V): bấm, kéo khối.',
            'Dao cạo (C): bấm vào khối để cắt đôi tại chỗ bấm. V hoặc Esc để về công cụ Chọn.',
            'Bắt dính (S): khi kéo hoặc cắt, khối hút vào đầu phát, mép khối khác và ranh giới slide.',
            'Hoàn tác (Ctrl+Z).',
            'Làm lại (Ctrl+Shift+Z hoặc Ctrl+Y).',
            'Bám đầu phát: timeline tự cuộn theo khi video chạy.',
            'Thu nhỏ timeline (phím −). Thanh trượt bên cạnh để thu phóng; Alt + lăn chuột cũng được.',
            'Phóng to (phím =).',
            'Vừa khung (phím \\): thấy trọn video.',
            'Thu gọn / mở rộng timeline để có thêm chỗ cho khung xem.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tl-thanh.webp', rong: true, chu: 'Thanh công cụ timeline — số theo thứ tự trái sang phải.' }],
          luuY: 'Kéo mép trên của timeline để đổi chiều cao; bấm đúp mép đó để về cỡ mặc định.',
          luuYTone: 'tin',
        },
        {
          moc: 'tl-track',
          icon: 'slide',
          nhan: 'Track',
          ten: 'Track, thước thời gian và đầu phát',
          buoc: [
            'Thước thời gian: bấm hoặc kéo để tua. Vạch đỏ "Kết thúc" là chỗ video xuất ra sẽ dừng (khối cuối cùng).',
            'Đầu phát: giờ đang xem trên khung. Khối mới, chữ mới, hiệu ứng mới đều đặt tại đây.',
            'Tên track: V = hình (track trên che track dưới), A = tiếng, C1 = phụ đề. Bấm tên C1 để chỉnh phụ đề.',
            'Ổ khoá: khoá track, không ai sửa được (kể cả AI agent).',
            'Con mắt: ẩn track — khối trên đó không vào video xuất. Track tiếng thì là nút loa (tắt tiếng track).',
          ],
          hinh: [{ anh: 'assets/huong-dan/tl-toan.webp', rong: true, chu: 'Timeline của mẫu "Hành trình": cảnh ở V2, lớp phủ V3–V4, chữ V5–V7; nhãn "Ô 1…8" là ô của mẫu.' }],
          luuY: 'Cuối danh sách track có bốn nút: "+ Hình", "+ Tiếng" (thêm track), "+ Chữ" (chữ tiêu đề tại đầu phát) '
            + 'và "+ Giọng" (gõ lời → giọng đọc thành một khối).',
          luuYTone: 'tin',
        },
        {
          moc: 'tl-khoi',
          video: { khoa: 'timeline', giay: 85 },
          icon: 'edit',
          nhan: 'Khối',
          ten: 'Làm việc với khối',
          buoc: [
            'Bấm để chọn; Shift hoặc Ctrl + bấm để chọn thêm; Ctrl+A chọn hết.',
            'Kéo thân khối để dời — kéo lên / xuống sang track cùng loại được.',
            'Kéo mép trái / phải để cắt bớt đầu / đuôi. Khối nhạc bật "Lặp lại" thì kéo dài bao nhiêu cũng được.',
            'Cắt đôi: công cụ Dao cạo, hoặc chọn khối rồi Ctrl+K để cắt tại đầu phát.',
            'Delete xoá khối; Shift+Delete xoá rồi DỒN các khối phía sau lên cho liền.',
            'Ctrl+C / Ctrl+V: chép rồi dán tại đầu phát.',
            'Kéo ảnh / video từ Thư viện (hoặc thẳng từ thư mục Windows) xuống track để thêm khối.',
            'Thả media lên một khối hình đang giữ Alt — hoặc thả lên "Ô n" của mẫu — là THAY media, giữ nguyên chuyển cảnh và hiệu ứng.',
          ],
          luuY: 'Ví dụ — bỏ 2 giây đầu một video: đặt đầu phát ở giây 2, chọn khối, Ctrl+K, chọn nửa đầu rồi Shift+Delete để nửa sau dồn về giây 0.',
          luuYTone: 'tot',
        },
        {
          moc: 'tl-danh-dau',
          icon: 'sao',
          nhan: 'Mẹo',
          ten: 'Điểm đánh dấu và di chuyển nhanh',
          buoc: [
            'M: đặt điểm đánh dấu tại đầu phát (ví dụ đánh dấu các nhịp nhạc để cắt cảnh cho khớp).',
            'Shift+M tới điểm sau, Ctrl+Shift+M về điểm trước. Bấm đúp điểm trên thước để đặt tên, Alt+bấm để xoá.',
            'J / K / L: tua lùi / dừng / phát — bấm J hoặc L nhiều lần để nhanh dần tới 8×.',
            '← / → khi đang xem: lùi / tiến 1 khung (Shift: 5 khung). Home / End: về đầu / tới cuối.',
            'Lăn chuột: cuộn ngang. Alt + lăn: thu phóng quanh con trỏ.',
          ],
        },
        {
          moc: 'tl-phim',
          icon: 'help',
          nhan: 'Tra nhanh',
          ten: 'Bảng phím tắt',
          buoc: [
            'Space chạy / dừng · J K L tua · ← → từng khung · ↑ ↓ slide trước / sau · Home End đầu / cuối.',
            'V Chọn · C Dao cạo · S Bắt dính · Esc bỏ chọn, về công cụ Chọn.',
            'Ctrl+Z hoàn tác · Ctrl+Shift+Z / Ctrl+Y làm lại.',
            'Ctrl+K cắt tại đầu phát · Delete xoá · Shift+Delete xoá + dồn · Ctrl+C / Ctrl+V chép / dán · Ctrl+A chọn hết.',
            'M đặt điểm đánh dấu · Shift+M tới điểm sau · Ctrl+Shift+M về điểm trước.',
            '= phóng to · − thu nhỏ · \\ vừa khung · Alt + lăn chuột thu phóng.',
          ],
          luuY: 'Phím tắt chỉ chạy khi con trỏ không nằm trong ô nhập chữ — bấm vào vùng timeline trước nếu phím không ăn.',
          luuYTone: 'nhac',
        },
      ],
    },

    'thu-vien': {
      tieuDe: 'Thư viện: media, nhạc, hiệu ứng và mẫu intro / outro',
      moTa: 'Tab Thư viện ở bảng bên phải là kho mọi thứ bạn đặt lên timeline. Năm tab con: Dự án, Dùng chung, '
        + 'Mẫu, Nhạc, Hiệu ứng.',
      muc: [
        {
          moc: 'tv-du-an',
          video: { khoa: 'timeline', giay: 40 },
          icon: 'folder',
          nhan: 'Dự án',
          ten: 'Media của dự án',
          buoc: [
            'Tab Dự án: ảnh, video, âm thanh đã nhập vào dự án này.',
            'Nhập media — hoặc kéo tệp từ thư mục Windows thả vào đây. Tệp được CHÉP vào thư mục dự án (dung/media), dọn thư mục Tải về cũng không mất.',
            '+ Chữ: thêm chữ tiêu đề tại đầu phát.',
            'Lọc: Tất cả / Video / Ảnh / Âm thanh.',
            'Lấp nhanh (chỉ hiện với dự án tạo từ mẫu dựng video): chọn một lượt nhiều tệp, app điền vào các ô theo thứ tự.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tv-du-an.webp', chu: 'Bấm đúp một ô media là thêm vào timeline tại đầu phát; kéo xuống track cũng được.' }],
          luuY: 'Trên mỗi ô media: ★ lưu vào thư viện Dùng chung, thùng rác xoá khỏi dự án.',
          luuYTone: 'tin',
        },
        {
          moc: 'tv-chung',
          icon: 'cuon',
          nhan: 'Dùng chung',
          ten: 'Thư viện dùng chung',
          buoc: [
            'Thêm vào thư viện dùng chung: logo, nhạc riêng, đoạn intro… dùng cho MỌI dự án. Hoặc bấm ★ trên một media của tab Dự án.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tv-chung.webp', chu: 'Thư viện dùng chung còn trống.' }],
          luuY: 'Bấm đúp một mục là chép vào dự án đang mở và đặt tại đầu phát. Xoá khỏi thư viện dùng chung không làm hỏng dự án đã dùng — '
            + 'mỗi dự án giữ bản chép riêng.',
          luuYTone: 'tin',
        },
        {
          moc: 'tv-mau',
          video: { khoa: 'mau-dung', giay: 159 },
          icon: 'copy',
          nhan: 'Mẫu',
          ten: 'Mẫu intro / outro',
          buoc: [
            'Ô tên mẫu, ví dụ "Intro kênh".',
            'Chọn các khối intro trên timeline (logo, chữ, nhạc…) rồi bấm "Lưu N khối đang chọn". Lần sau bấm "Chèn" là đặt cả cụm tại đầu phát, giữ nguyên khoảng cách.',
            'Lưu cả dự án làm mẫu dựng video: biến cả video đang dựng thành mẫu ở trang Mẫu, nhóm "Mẫu của tôi" (chỉ dự án video).',
          ],
          hinh: [{ anh: 'assets/huong-dan/tv-mau.webp', chu: 'Hai kiểu mẫu: cụm khối intro / outro, hoặc cả dự án.' }],
        },
        {
          moc: 'tv-nhac',
          video: { khoa: 'timeline', giay: 214 },
          icon: 'nhac',
          nhan: 'Nhạc',
          ten: 'Nhạc nền có sẵn',
          buoc: [
            'Sáu bản dựng ngay trong app, không bản quyền: Nhẹ nhàng, Piano, Lo-fi, Điện ảnh, Trầm, Nhạc mẫu.',
            '▶\uFE0E Nghe để nghe thử (lần đầu mất khoảng 1 giây để dựng bản nhạc).',
            'Thêm: đặt lên track tiếng tại đầu phát và tự LẶP tới hết video. Kéo xuống timeline cũng được.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tv-nhac.webp', chu: 'Nhạc có sẵn — mô tả ngắn hợp với loại nội dung nào.' }],
          luuY: 'Có giọng đọc thì bật "Hạ nhạc khi có giọng" (Thuộc tính khi không chọn khối) để nhạc tự nhỏ lại lúc giọng nói.',
          luuYTone: 'tin',
        },
        {
          moc: 'tv-hieu-ung',
          icon: 'sao',
          nhan: 'Hiệu ứng',
          ten: 'Lớp phủ và tiếng hiệu ứng',
          buoc: [
            'Lớp phủ: Viền tối, Vệt sáng ấm, Vệt sáng tím, Khung điện ảnh, Dải tối dưới, Dải tối trên, Chớp sáng, Đốm sáng, Viền mảnh — phủ kín khung, đặt trên một track hình.',
            'Tiếng hiệu ứng: Vút, Vút nhanh, Bụp, Nổ trầm, Tiếng dâng, Ting, Tách, Gõ phím, Thông báo.',
            'Bấm một mục là đặt ĐÚNG tại đầu phát — nên đặt đầu phát vào chỗ cắt cảnh trước. Kéo xuống timeline cũng được.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tv-hieu-ung.webp', chu: 'Lớp phủ có ảnh xem trước; tiếng hiệu ứng có nút Nghe.' }],
          luuY: 'Ví dụ kiểu CapCut: tiếng "Vút" bắt đầu khoảng 0,3 giây TRƯỚC chỗ cắt, "Chớp sáng" đặt ngay chỗ cắt, '
            + '"Viền tối" phủ cả video cho chất phim.',
          luuYTone: 'tot',
        },
      ],
    },

    'thuoc-tinh': {
      tieuDe: 'Thuộc tính: chỉnh khối, keyframe, màu và cắt khung',
      moTa: 'Tab Thuộc tính ở bảng bên phải đổi theo thứ đang chọn: không chọn gì là cài đặt của cả video, chọn một '
        + 'khối là chỉnh riêng khối đó. Sửa tới đâu khung xem đổi tới đó, Ctrl+Z để hoàn tác.',
      muc: [
        {
          moc: 'tt-ca-video',
          icon: 'khung',
          nhan: 'Không chọn khối',
          ten: 'Cài đặt của cả video',
          buoc: [
            'Bấm Esc để bỏ chọn — tab Thuộc tính hiện cài đặt chung.',
            'Cài đặt video → Khung: Theo khổ dự án, 16:9 ngang (YouTube), 9:16 dọc (Shorts, TikTok), 1:1 vuông, 4:5 (Instagram). '
              + 'Dòng "Bản xuất" cho biết cỡ video sẽ ra.',
            'Màu cả video: Độ sáng, Tương phản, Bão hoà áp cho MỌI khối một lượt — kiểu "chỉnh màu tổng" cuối cùng. "Màu gốc" để trả về 100.',
            'Phụ đề, Bộ slide, Hạ nhạc khi có giọng: xem các bài "Phụ đề và xuất video", "Âm thanh và giọng đọc".',
          ],
          hinh: [
            { anh: 'assets/huong-dan/tt-cai-dat.webp', chu: 'Đổi khung là đổi cỡ bản xuất — khối tự căn lại theo khung mới.' },
            { anh: 'assets/huong-dan/tt-mau-video.webp', chu: 'Màu cả video: tương phản 106, bão hoà 112 cho ảnh đậm đà hơn.' },
          ],
          luuY: 'Ví dụ: dựng xong bản dọc cho TikTok, muốn thêm bản 1:1 cho Facebook — đổi Khung sang 1:1 rồi Xuất video, khỏi dựng lại từ đầu.',
          luuYTone: 'tot',
        },
        {
          moc: 'tt-chon',
          icon: 'edit',
          nhan: 'Chọn khối',
          ten: 'Chọn và kéo ngay trên khung xem',
          buoc: [
            'Bấm một khối trên timeline, hoặc bấm thẳng vào hình trên khung xem — khối được chọn có khung xanh.',
            'Kéo thân hình để dời chỗ; kéo chấm xanh ở góc để đổi cỡ. Số ở tab Thuộc tính (Vị trí X / Y, Cỡ) chạy theo.',
            'Muốn chính xác thì gõ số vào ô bên phải thanh trượt rồi Enter.',
          ],
          hinh: [{ anh: 'assets/huong-dan/sk-chon.webp', chu: 'Chữ "HÀNH TRÌNH" đang được chọn — kéo khung để dời, kéo góc để phóng.' }],
        },
        {
          moc: 'tt-o',
          video: { khoa: 'mau-dung', giay: 99 },
          icon: 'copy',
          nhan: 'Ô của mẫu',
          ten: 'Thay ảnh / video trong ô của mẫu',
          buoc: [
            'Thay bằng ảnh / video của bạn…: chọn tệp trên máy. Khối GIỮ NGUYÊN chỗ, độ dài, chuyển cảnh và hiệu ứng — chỉ đổi hình.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-o.webp', chu: 'Dự án tạo từ mẫu: mỗi cảnh là một "Ô n" có sẵn hiệu ứng.' }],
          luuY: 'Nhanh hơn nữa: kéo ảnh từ Thư viện (hoặc từ thư mục Windows) thả thẳng lên khối "Ô n" trên timeline.',
          luuYTone: 'tin',
        },
        {
          moc: 'tt-keyframe',
          icon: 'dongho',
          nhan: 'Keyframe',
          ten: 'Chuyển động bằng keyframe',
          buoc: [
            'Đồng hồ ⏱: bật hoạt ảnh cho thuộc tính đó (Vị trí X, Vị trí Y, Cỡ, Xoay, Độ đục). Bấm lần nữa là tắt — giữ giá trị đang thấy tại đầu phát.',
            '◀\uFE0E tới keyframe trước.',
            '◆ thêm / bỏ keyframe tại đầu phát. Khi ⏱ đang bật, cứ dời đầu phát rồi đổi số (hoặc kéo hình) là có keyframe mới.',
            '▶\uFE0E tới keyframe sau.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-chuyen-dong.webp', chu: 'Ba nút ◀\uFE0E ◆ ▶\uFE0E chỉ hiện ở thuộc tính đã bật ⏱. Đầu phát phải nằm trong khối thì mới sửa được keyframe.' }],
          luuY: 'Ví dụ — ảnh phóng từ từ trong 3 giây: đặt đầu phát ở đầu khối, bật ⏱ ở Cỡ (100). Tua tới giây thứ 3, gõ Cỡ = 130. '
            + 'Ô "Chuyển động êm giữa các keyframe" bật thì chuyển động vào / ra chậm như máy quay thật.',
          luuYTone: 'tot',
        },
        {
          moc: 'tt-hieu-ung',
          video: { khoa: 'timeline', giay: 115 },
          icon: 'sao',
          nhan: 'Không cần keyframe',
          ten: 'Hiệu ứng chuyển động có sẵn',
          buoc: [
            'Kiểu: Không, Phóng chậm (Ken Burns), Thu chậm, Trôi sang trái, Trôi sang phải, Trôi lên, Trôi xuống.',
            'Hiệu ứng chạy hết độ dài khối — kéo dài khối thì chuyển động chậm lại, không phải chỉnh gì thêm.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-hieu-ung.webp', chu: 'Một chọn là ảnh tĩnh có chuyển động.' }],
          luuY: 'Mẹo: xen "Phóng chậm" và "Trôi sang trái / phải" giữa các ảnh liền nhau để video không đều đều.',
          luuYTone: 'tot',
        },
        {
          moc: 'tt-mau',
          icon: 'sun',
          nhan: 'Hình ảnh',
          ten: 'Màu, cắt khung và lật',
          buoc: [
            'Màu: Độ sáng, Tương phản, Bão hoà của RIÊNG khối này. "Màu gốc" trả về 100.',
            'Cắt khung & lật: cắt bớt mép Trái / Phải / Trên / Dưới (tính theo %), Lật ngang, Lật dọc.',
          ],
          hinh: [
            { anh: 'assets/huong-dan/tt-mau.webp', chu: 'Màu của một khối.' },
            { anh: 'assets/huong-dan/tt-cat.webp', chu: 'Cắt khung: bỏ viền đen, logo dính ở mép ảnh.' },
          ],
          luuY: 'Ảnh tối hơn các cảnh khác thì tăng Độ sáng lên 110–120 cho đều màu cả video.',
          luuYTone: 'tin',
        },
        {
          moc: 'tt-thoi-gian',
          icon: 'play',
          nhan: 'Video, tiếng',
          ten: 'Tốc độ phát',
          buoc: [
            'Thời gian → Tốc độ: 25% (quay chậm) tới 400% (tua nhanh). 100% là bình thường.',
            'Đổi tốc độ thì khối co / giãn theo, keyframe đã đặt dời theo đúng tỉ lệ.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-thoi-gian.webp', chu: 'Có ở khối video và khối tiếng.' }],
          luuY: 'Ví dụ: cảnh thác nước đặt 50% là ra slow-motion mượt cho đoạn mở đầu.',
          luuYTone: 'tot',
        },
        {
          moc: 'tt-cuoi',
          icon: 'refresh',
          nhan: 'Cuối bảng',
          ten: 'Về mặc định và Xoá khối',
          buoc: [
            'Về mặc định: xoá mọi chỉnh sửa của khối (vị trí, màu, cắt, keyframe…) nhưng giữ khối trên timeline.',
            'Xoá khối: bỏ khối khỏi timeline (giống phím Delete).',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-cuoi.webp', chu: 'Hai nút ở cuối tab Thuộc tính.' }],
        },
      ],
      cuoi: 'Chuyển cảnh, chữ và âm thanh cũng nằm ở tab này — mỗi thứ có bài riêng ngay trong trang Hướng dẫn.',
    },

    'chuyen-canh': {
      tieuDe: 'Chuyển cảnh và chữ động',
      moTa: 'Mỗi khối có chuyển cảnh VÀO và RA riêng — 26 kiểu, chia 5 nhóm. Chữ có thêm 7 kiểu chữ động. '
        + 'Chọn khối → tab Thuộc tính → nhóm Chuyển cảnh.',
      muc: [
        {
          moc: 'cc-dat',
          video: { khoa: 'timeline', giay: 131 },
          icon: 'slide',
          nhan: 'Cách đặt',
          ten: 'Vào, Ra và độ dài',
          buoc: [
            'Vào: cách khối hiện ra. Ra: cách khối biến mất. Dài: bao nhiêu giây (kéo thanh hoặc gõ số).',
            'Ô "Hoà với khối liền trước": khối trước nằm lại BÊN DƯỚI trong lúc chuyển, hai cảnh chồng lên nhau như xfade của Premiere. '
              + 'Bỏ tích thì khối trước tắt hẳn rồi khối này mới vào.',
            'Chuyển cảnh cho chữ, logo, lớp phủ cũng y như cho ảnh.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-chuyen-canh.webp', chu: 'Ảnh vào bằng "Quét mềm sang trái" trong 0,5 giây, hoà với cảnh thác trước đó.' }],
        },
        {
          moc: 'cc-kieu',
          icon: 'sao',
          nhan: 'Danh sách',
          ten: '26 kiểu chuyển cảnh',
          buoc: [
            'Cơ bản: Mờ dần, Trượt từ trái / phải / dưới lên / trên xuống, Phóng to + mờ (khi Ra: Trượt sang trái… và Thu nhỏ + mờ).',
            'Chuyển động: Phóng mạnh (từ 1,6×), Bật nảy, Xoay vào (khi Ra: Phình to + mờ, Thu nảy, Xoay ra).',
            'Quét: Quét sang trái / phải / lên / xuống — bản "Quét mềm" có mép nhoè, êm hơn.',
            'Hình: Tròn mở từ giữa, Tròn khép từ mép, Mở / Khép vào giữa (khe dọc và khe ngang), Quét vòng kim đồng hồ.',
            'Nháy qua màu: Nháy đen, Nháy trắng — cảnh lóe qua một màu rồi sang cảnh mới.',
          ],
          luuY: 'Gợi ý phối: video du lịch dùng "Quét mềm" + "Mờ dần"; video sôi động dùng "Phóng mạnh", "Nháy trắng" đúng nhịp trống; '
            + 'video sản phẩm dùng "Tròn mở từ giữa" để lộ sản phẩm. Một video chỉ nên dùng 2–3 kiểu cho có chất riêng.',
          luuYTone: 'tot',
        },
        {
          moc: 'cc-chu-dong',
          icon: 'chu',
          nhan: 'Chữ',
          ten: 'Chữ động',
          buoc: [
            'Chọn khối chữ → nhóm Chữ động → Kiểu: Không, Bật lên, Trượt lên, Phóng mạnh, Xoay vào, Mở từ giữa, Lộ dần (quét), Trôi nhẹ.',
            'Mỗi kiểu là một cặp chuyển cảnh Vào + Ra dựng sẵn, thời lượng vừa cho chữ (ví dụ Bật lên = Bật nảy 0,45 giây vào, Mờ dần ra). '
              + 'Khối chữ ngắn thì hiệu ứng tự co lại cho vừa.',
            'Chọn xong vẫn chỉnh tiếp Vào / Ra / Dài ở nhóm Chuyển cảnh được. Chọn "Không" là bỏ chuyển cảnh của chữ.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-chu-dong.webp', chu: 'Tiêu đề "HÀNH TRÌNH" dùng "Phóng mạnh".' }],
        },
        {
          moc: 'cc-them',
          icon: 'nhac',
          nhan: 'Cho chất hơn',
          ten: 'Thêm lớp phủ và tiếng hiệu ứng ở chỗ cắt',
          buoc: [
            'Đặt đầu phát vào chỗ hai cảnh nối nhau.',
            'Thư viện → Hiệu ứng: bấm "Chớp sáng" (lớp phủ) và "Vút" (tiếng) — cả hai đặt đúng tại đầu phát.',
            'Kéo khối tiếng "Vút" sớm lên khoảng 0,3 giây để tiếng tới trước hình.',
          ],
          luuY: 'Đây là công thức các mẫu dựng video đang dùng — mở một mẫu ra xem timeline là thấy.',
          luuYTone: 'tin',
        },
      ],
    },

    'chu': {
      tieuDe: 'Chữ tiêu đề: phông, cỡ, màu, viền',
      moTa: 'Chữ là một khối như ảnh: kéo, cắt, chuyển cảnh, keyframe đều được. Phông Việt hoá sẵn, '
        + 'xuất ra video giữ đúng như khung xem.',
      muc: [
        {
          moc: 'chu-them',
          video: { khoa: 'timeline', giay: 163 },
          icon: 'cong',
          nhan: 'Thêm chữ',
          ten: 'Ba cách thêm chữ',
          buoc: [
            'Nút "+ Chữ" ở cuối danh sách track (dưới timeline).',
            'Thư viện → Dự án → "+ Chữ".',
            'Hoặc nhờ AI agent: "thêm tiêu đề NIKKO · NHẬT BẢN ở giây 2, chữ vàng".',
          ],
          luuY: 'Chữ mới đặt TẠI ĐẦU PHÁT, dài 4 giây, trên track hình trên cùng (track đang khoá thì bỏ qua) — tua tới đúng chỗ trước khi thêm.',
          luuYTone: 'nhac',
        },
        {
          moc: 'chu-sua',
          video: { khoa: 'bat-dau', giay: 166 },
          icon: 'cochu',
          nhan: 'Chỉnh chữ',
          ten: 'Nhóm "Chữ tiêu đề"',
          buoc: [
            'Ô chữ: gõ nội dung, Enter để xuống dòng.',
            'Phông: Inter, Be Vietnam Pro, Montserrat, Playfair Display, Anton, Dancing Script, Segoe UI, Arial, Tahoma, Times New Roman, Courier New.',
            'Cỡ chữ (px).',
            'Đậm, Nghiêng, Bóng đổ — bấm để bật / tắt.',
            'Căn: Trái, Giữa, Phải.',
            'Màu chữ; Viền (độ dày px) + Màu viền.',
            'Nền sau chữ: thêm dải nền sau chữ cho dễ đọc trên ảnh rối.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-chu.webp', chu: 'Tiêu đề mẫu "Hành trình": Montserrat 124 px, Đậm + Bóng đổ.' }],
          luuY: 'Ví dụ tiêu đề TikTok dễ đọc: Anton hoặc Montserrat Đậm, 110–140 px, chữ trắng, Viền 6–8 px màu đen.',
          luuYTone: 'tot',
        },
        {
          moc: 'chu-vi-tri',
          icon: 'khung',
          nhan: 'Vị trí',
          ten: 'Đặt chữ đúng chỗ',
          buoc: [
            'Kéo chữ trên khung xem; số Vị trí X / Y ở nhóm Chuyển động chạy theo.',
            'Video dọc: chừa khoảng 15% trên và 25% dưới — TikTok / Reels phủ tên kênh, nút bấm ở đó.',
            'Chữ động và chuyển cảnh cho chữ: xem bài Chuyển cảnh và chữ động.',
          ],
        },
      ],
    },

    'am-thanh': {
      tieuDe: 'Âm thanh: nhạc nền, giọng đọc và tiếng hiệu ứng',
      moTa: 'Tiếng nằm trên các track A. Khối tiếng chỉnh được âm lượng (có keyframe), lặp, tăng / giảm dần, '
        + 'tốc độ. Giọng đọc tạo ngay trong app từ chữ bạn gõ.',
      muc: [
        {
          moc: 'at-khoi',
          video: { khoa: 'timeline', giay: 239 },
          icon: 'loa',
          nhan: 'Khối tiếng',
          ten: 'Âm lượng và lặp lại',
          buoc: [
            'Chọn khối tiếng → tab Thuộc tính → Âm thanh.',
            'Âm lượng: 0–400% (100% là gốc). Bấm ⏱ để đặt keyframe — ví dụ nhạc to ở đoạn mở đầu rồi nhỏ dần khi vào nội dung.',
            'Lặp lại: kéo mép phải của khối dài bao nhiêu cũng được, nhạc tự lặp (nhạc có sẵn của Thư viện bật sẵn ô này).',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-am-thanh.webp', chu: 'Nhạc nền 75%, đang lặp.' }],
        },
        {
          moc: 'at-tang-giam',
          icon: 'nhac',
          nhan: 'Êm tai',
          ten: 'Tăng / giảm dần',
          buoc: [
            'Tăng dần: số giây nhạc lớn dần từ im lặng lúc khối bắt đầu.',
            'Giảm dần: số giây nhạc nhỏ dần về im lặng trước khi khối hết.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-tang-giam.webp', chu: 'Vào 1 giây, ra 2 giây — đủ để video không bị "cụt" tiếng.' }],
          luuY: 'Nhạc nền nên luôn có Giảm dần 1,5–3 giây ở cuối video.',
          luuYTone: 'tot',
        },
        {
          moc: 'at-giong',
          icon: 'mic',
          nhan: 'Giọng đọc',
          ten: 'Thêm giọng đọc bằng "+ Giọng"',
          buoc: [
            'Gõ lời cần đọc (tối đa 5.000 ký tự). Số, ngày tháng app tự đọc thành chữ.',
            'Bộ giọng: Edge TTS (miễn phí, cần mạng), Trên máy (miễn phí, không cần mạng), Beeknoee AI, ElevenLabs (theo API key của bạn).',
            'Giọng: chọn người đọc trong bộ đã chọn.',
            'Tốc độ: 1 là bình thường; 1,1–1,2 hợp video ngắn.',
            'Tạo giọng đọc: khối giọng đặt tại đầu phát, trên track Giọng đọc.',
          ],
          hinh: [{ anh: 'assets/huong-dan/giong-hop.webp', chu: 'Nút "+ Giọng" nằm cuối danh sách track, cạnh "+ Chữ".' }],
          luuY: 'Chữ + giọng đã đọc rồi thì lần sau app lấy lại, không tính tiền lại.',
          luuYTone: 'tin',
        },
        {
          moc: 'at-ha-nhac',
          icon: 'loa',
          nhan: 'Tự động',
          ten: 'Hạ nhạc khi có giọng',
          buoc: [
            'Bỏ chọn khối → Thuộc tính → tích "Hạ nhạc khi có giọng": nhạc và các tiếng khác tự nhỏ lại lúc giọng đọc đang nói.',
            'App coi track nào là giọng đọc? Chọn một khối trên track đó → nhóm "Track An" → tích "Track giọng đọc". Track tạo bằng "+ Giọng" đã tích sẵn.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-ha-nhac.webp', chu: 'Kiểu "ducking" của Premiere — một ô tích.' }],
        },
        {
          moc: 'at-sfx',
          icon: 'sao',
          nhan: 'Hiệu ứng',
          ten: 'Nhạc có sẵn và tiếng hiệu ứng',
          buoc: [
            'Thư viện → Nhạc: 6 bản không bản quyền, bấm Thêm là đặt lên track tiếng và lặp tới hết video.',
            'Thư viện → Hiệu ứng → tiếng: Vút, Vút nhanh, Bụp, Nổ trầm, Tiếng dâng, Ting, Tách, Gõ phím, Thông báo.',
            'Nhạc riêng của bạn: Thư viện → Dự án → Nhập media (mp3, wav, m4a…), rồi kéo xuống track A.',
          ],
          luuY: 'Track A có nút loa ở đầu track để tắt tiếng cả track khi cần nghe riêng giọng.',
          luuYTone: 'tin',
        },
      ],
    },

    'xuat': {
      tieuDe: 'Phụ đề tự động và xuất video',
      moTa: 'Dự án video tạo phụ đề ngay trên máy từ tiếng trong timeline, rồi xuất ra một tệp MP4. '
        + 'Phụ đề không tốn lượt; mỗi lần xuất tính một lượt tạo video.',
      muc: [
        {
          moc: 'xu-phu-de',
          icon: 'cochu',
          nhan: 'Phụ đề',
          ten: 'Tạo phụ đề tự động',
          buoc: [
            'Bấm tên track C1 (Phụ đề) ở đầu timeline. Ngôn ngữ: Tiếng Việt, English, hoặc Tự nhận ngôn ngữ.',
            'Tạo phụ đề tự động: app nghe giọng đọc, giọng thu, nhạc có lời trên timeline rồi chia câu, đặt giờ.',
          ],
          hinh: [{ anh: 'assets/huong-dan/pd-c1.webp', chu: 'Chạy ngay trên máy — không cần mạng, không tốn lượt.' }],
          luuY: 'Câu sai chữ thì bấm vào câu đó trên track C1 để sửa; kéo mép câu để chỉnh giờ.',
          luuYTone: 'tin',
        },
        {
          moc: 'xu-kieu',
          icon: 'chu',
          nhan: 'Kiểu chữ',
          ten: 'Kiểu phụ đề',
          buoc: [
            'Có phụ đề rồi thì bấm lại tên C1: nhóm "Kiểu phụ đề" hiện ra.',
            'Phông, Cỡ chữ, Đậm / Nghiêng / Gạch chân, Căn lề.',
            'Màu chữ (cả câu) và Màu từ đang đọc (chữ đang được nói tới sáng lên kiểu karaoke).',
            'Viền chữ + Màu viền; Nền sau chữ (độ đục %) + Màu nền.',
            'Vị trí: Dưới / Trên, và khoảng cách tới mép.',
            '"Hiện phụ đề trong video": bỏ tích là xuất video không có phụ đề.',
          ],
        },
        {
          moc: 'xu-xuat',
          video: { khoa: 'bat-dau', giay: 199 },
          icon: 'play',
          nhan: 'Xuất',
          ten: 'Xuất video',
          buoc: [
            'Kiểm khung (bỏ chọn khối → Cài đặt video) và vạch đỏ "Kết thúc" trên thước — video dừng ở khối cuối cùng.',
            'Bấm "Xuất video" ở góc phải thanh trên. Nút đổi thành "Đang xuất video" cho tới khi xong.',
            'Tệp ra: output/<tên dự án>.mp4 trong thư mục dự án. Cạnh tên dự án hiện nút ⓘ (thông tin video) và nút thư mục (mở chỗ chứa).',
            'Đang xuất vẫn chuyển sang dự án khác làm tiếp được; bấm Xuất ở dự án khác thì nó xếp hàng chạy sau.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tt-cai-dat.webp', chu: 'Đổi khung trước khi xuất để ra bản 16:9, 9:16, 1:1 hoặc 4:5 từ cùng một dự án.' }],
          luuY: 'Xuất lại sau khi sửa sẽ GHI ĐÈ tệp cũ. Muốn giữ bản cũ thì đổi tên tệp trong thư mục output trước.',
          luuYTone: 'nhac',
        },
      ],
    },

    'mau-dung': {
      tieuDe: 'Mẫu dựng video: tạo dự án từ mẫu có sẵn',
      moTa: 'Mẫu dựng video là một timeline dựng sẵn — cảnh, chữ, chuyển cảnh, nhạc, tiếng hiệu ứng — với các "ô" '
        + 'để bạn thả ảnh / video của mình vào. Giống template của CapCut.',
      muc: [
        {
          moc: 'md-trang',
          video: { khoa: 'bat-dau', giay: 31 },
          icon: 'copy',
          nhan: 'Trang Mẫu',
          ten: 'Tìm mẫu',
          buoc: [
            'Nhóm mẫu: bấm "Mẫu dựng video" để chỉ xem mẫu dựng video; các nhóm khác là mẫu slide.',
            'Lưới / Danh sách: đổi cách xem.',
            'Sắp xếp: Thứ tự đề xuất, Tên A → Z, Nhiều slide nhất.',
            'Thẻ mẫu: bấm ▶\uFE0E để xem video mẫu.',
            '"Hướng dẫn chi tiết": mở bài Hướng dẫn sử dụng app (đi hết một lượt từ lúc chọn mẫu tới lúc ra video).',
            'Ô tìm (Ctrl+K): gõ chủ đề, phong cách, ví dụ "du lịch", "sản phẩm".',
          ],
          hinh: [{ anh: 'assets/huong-dan/mau-trang.webp', rong: true, chu: 'Trang Mẫu dọc 9:16. Mẫu ngang 16:9 ở nút ngay dưới trên thanh dọc.' }],
        },
        {
          moc: 'md-the',
          icon: 'play',
          nhan: 'Thẻ mẫu',
          ten: 'Các nút trên một thẻ mẫu',
          buoc: [
            'Phát / dừng video mẫu.',
            'Bật / tắt tiếng.',
            'Copy prompt: chép lời nhờ cho Claude Desktop / Codex Desktop bên ngoài app.',
            'Tạo dự án: mở hộp Tạo dự án (mục dưới).',
          ],
          hinh: [{ anh: 'assets/huong-dan/mau-the.webp', chu: 'Dưới tên mẫu: số ô và độ dài ("8 ô · 17 giây").' }],
        },
        {
          moc: 'md-hop',
          icon: 'bolt',
          nhan: 'Tạo dự án',
          ten: 'Hộp Tạo dự án',
          buoc: [
            'Nội dung: tả video bạn muốn và dán đường dẫn ảnh / video của bạn, mỗi tệp một dòng.',
            'Lưu ý (không bắt buộc): giọng điệu, độ dài, màu sắc, tên thương hiệu, điều cần tránh.',
            'Chỉ tạo dự án: tạo ngay dự án từ mẫu, không nhờ AI — bạn tự thả media vào các ô.',
            'Tạo: app chuyển sang trang Dựng video và ĐẶT SẴN lời nhờ vào ô chat của AI agent. Đọc lại, sửa nếu cần, rồi bấm Gửi.',
          ],
          hinh: [{ anh: 'assets/huong-dan/mau-hop-tao.webp', chu: 'Bấm Tạo không gửi ngay — bạn vẫn được xem lại lời nhờ.' }],
          luuY: 'Ví dụ Nội dung: "Video du lịch Đà Lạt 3 ngày 2 đêm" rồi hai dòng D:\\Anh\\dalat-1.jpg, D:\\Anh\\dalat-2.mp4. '
            + 'AI tạo dự án từ mẫu, thay vào các ô theo thứ tự, sửa chữ tiêu đề cho hợp.',
          luuYTone: 'tot',
          video: { khoa: 'mau-dung', giay: 51 },
        },
        {
          moc: 'md-o',
          video: { khoa: 'mau-dung', giay: 73 },
          icon: 'folder',
          nhan: 'Sau khi tạo',
          ten: 'Thay media vào các ô',
          buoc: [
            'Trên track Cảnh, mỗi khối có nhãn "Ô 1, Ô 2…" — ảnh / video mẫu đang giữ chỗ.',
            'Kéo ảnh từ Thư viện thả lên một ô: thay hình, giữ nguyên chuyển cảnh và hiệu ứng.',
            'Hoặc chọn khối → Thuộc tính → "Thay bằng ảnh / video của bạn…".',
            'Lấp nhanh (Thư viện → Dự án): chọn một lượt nhiều tệp, app điền vào các ô theo thứ tự.',
          ],
          hinh: [{ anh: 'assets/huong-dan/md-o-track.webp', rong: true, chu: 'Track Cảnh của mẫu "Hành trình": 8 ô, mỗi ô đang giữ một ảnh / video mẫu.' }],
                  },
        {
          moc: 'md-luu',
          video: { khoa: 'mau-dung', giay: 159 },
          icon: 'sao',
          nhan: 'Mẫu riêng',
          ten: 'Lưu video của bạn làm mẫu',
          buoc: [
            'Thư viện → Mẫu → "Lưu cả dự án làm mẫu dựng video".',
            'Mẫu mới nằm ở trang Mẫu, nhóm "Mẫu của tôi" — tạo dự án từ nó như mẫu có sẵn.',
            'Hợp cho kênh có khuôn cố định: intro, cỡ chữ, nhạc, logo giống nhau, chỉ thay cảnh mỗi tập.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tv-mau.webp', chu: 'Lưu cụm intro / outro, hoặc lưu cả dự án.' }],
        },
      ],
    },

    'ai-agent': {
      tieuDe: 'AI agent: nhờ AI dựng và sửa video hộ',
      moTa: 'Cột AI agent bên trái trang Dựng video. Nhắn bằng lời thường, agent tự thao tác trong app: tạo dự án '
        + 'từ mẫu, thay ảnh, thêm chữ, chỉnh màu, đặt chuyển cảnh, xuất video.',
      muc: [
        {
          moc: 'ag-ket-noi',
          video: { khoa: 'ai-agent', giay: 11 },
          icon: 'bolt',
          nhan: 'Kết nối',
          ten: 'Chọn agent',
          buoc: [
            'Codex — dùng gói ChatGPT của bạn. Chấm xanh = đã kết nối; nút đỏ bên phải để đăng xuất.',
            'Claude — dùng gói Pro / Max. Bấm Đăng nhập: máy đã đăng nhập Claude Code thì kết nối ngay, chưa thì mở trang Anthropic để đăng nhập.',
            'Claude · Beeknoee Platform — dùng khoá sk-bee-… của Beeknoee Platform, trả theo lượt dùng.',
            'Model: model của agent đang chọn.',
            'Mức suy nghĩ: cao hơn thì làm kỹ hơn nhưng chậm hơn.',
            'Quyền: mức tự do của agent (ví dụ Auto review — tự làm, chỉ hỏi khi cần).',
            'Khoá API cho AI agent…: dán / đổi khoá Beeknoee Platform.',
          ],
          hinh: [{ anh: 'assets/huong-dan/ag-menu.webp', chu: 'Bấm tên agent dưới ô nhập để mở menu này.' }],
          luuY: 'Studio không thấy mật khẩu: đăng nhập diễn ra trên trang của OpenAI / Anthropic. '
            + 'Agent chạy bằng tài khoản của bạn, không trừ lượt tạo video của Studio — chỉ lần xuất video mới tính lượt.',
          luuYTone: 'tin',
        },
        {
          moc: 'ag-chat',
          video: { khoa: 'ai-agent', giay: 145 },
          icon: 'edit',
          nhan: 'Nhắn tin',
          ten: 'Ô nhập tin',
          buoc: [
            'Gõ lời nhờ. Enter gửi, Shift+Enter xuống dòng.',
            'Đính kèm ảnh (ảnh chụp màn hình, ảnh mẫu bạn muốn bắt chước).',
            'Agent / model đang dùng — bấm để đổi.',
            'Gửi. Trong lúc agent đang làm, nút này thành nút Dừng.',
          ],
          hinh: [{ anh: 'assets/huong-dan/ag-nhap.webp', chu: '"Chat mới" ở đầu cột để bắt đầu lại từ đầu.' }],
        },
        {
          moc: 'ag-vi-du',
          icon: 'saoAI',
          nhan: 'Ví dụ',
          ten: 'Nhờ gì cũng được — vài câu mẫu',
          buoc: [
            '"Tạo dự án từ mẫu Hành trình, dùng ảnh trong thư mục D:\\Anh\\Nikko, tiêu đề MÙA THU NIKKO."',
            '"Ô 3 thay bằng D:\\Anh\\la-do.jpg, cho phóng chậm."',
            '"Thêm chữ \'Ngày 1\' ở giây 4, chữ vàng, phông Montserrat, chữ động Trượt lên."',
            '"Tất cả ảnh tăng tương phản 110, chuyển cảnh Quét mềm 0,5 giây."',
            '"Thêm nhạc Lo-fi, giảm dần 2 giây ở cuối, rồi xuất video."',
          ],
          luuY: 'Agent sửa TRỰC TIẾP vào dự án đang mở — khung xem đổi ngay. Mỗi việc agent làm là MỘT bước hoàn tác tên "AI: …": không ưng thì Ctrl+Z.',
          luuYTone: 'tot',
          video: { khoa: 'ai-agent', giay: 175 },
        },
        {
          moc: 'ag-ngoai',
          icon: 'monitor',
          nhan: 'Agent ngoài app',
          ten: 'Dùng Claude Code / Codex bên ngoài',
          buoc: [
            'Chuột phải biểu tượng Studio ở khay hệ thống → "AI agent (Claude Code, Codex)" → "Kết nối với Claude Code" hoặc "Kết nối với Codex".',
            'Mở Claude Code / Codex (đang mở thì khởi động lại) rồi chat như thường — nó điều khiển Studio qua cổng MCP trên máy.',
            'Agent khác (Gemini CLI, Cursor…): cùng menu → Nâng cao → "Bật cổng MCP cho agent nối tay" rồi "Sao chép cấu hình kết nối".',
            'Hoặc kiểu cũ: trang Mẫu → "Copy prompt" → dán vào Claude Desktop / Codex Desktop.',
          ],
          luuY: 'Cổng MCP chỉ mở trên máy bạn (127.0.0.1), có mã kết nối riêng. Ngắt lúc nào cũng được ở cùng menu.',
          luuYTone: 'tin',
        },
      ],
    },

    /**
     * Bài THƯ MỤC — chỗ hỏng nhiều nhất ở ngày đầu tiên.
     *
     * Không phải chuyện dùng app cho đẹp: app theo dõi một thư mục, AI ghi deck
     * vào thư mục khác, và triệu chứng là "danh sách trống" — thứ mà ai cũng đọc
     * thành "app hỏng". Chú thích ở `ipc/projects.js` (chỗ dựng `workRoot`) đã
     * cảnh báo đúng cái lệch này từ phía mã; đây là phía người dùng.
     */
    'thu-muc': {
      tieuDe: 'Thư mục làm việc: app tìm deck ở đâu',
      moTa: 'App chỉ nhìn thấy deck nằm trong MỘT thư mục. AI dựng deck ra chỗ khác thì '
        + 'danh sách trống — không phải app hỏng. Bài này chỉ chỗ đó ở đâu và sửa thế nào.',
      muc: [
        {
          moc: 'tm-mot-tang',
          luuYTone: 'tot',
          luuY: 'Deck AI vừa dựng xong tự hiện trong danh sách — không phải bấm Làm mới.',
          icon: 'folder',
          nhan: 'Khái niệm',
          ten: 'Một thư mục, quét đúng một tầng',
          buoc: [
            'App quét MỘT thư mục nguồn. Mỗi thư mục con nằm ngay trong đó, nếu có file index.html, là một dự án.',
            'Đúng MỘT tầng: deck nằm trong thư mục con của thư mục con thì app không thấy.',
            'Thiếu index.html cũng không thấy — app không tính đó là dự án.',
            'Đang trỏ vào đâu: bấm "Dự án" trên thanh trên cùng — ô thư mục ở đầu hộp hiện thư mục nguồn.',
          ],
        },
        {
          moc: 'tm-doi',
          icon: 'edit',
          nhan: 'Khi cần',
          ten: 'Đổi sang thư mục khác',
          buoc: [
            'Bấm "Dự án" trên thanh trên cùng, rồi bấm nút thư mục cạnh ô tìm (số 1 trên ảnh) để chọn thư mục chứa các dự án.',
            'Chọn thư mục CHA — chỗ chứa các thư mục deck, đừng bấm vào trong một deck.',
            'Chọn xong trang tự nạp lại. Lượt đang dựng vẫn chạy tiếp ở nền, không bị huỷ.',
            'App nhớ lựa chọn này, lần mở sau vào thẳng.',
          ],
          hinh: [{ anh: 'assets/huong-dan/tm-nguon.webp', chu: 'Nút thư mục ở đầu hộp Dự án — rê chuột vào để xem đang trỏ tới đâu.' }],
        },
        {
          moc: 'tm-ai',
          luuYTone: 'nhac',
          luuY: 'Lệch thư mục thì AI báo dựng xong mà danh sách vẫn trống. Triệu chứng giống hệt app hỏng, nên đây là chỗ đáng kiểm đầu tiên.',
          icon: 'bolt',
          nhan: 'Quan trọng',
          ten: 'Trỏ AI vào đúng chỗ',
          buoc: [
            'Đây là chỗ hỏng nhiều nhất: app theo dõi thư mục A, AI lại ghi deck vào thư mục B. '
              + 'AI báo xong xuôi mà danh sách vẫn trống.',
            'Thư mục làm việc của AI là thư mục CHA của thư mục nguồn — nơi có template/, '
              + 'workflow.md và AGENTS.md để AI đọc.',
            'Đường dẫn đúng nằm ngay dưới đây. Bấm Copy đường dẫn rồi đặt nó làm thư mục làm việc '
              + 'cho Claude Desktop, Codex hoặc bản dòng lệnh.',
            'Nút Copy prompt ở trang Template đã kèm sẵn đường dẫn này — dán nguyên câu lệnh là AI biết đường.',
          ],
          duongApp: true,
        },
        {
          moc: 'tm-trong',
          icon: 'warn',
          nhan: 'Gỡ rối',
          ten: 'Danh sách trống thì kiểm ba thứ',
          buoc: [
            'Thư mục nguồn (ô thư mục trong hộp Dự án) đang trỏ vào đâu — mở thư mục đó ra xem có thư mục deck nào không.',
            'Deck đã có index.html ngay trong nó chưa.',
            'Deck có bị lồng sâu thêm một tầng không.',
            'Deck AI vừa dựng thì tự hiện; vẫn không thấy thì bấm ↻ (Làm mới) ở góc trên phải khung xem để quét lại. Vẫn không có thì gần như chắc chắn '
              + 'là hai thư mục đang lệch nhau.',
          ],
        },
      ],
      cuoi: 'Deck là thư mục thường trên đĩa, không nằm trong cơ sở dữ liệu nào. Chép cả thư mục deck '
        + 'sang máy khác rồi trỏ thư mục nguồn vào đó là dùng được ngay.',
    },

    /**
     * Bài DỰ ÁN SLIDE (giữ khoá 'trinh-sua' — các link cũ trỏ vào đây). Trình sửa riêng ngày trước đã gộp vào
     * bảng bên phải của trang Dựng video: dự án slide có thêm tab Nội dung + Âm thanh (23/10/2026 viết lại theo app thật).
     */
    'trinh-sua': {
      tieuDe: 'Dự án slide: lời thoại, nền, âm thanh và Tạo video',
      moTa: 'Dự án tạo từ mẫu slide có thêm hai tab ở bảng bên phải: Nội dung và Âm thanh. Không có nút Lưu — '
        + 'sửa tới đâu ghi vào deck tới đó, khung xem đổi ngay.',
      muc: [
        {
          moc: 'ts-noi-dung',
          video: { khoa: 'slide-timeline', giay: 60 },
          icon: 'edit',
          nhan: 'Tab Nội dung',
          ten: 'Lời thoại và hiệu ứng của slide',
          buoc: [
            '‹ › chuyển sang slide trước / sau (số "1/6" là slide đang xem).',
            'Lời thoại slide này: chữ giọng đọc sẽ đọc. Gõ xong khoảng một giây là tự ghi.',
            'Chỉnh phụ đề — kiểu chữ, bật / tắt…: mở phần Kiểu phụ đề (cũng là bấm tên track C1).',
            'Hiệu ứng nền: lớp chuyển động SAU slide — hạt bay, lưới, mưa sao… Dưới đó là Hiệu ứng video (lớp phủ LÊN TRÊN cả khung).',
          ],
          hinh: [{ anh: 'assets/huong-dan/dk-noi-dung.webp', chu: 'Tab Nội dung của mẫu "Mẹo sức khoẻ".' }],
          luuY: 'Kéo xuống còn: Ánh sáng nền (Đèn 1 / Đèn 2 — màu, độ sáng, vị trí trên lưới ô; áp cho slide đang xem), '
            + 'Tông màu Tối / Kem, và các màu của bộ mẫu (màu nền, lưới nền, viền / hắt sáng / đèn icon).',
          luuYTone: 'tin',
        },
        {
          moc: 'ts-am-thanh',
          video: { khoa: 'slide-timeline', giay: 122 },
          icon: 'nhac',
          nhan: 'Tab Âm thanh',
          ten: 'Nhạc nền và tiếng của slide',
          buoc: [
            'Nhạc nền: chọn bản có sẵn và kéo Âm lượng — nên nhỏ hơn giọng đọc khá nhiều.',
            '"Áp dụng tiếng dưới đây cho": Toàn bộ video (mọi slide) hoặc Slide này (chỉ slide đang xem).',
            'Tiếng chuyển slide (lúc sang slide) và Tiếng hiện từng phần (mỗi lần một phần tử hiện ra). Nút ▶\uFE0E để nghe thử.',
            'Tự hạ nhạc khi có giọng đọc: nhạc nhỏ lại lúc giọng đang nói (cần dựng lại video một lần).',
          ],
          hinh: [{ anh: 'assets/huong-dan/dk-am-thanh.webp', chu: 'Nhạc "Ambient" 20%, tiếng chuyển "Rise", tiếng hiện "Pop".' }],
        },
        {
          moc: 'ts-giong',
          video: { khoa: 'slide-timeline', giay: 130 },
          icon: 'mic',
          nhan: 'Giọng đọc',
          ten: 'Chọn nguồn giọng đọc',
          buoc: [
            'Tải file: dùng file đọc có sẵn (MP3, WAV, M4A, tối đa 200 MB) — một file cho cả video.',
            'ElevenLabs: app tự gọi ElevenLabs bằng API key của bạn (bài "Lấy API key + Voice ID").',
            'Beeknoee AI: app gọi Beeknoee Platform, trả theo lượt dùng.',
            'Trên máy: miễn phí, không cần mạng — tải bộ giọng một lần rồi chọn giọng Bắc / Trung / Nam.',
          ],
          hinh: [{ anh: 'assets/huong-dan/dk-giong.webp', chu: 'Nhóm Giọng đọc ở cuối tab Âm thanh. "Hướng dẫn" mở bài tạo file MP3.' }],
        },
        {
          moc: 'ts-tao',
          video: { khoa: 'slide-timeline', giay: 157 },
          icon: 'play',
          nhan: 'Dựng',
          ten: 'Tạo video',
          buoc: [
            'Tốc độ đọc: 1.1, 1.15, 1.2 (hoặc gõ số).',
            'Độ phân giải: 1080 × 1920 hoặc 720 × 1280 (khổ ngang thì 1920 × 1080 / 1280 × 720).',
            'Tạo video (lần sau là "Tạo lại"). Bảng năm bước ở dưới hiện tiến trình: chuẩn bị → giọng đọc → khớp lời → quay hình → xuất.',
          ],
          hinh: [{ anh: 'assets/huong-dan/dk-tao-video.webp', chu: 'Bấm "Tạo video" ở góc phải thanh trên để mở hộp này.' }],
          luuY: 'Đang dựng vẫn làm dự án khác được; bấm Tạo video ở dự án khác là xếp hàng (bài "Dựng nhiều video một lượt").',
          luuYTone: 'tin',
        },
        {
          moc: 'ts-timeline',
          icon: 'cuon',
          nhan: 'Thêm thắt',
          ten: 'Timeline của dự án slide',
          buoc: [
            'Track V1 là các slide; các track phía trên để chèn B-roll, logo, chữ, nhạc như dự án video.',
            'Bỏ chọn khối → Thuộc tính: Khung (Theo video slide, 16:9, 9:16, 1:1, 4:5), Màu cả video, "Thêm một bộ slide nữa…".',
            'Khối slide → Bắt đầu: dời cả bộ slide; Alt + kéo khối trên V1 cũng được.',
          ],
          luuY: 'Bấm "Tạo video" dựng chung slide + mọi khối trên timeline trong một lượt.',
          luuYTone: 'tot',
          video: { khoa: 'slide-timeline', giay: 213 },
        },
      ],
      cuoi: 'Sửa lời thoại sau khi đã dựng video thì dự án hiện nhãn "Video cũ" — nhớ dựng lại, '
        + 'không thì video vẫn đọc theo bản cũ.',
    },

    /**
     * Bài HÀNG ĐỢI — chức năng không ai tự phát hiện ra.
     *
     * Nút "Tạo video" tự đổi thành "Thêm vào hàng đợi" khi máy đang bận; ai không
     * thử bấm đúng lúc đang dựng thì không bao giờ biết là có hàng đợi.
     */
    'hang-doi': {
      tieuDe: 'Dựng nhiều video một lượt',
      moTa: 'Máy chỉ dựng được một video tại một thời điểm, nhưng bạn không phải ngồi canh: '
        + 'xếp sẵn nhiều dự án rồi để đó.',
      muc: [
        {
          moc: 'hd-xep',
          luuYTone: 'nhac',
          luuY: 'Hàng đợi chỉ sắp thứ tự, không phải đường lách hạn mức — mỗi dự án vẫn tính một lượt.',
          icon: 'cuon',
          nhan: 'Bước 1',
          ten: 'Xếp dự án vào hàng',
          buoc: [
            'Bấm Tạo video cho dự án đầu tiên như bình thường.',
            'Trong lúc nó chạy, chọn dự án khác — nút tự đổi thành "Thêm vào hàng đợi". Bấm là xếp vào cuối hàng.',
            'Xếp được tối đa 20 dự án.',
            'Chọn lại một dự án đang trong hàng thì nút thành "Bỏ khỏi hàng đợi".',
          ],
        },
        {
          moc: 'hd-theo-doi',
          icon: 'dongho',
          nhan: 'Bước 2',
          ten: 'Theo dõi tới đâu rồi',
          buoc: [
            'Bảng năm bước hiện tiến trình của dự án ĐANG CHỌN, kèm thời gian từng bước.',
            'Đang xem dự án khác thì tiến độ của lượt đang chạy nằm ở dải mỏng phía trên.',
            'Dự án còn xếp hàng hiện "Đang chờ trong hàng đợi (thứ n)".',
            'Mở lại một dự án đã dựng xong vẫn xem lại được thời gian từng bước của lượt đó.',
          ],
          anh: 'assets/huong-dan/hd-buoc.webp',
          chuThich: 'Một lượt đã xong, kèm thời gian THẬT của từng bước.',
        },
        {
          moc: 'hd-ngam',
          luuYTone: 'tin',
          luuY: 'Đây chính là lý do có biểu tượng ở khay: trước đây bấm X là huỷ luôn lượt đang dựng.',
          icon: 'monitor',
          nhan: 'Tiện',
          ten: 'Đóng cửa sổ, video vẫn dựng',
          buoc: [
            'Bấm dấu X là cửa sổ ẩn xuống khay hệ thống, video vẫn dựng tiếp.',
            'Bấm biểu tượng ở khay để mở lại cửa sổ.',
            'Chuột phải vào biểu tượng để xem đang dựng dự án nào, hoặc chọn Thoát hẳn.',
            'Thoát hẳn lúc đang dựng thì app hỏi lại — thoát là mất lượt đang chạy.',
          ],
        },
        {
          moc: 'hd-dung',
          luuYTone: 'tot',
          luuY: 'Dừng tay và dựng hỏng đều được hoàn lượt. Chỉ video ra thật mới bị trừ.',
          icon: 'stop',
          nhan: 'Khi cần',
          ten: 'Dừng giữa chừng',
          buoc: [
            'Nút Dừng chỉ hiện khi bạn đang xem đúng dự án đang dựng.',
            'Dừng tay thì lượt đó được hoàn lại, không bị trừ.',
            'Hàng đợi vẫn chạy tiếp sang dự án kế.',
          ],
        },
      ],
      cuoi: 'Một lượt chiếm máy khoảng bằng thời lượng video, cộng thêm chừng một phần tư nữa để ghép. '
        + 'Video 90 giây thì tính khoảng hai phút.',
    },

    /**
     * Bài GỠ LỖI.
     *
     * ⚠ Đừng liệt kê từng câu lỗi cụ thể ở đây. Câu chữ trong mã đổi theo từng
     * bản, mà bài hướng dẫn thì không ai nhớ sửa theo — vài tháng là bài nói một
     * đằng app nói một nẻo. Dạy cách ĐỌC bảng năm bước thì không lạc hậu.
     */
    'khi-loi': {
      tieuDe: 'Gặp lỗi thì làm sao',
      moTa: 'App báo lỗi ở đúng một chỗ: bảng năm bước. Bài này dạy đọc bảng đó, rồi xử ba loại hay gặp.',
      muc: [
        {
          moc: 'kl-doc',
          luuYTone: 'tin',
          luuY: 'Chụp lại bảng này KÈM dòng chữ cuối là đủ để bộ phận hỗ trợ lần ra chỗ hỏng.',
          icon: 'warn',
          nhan: 'Trước hết',
          ten: 'Đọc bảng năm bước',
          buoc: [
            'Bước hỏng đổi sang đỏ, các bước sau đứng lại ở "Chờ xử lý".',
            'Dòng chữ CUỐI bảng là lý do hỏng. Đó mới là câu cần đọc, không phải tiêu đề.',
            'Bước nào đỏ cũng cho biết hỏng ở khâu nào: giọng đọc, khớp lời thoại, quay hình hay xuất video.',
          ],
          anh: 'assets/huong-dan/kl-bang.webp',
          chuThich: 'Bước 2 đỏ, ba bước sau đứng chờ, và dòng đỏ cuối bảng là lý do.',
        },
        {
          moc: 'kl-luot',
          luuYTone: 'tot',
          luuY: 'Số lượt chỉ giảm khi có video ở thư mục output. Không ra video thì không mất gì.',
          icon: 'xu',
          nhan: 'Loại 1',
          ten: 'Hết lượt tạo video',
          buoc: [
            'Số lượt còn lại ghi ngay trên nút Tạo video, dạng "(3/50 lần miễn phí)".',
            'Hết thì vào mục Nâng cấp để mở gói.',
            'Lượt CHỈ bị trừ khi ra được video. Dựng hỏng, hoặc bạn bấm dừng, thì lượt tự hoàn lại.',
          ],
        },
        {
          moc: 'kl-key',
          icon: 'khoa',
          nhan: 'Loại 2',
          ten: 'Lỗi ở khâu giọng đọc',
          buoc: [
            'Bước "Xử lý giọng đọc" đỏ thì gần như luôn là chuyện API key hoặc credit.',
            'Key sai hoặc đã thu hồi: dán lại theo bài "Lấy API key + Voice ID".',
            'Hết credit bên ElevenLabs hay Beeknoee Platform: nạp thêm ngay ở trang của họ.',
            'Không muốn phụ thuộc mạng thì đổi sang Tải file, dùng MP3 có sẵn.',
          ],
        },
        {
          moc: 'kl-mang',
          icon: 'refresh',
          nhan: 'Loại 3',
          ten: 'Mất mạng hoặc máy chủ bận',
          buoc: [
            'App nói thẳng là mất kết nối, không ném chữ tiếng Anh khó hiểu ra màn hình.',
            'Kiểm mạng rồi bấm Tạo video lại — lượt cũ đã được hoàn nên không mất gì.',
            'Riêng hai bước "Quay hình" và "Xuất video" chạy hoàn toàn trên máy, không cần mạng.',
          ],
        },
      ],
      cuoi: 'Lỗi không nằm trong ba loại trên thì chụp lại bảng năm bước KÈM dòng chữ cuối rồi gửi hỗ trợ — '
        + 'đúng câu đó là thứ lần ra được chỗ hỏng.',
    },

    /**
     * Đường KHÔNG dùng API: tự tạo file MP3 trên web ElevenLabs rồi nạp vào app.
     *
     * ⚠ Mục này trước đây RỖNG. Nút "Hướng dẫn lấy file audio" trỏ `#manual`,
     * mà `NOI_DUNG` chỉ có `api-credit` — bấm vào không ra gì, không báo lỗi,
     * không ai biết. Ảnh chụp là ảnh THẬT do chủ dự án chụp, không phải hình vẽ
     * lại bằng CSS như bản web cũ (thứ lạc hậu ngay khi ElevenLabs đổi giao diện).
     */
    /**
     * CÂU HỎI THƯỜNG GẶP — mỗi mục là một câu hỏi, các "bước" là câu trả lời.
     * Dùng chung khuôn bài thường (`muc[].ten` = câu hỏi, `buoc` = trả lời) để
     * không phải thêm loại bài mới; ô tìm kiếm của trang Hướng dẫn quét được.
     * Chỉ giữ câu hỏi CƠ BẢN, gặp thật — mỗi câu trỏ về bài chi tiết nếu có.
     */
    'cau-hoi': {
      tieuDe: 'Câu hỏi thường gặp',
      moTa: 'Những thắc mắc hay gặp nhất khi mới dùng app. Câu nào cần chi tiết hơn thì có '
        + 'chỉ sang bài tương ứng.',
      muc: [
        {
          moc: 'hai-cach',
          icon: 'saoAI',
          nhan: 'AI',
          ten: 'Nên làm slide bằng AI trong app hay Copy prompt ra Claude/Codex Desktop?',
          buoc: [
            'Trong app (cột AI agent): nhanh, không rời cửa sổ, agent thao tác thẳng trên timeline và khung xem. '
              + 'Dùng gói ChatGPT (Codex) hoặc Claude Pro/Max sẵn có, hay khoá Beeknoee Platform.',
            'Copy prompt: dán vào Claude Desktop / Codex Desktop bên ngoài, AI có thể sửa sâu cả HTML/CSS của deck. '
              + 'Đổi lại phải chuyển qua lại hai cửa sổ.',
            'Cả hai cách ra cùng một loại dự án, nên bắt đầu bằng cách nào rồi đổi sang cách kia đều được.',
          ],
        },
        {
          moc: 'api-key',
          icon: 'bolt',
          nhan: 'AI',
          ten: 'AI agent có cần API key không?',
          buoc: [
            'Không, nếu dùng Codex (gói ChatGPT) hoặc Claude (gói Pro/Max) — agent chạy bằng tài khoản của chính bạn.',
            'Chỉ "Claude · Beeknoee Platform" cần khoá (sk-bee-…, lấy ở platform.beeknoee.com): menu chọn agent → '
              + '"Khoá API cho AI agent…". Khoá được mã hoá trên máy bạn, không gửi đi đâu ngoài nhà cung cấp.',
            'Đã có key Beeknoee cho giọng đọc thì mục Beeknoee Platform tự nhận, không phải dán lại.',
          ],
        },
        {
          moc: 'ai-khong-dung-video',
          icon: 'play',
          nhan: 'AI',
          ten: 'AI làm xong sao chưa có video?',
          buoc: [
            'AI agent chỉ dựng video khi bạn bảo rõ — dựng mất vài phút và tốn một lượt hạn mức. '
              + 'Ưng deck rồi thì bấm "Tạo video" ở thanh trên, hoặc nhắn agent "dựng video đi".',
            'Sửa slide xong sau khi đã có video thì dự án hiện "Video cũ" — bấm "Tạo lại" cho khớp lời thoại.',
          ],
        },
        {
          moc: 'danh-sach-trong',
          icon: 'folder',
          nhan: 'Dự án',
          ten: 'AI (Claude/Codex) dựng xong mà danh sách dự án vẫn trống?',
          buoc: [
            'App chỉ nhìn MỘT thư mục nguồn. AI ghi deck ra thư mục khác thì danh sách không thấy.',
            'Bấm "Dự án" trên thanh trên cùng rồi bấm nút thư mục cạnh ô tìm để trỏ đúng chỗ chứa deck, hoặc bảo AI ghi vào thư mục đó. '
              + 'Chi tiết ở bài "Thư mục làm việc".',
          ],
        },
        {
          moc: 'doc-ngang',
          icon: 'monitor',
          nhan: 'Video',
          ten: 'Video ra bị cắt mất hình, hoặc app báo "deck thiết kế cho khổ ngang"?',
          buoc: [
            'Mỗi deck thiết kế cho MỘT khổ: dọc 9:16 (Short, Reels, TikTok) hoặc ngang 16:9 (YouTube). '
              + 'App tự hiện đúng bộ độ phân giải theo khổ của deck đang chọn.',
            'Deck tự dựng muốn là khổ ngang thì phải có thẻ <meta name="bee-khung" content="ngang"> '
              + 'trong index.html; không có thẻ đó app coi là dọc. Mẫu ngang có sẵn ở trang Mẫu ngang 16:9.',
          ],
        },
        {
          moc: 'phu-de',
          icon: 'cochu',
          nhan: 'Phụ đề',
          ten: 'Phụ đề nằm ở đâu, chỉnh thế nào? Có xuất được tệp .srt không?',
          buoc: [
            'Bấm tên track C1 (Phụ đề) dưới timeline: tab Thuộc tính bên phải có vị trí trên/dưới, khoảng cách, '
              + 'phông, cỡ, màu, viền, nền, căn lề. Xem trước đổi ngay, video dựng ra y hệt.',
            'Dự án video chưa có phụ đề thì bấm "Tạo phụ đề tự động" ở cùng chỗ — xem bài "Phụ đề và xuất video".',
            'Mỗi lượt dựng ghi thêm tệp .srt và danh sách chương YouTube cạnh tệp MP4 — dùng cho video '
              + 'ngang, video dọc có cũng không hại gì.',
          ],
        },
        {
          moc: 'lich-su-chat',
          icon: 'doc',
          nhan: 'AI',
          ten: 'Tắt app thì cuộc chat với AI agent có mất không?',
          buoc: [
            'Cuộc chat chỉ giữ trong lúc app đang mở. Tắt app, hoặc bấm "Chat mới", là bắt đầu lại từ đầu.',
            'Những gì agent ĐÃ SỬA thì nằm trong dự án, không mất. Muốn bỏ thì Ctrl+Z — mỗi việc agent làm là một bước hoàn tác.',
          ],
        },
        {
          moc: 'khoa-khi-ai-chay',
          icon: 'edit',
          nhan: 'Sửa',
          ten: 'Vì sao bảng sửa và nút Tạo video bị khoá?',
          buoc: [
            'Deck đang được AI ghi vào thì bảng sửa và nút Tạo video của CHÍNH deck đó khoá lại, để hai '
              + 'bên không ghi đè nhau. Deck khác vẫn sửa bình thường.',
            'Chờ AI xong (hoặc bấm nút vuông để dừng) là mở lại.',
          ],
        },
        {
          moc: 'keo-cot',
          icon: 'khung',
          nhan: 'Giao diện',
          ten: 'Cột danh sách hoặc bảng sửa bé quá?',
          buoc: [
            'Rê chuột vào đường kẻ giữa các cột rồi kéo. Bấm đúp vào đường kẻ để về mặc định. '
              + 'App nhớ bề ngang bạn chọn cho lần sau.',
          ],
        },
        {
          moc: 'loi-khac',
          icon: 'warn',
          nhan: 'Lỗi',
          ten: 'Gặp lỗi khác thì xem ở đâu?',
          buoc: [
            'Bài "Gặp lỗi thì làm sao" đọc bảng năm bước dựng và ba lỗi hay gặp. Cài đặt (bánh răng '
              + 'đáy thanh trái) có hàng Phiên bản để kiểm tra bản mới.',
          ],
        },
      ],
      cuoi: 'Câu hỏi chưa có ở đây thì gửi về sales@beeknoee.com.',
    },
    manual: {
      tieuDe: 'Hướng dẫn tạo audio MP3',
      moTa: 'Cách này KHÔNG cần API key. Bạn tự tạo file đọc trên web ElevenLabs '
        + 'rồi nạp vào app — hợp khi mới bắt đầu, hoặc muốn nghe thử trước khi ưng.',
      muc: [
        {
          moc: 'b1',
          icon: 'user',
          chuThich: 'Màn hình đăng nhập của elevenlabs.io — chọn Sign in with Google.',
          nhan: 'Bước 1',
          ten: 'Đăng nhập ElevenLabs',
          buoc: ['Mở elevenlabs.io.', 'Bấm Sign in with Google (hoặc Apple/SSO nếu bạn dùng cách khác).'],
          anh: 'assets/huong-dan/audio-b1.webp',
          link: 'https://elevenlabs.io/app/sign-in',
          linkNhan: 'Mở trang đăng nhập',
        },
        {
          moc: 'b2',
          icon: 'mic',
          chuThich: 'Mục Text to Speech nằm trong nhóm Pinned ở cột trái.',
          nhan: 'Bước 2',
          ten: 'Vào mục Text to Speech',
          buoc: ['Ở cột trái, mục Pinned, bấm Text to Speech.'],
          anh: 'assets/huong-dan/audio-b2.webp',
          link: 'https://elevenlabs.io/app/speech-synthesis/text-to-speech',
          linkNhan: 'Mở thẳng Text to Speech',
        },
        {
          moc: 'b3',
          icon: 'copy',
          chuThich: 'Cuối tab Thuộc tính của track C1 (Phụ đề): nút Chép toàn bộ phụ đề.',
          nhan: 'Bước 3',
          ten: 'Quay lại app, copy lời thoại',
          buoc: [
            'Mở dự án bạn muốn làm (nút "Dự án" trên thanh trên cùng).',
            'Bấm tên track C1 (Phụ đề) dưới timeline — hoặc nút "Chỉnh phụ đề" ở tab Nội dung.',
            'Kéo xuống cuối tab Thuộc tính, bấm Chép toàn bộ phụ đề — toàn bộ lời thoại của mọi slide vào bộ nhớ tạm.',
          ],
          anh: 'assets/huong-dan/pd-chep.webp',
        },
        {
          moc: 'b4',
          icon: 'edit',
          chuThich: 'Bảng bên phải: Voice, Model, Stability và Output Format.',
          nhan: 'Bước 4',
          ten: 'Chọn giọng và định dạng',
          buoc: [
            'Voice: chọn giọng bạn muốn (ví dụ “Nhật - Narrative & Compelling”).',
            'Model: Eleven v3.',
            'Stability: kéo về giữa. Lệch hẳn sang Creative thì giọng hay đổi nhịp giữa các câu.',
            'Output Format: MP3 44.1 kHz (128 kbps) — app khớp lời thoại theo file MP3, đừng chọn định dạng khác.',
          ],
          anh: 'assets/huong-dan/audio-b4.webp',
        },
        {
          moc: 'b5',
          icon: 'bolt',
          chuThich: 'Ô soạn thảo sau khi dán — góc dưới hiện số ký tự và nút Generate speech.',
          nhan: 'Bước 5',
          ten: 'Dán lời thoại rồi tạo giọng',
          buoc: [
            'Dán vào ô soạn thảo (Ctrl+V).',
            'Nhìn số ký tự ở đáy: quá 5.000 thì phải cắt làm nhiều lần.',
            'Bấm Generate speech, chờ xong rồi bấm nút tải xuống để lấy file .mp3.',
          ],
          anh: 'assets/huong-dan/audio-b5.webp',
        },
        {
          moc: 'b6',
          luuYTone: 'tin',
          luuY: 'Một file MP3 cho TOÀN BỘ video, không phải mỗi slide một file.',
          icon: 'upload',
          chuThich: 'Tab Âm thanh → nhóm Giọng đọc → Tải file → Chọn file.',
          nhan: 'Bước 6',
          ten: 'Nạp file MP3 vào app rồi tạo video',
          buoc: [
            'Mở dự án → tab Âm thanh ở bảng bên phải → nhóm Giọng đọc → chọn Tải file.',
            'Bấm Chọn file rồi trỏ tới file .mp3 vừa tải.',
            'Bấm "Tạo video" ở thanh trên: chọn tốc độ và độ phân giải (1080×1920 cho dọc), rồi Tạo video.',
          ],
          anh: 'assets/huong-dan/dk-giong-tai.webp',
        },
        {
          moc: 'b7',
          icon: 'check',
          chuThich: 'Chạy xong: 5 bước tích xanh, nút "Tạo lại" và nút thư mục ở góc trên hộp.',
          nhan: 'Bước 7',
          ten: 'Chờ chạy xong và mở video',
          buoc: [
            'App chạy 5 bước: chuẩn bị dự án → xử lý giọng đọc → khớp lời thoại → quay hình → xuất video.',
            'Xong thì bấm ▶\uFE0E dưới timeline (hoặc Space) để xem ngay trên khung, hoặc nút thư mục ở góc hộp Tạo video để lấy file.',
            'Chưa ưng thì sửa lại rồi bấm Tạo lại — bản cũ sẽ bị ghi đè.',
          ],
          anh: 'assets/huong-dan/dk-tao-video.webp',
        },
      ],
      cuoi: 'Cách này miễn phí credit API nhưng phải làm tay từng dự án. Làm nhiều thì '
        + 'chuyển sang ElevenLabs (Gọi API) để app tự tạo giọng — xem hướng dẫn lấy API key.',
    },

    /**
     * Đường DÙNG API: app tự gọi ElevenLabs, không phải tự tạo file MP3 tay.
     *
     * Cùng khuôn với `manual` — cũng là trang, cũng ảnh bên phải từng bước.
     * Hai hướng dẫn để hai kiểu khác nhau thì người dùng phải học lại cách đọc.
     */
    'api-credit': {
      tieuDe: 'Hướng dẫn lấy API key + Voice ID',
      moTa: 'Cách này app TỰ gọi ElevenLabs, không phải tạo file MP3 tay từng dự án. '
        + 'Đổi lại phải nạp credit và tốn tiền theo số ký tự đọc.',
      muc: [
        {
          moc: 'api-credit',
          icon: 'bolt',
          chuThich: 'Thẻ ElevenAPI trong trang Subscription — số dư và nút Add credits.',
          nhan: 'Bước 1',
          ten: 'Nạp credit cho ElevenAPI',
          buoc: [
            'Mở trang Subscription rồi chọn thẻ ElevenAPI (không phải ElevenCreative).',
            'Bấm Add credits.',
            'Nạp khoảng 5 đô để thử trước — đừng nạp nhiều khi chưa chạy hết một vòng.',
          ],
          anh: 'assets/huong-dan/api-b1.webp',
          link: 'https://elevenlabs.io/app/subscription/api',
          linkNhan: 'Mở trang nạp API credit',
        },
        {
          moc: 'api-key',
          luuYTone: 'tot',
          luuY: 'Khoá được cất trong kho mã hoá của máy, không nằm dạng chữ thường trong file cấu hình.',
          icon: 'copy',
          chuThich: 'Trang API Keys khi chưa có key nào — chỉ có nút Create Key.',
          nhan: 'Bước 2',
          ten: 'Tạo API key rồi dán vào app',
          /* ⚠ HAI DÒNG QUYỀN LÀ BẮT BUỘC PHẢI CÓ TRONG HƯỚNG DẪN.
             ElevenLabs cho tạo khoá GIỚI HẠN QUYỀN, và mặc định trong bảng tạo
             khoá KHÔNG bật sẵn đủ thứ app cần. Khoá thiếu quyền vẫn "hợp lệ"
             nên người dùng không hề biết mình tạo thiếu — họ chỉ thấy app báo
             lỗi rồi đi tạo khoá mới, cũng thiếu y như cũ. Đã gặp thật.
             App gọi đúng ba thứ: `text_to_speech` để dựng tiếng,
             `GET /v1/voices` để liệt kê giọng, và `GET /v1/voices/{id}` cho nút
             Kiểm tra ở popup "Tự điền ID giọng". Hai cái sau CÙNG cần quyền
             Voices → Read, nên dòng quyền đó nay không còn là tuỳ chọn: thiếu
             nó là không kiểm được Voice ID gõ tay, mà không kiểm được thì popup
             không cho lưu. Ngoài ba thứ đó app không cần quyền nào khác. */
          buoc: [
            'Vào Developers → API Keys.',
            'Bấm Create Key rồi đặt tên tuỳ ý.',
            'Trong bảng quyền, tìm dòng Text to Speech và chọn Has access. THIẾU quyền này là không dựng được video.',
            'Tìm tiếp dòng Voices và chọn Read. Quyền này lo HAI việc: hiện danh sách giọng trong tài khoản bạn, và kiểm một Voice ID bạn tự dán (nút Tự điền ID giọng). Thiếu nó, app vẫn dựng video bình thường nhưng ô Giọng đọc chỉ còn các giọng gợi ý sẵn, và nút Kiểm tra sẽ báo thiếu quyền nên không lưu được ID gõ tay.',
            'Tìm dòng User và chọn Read — để app hiện số credit còn lại ngay cạnh ô API key và tự biết gói của bạn (mở đúng các mức chất lượng audio). Thiếu quyền này video vẫn dựng được, nhưng nên bật.',
            'Những dòng quyền còn lại cứ để No access — app không dùng tới.',
            'Bấm Create rồi copy key NGAY — ElevenLabs chỉ hiện đầy đủ MỘT LẦN, đóng đi là phải tạo key khác.',
            'Quay lại app, dán vào ô API Key. App tự lưu rồi tự lấy danh sách giọng.',
          ],
          anh: 'assets/huong-dan/api-b2.webp',
          link: 'https://elevenlabs.io/app/developers/api-keys',
          linkNhan: 'Mở trang tạo API key',
        },
        {
          moc: 'voice-id',
          icon: 'mic',
          chuThich: 'Voice Library, thẻ Explore — lọc theo Language để ra giọng tiếng Việt.',
          nhan: 'Bước 3',
          ten: 'Chọn giọng đọc',
          buoc: [
            'Dán key xong, ô Giọng đọc trong app tự hiện giọng CỦA TÀI KHOẢN bạn — chọn ở đó là xong.',
            'Dưới đó app có sẵn hai nhóm giọng gợi ý (tiếng Việt và tiếng Anh) dùng được ngay, kể cả khi tài khoản bạn chưa có giọng nào.',
            'Muốn thêm giọng khác thì mở Voice Library, thẻ Explore, lọc Language = Vietnamese.',
            'Bấm vào giọng ưng rồi Add to my voices — sau đó nó hiện trong ô của app.',
            'Hoặc bấm menu ba chấm → Copy voice ID rồi dán thẳng vào ô bên phải.',
          ],
          anh: 'assets/huong-dan/api-b3.webp',
          link: 'https://elevenlabs.io/app/voice-library?search=nh%E1%BA%ADt+',
          linkNhan: 'Mở Voice Library',
        },
      ],
      cuoi: 'ElevenLabs API tính tiền theo số ký tự. Nạp ít để thử trước — ví dụ 5 đô — '
        + 'rồi tạo một video ngắn xem chất lượng có ưng không rồi hẵng dùng thường xuyên.',
    },

    /**
     * Đường Beeknoee Platform: một key dùng được nhiều bộ giọng (Gemini,
     * OpenAI...). App đã cấu hình sẵn theo tài liệu
     * platform.beeknoee.com/docs/text-to-speech nên hướng dẫn CỐ Ý ngắn:
     * việc của người dùng chỉ là lấy key — model, giọng, giới hạn ký tự,
     * giá từng model đều nằm sẵn trong ô chọn của app rồi.
     * Hiện thành TAB cạnh bài ElevenLabs — xem TAB_NHOM bên dưới.
     */
    'bee-api': {
      tieuDe: 'Hướng dẫn lấy API key Beeknoee',
      moTa: 'Một key của Beeknoee Platform dùng được nhiều bộ giọng AI (Google Gemini, '
        + 'OpenAI…). App đã cấu hình sẵn mọi thứ theo tài liệu platform — bạn chỉ cần '
        + 'dán key rồi chọn model + giọng là dựng được video.',
      muc: [
        {
          moc: 'bee-b1',
          icon: 'user',
          nhan: 'Bước 1',
          ten: 'Đăng nhập Beeknoee Platform',
          buoc: [
            'Mở platform.beeknoee.com rồi đăng nhập — chưa có tài khoản thì đăng ký, có hạn mức miễn phí để thử.',
          ],
          link: 'https://platform.beeknoee.com',
          linkNhan: 'Mở Beeknoee Platform',
        },
        {
          moc: 'bee-b2',
          icon: 'copy',
          nhan: 'Bước 2',
          ten: 'Tạo API key',
          buoc: [
            'Trong Dashboard, vào mục API Keys rồi tạo key mới, đặt tên tuỳ ý.',
            'Copy key dạng sk-bee-… và giữ kín — ai cầm key là tiêu được token của bạn.',
            'Muốn dùng model trả phí thì nạp gói token. Model "Google dịch" miễn phí hoàn toàn nên chưa nạp vẫn thử được.',
          ],
        },
        {
          moc: 'bee-b3',
          icon: 'bolt',
          nhan: 'Bước 3',
          ten: 'Dán key vào app',
          buoc: [
            'Ở cột Dựng video, mục Giọng đọc, chọn tab Beeknoee AI.',
            'Dán key vào ô API Key rồi bấm Lưu. Key được mã hoá và chỉ nằm trên máy bạn — muốn thay key thì bấm Xoá rồi dán key mới.',
          ],
        },
        {
          moc: 'bee-b4',
          icon: 'mic',
          nhan: 'Bước 4',
          ten: 'Chọn model + giọng đọc',
          buoc: [
            'Model mặc định là Gemini 2.5 Flash — đọc tiếng Việt tự nhiên, giá hợp lý. Muốn miễn phí hoàn toàn thì chọn "Google dịch".',
            'Chọn giọng trong danh sách (mặc định Kore). Đổi model là danh sách giọng tự đổi theo bộ của model đó.',
            'Nghe thử trước khi chọn: giọng OpenAI ở trang openai.fm, giọng Gemini ở geminitts.net.',
            'Xong — bấm Tạo video như bình thường, app tự gọi platform và tự canh mọi thứ còn lại.',
          ],
        },
      ],
      cuoi: 'Platform tính tiền theo số ký tự đọc, giá từng model ghi ngay trong ô chọn. '
        + 'Một video ~90 giây tốn khoảng 1.000–1.500 ký tự — với Gemini 2.5 Flash là '
        + 'khoảng 0,03 đô (chưa tới 1.000đ) mỗi video.',
    },
  };

  /**
   * Nhóm bài hiện thành TAB trong cùng một trang. Cùng chủ đề "nối app với
   * dịch vụ giọng đọc bằng API" — tách hai bài rời thì mục lục phình ra và
   * người dùng không thấy được là mình CÓ LỰA CHỌN giữa hai dịch vụ.
   */
  /* ══ MỤC LỤC — MỘT MỐI DUY NHẤT cho danh sách bài ════════════════════════
   *
   * ⚠ TRƯỚC 19/09/2026 danh sách này nằm ở `pages.js` (mảng `BAI`), tức mỗi bài
   * được khai HAI LẦN: nội dung ở đây, còn thứ tự + icon + tiêu đề thẻ ở bên
   * kia. Thêm một bài mà quên một bên là bài đó có nội dung nhưng không có
   * trong mục lục, và chẳng có phép kiểm nào báo. Nay `pages.js` chỉ VẼ, còn
   * khai báo nằm hết ở đây — cạnh chính nội dung nó mô tả.
   *
   * ⚠ THỨ TỰ MẢNG NÀY CHÍNH LÀ SỐ HIỆN TRÊN THẺ, nên nó là thứ tự người dùng
   * ĐỌC. Xếp theo đúng đường đi của một video:
   *
   *   1 tổng quan  →  2 deck nằm ở đâu  →  3 chỉnh deck
   *                →  4-5 kiếm giọng đọc  →  6 dựng hàng loạt  →  7 khi hỏng
   *
   * Bài (2) đứng ngay sau bài tổng quan vì đó là chỗ hỏng ở NGÀY ĐẦU TIÊN: app
   * theo dõi một thư mục, AI ghi deck vào thư mục khác, danh sách trống. Hai
   * bài ElevenLabs không đứng thứ 2-3 — chúng là nhánh rẽ khi đã biết dùng app.
   *
   * ⚠ `bee-api` CỐ Ý KHÔNG có mặt ở đây. Nó không phải bài riêng mà là TAB thứ
   * hai của `api-credit` (xem `TAB_NHOM` ngay dưới): cùng một việc "nối app với
   * dịch vụ đọc", hai nhà cung cấp. Tách thành thẻ riêng thì mục lục phình ra
   * mà người đọc lại không thấy đó là hai lựa chọn của cùng một việc.
   *
   * `ten` chỉ khai khi thẻ mục lục muốn NGẮN HƠN tiêu đề bài; bỏ trống thì lấy
   * thẳng `tieuDe` — để tiêu đề chỉ phải viết một chỗ. */
  const MUC_LUC = [
    { khoa: 'su-dung-app', icon: 'play',
      mo: 'Video hướng dẫn đầy đủ từ lúc chọn mẫu tới lúc ra video, kèm các mốc để tra lại nhanh.' },
    { khoa: 'giao-dien', icon: 'slide', ten: 'Bản đồ giao diện',
      mo: 'Sáu vùng của trang Dựng video, thanh trên, thanh dọc, hộp Dự án và Dự án mới — ảnh đánh số từng nút.' },
    { khoa: 'timeline', icon: 'cuon', ten: 'Timeline và phím tắt',
      mo: 'Từng nút trên thanh công cụ, track, cắt / kéo / thay khối, điểm đánh dấu và bảng phím tắt.' },
    { khoa: 'thu-vien', icon: 'folder', ten: 'Thư viện',
      mo: 'Nhập media, thư viện dùng chung, mẫu intro / outro, nhạc nền và hiệu ứng có sẵn.' },
    { khoa: 'thuoc-tinh', icon: 'edit', ten: 'Thuộc tính khối',
      mo: 'Kéo trên khung xem, keyframe ⏱ ◀\uFE0E ◆ ▶\uFE0E, hiệu ứng Ken Burns, màu, cắt khung, tốc độ — kèm ví dụ.' },
    { khoa: 'chuyen-canh', icon: 'sao', ten: 'Chuyển cảnh và chữ động',
      mo: '26 kiểu chuyển cảnh trong 5 nhóm, 7 kiểu chữ động, và công thức "chớp sáng + vút" ở chỗ cắt.' },
    { khoa: 'chu', icon: 'cochu', ten: 'Chữ tiêu đề',
      mo: 'Thêm chữ, 11 phông có tiếng Việt, cỡ, màu, viền, nền sau chữ và chỗ đặt an toàn cho video dọc.' },
    { khoa: 'am-thanh', icon: 'loa', ten: 'Âm thanh và giọng đọc',
      mo: 'Âm lượng có keyframe, lặp, tăng / giảm dần, "+ Giọng" từ chữ, hạ nhạc tự động khi có giọng.' },
    { khoa: 'xuat', icon: 'play', ten: 'Phụ đề và xuất video',
      mo: 'Phụ đề tự động ngay trên máy, kiểu phụ đề karaoke, đổi khung 16:9 / 9:16 / 1:1 / 4:5 rồi xuất MP4.' },
    { khoa: 'mau-dung', icon: 'copy', ten: 'Mẫu dựng video',
      mo: 'Tìm mẫu, hộp Tạo dự án (nhờ AI hoặc tự làm), thay media vào các ô, Lấp nhanh, lưu video của bạn làm mẫu.' },
    { khoa: 'ai-agent', icon: 'bolt', ten: 'AI agent',
      mo: 'Kết nối Codex / Claude, model, quyền, câu nhờ mẫu, và cách cho Claude Code / Codex bên ngoài điều khiển app.' },
    { khoa: 'thu-muc', icon: 'folder',
      mo: 'App chỉ nhìn một thư mục. AI dựng deck ra chỗ khác là danh sách trống — bài này chỉ chỗ sửa.' },
    { khoa: 'trinh-sua', icon: 'slide', ten: 'Dự án slide',
      mo: 'Tab Nội dung, Âm thanh, chọn giọng đọc và hộp Tạo video của dự án slide — từng ô một.' },
    /* Bỏ chữ "Hướng dẫn" ở đầu: thẻ đang nằm trong trang tên là Hướng dẫn. */
    { khoa: 'manual', icon: 'mic', ten: 'Tạo audio MP3',
      mo: 'Lấy file giọng đọc .mp3 từ ElevenLabs rồi đưa vào app. Dùng khi bạn muốn tự chọn giọng.' },
    { khoa: 'api-credit', icon: 'bolt', ten: 'Lấy API key + Voice ID',
      mo: 'Nối app với ElevenLabs hoặc Beeknoee Platform để app tự đọc — hai tab trong một bài.' },
    { khoa: 'hang-doi', icon: 'cuon',
      mo: 'Xếp sẵn tối đa 20 dự án rồi để máy tự chạy. Đóng cửa sổ video vẫn dựng tiếp.' },
    { khoa: 'khi-loi', icon: 'warn',
      mo: 'Đọc bảng năm bước để biết hỏng ở khâu nào, và ba loại lỗi hay gặp nhất.' },
    { khoa: 'cau-hoi', icon: 'help',
      mo: 'AI trong app hay Copy prompt? Cần key gì? Sao chưa có video? Mười câu hay gặp nhất, trả lời ngắn.' },
  ];

  /* ⚠ CHỐT CHẶN: bài có nội dung mà KHÔNG có đường nào tới thì kêu lên.
     Một bài tới được với người đọc qua đúng hai đường: đứng trong `MUC_LUC`,
     hoặc làm tab của một bài khác trong `TAB_NHOM`. Viết xong nội dung mà quên
     cả hai thì bài đó nằm chết trong tệp — đúng cái hỏng mà việc gom mục lục
     về một mối này đang chữa, nên phải có thứ báo chứ không chỉ trông vào trí
     nhớ. Chạy một lần lúc nạp; chỉ ghi console, không làm phiền người dùng. */
  function soatBaiLacLoi() {
    const coTab = new Set();
    TAB_NHOM.forEach((g) => g.nhom.forEach((k) => coTab.add(k)));
    const trongMuc = new Set(MUC_LUC.map((b) => b.khoa));
    const lac = Object.keys(NOI_DUNG).filter((k) => !trongMuc.has(k) && !coTab.has(k));
    if (lac.length) {
      console.warn('[guide] Bài không có đường nào tới — thêm vào MUC_LUC hoặc TAB_NHOM:', lac);
    }
    /* Chiều ngược lại: mục lục trỏ tới bài không tồn tại. `mucLuc()` đã lọc bỏ
       để khỏi ra thẻ trắng, nhưng im lặng bỏ thì không ai biết mà sửa. */
    const thieu = MUC_LUC.filter((b) => !NOI_DUNG[b.khoa]).map((b) => b.khoa);
    if (thieu.length) console.warn('[guide] Mục lục trỏ tới bài không có nội dung:', thieu);
  }

  /** Mục lục đã bung đủ trường để `pages.js` vẽ thẳng, không phải biết gì thêm. */
  function mucLuc() {
    return MUC_LUC
      /* Bài bị gỡ khỏi `NOI_DUNG` thì rơi khỏi mục lục luôn, không để lại thẻ
         bấm vào ra trang trắng. */
      .filter((b) => NOI_DUNG[b.khoa])
      .map((b) => ({ khoa: b.khoa, icon: b.icon, mo: b.mo,
        ten: b.ten || NOI_DUNG[b.khoa].tieuDe }));
  }

  const TAB_NHOM = [
    {
      nhom: ['api-credit', 'bee-api'],
      nhan: { 'api-credit': 'ElevenLabs', 'bee-api': 'Beeknoee Platform' },
    },
  ];

  function cacTab(key) {
    const g = TAB_NHOM.find((x) => x.nhom.includes(key));
    return g ? g.nhom.map((k) => ({ key: k, nhan: g.nhan[k] })) : null;
  }

  function thanhTab(key) {
    const ds = cacTab(key);
    if (!ds) return '';
    return `<div class="hd-tab-thanh">${ds.map((t) => (
      `<button type="button" class="hd-tab${t.key === key ? ' active' : ''}" data-hd-tab="${esc(t.key)}">${esc(t.nhan)}</button>`
    )).join('')}</div>`;
  }

  function style() {
    if (document.getElementById('bee-guide-style')) return;
    // CSS của module này nằm ở css/guide.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  /**
   * Thân nội dung, dùng chung cho popup và cho trang.
   *
   * `laTrang = true` xếp mỗi bước thành HAI CỘT: chữ bên trái, ảnh bên phải.
   * Popup rộng tối đa 760px nên hai cột ở đó là hai cột hẹp, chữ vỡ dòng liên
   * tục — vì thế popup vẫn xếp dọc.
   */
  /* Màu cho ô số của từng mục — cùng bảng với mục lục ở pages.js.
     Bảy mục chữ đen trên nền trắng thì cuộn một lúc là mất dấu mình đang ở mục
     nào; có màu thì nhớ được bằng hình. */
  const MAU_MUC = ['lam', 'luc', 'tim', 'vang', 'do', 'lam', 'xam'];

  /** Icon cho dải lưu ý ở cuối mục, theo tông. */
  const ICON_LUUY = { tin: 'info', tot: 'ok', nhac: 'warn' };

  /**
   * Thân một bài hướng dẫn.
   *
   * `laTrang = true` dựng bản ĐẦY ĐỦ: khối mở đầu, thẻ từng bước, cột phải có
   * mục lục trong trang. `false` là bản popup — vẫn phải gọn, vì popup chỉ rộng
   * 760px và hai cột ở đó là hai cột hẹp, chữ vỡ dòng liên tục.
   */
  function than(d, laTrang) {
    const muc = (m, i) => {
      const so = laTrang
        ? `<span class="hd-stt" data-mau="${MAU_MUC[i] || 'xam'}">${i + 1}</span>`
        : '';
      // Icon đứng trước nhãn để phân biệt nhanh bằng HÌNH, không phải đọc chữ.
      // `data-icon` do icons.js thay bằng SVG — xem `apply()` gọi ở cuối `veTrang`.
      /* Nhãn nào chỉ lặp lại con số đã nằm trong ô bên trái thì BỎ. "Bước 1"
         đứng cạnh một ô ghi "1" là hai lần nói cùng một thứ; còn "Khái niệm",
         "Toàn bộ video", "Slide hiện tại" thì phải giữ — chúng nói phạm vi. */
      const nhanThua = /^bước\s*\d+$/i.test(String(m.nhan || '').trim());
      const dau = laTrang
        ? `<div class="hd-muc-dau">
             ${so}
             <div class="hd-muc-ten">
               <h3>${esc(m.ten)}</h3>
               ${nhanThua ? '' : `<p class="hd-nhan">
                 ${m.icon ? `<span class="btn-icon" data-icon="${esc(m.icon)}"></span>` : ''}
                 <span>${esc(m.nhan)}</span>
               </p>`}
             </div>
           </div>`
        : `<p class="hd-nhan">
             ${m.icon ? `<span class="btn-icon" data-icon="${esc(m.icon)}"></span>` : ''}
             <span>${esc(m.nhan)}</span>
           </p>
           <h3>${esc(m.ten)}</h3>`;
      const luuY = m.luuY
        ? `<div class="hd-luuy" data-tone="${esc(m.luuYTone || 'tin')}">
             <span class="btn-icon" data-icon="${esc(ICON_LUUY[m.luuYTone] || 'info')}"></span>
             <span>${esc(m.luuY)}</span>
           </div>`
        : '';
      const chu = `
        ${dau}
        <ol>${m.buoc.map((b) => `<li>${esc(b)}</li>`).join('')}</ol>
        ${m.duongApp ? '<div class="hd-duong" data-duong-app>Đang đọc đường dẫn…</div>' : ''}
        ${m.link ? `<a class="hd-link" href="${esc(m.link)}" data-ngoai>${esc(m.linkNhan)} ↗</a>` : ''}
        ${luuY}`;
      /* Ảnh: `anh` + `chuThich` (một tấm, kiểu cũ) và / hoặc `hinh: [{ anh, chu, rong? }]` (nhiều tấm). Tấm `rong`
         (ảnh chụp ngang có đánh số) trải HẾT bề rộng dưới phần chữ; tấm thường xếp ở cột phải. */
      const hinh = [...(m.anh ? [{ anh: m.anh, chu: m.chuThich }] : []), ...(m.hinh || [])];
      const fig = (h) => `<figure class="hd-hinh${h.rong ? ' hd-hinh-rong' : ''}">
             <img class="hd-anh" src="${esc(h.anh)}" alt="${esc(h.chu || '')}" loading="lazy">
             ${h.chu ? `<figcaption class="hd-chu">${esc(h.chu)}</figcaption>` : ''}
           </figure>`;
      const anh = hinh.filter((h) => !h.rong || !laTrang).map(fig).join('');
      const anhRong = laTrang ? hinh.filter((h) => h.rong).map(fig).join('') : '';
      /* Bảng nút: ảnh cắt sát từng nút + tên (+ phím tắt) + làm gì + ví dụ. */
      const bangNut = (m.nut || []).length
        ? `<div class="hd-nut-bang">${m.nut.map((n) => `
             <div class="hd-nut-dong">
               <div class="hd-nut-anh">${n.anh ? `<img src="${esc(n.anh)}" alt="" loading="lazy">` : ''}</div>
               <div class="hd-nut-chu">
                 <b>${esc(n.ten)}</b>${n.phim ? ` <kbd>${esc(n.phim)}</kbd>` : ''}
                 <p>${esc(n.lam)}</p>
                 ${n.viDu ? `<p class="hd-nut-vd"><span>Ví dụ:</span> ${esc(n.viDu)}</p>` : ''}
               </div>
             </div>`).join('')}
           </div>`
        : '';
      const nutVideo = m.video
        ? `<button class="hd-link hd-link-video" type="button" data-hd-xem="${esc(m.video.khoa)}" data-hd-giay="${Number(m.video.giay) || 0}" hidden>
             <span class="btn-icon" data-icon="play"></span>Xem đoạn này trong video</button>`
        : '';
      return laTrang
        ? `<section class="hd-muc hd-doi${anh ? '' : ' hd-mot'}" id="hd-${esc(m.moc)}">
             <div class="hd-trai">${chu}${nutVideo}</div>
             <div class="hd-phai">${anh}</div>
             ${anhRong || bangNut ? `<div class="hd-duoi">${anhRong}${bangNut}</div>` : ''}
           </section>`
        : `<section class="hd-muc" id="hd-${esc(m.moc)}">${chu}${nutVideo}${anh}${bangNut}</section>`;
    };

    if (!laTrang) {
      return `
        <h2>${esc(d.tieuDe)}</h2>
        ${d.moTa ? `<p class="hd-mota">${esc(d.moTa)}</p>` : ''}
        ${d.muc.map(muc).join('')}
        ${d.cuoi ? `<p class="hd-cuoi">${esc(d.cuoi)}</p>` : ''}`;
    }

    /* Ba con tem ở khối mở đầu — TẤT CẢ đều đếm được từ chính dữ liệu bài, không
       có cái nào là lời quảng cáo. "Đọc 5 phút" nghe hay nhưng không ai đo, và
       sai một lần là mất tin cả ba. */
    const soAnh = d.muc.reduce((n, m) => n + (m.anh ? 1 : 0) + (m.hinh || []).length + (m.nut || []).filter((x) => x.anh).length, 0);
    const tem = [
      { icon: 'cuon', chu: `${d.muc.length} mục` },
      soAnh ? { icon: 'slide', chu: soAnh > 1 ? `${soAnh} ảnh chụp từ app` : 'Có ảnh chụp từ app' } : null,
      d.nhanh ? { icon: 'play', chu: 'Có video hướng dẫn' } : null,
    ].filter(Boolean);

    /* Thẻ "Bắt đầu nhanh" chỉ dựng khi bài KHAI `nhanh`. Bài nào cũng nhét một
       thẻ mời xem video thì sáu bài còn lại trỏ vào cùng một video không liên
       quan tới nội dung chúng. */
    const nhanh = d.nhanh
      ? `<section class="hd-nhanh">
           <div class="hd-nhanh-chu">
             <span class="hd-nhanh-tem"><span class="btn-icon" data-icon="bolt"></span>BẮT ĐẦU NHANH</span>
             <h3>${esc(d.nhanh.ten)}</h3>
             <p>${esc(d.nhanh.chu)}</p>
             <button class="hd-nhanh-nut" type="button" data-hd-xemvideo>
               <span class="btn-icon" data-icon="play"></span>${esc(d.nhanh.nut)}
             </button>
           </div>
           <button class="hd-nhanh-hinh" type="button" data-hd-xemvideo
                   aria-label="${esc(d.nhanh.nut)}">
             <img src="assets/hd-video-bia.webp" alt="" loading="lazy">
             <span class="hd-nhanh-play" aria-hidden="true">
               <span class="btn-icon" data-icon="play"></span>
             </span>
           </button>
         </section>`
      : '';

    return `
      <div class="hd-bai">
        <div class="hd-bai-chinh">
          <header class="hd-dau">
            <h2>${esc(d.tieuDe)}</h2>
            ${d.moTa ? `<p class="hd-mota">${esc(d.moTa)}</p>` : ''}
            <div class="hd-tem">
              ${tem.map((t) => (
                `<span><span class="btn-icon" data-icon="${t.icon}"></span>${esc(t.chu)}</span>`
              )).join('')}
            </div>
          </header>
          ${nhanh}
          ${d.muc.map(muc).join('')}
          ${d.cuoi ? `<p class="hd-cuoi">${esc(d.cuoi)}</p>` : ''}
        </div>

        <aside class="hd-ben">
          <section class="hd-ben-the hd-toc">
            <h3><span class="btn-icon" data-icon="cuon"></span>Trong trang này</h3>
            <div class="hd-toc-ds">
              ${d.muc.map((m, i) => (
                `<button class="hd-toc-dong" type="button" data-hd-toc="hd-${esc(m.moc)}">
                   <span class="hd-toc-so" data-mau="${MAU_MUC[i] || 'xam'}">${i + 1}</span>
                   <span class="hd-toc-chu">${esc(m.ten)}</span>
                 </button>`
              )).join('')}
            </div>
          </section>

          <section class="hd-ben-the hd-meo">
            <h3><span class="btn-icon" data-icon="sao"></span>Mẹo nhỏ</h3>
            <p>Làm theo đúng thứ tự các bước. Mục nào có ảnh thì mở app ra đối chiếu
               ngay, nhanh hơn đọc chữ nhiều lần.</p>
          </section>

          <section class="hd-ben-the hd-hotro">
            <h3><span class="btn-icon" data-icon="mail"></span>Bạn cần hỗ trợ?</h3>
            <p>Bài này chưa trả lời được việc bạn đang gặp? Gửi thẳng cho đội Beeknoee,
               kèm nhật ký lỗi của app.</p>
            <button class="hd-hotro-nut" type="button" data-hd-hotro>Liên hệ hỗ trợ →</button>
          </section>
        </aside>
      </div>`;
  }

  /**
   * Liên kết ra ngoài PHẢI mở bằng trình duyệt hệ thống.
   *
   * Để `<a href>` chạy tự nhiên là CẢ CỬA SỔ APP điều hướng sang trang web, mà
   * app không có thanh địa chỉ nên không còn đường quay lại.
   */
  function noiLinkNgoai(goc) {
    hienNutVideo(goc);
    /* Gắn MỘT lần: trang Hướng dẫn dùng lại cùng `box` cho mọi lần vẽ — gắn mỗi lần là N lần chuyển bài thì một
       cú bấm mở N tab trình duyệt. */
    if (goc.__hdNgoai) return;
    goc.__hdNgoai = true;
    goc.addEventListener('click', (e) => {
      /* Video hướng dẫn phát TRONG app: nút của từng mục (đúng giây) và thẻ "Bắt đầu nhanh" (video 1). */
      const xem = e.target.closest('[data-hd-xem]');
      if (xem) { xemVideo(xem.dataset.hdXem, Number(xem.dataset.hdGiay) || 0); return; }
      if (e.target.closest('[data-hd-xemvideo]')) { xemVideo('bat-dau', 0); return; }
      const a = e.target.closest('a[data-ngoai]');
      if (!a) return;
      e.preventDefault();
      if (window.beeknoee && window.beeknoee.openExternal) window.beeknoee.openExternal(a.href);
    });
  }

  /** Vẽ vào một trang có sẵn (không phải popup). Xem pages.js#napHuongDan. */
  /**
   * Điền đường dẫn THẬT của thư mục app vào ô `[data-duong-app]`.
   *
   * ⚠ Không viết cứng một đường dẫn nào: mỗi máy cài một chỗ, bản chạy từ mã
   * nguồn còn trỏ thẳng vào `desktop/`. Nguồn duy nhất là `appRootDir()` bên
   * main, trả về qua `templates.list().root` — cùng giá trị mà nút Copy prompt
   * nhúng vào câu lệnh, nên hai chỗ không thể lệch nhau.
   *
   * Đọc BẤT ĐỒNG BỘ sau khi vẽ: bài hướng dẫn phải hiện ra ngay, không đợi một
   * lượt IPC. Hỏng thì để lại câu báo, đừng để ô trống không ai hiểu.
   */
  async function dienDuongApp(box) {
    const o = box.querySelector('[data-duong-app]');
    if (!o) return;
    let duong = '';
    try {
      duong = (await window.beeknoee.templates.list()).root || '';
    } catch { /* để rơi xuống nhánh báo lỗi bên dưới */ }
    if (!duong) { o.textContent = 'Chưa đọc được thư mục app.'; return; }
    o.textContent = '';
    const ma = document.createElement('code');
    ma.textContent = duong;
    const nut = document.createElement('button');
    nut.type = 'button';
    nut.className = 'hd-duong-copy';
    nut.textContent = 'Copy đường dẫn';
    nut.onclick = async () => {
      try {
        await navigator.clipboard.writeText(duong);
        nut.textContent = 'Đã copy ✓';
        setTimeout(() => { nut.textContent = 'Copy đường dẫn'; }, 1400);
      } catch { nut.textContent = 'Copy lỗi'; }
    };
    o.append(ma, nut);
  }

  function veTrang(box, key) {
    const d = NOI_DUNG[key];
    if (!d || !box) return false;
    style();
    box.classList.add('hd-trang');
    box.innerHTML = thanhTab(key) + than(d, true);
    noiLinkNgoai(box);
    dienDuongApp(box);
    /* Bấm tab thì đi qua pages.js (moHuongDan) chứ ĐỪNG tự veTrang tại chỗ:
       pages.js giữ `hdDangVe` để biết đang hiện bài nào — tự vẽ là hai bên
       lệch nhau, bấm lại nút "Hướng dẫn lấy API" trên đầu cột sẽ bị nuốt vì
       pages tưởng đang hiện đúng bài. Gắn MỘT lần trên box (box được pages
       dùng lại qua các lần vẽ, gắn mỗi lần là chồng listener). */
    if (!box.__hdTabWired) {
      box.__hdTabWired = true;
      box.addEventListener('click', (e) => {
        const nut = e.target.closest('[data-hd-tab]');
        if (nut) {
          const k = nut.dataset.hdTab;
          if (window.__beePages && window.__beePages.moHuongDan) window.__beePages.moHuongDan(k);
          else veTrang(box, k);
          return;
        }
        /* Mục lục trong trang. Cuộn TRONG `box` chứ không cuộn cửa sổ:
           #page-huongdan mới là thứ có overflow-y, còn body thì cố định cao
           100vh — gọi window.scrollTo ở đây là không nhúc nhích. */
        const toc = e.target.closest('[data-hd-toc]');
        if (toc) {
          const dich = document.getElementById(toc.dataset.hdToc);
          if (dich) dich.scrollIntoView({ block: 'start', behavior: 'smooth' });
          return;
        }
        /* Bấm ảnh = phóng to cả cửa sổ (cột phải chỉ cao 260px — ảnh chụp có đánh số phải xem to mới đọc được). */
        const img = e.target.closest('.hd-anh, .hd-nut-anh img');
        if (img) { phongAnh(img); return; }
        /* "Liên hệ hỗ trợ" mở đúng hộp báo lỗi của nút "?" — nó gửi thẳng về
           máy chủ kèm nhật ký lỗi. Dựng đường liên hệ thứ hai là hai đường cùng
           làm một việc rồi lệch nhau. */
        if (e.target.closest('[data-hd-hotro]')) {
          if (window.__beeHub && window.__beeHub.moHopLoi) window.__beeHub.moHopLoi();
        }
      });
    }
    // icons.js chỉ quét MỘT LẦN lúc nạp trang, mà nội dung này dựng sau — không
    // gọi ở đây thì mấy ô `data-icon` nằm trống không, chẳng báo lỗi gì.
    if (window.__beeIcons) window.__beeIcons.apply(box);
    return true;
  }

  /** Lớp phủ xem ảnh cỡ thật (kèm chú thích nếu có); bấm hoặc Esc là đóng. */
  function phongAnh(img) {
    const lop = document.createElement('figure');
    lop.className = 'hd-phong';
    const to = document.createElement('img');
    to.src = img.src;
    to.alt = img.alt || '';
    lop.appendChild(to);
    const cap = img.closest('figure') && img.closest('figure').querySelector('figcaption');
    if (cap) { const c = document.createElement('figcaption'); c.textContent = cap.textContent; lop.appendChild(c); }
    const dongPhong = () => { lop.remove(); document.removeEventListener('keydown', phimPhong, true); };
    const phimPhong = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dongPhong(); } };
    lop.onclick = dongPhong;
    document.addEventListener('keydown', phimPhong, true);
    document.body.appendChild(lop);
  }

  function mo(key) {
    const d = NOI_DUNG[key];
    if (!d) return;
    style();
    dong();
    const el = document.createElement('div');
    el.id = 'bee-guide';
    el.innerHTML = `
      <div class="hd-hop">
        <button class="hd-x" type="button" data-dong aria-label="Đóng">×</button>
        ${thanhTab(key)}
        ${than(d, false)}
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-dong]')) { dong(); return; }
      // Tab trong popup: vẽ lại popup với bài kia (mo() tự dong() bản cũ).
      const nutTab = e.target.closest('[data-hd-tab]');
      if (nutTab) mo(nutTab.dataset.hdTab);
    });
    noiLinkNgoai(el);
    document.addEventListener('keydown', phim, true);
  }

  function phim(e) { if (e.key === 'Escape') { e.preventDefault(); dong(); } }

  function dong() {
    const el = document.getElementById('bee-guide');
    if (el) el.remove();
    document.removeEventListener('keydown', phim, true);
  }

  // Bắt ở tầng document: hai nút nằm trong `.header-tools`, mà cụm đó bị
  // render-layout.js chuyển sang hàng tiêu đề danh sách — gắn thẳng vào nút thì
  // phải canh đúng thời điểm chuyển xong.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="/elevenlabs-guide"]');
    if (!a) return;
    e.preventDefault();
    const moc = (a.getAttribute('href').split('#')[1] || '').trim();
    // CẢ HAI hướng dẫn đều đi thành TRANG. Nhét vào popup thì phải cuộn trong
    // một ô 760px và ảnh chụp co lại còn bằng con tem — mà ảnh mới là thứ
    // người ta nhìn để đối chiếu. `mo()` vẫn giữ cho chỗ nào cần popup nhanh.
    /* ⚠ LIÊN KẾT NẰM TRONG KHUNG DỰNG THÌ MỞ POPUP, KHÔNG CHUYỂN TRANG.
       `moHuongDan()` gọi `moTrang('huongdan')`, mà hàm đó đặt
       `.dashboard-shell.hidden = true` — tức DỌN SẠCH cả khung dựng video,
       khung sửa lẫn danh sách dự án bên trái cùng một lúc. Với nút Hướng dẫn ở
       thanh bên hay ở Trung tâm trợ giúp thì đúng: người dùng đang đi tìm tài
       liệu. Nhưng cái nút này nằm NGAY TRONG phần Giọng đọc, giữa lúc người ta
       đang chỉnh âm thanh — bấm một cái là cả chỗ làm việc biến mất, nhìn y như
       app hỏng (chủ dự án báo 19/09/2026, đã dựng lại được: `shellAn` false →
       true, `danh sách dự án` hiện → mất).
       Popup giữ nguyên chỗ làm việc phía sau, đóng lại là về đúng chỗ đang dở. */
    if (NOI_DUNG[moc] && a.closest('.render-machine')) { mo(moc); return; }
    /* Không có mốc (href trơn '/elevenlabs-guide') = mở MỤC LỤC ba bài.
       moHuongDan('') chính là thứ nút Hướng dẫn ở thanh bên gọi. */
    if ((moc === '' || NOI_DUNG[moc]) && window.__beePages && window.__beePages.moHuongDan) {
      /* href trơn (không mốc) từ trong khung dựng: mở đúng bài về giọng đọc
         ElevenLabs — cùng bài mà Trung tâm trợ giúp gọi là 'manual'. */
      if (a.closest('.render-machine')) { mo('manual'); return; }
      window.__beePages.moHuongDan(moc);
      return;
    }
    if (NOI_DUNG[moc]) mo(moc);
  }, true);

  /* Link ra ngoài ở NGOÀI trang hướng dẫn (ví dụ dòng gợi ý trong tab
     Beeknoee AI) cũng phải mở bằng trình duyệt hệ thống — app không có
     setWindowOpenHandler nên target=_blank sẽ bung một cửa sổ Electron trần
     không thanh địa chỉ. Bắt ở pha nổi bọt và né những link mà listener của
     container hướng dẫn đã xử (chúng preventDefault trước khi tới đây). */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const a = e.target.closest('a[data-ngoai]');
    if (!a) return;
    e.preventDefault();
    if (window.beeknoee && window.beeknoee.openExternal) window.beeknoee.openExternal(a.href);
  });

  /**
   * Toàn bộ chữ tìm được của một bài — cho ô tìm ở thanh trên (pages.js).
   *
   * Trả chữ THÔ, việc bỏ dấu để bên gọi lo: pages.js đã có sẵn hàm đó cho thẻ
   * mẫu, dựng thêm một bản ở đây là hai bản sẽ lệch nhau.
   * Gộp cả tên mục và từng gạch đầu dòng: tìm "hàng đợi" phải ra bài số 6 dù
   * tiêu đề bài không có chữ đó.
   */
  function timBai(khoa) {
    const d = NOI_DUNG[khoa];
    if (!d) return '';
    const phan = [d.tieuDe, d.moTa, d.cuoi];
    (d.muc || []).forEach((m) => {
      phan.push(m.ten, m.nhan, m.luuY, m.chuThich);
      (m.buoc || []).forEach((b) => phan.push(b));
      (m.hinh || []).forEach((h) => phan.push(h.chu));
      (m.nut || []).forEach((n) => phan.push(n.ten, n.phim, n.lam, n.viDu));
    });
    return phan.filter(Boolean).join(' ');
  }

  soatBaiLacLoi();
  // Video mở ra cho pages.js dùng chung (trang chủ Hướng dẫn) — khai danh sách ở hai nơi là có ngày lệch nhau.
  window.__beeGuide = { mo, dong, veTrang, timBai, mucLuc, xemVideo, napVideo, videoDs: VIDEO_DS };
})();
