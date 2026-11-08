'use strict';
/**
 * Nhật ký thay đổi — nguồn cho bảng hiện khi rê chuột vào số hiệu bản
 * (góc dưới bên phải).
 *
 * Để ở file riêng chứ không nhét vào `version-badge.js`: đây là DỮ LIỆU, mỗi
 * lần phát hành lại sửa, còn cái kia là mã dựng giao diện. Trộn hai thứ thì
 * mỗi lần thêm một dòng ghi chú lại phải đụng vào mã.
 *
 * ⚠ BA LUẬT BẮT BUỘC — đọc trước khi thêm dòng:
 *
 * 1. VIẾT CHO NGƯỜI DÙNG, KHÔNG VIẾT CHO LẬP TRÌNH VIÊN.
 *    Bảng này người mua đọc. Chỉ ghi thứ họ THẤY hoặc LÀM được khác đi.
 *    ĐỪNG ghi: tên file mã nguồn, tên hàm, khoá cấu hình, đường dẫn máy chủ,
 *    tên bảng cơ sở dữ liệu, đầu mối API, tên nhà cung cấp phía sau, hay bất
 *    cứ thứ gì thuộc phần máy chủ. Trước đây file này từng lỡ ghi cả tên file
 *    video nội bộ và chi tiết trình sửa slide — đó là thứ phải tránh.
 *
 * 2. CHỈ GHI THỨ ĐÃ LÀM THẬT VÀ ĐÃ PHÁT HÀNH.
 *    Đây là chỗ người dùng tra khi thấy app đổi hành vi; bịa một dòng là gửi
 *    họ đi tìm một tính năng không tồn tại. Bản chưa phát hành thì ĐỪNG thêm
 *    vào đây — `version-badge.js` có lọc chặn bản mới hơn bản đang cài, nhưng
 *    đừng dựa vào cái lọc đó thay cho việc giữ file này sạch.
 *
 * 3. Thứ tự: MỚI NHẤT lên đầu. `version` phải khớp `package.json`.
 */
