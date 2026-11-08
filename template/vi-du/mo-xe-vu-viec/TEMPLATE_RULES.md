# KC-01 · Mổ xẻ một vụ việc — luật của mẫu

Khung **ngang 16:9**. Bảy slide. Nền xám than có vân giấy báo, tông nhấn đỏ rượu.

## Nhịp — đụng vào là hỏng video

| Slide | Bố cục | `.slide-element` | Câu script |
|---|---|---|---|
| 1 | Bìa: tên vụ việc lệch trái, ảnh tư liệu phủ nền, dòng ngày chụp ở góc | **3** | **1** |
| 2 | Bối cảnh: khối địa danh ba ô + ảnh và chữ | **2** | **2** |
| 3–5 | Dòng thời gian: thanh mốc + ảnh và chữ | **2** | **2** |
| 6 | Bước ngoặt: một câu, nền tối hẳn | **1** | **1** |
| 7 | Còn lại gì: tiêu đề + ba gạch đầu dòng và hình mặt cắt 1940/1950 | **2** | **2** |

⚠ **Slide 1 là ngoại lệ 3 phần tử / 1 câu.** Bảng nhịp (`HOOK_SENTENCE_COUNTS`
trong `python/timeline.py`) gộp mọi phần tử của slide đầu vào một cú bấm **khi
và chỉ khi slide đó có đúng một câu**. Viết hai câu cho slide 1 là lệch ngay.

⚠ **Slide 6 không được miễn.** Nó nằm giữa deck nên phải đúng **1 phần tử / 1
câu**. Đó cũng là chủ ý của bố cục: cả màn chỉ còn một câu để nhớ.

⚠ **Số viết bằng chữ trong script.** Bộ tách câu là `(?<=[.!?])\s+`, nên
`853` không sao nhưng `11.000` bị đếm thành **hai câu**. Trên màn hình thì cứ
để chữ số.

## Khung ngang khác khung dọc ở đâu

* Khổ do thẻ `<meta name="bee-khung" content="ngang">` quyết định. **Thẻ nằm
  trong chú thích HTML là không tính** — mất thẻ thì deck rơi về dọc 9:16.
* Khung **1232×693** → quay ra **1920×1080**.
* `style.css` của mẫu ngang **tự chứa**, không nối vào bộ máy dọc. Nghĩa là
  không dính bẫy flex kế thừa, nhưng cũng nghĩa là **phải tự khai
  `.slide-element`**.
* `app.js` mẫu ngang **không có `slideScripts`** — lời thoại chỉ ở
  `script-90s.txt`. `validate_slide.py` tự nhận khổ ngang và đọc từ đó.
  ⚠ **Đừng thêm mảng `slideScripts`** vào `app.js` cho qua bộ soát.

## Dải an toàn

`[100, 493]` trên khung 693, khai bằng `padding` của `.than`
(`100px … 200px`). Phần 200px dưới **là chỗ của phụ đề** — thấy trống ở đó là
đúng, đừng nhồi nội dung vào.

## Nền tối: phụ đề phải là mực sáng

`visuals.colorMode` = `dark`, `subtitles.color` = `#ece6dd`. Mặc định của bộ
máy là `#ffffff` nên cũng đọc được, nhưng mẫu khai rõ để **ai đổi sang nền
sáng thì thấy ngay chỗ phải sửa** — chữ trắng trên nền kem là mất hút.

## Bẫy đã dính khi dựng mẫu này

1. **Ảnh tư liệu lịch sử phải soi biểu tượng chính trị, không chỉ soi giấy
   phép.** Bộ ảnh Hindenburg đủ điều kiện phạm vi công cộng nhưng có chữ thập
   ngoặc trên vây đuôi → bỏ cả vụ việc. Xem `source/source.md`.
2. **Ghi công phải đọc từ chú thích gốc.** Hai khung phim ngày 7/11/1940 dùng ở
   đây là phim của **F. B. Farquharson**, không phải Barney Elliott — dù Elliott
   là cái tên hay gắn với sự kiện này nhất.
