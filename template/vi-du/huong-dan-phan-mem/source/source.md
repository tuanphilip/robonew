# Nguồn — Hướng dẫn phần mềm (GD-06)

Deck mẫu đi kèm Beeknoee Studio. Nội dung: **cách tạo video đầu tiên trong
Beeknoee Studio**, chụp ngày **23/9/2026** trên chính bản đang chạy.

## ⚠ Vì sao deck mẫu lại hướng dẫn chính app này

Mẫu này cần **ảnh chụp màn hình phần mềm**, mà giao diện phần mềm là tác phẩm
có bản quyền của người làm ra nó. Chụp màn hình Photoshop, Canva hay Office rồi
đưa vào một mẫu ship theo bộ cài là dùng tác phẩm của họ.

Chụp **chính app của mình** thì sạch hoàn toàn — và tiện thể, video demo trở
thành một bài hướng dẫn dùng được thật.

⚠ Làm nội dung thật mà hướng dẫn phần mềm của người khác thì:

- **Ảnh chụp giao diện có bản quyền.** Nhiều hãng cho phép dùng trong nội dung
  hướng dẫn, nhưng có điều kiện — đọc trang "brand guidelines" hoặc "press kit"
  của họ trước.
- **Logo lại là chuyện khác nữa.** Logo là nhãn hiệu, và phần lớn hãng cấm dùng
  logo theo cách khiến người xem tưởng video là của hãng.
- **Đừng chụp màn hình có dữ liệu thật của ai.** Tên, email, số điện thoại,
  nội dung riêng tư — che hoặc thay bằng dữ liệu mẫu trước khi chụp.

## Ảnh trong deck

| Tệp | Chụp gì | Nguồn |
|---|---|---|
| `anh/b1-chon-mau.jpg` | Trang Mẫu dọc 9:16, các thẻ mẫu và nút Tạo dự án bằng AI | Beeknoee Studio |
| `anh/b2-ta-noi-dung.jpg` | Cột trái: ô Tên dự án, ô Nội dung, nút Tạo dự án bằng AI | Beeknoee Studio |
| `anh/b3-loi-thoai.jpg` | Thẻ Phụ đề, ô "Lời thoại slide này" | Beeknoee Studio |
| `anh/b4-giong-doc.jpg` | Mục Giọng đọc: Tải file · ElevenLabs · Beeknoee AI | Beeknoee Studio |
| `anh/b5-tao-video.jpg` | Nút Tạo video ở góc trên bên phải | Beeknoee Studio |

⚠ **Cả năm tấm CÙNG MỘT TỈ LỆ (16:10)**, cắt và thu về cùng 1160×725. Lệch tỉ
lệ thì khung ảnh nhảy kích thước giữa các bước — nhìn ra ngay là làm ẩu. Tổng
**363 KB**.

⚠ Ảnh chụp trên deck mẫu `hoc-tieng-anh` đi kèm app, **không có dữ liệu của
người dùng nào**.

⚠ **Soi kỹ ảnh chụp trước khi dùng.** Bản chụp trên máy dựng hay lẫn trạng thái
mà người dùng thật không gặp. Ảnh bước 2 lúc đầu lộ nửa dòng cảnh báo đỏ
*"Chưa nối API…"* ở mép dưới — vừa sai trạng thái, vừa bị cắt đôi nên đọc ra
như lỗi dựng. Đã đo đúng toạ độ rồi cắt lại: dòng đỏ bắt đầu ở `y=1092`, đáy
nút ở `y=1066`, nên cắt ở `y=1080` — lọt đúng khoảng 26px sạch giữa hai mốc.

## Khung vàng khoanh chỗ cần bấm

Toạ độ khung truyền bằng biến CSS trong thuộc tính `style` của HTML, tính theo
**phần trăm** của khung ảnh:

```html
<span class="khoanh" style="--l: 15%; --t: 83%; --w: 25%; --h: 8%"></span>
```

Nhờ tính theo phần trăm mà đổi sang ảnh khác kích thước vẫn khoanh đúng chỗ.

## Lựa chọn biên tập (không phải fact)

- **Năm bước, không phải bảy.** Gộp "chọn mẫu" và "tả nội dung" được, nhưng
  tách ra thì mỗi bước còn đúng một việc để làm.
- **Dòng chốt nói thứ người xem CHƯA BIẾT** sau khi làm xong — rằng lần sau chỉ
  cần đổi nội dung — chứ không phải một lời chúc mừng.
