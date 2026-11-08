# GD-05 · Tóm tắt sách

Sáu slide **khổ NGANG 16:9**: bìa sách → một câu tóm cả cuốn → ba ý chính →
trích dẫn nguyên văn kèm một dòng "áp dụng thế nào".

## ⚠ Đây là mẫu KHỔ NGANG — dòng mẫu khác hẳn mẫu dọc

| | |
|---|---|
| khai khổ | `<meta name="bee-khung" content="ngang" />` trong `index.html`. **Không khai = dọc.** Thẻ nằm trong chú thích HTML thì KHÔNG tính |
| khung thiết kế | **1232 × 693** (693 × 16/9 = 1232 chằn → video 1920×1080 không viền đen) |
| vùng an toàn | **[100, 493]** — `.than` khai bằng padding. `main/kiemDeck.js` đo hộp bao của mọi `.slide-element` |
| engine | `app.js` riêng, **không có** `slideScripts`. Lời thoại chỉ nằm ở `script-90s.txt` |

`app.js` của dòng mẫu này cố ý **không có** `const slideScripts = [...]` —
lời thoại chỉ nằm ở `script-90s.txt`. `validate_slide.py` tự nhận khổ ngang qua
thẻ `bee-khung` và đọc lời thoại từ đó. ⚠ **Đừng thêm mảng `slideScripts`** vào
`app.js` cho qua bộ soát.

## ⚠ Hợp đồng nhịp

Bộ ghi **bấm chuột thật** vào trang, không gọi hàm nào của deck:

- slide có N phần tử → N−1 cú bấm hé lộ phần tử 2…N
- **slide đầu có ĐÚNG 1 câu** → bảng nhịp gộp mọi phần tử vào một cú bấm
  (`HOOK_SENTENCE_COUNTS` trong `python/timeline.py`), nên ở đó 1 câu / N phần
  tử là ĐÚNG
- các slide sau: **số câu = số `.slide-element`**

Mẫu này: **1 / 2 / 2 / 2 / 2 / 2** câu.

## Ba thứ làm nên mẫu này

**1. Bìa sách THẬT ở slide mở.** Thứ đang nói tới là một cuốn sách có thật, và
bìa của nó là bằng chứng — vẽ lại một cái bìa là bịa.

⚠ **Bìa sách hiện hành CÓ BẢN QUYỀN**, của nhà xuất bản chứ không phải tác giả.
Kể cả tác phẩm đã hết hạn bảo hộ thì bìa bản in mới vẫn không dùng được. Deck
mẫu chọn Số đỏ vì có sẵn **bìa bản in đầu 1938** trên Commons dưới Public
domain. Tóm sách đang bán thì hỏi nhà xuất bản, hoặc tự chụp cuốn sách của bạn.

**2. Tiêu đề dùng CHỮ CÓ CHÂN.** Đó là thứ làm mẫu đọc ra "sách" chứ không phải
một trang trình chiếu.

⚠ **Dùng font HỆ THỐNG, đừng thêm link Google Font.** `rewriteFontLinks()` thay
**bất kỳ** thẻ `<link href="...fonts.googleapis.com/css2...">` nào bằng Inter
đóng gói — thêm một font chữ có chân từ Google là lúc quay nó âm thầm biến mất,
trong khi mở bằng trình duyệt vẫn thấy đúng. Không có lỗi nào báo.

⚠ **TUYỆT ĐỐI KHÔNG ĐỂ `Georgia` trong chuỗi font.** Đo 23/9/2026 bằng ảnh chụp
thật: Georgia thiếu glyph tiếng Việt dựng sẵn, nên trình duyệt lấy dấu từ font
dự phòng và **dấu rời hẳn ra khỏi chữ** — "Số đỏ" hiện thành "Sô ́ đỏ", "nhất"
thành "nhâ ́t". Trông như lỗi phông chứ không ai nghĩ tới đây. Và **phép đo bề
rộng không bắt được** — nó vẫn báo Georgia đủ dấu; chỉ chụp ảnh ra nhìn mới
thấy. Đã kiểm bằng ảnh: Palatino Linotype, Cambria, Constantia, Times New Roman
đều dựng dấu đúng.

**3. Số ý to mờ phía sau** lấy từ thuộc tính `data-y`, **không phải số slide** —
số slide sẽ là 03/04/05 trong khi người xem đang nghe "ý thứ nhất".

⚠ Nó là pseudo-element của `.slide`, không phải `.slide-element`, nên không kéo
hộp bao mà `kiemDeck` đo.

⚠ **Khai `background` rút gọn là XOÁ `background-clip: text`.** Luật gốc cắt nền
theo hình chữ; đặt lại `background` mà quên khai lại `background-clip` thì nền
tô kín cả hộp trong khi chữ vẫn trong suốt — slide hiện ra **một hình chữ nhật
mờ** chứ không phải con số. Đã dính đúng lỗi này khi dựng mẫu.

## ⚠ Nền sáng thì phụ đề phải đổi theo

Bộ ghi mặc định `--subtitle-color: #ffffff`; để nguyên là chữ trắng trên giấy,
mất sạch. `preview-settings.json` đã đặt `subtitles.color` tối.

⚠ `subtitles.fontSize` **đè lên** `--subtitle-font-size` trong `style.css`. Hai
chỗ cố ý để cùng một số; đổi một bên thì đổi cả hai.

## ⚠ Bảng màu phải trùng hai nơi

`theme.variables` trong `preview-settings.json` phải trùng **cả tên lẫn giá
trị** với `:root` trong `style.css`. Trình sửa đọc tệp đó và ghi đè `:root` lúc
quay, nên lệch giá trị là **video ra màu cũ** trong khi mở deck bằng trình duyệt
vẫn thấy màu mới. Bảng trong `preview-settings.json` của mẫu này được **sinh ra
từ chính `style.css`** chứ không gõ tay.

## Viết nội dung

- **Câu tóm cả cuốn phải tóm được thật**, mà vẫn còn chỗ cho người xem tò mò.
- **Ba ý chính là cách đọc của bạn**, nói rõ như vậy trong `source/source.md`.
- **Trích NGUYÊN VĂN.** Người xem tóm tắt sách thường là người đã đọc — sai một
  chữ là mất uy tín ngay.
- **Dòng "áp dụng thế nào" phải nói một việc làm được**, không phải một lời khen
  cuốn sách.

## Soát trước khi coi là xong

Chạy `validate_slide.py <thư-mục-deck> --semantic-report`. Nó tự nhận khổ ngang,
kiểm ánh xạ câu ↔ phần tử và đo vùng an toàn [100, 493] trên `.slide-container`
thật 1232×693. Rồi **mở ảnh chụp cả dải slide ra xem bằng mắt** — bộ soát ĐẠT
không có nghĩa là nhìn được.