3. **Cột ảnh chốt cứng 376px, đừng để `1fr`.** Để `1fr` thì ảnh cao theo tỉ lệ
   khung và đẩy khối vượt dải an toàn (đúng lỗi đã dính ở GD-06).
4. **`align-items: center` chứ không `start`** cho `.moc-than` và `.bc-than`.
   Khối chữ luôn thấp hơn ảnh; để `start` là hở một mảng trống góc dưới phải và
   slide đọc ra như bị thiếu nội dung.
5. **Mốc mờ không được mờ quá.** Trên nền xám than, dưới `opacity: 0.4` là hai
   mốc kia tắt hẳn, mất luôn tác dụng cho người xem biết mình đang ở đâu.
6. **`text-wrap: balance` không cân được qua `<br />` đặt tay.** Câu ở slide 6
   ngắt cứng sau dấu phẩy để không cắt đôi mệnh đề, nên đã bỏ `balance`.
7. **Bộ đếm phần tử phải bỏ chú thích HTML trước khi đếm.** Chú thích của slide
   sau nằm trong khúc của slide trước, và chú thích có nhắc chữ
   `.slide-element` → đếm thừa đều mọi slide.
8. **Ảnh "cùng tên công trình" có thể là công trình DỰNG LẠI — đọc ngày chụp.**
   Bản đầu dùng làm bìa một ảnh HAER tên *"Tacoma Narrows Bridge in
   perspective…"*, không ghi năm. Ngày chụp trong API: **1993** — tức là cây cầu
   thông xe năm 1950, không phải cây cầu đã sập. Lỗi đó đã lọt vào cả video mẫu.
   Giờ bìa có dòng *"Ảnh chụp 29·8·1940"* để ai thay ảnh cũng buộc phải tra ngày.
9. **Thanh mốc neo `flex-start`, không `center`.** Căn giữa thì vị trí thanh phụ
   thuộc chiều cao khối dưới: một chú thích ảnh dài thêm một dòng là thanh nhảy
   ~8px khi chuyển mốc. Và **chú thích ảnh giữ vừa một dòng**.
10. **Tâm chấm mốc nằm ở 0 / 0,338 / 0,675 bề ngang ray, KHÔNG phải 0 / ⅓ / ⅔** —
    chấm ở đầu mỗi cột, ray lệch vào 6px. Công thức cho mốc thứ k (k = 0, 1, 2):
    **(k × W ÷ 3 + 0,5) ÷ (W − 12)**, với W = bề rộng thanh = 1080px (khung 1232
    trừ lề 76 mỗi bên). Đổi `--le` hay số cột là phải tính lại. Đo sau khi hiệu
    ứng xong: lệch ±0,5px.
11. **Nét gạch chân ở slide 6 chạy theo giọng đọc.** `--tre-ngoat: 2.2s` là lúc
    câu mẫu (4,43s) tới dấu phẩy. Đổi câu thì đo lại bằng `output/timing.json`.
12. **Soát TRẠNG THÁI CUỐI, không chỉ một khung giữa chừng.** Dải ảnh chụp sau
    700ms bắt được ray tô đỏ mới đi 2/3 đường và chấm mốc còn thu nhỏ chờ — nhìn
    y như lỗi. Chụp lại sau 3 giây mới biết ray dừng đúng tâm chấm.

## Bộ soát

```
.venv/bin/python validate_slide.py slide/<project> --semantic-report
```

Bộ soát tự nhận khổ ngang, kiểm ánh xạ câu ↔ phần tử (kể cả luật slide đầu
đúng 1 câu) và đo vùng an toàn trên khung thật 1232×693.

⚠ **Bộ soát báo ĐẠT không có nghĩa là nhìn được.** Nó đo HỘP của phần tử, nên
một khối kẹt ở `opacity: 0` vì viết nhầm dấu cách trong bộ chọn vẫn ĐẠT. Luôn
chụp cả dải slide ra xem bằng mắt — ảnh tối thành vệt đen, chữ ngắt dòng xấu,
khối lệch trọng tâm đều lọt qua bộ soát.
