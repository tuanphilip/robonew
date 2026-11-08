# KD-01 · Case study kinh doanh — luật của mẫu

Khung **ngang 16:9**. Bảy slide. Nền trắng, tông navy, biểu đồ cột phẳng không
đổ bóng — phong cách báo cáo tư vấn.

## Nhịp — đụng vào là hỏng video

| Slide | Bố cục | `.slide-element` | Câu script |
|---|---|---|---|
| 1 | Bìa: nhãn, tên doanh nghiệp, câu định vị; ảnh ở lớp nền bên phải | **3** | **1** |
| 2 | Vấn đề: một câu trên khối tối (dừng ở y = 560), số lớn mờ phía sau đếm lên | **1** | **1** |
| 3 | Việc họ làm: ba thẻ ngang có ảnh, xếp theo thời gian | **3** | **3** |
| 4 | Số liệu 1: cột "trước" rồi cột "sau" + chữ gọi, trích sách gốc 1915 bên phải | **2** | **2** |
| 5 | Số liệu 2: như slide 4, thêm khung bằng chứng bên phải | **2** | **2** |
| 6 | Vì sao hiệu quả: hai gạch đầu dòng + ảnh | **2** | **2** |
| 7 | Bài học: khối navy + ba bước làm được ngay | **2** | **2** |

⚠ **Slide 1 là ngoại lệ 3 phần tử / 1 câu** — `app.js` mẫu ngang hiện hết
slide đầu ngay lúc nạp. Và vì thế slide 1 **bắt buộc đúng 1 câu**: câu thứ hai
sẽ làm chuyển slide sớm (`validate_slide.py` bắt lỗi này).

⚠ **Slide 2 KHÔNG được miễn** — nằm giữa deck, đúng 1 phần tử / 1 câu.

⚠ **Tiêu đề phía trên slide 3–6 KHÔNG phải phần tử.** Nó hiện ngay khi vào
slide, cùng lúc với phần tử đầu tiên. Đừng thêm lớp `slide-element` cho nó.

⚠ **Số viết bằng chữ trong script.** Bộ tách câu cắt theo dấu chấm: "2.011.125"
thành ba câu, "12.5" thành hai. Trên màn hình thì cứ để chữ số.

## Biểu đồ: chiều cao cột và số chạy lên

* Chiều cao cột = `--cao` (0–1) × `--cot-toi-da` (188px). `--cao` = giá trị /
  giá trị lớn nhất, làm tròn bốn chữ số (vd 93 ÷ 748 = 0.1243) — **tính bằng
  máy tính rồi dán**, ước bằng mắt là cột lệch số.
* Số chạy lên **thuần CSS**: `@property` khai biến kiểu `<integer>`, trình duyệt
  nội suy nó, `counter()` in ra thành chữ. Số đích khai trên thẻ: `--so-toi`
  (phần nguyên), `--le-toi` (một chữ số thập phân, vd 12,5). Không đụng
  `app.js` dùng chung.
* Cột và số chạy **cùng 1,2s** để số tới đích đúng lúc cột mọc xong. Chữ gọi
  (×8, −62%) hiện sau 0,75s — mắt thấy cột trước rồi mới đọc kết luận.
* Cột "sau" và chữ gọi nằm **CHUNG một phần tử**. Tách ra là chữ gọi hiện sẵn từ
  đầu slide, lộ kết quả trước khi giọng đọc nói tới.
* Khung bằng chứng (slide 4, 5) là phần TĨNH, hiện từ đầu slide. Nó được chứa
  con số "sau" ở dạng **nguyên văn tài liệu, chữ nhỏ** (trang sách 1915 có
  "1 hour 33 minutes") — nhưng **không được tô đậm hay phóng to** con số đó:
  phóng to là lộ kết quả trước câu thứ hai. Dải phóng to ở slide 5 chỉ phóng
  phần giá "trước".

## Nền trắng: phụ đề phải là mực đậm

`visuals.colorMode` = `cream` (bộ máy chỉ nhận `dark`/`cream`; mẫu tự khai nền
trắng trong CSS), `subtitles.color` = `#0f1b2e`. Mặc định của bộ ghi là trắng —
trên nền trắng là mất sạch phụ đề.

⚠⚠ **PHỤ ĐỀ LÀ MỘT MÀU CHO CẢ VIDEO — nên dải y > 560 của MỌI slide phải sáng.**
Ảnh bìa và khối tối của slide 2 đều **dừng ở y = 560**. Bản đầu để slide 2 tối
kín khung: khung hình thật trích từ video cho thấy phụ đề navy trên nền navy,
tương phản **1,0:1**, biến mất suốt 6,7 giây — trong khi mọi bộ soát bố cục
đều ĐẠT. Thêm slide nền tối thì cũng dừng khối tối ở 560.

## Bẫy đã dính khi dựng mẫu này

1. **`@property` ĐĂNG KÝ TÊN BIẾN CHO TOÀN TRANG.** Bản đầu đặt tên biến đếm
   là `--le` (phần lẻ) — trùng biến LỀ `--le: 76px`. "76px" không hợp kiểu
   `<integer>` nên bị ép về 0, và **mọi slide mất lề trái-phải**, chữ dính sát
   mép. `validate_slide.py` không bắt được vì nó chỉ đo chiều dọc. Biến đếm giờ
   có tiền tố `--dem-` riêng.
2. **Chữ gọi nằm ngoài phần tử = lộ kết quả sớm.** Xem mục biểu đồ.
3. **Mất lề kéo theo tràn dải an toàn.** Thẻ rộng ra thì ảnh cao lên, và slide 3
   tràn 2,36px. Sửa lề là hết tràn — đừng vội hạ chữ khi số đo lạ.
4. **So giá khác loại xe.** Cặp "$850 → $260" hay được trích là hai loại xe
   khác nhau. Xem `source/source.md`.
5. **"Giờ công" không phải thời gian trôi qua.** Ghi rõ đơn vị ngay trên slide.
6. **Phụ đề biến mất trên slide tối** — chỉ lộ ra ở khung hình thật. Xem mục
   phụ đề ở trên.
7. **Tin OCR là đọc nhầm số.** Bản chữ nhận dạng của sách 1915 ghi "1,219",
   bản quét in "1,212". Luôn đọc con số trên ảnh quét.
8. **Nguồn gốc cũng có thể tự mâu thuẫn**: sách ghi 12 giờ 28 phút rồi viết
   "728 phút" (đúng ra 748). Chọn kết luận đúng với cả hai số (×8), và ghi lại
   trong `source/source.md`.

## Bộ soát

```
.venv/bin/python validate_slide.py slide/<project> --semantic-report
```

⚠ **Bộ soát báo ĐẠT không có nghĩa là nhìn được.** Nó chỉ đo chiều dọc và hộp
của phần tử: lề trái-phải mất sạch vẫn ĐẠT, phụ đề tàng hình vẫn ĐẠT. Luôn:

1. chụp cả dải slide **sau khi số đã đếm xong** (~2 giây);
2. sau khi dựng, **trích khung hình thật từ `demo.mp4`** — mở video trong trình
   duyệt, tua tới giữa từng slide, chụp. Phụ đề được đốt vào video nên chỉ ở
   đây mới thấy nó đè lên nền thế nào. (`ffmpeg` đi kèm app không có bộ mã hoá
   ảnh nào, kể cả rawvideo, nên không trích bằng nó được.)
