# GD-06 · Hướng dẫn phần mềm

Bảy slide **khổ NGANG 16:9**: tên việc cần làm → năm bước, mỗi bước một ảnh
chụp có khung vàng khoanh chỗ cần bấm → kết quả kèm một dòng lưu ý.

⚠ **Khác `GD-04` Quy trình từng bước**: cái kia là đường ray toàn chữ, **không
có chỗ đặt ảnh chụp**. Đây là khác biệt chính giữa hai mẫu.

## ⚠ Mẫu khổ NGANG — dòng mẫu khác hẳn mẫu dọc

| | |
|---|---|
| khai khổ | `<meta name="bee-khung" content="ngang" />` trong `index.html`. **Không khai = dọc.** Thẻ trong chú thích HTML thì KHÔNG tính |
| khung thiết kế | **1232 × 693** → video 1920×1080 |
| vùng an toàn | **[100, 493]**, `.than` khai bằng padding |
| engine | `app.js` riêng, **không có** `slideScripts`. Lời thoại chỉ ở `script-90s.txt` |

`validate_slide.py` tự nhận khổ ngang qua thẻ `bee-khung` và đọc lời thoại từ
`script-90s.txt`. ⚠ **Đừng thêm mảng `slideScripts`** vào `app.js` cho qua bộ soát.

Nhịp: bộ ghi **bấm chuột thật**. Slide đầu có **đúng 1 câu** → mọi phần tử hiện
cùng lúc; các slide sau **số câu = số `.slide-element`**. Mẫu này:
**1 / 2 / 2 / 2 / 2 / 2 / 2**.

## Ba thứ làm nên mẫu này

**1. Ảnh chụp chiếm 2/3 bên phải, chữ bên trái.** Ảnh chụp màn hình vốn là khổ
ngang; nhét vào khung dọc thì hoặc thu nhỏ tới mức không đọc nổi chữ bên trong,
hoặc cắt mất ngữ cảnh quanh chỗ cần bấm — mà ngữ cảnh mới là thứ giúp người xem
tìm được nút đó trên máy mình.

⚠ **Cột phải CHỐT 600px, đừng để `2fr`.** Ảnh tỉ lệ 16:10 nên bề ngang quyết
định chiều cao: `2fr` cho cột rộng 697px và ảnh cao 436px — vượt dải an toàn
393px đúng 21,8px mỗi bên. 600px cho ảnh cao 375px, vừa khít.

**2. Khung vàng khoanh chỗ cần bấm, kèm mũi tên.** Toạ độ truyền theo **phần
trăm** của khung ảnh qua biến CSS trong thuộc tính `style`, nên đổi ảnh khác
kích thước vẫn khoanh đúng chỗ.

⚠ Khung nhấp nháy **hai nhịp rồi đứng yên**. Nhấp nháy suốt slide thì mắt không
đọc nổi chữ bên cạnh.

**3. Cả năm ảnh CÙNG MỘT TỈ LỆ.** Lệch tỉ lệ thì khung ảnh nhảy kích thước giữa
các bước — nhìn ra ngay là làm ẩu.

## ⚠ Ảnh chụp phần mềm: chuyện bản quyền

Giao diện phần mềm là **tác phẩm có bản quyền** của người làm ra nó. Deck mẫu
này chụp **chính Beeknoee Studio**, nên sạch hoàn toàn.

Hướng dẫn phần mềm của người khác thì:

- Đọc trang **brand guidelines / press kit** của hãng trước. Nhiều hãng cho
  dùng ảnh chụp trong nội dung hướng dẫn, nhưng có điều kiện.
- **Logo là nhãn hiệu**, chuyện khác nữa — phần lớn hãng cấm dùng logo theo
  cách khiến người xem tưởng video là của hãng.
- ⚠ **Đừng chụp màn hình có dữ liệu thật của ai.** Tên, email, số điện thoại,
  nội dung riêng tư — che hoặc thay bằng dữ liệu mẫu trước khi chụp.

## ⚠ Bẫy tổ hợp/hậu duệ — bộ soát bố cục KHÔNG bắt được

Viết `.slide-element.visible .hang-buoc span` là đòi `.hang-buoc` phải là **con
cháu** của `.slide-element.visible`. Nhưng `.hang-buoc` **chính là** cái
`.slide-element` đó, nên luật không bao giờ khớp và cả hàng chữ kẹt ở
`opacity: 0` — **biến mất khỏi slide**.

Đúng: `.slide-element.visible.hang-buoc span` (tổ hợp, không dấu cách).

⚠ Bộ soát bố cục vẫn báo ĐẠT: nó đo **hộp**, mà phần tử trong suốt vẫn có hộp
đúng kích thước. Đã dính đúng lỗi này khi dựng mẫu. **Chụp deck ra nhìn.**

## ⚠ Nền sáng thì phụ đề phải đổi theo

Bộ ghi mặc định `--subtitle-color: #ffffff`; trên nền xám nhạt là mất sạch.
`preview-settings.json` đã đặt `subtitles.color` tối.

⚠ `subtitles.fontSize` **đè lên** `--subtitle-font-size` trong `style.css`.
Đổi một bên thì đổi cả hai.

⚠ `theme.variables` phải trùng **cả tên lẫn giá trị** với `:root` — trình sửa
ghi đè `:root` lúc quay, nên lệch là video ra **màu cũ**. Bảng trong
`preview-settings.json` được **sinh ra từ chính `style.css`**.

## Viết nội dung

- **Mỗi bước đúng MỘT việc để làm.** Gộp hai việc vào một bước là người xem
  phải tua lại.
- **Câu lệnh ngắn**, in đậm đúng tên nút/ô cần tìm.
- **Dòng chốt nói thứ người xem chưa biết** sau khi làm xong, không phải lời
  chúc mừng.
