# TIN-07 · Điểm tin tuần

Bảy slide **khổ NGANG 16:9**: bìa có khoảng ngày và số tin → năm mục tin → tin
đáng chú ý nhất kèm câu hỏi cho khán giả.

⚠ **Khác `TIN-06` Bản tin & số liệu**: cái kia đào sâu **một** chủ đề, cái này
lướt **nhiều** tin ngắn. Đừng gộp hai mẫu.

## ⚠ Mẫu khổ NGANG — dòng mẫu khác hẳn mẫu dọc

| | |
|---|---|
| khai khổ | `<meta name="bee-khung" content="ngang" />`. **Không khai = dọc** |
| khung | **1232 × 693** → video 1920×1080 |
| vùng an toàn | **[100, 493]**, `.than` khai bằng padding |
| engine | `app.js` riêng, **không có** `slideScripts` |

`validate_slide.py` tự nhận khổ ngang qua thẻ `bee-khung` và đọc lời thoại từ
`script-90s.txt`. ⚠ **Đừng thêm mảng `slideScripts`** vào `app.js` cho qua bộ soát.

Nhịp: slide đầu có **đúng 1 câu** → mọi phần tử hiện cùng lúc; các slide sau
**số câu = số `.slide-element`**. Mẫu này: **1 / 2 / 2 / 2 / 2 / 2 / 2**.

## Ba thứ làm nên mẫu này

**1. Ba khối NẰM NGANG trong mỗi mục: số lớn · chữ · ảnh.** Đọc lướt được
trong hai giây. Khung dọc buộc xếp chồng, và lúc đó nó thành một danh sách dọc
dài chứ không còn là một mục tin.

**2. Kẻ ngang mảnh** ngăn giữa các mục — chữ ký của mẫu. Kẻ mọc ra từ trái khi
mục hiện, như một dòng tin vừa được gạch xuống.

**3. CHỈ MỘT màu nhấn.** Bản tin nhiều màu đọc ra như quảng cáo; một màu duy
nhất thì mắt biết ngay đâu là chỗ cần nhìn.

## ⚠ Ảnh minh hoạ phải được GỌI TÊN là minh hoạ

Nhiều tin không có sẵn ảnh của chính đối tượng. Dùng ảnh một vật khác để minh
hoạ là chuyện bình thường trong nghề báo — **giấu chuyện đó đi mới là nói dối
người xem bằng hình.**

Mẫu này có chú thích riêng dưới mỗi ảnh, và ba trong năm tấm ghi rõ *"Ảnh minh
hoạ"*. Giữ nguyên chỗ đó.

⚠ **Đừng tin tên tệp — mở ảnh ra nhìn.** Khi dựng mẫu, tìm "black hole jet
NASA Supercomputer" ra **ảnh một cái siêu máy tính** (khớp chữ trong tên), và
"Wolf-Rayet star" ra ảnh một **thiên hà** chứ không phải ngôi sao. Cả hai đều
đúng giấy phép và đều sai chủ thể.

## ⚠ Thể loại hết hạn nhanh nhất trong kho

Một video "điểm tin tuần" chỉ đúng trong đúng tuần đó. **Ghi khoảng ngày ngay
trên bìa** — người xem biết ngay nó nói về tuần nào.

⚠ **Tra từ NGUỒN GỐC**, đừng chép lại bản điểm tin của người khác. Mỗi mục ghi
kèm cơ quan hoặc tạp chí công bố để người xem lần ngược về được.

⚠ **Đừng nêu tên người** trong một mục điểm tin trừ khi chính tin đó là về
người ấy. Tên người là chi tiết dễ sai nhất trong bản tổng hợp, và sai tên
người thì hỏng cả video.

## ⚠ Nền sáng thì phụ đề phải đổi theo

`subtitles.color` phải là mực đậm — mặc định của bộ ghi là **trắng**.
`subtitles.fontSize` **đè lên** `--subtitle-font-size` trong `style.css`.
`theme.variables` phải trùng **cả tên lẫn giá trị** với `:root`; bảng trong
`preview-settings.json` được **sinh ra từ chính `style.css`**.

## ⚠ Bẫy tổ hợp/hậu duệ

Khi viết luật hiện cho phần tử **bên trong** một `.slide-element`, dùng tổ hợp
không dấu cách nếu lớp đó chính là cái `.slide-element`. Viết có dấu cách là cả
khối kẹt ở `opacity: 0` và biến mất — mà bộ soát bố cục vẫn báo ĐẠT vì phần tử
trong suốt vẫn có hộp đúng kích thước.

## Viết nội dung

- **Mỗi tin một slide.** Nhồi hai tin vào một slide là mất nhịp đọc lướt.
- **Một câu tóm, không hai.** Ai muốn biết thêm thì đi đọc nguồn.
- **In đậm đúng con số** trong câu tóm — đó là thứ người xem nhớ được.
- **Slide chốt chọn MỘT tin** và nói vì sao nó đáng nhớ, đừng tóm lại cả năm.