window.__BEE_CHANGELOG__ = [
  {
    version: '1.3.0',
    ngay: '24/10/2026',
    muc: [
      'Trình dựng video kiểu Premiere: kéo video, ảnh, nhạc, chữ lên timeline; tạo dự án video trống và tự tạo phụ đề',
      '26 hiệu ứng chuyển cảnh mới, kèm kho âm thanh hiệu ứng, lớp phủ, chữ động và font tiếng Việt có sẵn',
      '10 mẫu dựng video (7 dọc, 3 ngang): chỉ cần thay ảnh, video của bạn; lưu được dự án của mình làm mẫu',
      'Giọng đọc chạy ngay trên máy, không cần khoá API; âm lượng giọng đều hơn, đọc đúng số và ngày tháng',
      'Tab AI agent: chat với Codex hoặc Claude để AI làm video ngay trong Studio; đổi model hay agent không mất cuộc chat',
      'Trang Hướng dẫn mới với 5 video hướng dẫn và các bài viết lại theo app mới',
      'Dùng thử miễn phí tăng lên 50 video',
    ],
  },
  {
    version: '1.2.4',
    ngay: '01/10/2026',
    muc: [
      'Sửa lỗi giọng đọc ElevenLabs: script dài mà ElevenLabs trả chậm thì app không còn bỏ cuộc sau 2 phút để rồi gọi lại nhiều lần — mỗi lần gọi đều bị tính credit mà vẫn không ra giọng. Nay chờ tối đa 5 phút mỗi lần, và hết giờ chờ thì dừng, báo rõ credit có thể đã bị trừ cùng cách tải file giọng từ History của ElevenLabs để dùng ở chế độ Tải file',
      'Lỗi mạng tạm thời với ElevenLabs chỉ thử lại một lần (trước đây hai lần) để đỡ tốn thêm credit',
    ],
  },
  {
    version: '1.2.3',
    ngay: '29/09/2026',
    muc: [
      'Trang thanh toán lấy thông tin xuất hoá đơn thẳng từ hồ sơ tài khoản — sửa bằng nút Sửa thông tin; hồ sơ còn thiếu gì thì báo rõ ngay dưới form',
      'Nút Tạo mã QR chỉ bật khi hồ sơ hoá đơn đã đủ — rê chuột vào nút đang mờ để xem còn thiếu gì',
      'Hồ sơ đã chọn xuất hoá đơn theo doanh nghiệp thì trang thanh toán xuất thẳng hoá đơn công ty',
    ],
  },
  {
    version: '1.2.2',
    ngay: '29/09/2026',
    muc: [
      'Đăng nhập bằng Google nay đi qua Bee Account — tài khoản chung của các sản phẩm Beeknoee. Đã đăng nhập Bee Platform hoặc Bee Project trên cùng trình duyệt thì vào app ngay, không phải chọn lại tài khoản',
      'Bảng tài khoản chia ba tab Thông tin · Doanh nghiệp · Cài đặt: khai họ tên, số điện thoại, địa chỉ (chọn tỉnh/thành và phường/xã từ danh sách), CCCD và thông tin xuất hoá đơn doanh nghiệp một lần — dùng chung với Bee Platform và Bee Project',
      'Trang thanh toán tự điền thông tin hoá đơn từ hồ sơ: chọn Cá nhân hay Công ty là hiện đúng bộ thông tin của loại đó, thiếu gì thì báo ngay kèm nút Sửa thông tin',
    ],
  },
  {
    version: '1.2.1',
    ngay: '24/09/2026',
    muc: [
      'Thêm 12 mẫu mới, kho mẫu lên 43 (27 dọc · 16 ngang) với bốn nhóm mới: Xếp hạng & tương tác, Kể chuyện, Thủ tục & dịch vụ công, Kinh doanh. Mẫu dọc: Top N xếp hạng, Chuyện có thật, Thủ tục & giấy tờ, Đố vui, Trước và sau, Tiền của bạn. Mẫu ngang: Tóm tắt sách, Hướng dẫn phần mềm, Điểm tin tuần, Mổ xẻ một vụ việc, Case study kinh doanh, Đối thoại hai bên. Phần lớn dùng ảnh thật thuộc phạm vi công cộng hoặc giấy phép tự do, nguồn ghi kèm trong từng mẫu',
      'Phụ đề theo khổ video: khổ dọc luôn ngắt cụm ngắn cho vừa khung — deck dọc thiếu thiết lập phụ đề trước đây có thể tràn chữ ra mép, nay hết; khổ ngang mặc định cụm dài hơn cho dễ đọc, AI chọn cụm ngắn khi deck cần nhịp nhanh',
      'AI trong app: deck ngang không còn bị bước tự kiểm báo lỗi sai; bước này nay còn bắt lỗi slide mở đầu của deck ngang có hai câu, vốn làm cả video lệch nhịp',
      'Mẫu có sẵn được sửa: bốn mẫu nhóm Công cụ AI hết tràn ra vùng dễ bị che; ảnh giữ chỗ trong Mẫu khởi đầu nay là dấu hiệu Beeknoee; lời kêu gọi theo dõi trong mẫu viết trung tính để bạn dùng cho kênh của mình; video mẫu quay lại theo nội dung mới',
      'Mở hộp Tạo video khi đang ở tab Âm thanh: tab nay ghi rõ "Giọng đọc đang ở trong hộp Tạo video" kèm nút Đóng hộp, thay cho một khoảng trống',
      'Nút "Tạo dự án bằng AI" trên các thẻ mẫu nay cao đều nhau',
    ],
  },
  {
    version: '1.2.0',
    ngay: '23/09/2026',
    muc: [
      'Tạo dự án bằng AI ngay trong app: tab "Tạo bằng AI" ở cột trái — chọn mẫu, mô tả nội dung, AI viết chữ và lời thoại cho từng slide rồi tự kiểm; xong thì chat tiếp để sửa từng chỗ. Nối API của Anthropic, OpenAI, Google Gemini, Beeknoee Platform hoặc máy chủ tương thích OpenAI ở Cài đặt AI',
      'Trang dựng video gộp làm một: deck hiện thường trú ở giữa, bảng sửa (nội dung · âm thanh · phụ đề) bên phải, danh sách dự án bên trái. Kéo đường kẻ giữa các cột để đổi bề ngang, bấm đúp để về mặc định',
      'Mẫu ngang 16:9 cho YouTube: trang "Mẫu ngang" riêng với 10 mẫu mới (bản tin, bài giảng, đối chiếu, quy trình, hồ sơ, phân tích nến, bảng giá, quản lý vốn, mổ xẻ lệnh, khái niệm on-chain). App tự hiện đúng bộ độ phân giải theo khổ của deck và chặn dựng nhầm khổ',
      'Mười mẫu dọc làm lại đậm nét hơn, có hình minh hoạ và video mẫu mới; Copy prompt nay kèm sẵn yêu cầu chất lượng và lưu ý cơ bản để AI làm chuẩn mẫu hơn',
      'Mỗi lượt dựng ghi thêm tệp phụ đề .srt và danh sách chương YouTube cạnh tệp MP4',
      'Phụ đề: chọn phông, đậm/nghiêng/gạch chân, căn lề, viền, nền, vị trí trên/dưới — xem trước đổi ngay và video dựng ra y hệt',
      'Bảng thông tin ElevenLabs/Beeknoee: nút nghe thử thành hình loa, giọng và model đánh số thứ tự; ô chọn model có tìm kiếm và chia theo nhà cung cấp',
      'Hướng dẫn viết lại theo hai cách làm slide (AI trong app · Copy prompt cho Claude/Codex Desktop) và thêm bài Câu hỏi thường gặp',
      'Sửa lỗi: lịch sử chat với AI nay nạp lại đúng sau khi mở lại app; bấm dừng AI không còn làm dừng video đang dựng; chép toàn bộ phụ đề ở tab Phụ đề chạy lại; bề ngang cột kéo được nhớ qua lần mở sau',
      'Ô "Lời thoại slide này" chuyển lên đầu tab Phụ đề — trước nó nằm cuối nên chỉ lòi ra một vạch ở mép dưới, phải cuộn mới sửa được',
      'Nút Tạo video trên thanh trên nay báo khi đang dựng ngầm: icon xoay, chữ "Đang tạo video" và một vệt sáng chạy qua — đóng bảng tiến trình vẫn biết máy đang chạy',
      'Sửa lỗi: hộp Tạo video không còn trắng trơn khi đổi slide hoặc khi lượt dựng sang bước kế; nhãn số lượt miễn phí thôi ghi "0/10" lúc app chưa hỏi được máy chủ',
      'Cài đặt AI dùng được nhiều nhà cung cấp cùng lúc: mỗi nhà nhớ riêng model và địa chỉ của mình, đổi nhà là model cũ hiện lại đúng như lúc để. Ô Model nay xổ ra danh sách gộp của mọi nhà đã cắm khoá, chia nhóm theo nhà kèm logo và số lượng, tìm được cả theo tên nhà; chọn model của nhà khác thì app tự chuyển nhà theo',
      'Thông báo chuyển lên thanh trên, bên trái nút Hướng dẫn — trước nó nằm tít đáy cột phải nên hay bị bỏ sót',
      'Bảng cài đặt gọn lại: Giao diện còn một nút sáng/tối đổi icon theo nền đang dùng, Cỡ chữ thành ô chọn xổ xuống ghi rõ mức nào là mức app tự chọn cho màn hình này',
      'Nền tối dịu hơn ở cột dự án: thẻ dự án và hàng tab thôi sáng chói, và dự án đang chọn nhờ vậy nổi hẳn lên',
    ],
  },
  {
    version: '1.1.8',
    ngay: '13/09/2026',
    muc: [
      'Bản macOS: bộ cài nay được ký đúng cách. Trước đây macOS báo "Beeknoee Studio bị hỏng và không thể mở được" dù file tải về hoàn toàn bình thường, khiến nhiều người tưởng tải lỗi và xoá đi. Nay chỉ còn cảnh báo thông thường của macOS dành cho phần mềm ngoài App Store, mở được bằng vài cú bấm — xem mục "Cài trên macOS" ở trang chủ',
      'Hướng dẫn cài trên macOS ở trang chủ đã viết lại cho đúng các đời macOS mới',
    ],
  },
  {
    version: '1.1.7',
    ngay: '13/09/2026',
    muc: [
      'Phụ đề và slide nay chạy khớp giọng đọc ở MỌI độ dài video. Trước đây video càng dài càng lệch dần — video 26 phút lệch hơn 10 giây ở đoạn cuối; nay lệch dưới 1/50 giây',
      'Ô Tốc độ nhận cả số viết dấu phẩy ("1,25"), và khi bạn gõ số ngoài khoảng cho phép thì app nói rõ đã dùng số nào thay vào — trước đây nó âm thầm quay về 1.1 mà không báo gì',
      'Thêm nút "Dọn rác" cạnh nút Làm mới: xem trước từng nhóm tệp dựng dở rồi chọn nhóm muốn xoá, biết trước lấy lại được bao nhiêu. Video đã dựng xong không bao giờ bị đụng tới',
      'Tổng dung lượng thư mục dự án hiện ngay ở tiêu đề danh sách',
      'Lúc app tải bản cập nhật nay có hiện tiến độ, biết mà chờ thay vì tưởng app đứng im',
      'Tải bản cập nhật nhẹ hơn hẳn — app chỉ tải phần khác so với bản đang có thay vì tải lại trọn bộ',
      'Lúc cài bản mới có thanh tiến trình thay cho màn hình trống, không còn cảm giác máy bị treo',
      'Danh sách dự án bỏ ảnh xem trước của từng dự án (thêm ở bản 1.1.6) — hàng gọn hơn và tên dự án đứng ngay đầu hàng',
      'Biểu tượng "Dựng video" ở thanh bên trái đổi sang màu xanh, bỏ nền tròn',
    ],
  },
  {
    version: '1.1.6',
    ngay: '12/09/2026',
    muc: [
      'Đóng cửa sổ app không còn huỷ video đang dựng: app thu xuống khay cạnh đồng hồ và chạy tiếp. Muốn tắt hẳn thì chuột phải vào biểu tượng ở khay rồi chọn "Thoát hẳn"',
      'Danh sách dự án có ảnh xem trước cho mọi dự án — app tự chụp lấy slide đầu, không còn chỗ có ảnh chỗ trống',
      'Thời gian từng bước của lần tạo video được lưu lại: mở lại dự án cũ vẫn xem được, không còn hiện 0 giây',
      'Trang Hướng dẫn có thêm 4 bài (thư mục làm việc, Trình Sửa, dựng nhiều video một lượt, gặp lỗi thì làm sao) và tự đánh dấu bài đã đọc',
      'Trang Template gọn hơn: mỗi mẫu có thẻ phân loại, chuyển nhóm bằng nút trượt, đổi được kiểu xem và cách sắp xếp',
      'Thêm ô tìm kiếm ở thanh trên — ở trang Template thì tìm mẫu, ở trang Hướng dẫn thì tìm bài',
      'Trang Nâng cấp dựng lại: xem sẵn giá của cả bốn mốc thời hạn, thông tin chuyển khoản và mã QR gom một chỗ',
      'Bảng "Có gì mới" mở bằng cách bấm vào số hiệu bản ở góc dưới phải, xem lại được toàn bộ các bản trước',
    ],
  },
  {
    version: '1.1.5',
    ngay: '11/09/2026',
    muc: [
      'Trang sửa slide dễ nhìn hơn: màu và độ sáng của mỗi vùng sáng nền gom chung một chỗ, có tên và mã màu rõ ràng',
      'Dự án tạo mới có thêm 5 hiệu ứng nền và lưới chọn vị trí vùng sáng chi tiết hơn; dự án cũ không còn bị vỡ hàng ở bảng chọn vị trí',
      'Màn hình tạo video hiện thời gian từng bước và dự kiến còn lại; danh sách dự án gọn lại còn 5 dự án mới nhất kèm ảnh xem trước',
    ],
  },
  {
    version: '1.1.4',
    ngay: '04/09/2026',
    muc: [
      'Nút "Copy prompt" ở trang Template kèm sẵn đường dẫn thư mục làm việc — dán cho AI là mở đúng chỗ, không còn báo không thấy mẫu',
      'Bấm Dừng là dừng hẳn, không còn chạy ngầm; lần tạo video sau không dùng nhầm giọng đọc dở dang của lần trước',
      'Bấm Tạo video ngay khi vừa mở app không còn báo lỗi',
      'Tách slide theo giọng đọc nhanh hơn từ video thứ hai trở đi trong cùng lần mở app',
      'Giao diện đồng bộ lại màu và cỡ chữ; nút Tạo mã QR và nhãn giảm giá dễ đọc hơn; màn hình cài đặt lần đầu theo đúng nền sáng/tối đang chọn',
    ],
  },
  {
    version: '1.1.3',
    ngay: '29/08/2026',
    muc: [
      'Thêm 4 mẫu video nhóm Tin tức: Tạp chí công nghệ, Trader tài sản số, Giá coin hôm nay và Tạp chí tiền số — mỗi mẫu kèm video xem thử',
      'Sửa lỗi video tạo từ mẫu "Giá vàng hôm nay" bị mất cảnh mở đầu và hình chạy sớm hơn tiếng một nhịp',
    ],
  },
  {
    version: '1.1.2',
    ngay: '27/08/2026',
    muc: [
      'Bấm Tạo video ngay sau khi vừa mở app không còn bị đếm sai lượt miễn phí',
      'Bộ nén video không chạy được (bị phần mềm bảo vệ chặn) thì báo lỗi rõ ràng thay vì đứng im',
      'Cảnh báo ngay trước khi quay nếu thời lượng video dài bất thường so với giọng đọc — thường do video nền của slide quá dài',
    ],
  },
  {
    version: '1.1.1',
    ngay: '26/08/2026',
    muc: [
      'Nâng dùng thử miễn phí từ 3 lên 10 video',
      'Tạo video bị lỗi hoặc bị dừng thì không mất lượt — kể cả khi mất mạng hay app tắt giữa chừng, lần mở sau tự hoàn lại',
      'Sửa lỗi máy chậm hay gặp lúc "gần xong": app chờ đóng tệp ghi hình xong hẳn rồi mới ghép, không còn báo lỗi tệp hỏng',
    ],
  },
  {
    version: '1.1.0',
    ngay: '26/08/2026',
    muc: [
      'Sửa lỗi hình chạy nhanh hơn tiếng trên máy yếu: máy ghi hụt hình thì video tự giãn lại cho khớp giọng đọc và phụ đề',
      'Bộ dựng video không khởi động được thì báo lỗi rõ ràng sau vài giây — trước đây màn hình đứng im ở "Đang chờ tới lượt…"',
      'Bấm Tạo video lại sau lỗi là thử khởi động lại từ đầu, không phải tắt mở app',
      'Lần mở đầu trên máy Mac được chờ tới 3 phút cho hệ thống kiểm tra xong app, thay vì bị cắt ngang ở 60 giây',
      'Câu báo lỗi khi dựng video không còn bị xoá mất ngay sau khi hiện',
    ],
  },
  {
    version: '1.0.9',
    ngay: '22/08/2026',
    muc: [
      'Bỏ hẳn logo và chữ ở góc video — video dựng ra không còn dấu hiệu thương hiệu nào',
      'Dựng xong một video trong lúc còn hàng đợi thì dự án đó hiện đúng "Đã có video" kèm nút mở video, không phải chờ hàng đợi chạy hết',
      'Đổi màu các trạng thái dự án cho dễ phân biệt: xong là xanh lá, thiếu script là đỏ, video cũ là cam',
    ],
  },
  {
    version: '1.0.8',
    ngay: '20/08/2026',
    muc: [
      'API key ElevenLabs nay được mã hoá trước khi lưu và cất trong thư mục dữ liệu riêng của tài khoản máy bạn',
      'Ô API key hiện dấu sao sau khi lưu; có nút Lưu và nút Xoá riêng, muốn thay key phải xoá key cũ trước',
      'Ô chọn giọng đọc dựng lại: đánh số thứ tự, nghe thử được từng giọng ngay trong danh sách mà không tốn credit',
      'Giọng tiếng Việt và tiếng Anh tách thành hai nhóm riêng, tiếng Việt xếp trước, có hiện tổng số giọng',
      'Báo lỗi khi gọi ElevenLabs nay ngắn gọn và nói rõ phải sửa gì, thay cho một đoạn dài khó đọc',
    ],
  },
  {
    version: '1.0.7',
    ngay: '20/08/2026',
    muc: [
      'Đăng nhập ở máy thứ ba khi đã dùng đủ số máy: thêm nút đăng xuất các máy khác ngay tại màn hình đăng nhập',
      'Khoá ElevenLabs bị giới hạn quyền không còn làm trống ô chọn giọng — vẫn chọn được các giọng có sẵn trong app',
      'Thay hai giọng tiếng Việt đã bị gỡ khỏi thư viện ElevenLabs bằng hai giọng khác',
      'Hướng dẫn lấy API key ghi rõ cần bật những quyền nào khi tạo key',
    ],
  },
  {
    version: '1.0.6',
    ngay: '16/08/2026',
    muc: [
      'Xếp hàng tạo video: đang dựng một video mà bấm Tạo video cho dự án khác thì nó vào hàng đợi, xong cái này tự chạy cái kế',
      'Dự án đang chờ hiện trạng thái "Đang chờ" kèm số thứ tự; bấm lại nút là bỏ khỏi hàng',
      'Bấm Dừng khi còn hàng đợi sẽ hỏi thêm: xoá luôn cả hàng, hay để video kế chạy tiếp',
      'Nút Tạo video mờ đi khi chưa chọn file giọng đọc hoặc chưa lưu API key — rê chuột vào để biết còn thiếu gì',
      'Dòng trạng thái lúc dựng nay ghi rõ đang tạo video cho dự án nào',
      'Thêm video hướng dẫn sử dụng app, mở được từ mục Hướng dẫn và từ trang Template',
      'Mục Hướng dẫn sử dụng app được đưa lên đầu danh sách hướng dẫn',
      'Đổi tên "Đèn chính / Đèn phụ" thành "Quầng sáng 1 / Quầng sáng 2" ở trang sửa slide',
      'Đổi tên mục "Thông số" thành "Tuỳ chỉnh video" cho đúng thứ nằm trong đó',
    ],
  },
  {
    version: '1.0.5',
    ngay: '16/08/2026',
    muc: [
      'Danh sách dự án tự cập nhật khi bạn hoặc AI tạo deck mới — không phải bấm Làm mới nữa',
      'Mỗi dự án có trạng thái riêng: Đang thiết kế, Thiếu script, Sẵn sàng, Đang dựng, Đã có video, Video cũ',
      'Sửa script sau khi đã dựng video thì dự án hiện "Video cũ" để bạn biết cần dựng lại',
      'Thêm ô tìm kiếm và bộ lọc theo trạng thái ở đầu danh sách dự án',
      'File giọng đọc đã chọn được nhớ riêng cho từng dự án, và còn nguyên sau khi tắt mở app',
      'Vào trang sửa slide là vào thẳng slide 1, số slide chạy đúng khi bấm lên xuống',
      'Thêm 10 mẫu chủ đề mới: đen trắng tối giản, lời Phật dạy, mẹo sức khoẻ, món ngon mỗi ngày, học tiếng Anh, lịch sử Việt Nam, tử vi phong thuỷ, thể thao, giải thích khái niệm, một điểm nhấn',
      'Thêm mục Hướng dẫn riêng trên thanh bên, gom cả ba bài vào một chỗ',
      'Trang nâng cấp và trang thanh toán gộp làm một, xem giá xong bấm tạo mã QR ngay tại chỗ',
      'Mã QR chỉ được tạo khi bạn bấm nút, nên mở trang xem giá không còn sinh lệnh nạp thừa',
      'Đang dùng gói trả phí thì gia hạn thêm được — thời hạn cộng tiếp vào ngày hết hạn, không mất ngày nào',
      'Thông báo lỗi khi tạo video nay bằng tiếng Việt và nói rõ phải sửa gì',
    ],
  },
  {
    version: '1.0.4',
    ngay: '14/08/2026',
    muc: [
      'Phóng to giao diện được: Ctrl cộng / Ctrl trừ, Ctrl + lăn chuột, hoặc chọn cỡ chữ trong Cài đặt',
      'Màn hình lớn tự dùng cỡ chữ vừa mắt ngay lần đầu mở app — trước đây chữ bé tí trên màn 2K và 4K',
      'Cỡ chữ được nhớ lại cho những lần mở sau',
      'Thêm nút Kiểm tra cập nhật trong Cài đặt của tài khoản',
      'Xoá được cả dự án bằng nút thùng rác, kể cả dự án chưa tạo video — thư mục chuyển vào Thùng rác nên khôi phục lại được',
      'Đã có bản cho máy Mac — cả máy chip Apple lẫn chip Intel',
    ],
  },
  {
    version: '1.0.3',
    ngay: '14/08/2026',
    muc: [
      'Rời sang tab khác giữa lúc tạo video rồi quay lại, thanh tiến trình chạy tiếp đúng chỗ thay vì đứng hình',
      'Thêm nút "?" ở góc dưới bên phải: mở nhanh ba hướng dẫn và gửi báo lỗi thẳng cho đội hỗ trợ',
      'Số hiệu bản và nút "?" đã đọc rõ, trước bị mờ gần như không thấy',
      'Đang tạo video mà bấm Tạo video lần nữa thì không còn sinh ra tiến trình thừa',
    ],
  },
  {
    version: '1.0.2',
    ngay: '14/08/2026',
    muc: [
      'Giao diện tối: chữ trong các danh sách xổ xuống (chọn giọng đọc, chất lượng audio) đã đọc được, trước bị chìm vào nền',
      'Ô API key ElevenLabs luôn hiện, đổi được key đã lưu — trước lưu xong là ô biến mất, key sai cũng không sửa lại được',
      'Bảng "Có gì mới" chỉ hiện ghi chú của bản đang dùng trở về trước',
    ],
  },
  {
    version: '1.0.1',
    /* ⚠ Ngày ở đây là ngày PHÁT HÀNH (giờ tệp trên /updates/), không phải ngày
       commit. Từng ghi nhầm 14/08 cho bản này vì đoán theo ngày đang ngồi sửa;
       máy chủ nói 13/08. Không chắc thì tra `last-modified` của bộ cài. */
    ngay: '13/08/2026',
    muc: [
      'Cài bản mới không còn ghi đè slide bạn đã tự tạo trong thư mục dự án',
      'Các template kèm video minh hoạ đã hiện đầy đủ sau khi cài',
      'Mở app lần nữa khi đang chạy thì bật lại cửa sổ cũ, không mở thêm cửa sổ mới',
      'Trang nâng cấp gói gọn lại; thông tin xuất hoá đơn tự lưu khi bạn điền xong',
    ],
  },
  {
    version: '1.0.0',
    ngay: '13/08/2026',
    muc: [
      'Bản phát hành đầu tiên: dựng video dọc 1080×1920 từ slide ngay trên máy bạn',
      'Lồng tiếng sẵn trong app hoặc nối ElevenLabs, phụ đề tự khớp theo từng câu',
      'Kho template dựng sẵn cho tin tức, so sánh, dòng thời gian, số liệu',
      'Dùng thử 3 video miễn phí, nâng cấp gói và thanh toán ngay trong app',
    ],
  },
];
