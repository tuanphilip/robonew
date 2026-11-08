# DS-04 · Đối thoại hai bên — luật của mẫu

Khung **ngang 16:9**. Sáu slide. Nền chia đôi bằng một đường dọc mảnh ở giữa:
nửa trái tông **lạnh** là phe A, nửa phải tông **ấm** là phe B. Bên nào đang
nói thì sáng hơn.

⚠ Khác `DS-03` Hồ sơ & trích dẫn: cái kia là chân dung tĩnh MỘT người, cái này
là đối đáp QUA LẠI giữa hai bên.

## Nhịp — đụng vào là hỏng video

| Slide | Bố cục | `.slide-element` | Câu script |
|---|---|---|---|
| 1 | Chủ đề đặt giữa, chân dung hai phe hai bên | **3** | **1** |
| 2–5 | Một vòng: phe A (trái) lập luận, phe B (phải) phản biện | **2** | **2** |
| 6 | Điểm chung của hai bên | **2** | **2** |

⚠ **Slide 1 là ngoại lệ 3 phần tử / 1 câu** — `app.js` mẫu ngang hiện hết
slide đầu ngay lúc nạp. Nên slide 1 **bắt buộc đúng 1 câu**.

⚠ **Mỗi vòng: câu 1 = phe A, câu 2 = phe B.** Đảo thứ tự là thẻ sáng lên không
khớp với người đang được đọc.

⚠ **Nhãn vòng không phải phần tử** — hiện ngay khi vào slide.

⚠ **Số viết bằng chữ trong script.**

## Bên đang nói sáng hơn — không cần JavaScript

Viết bằng `:has()` trong `style.css`:

* phe A hiện → nửa nền trái sáng;
* phe B hiện → nửa nền phải sáng thay, và thẻ phe A **lùi mờ còn 34%**.

⚠ Bộ chọn `.slide:has(.ben-b.visible) .ben-a.visible` có độ ưu tiên (0,5,0) để
thắng `.slide-element.visible` (0,2,0). Đừng rút gọn.

Mỗi thẻ bước vào **từ phía của mình** (trái trượt từ trái, phải từ phải).

**Dấu hiệu ĐANG NÓI**: ba vạch sóng âm nhảy theo nhịp ở góc thẻ — CHỈ ở thẻ
đang nói. Phe B hiện thì vạch của phe A tắt. Độ sáng thôi thì người xem phải so
hai bên mới biết ai đang nói; sóng âm là biết ngay.

**Số lớn đếm lên** khi thẻ hiện (110 V, 800 m, 121 trạm) — cùng kỹ thuật
`@property` của KD-01, tên biến có tiền tố `--dem-` để không trùng biến bố cục.

**Slide điểm chung**: nền hai tông HOÀ vào nhau ở giữa; khi câu thứ hai nói ra
điểm chung, đường dọc TAN hẳn và hai nửa cùng sáng.

## Vị trí

* Đường dọc ở **chính giữa khung** (x = 616) — trục đối xứng của cả mẫu.
  Slide 1 cho nó bắt đầu dưới tiêu đề; slide 6 cho nó mờ đi (hai bên gặp nhau).
* ⚠ **Các vòng NEO LÊN TRÊN** (`flex-start`, đệm trên 124px), không căn giữa.
  Căn giữa thì vòng nào chữ xuống dòng là nhãn vòng nhảy ~10px khi chuyển
  vòng. 124px là đỉnh của vòng cao nhất khi căn giữa.
* Tiêu đề slide 1 viết **"DC hay AC?"** — phe viết TRƯỚC là phe đứng BÊN TRÁI.
  Viết ngược lại là chữ và hình chỉ hai hướng khác nhau.

## Hai nửa đều tối — phụ đề mực sáng

`visuals.colorMode` = `dark`, `subtitles.color` = `#c8c1b8`, `activeColor` =
`#ffffff`. **Chữ đang đọc trắng trung tính** — tô màu lạnh hay ấm là ngả về một
phe. ⚠ Nhưng màu chữ thường phải NHẠT HƠN trắng một bậc: bản đầu để `#f2ede7`
với `#ffffff` — gần trùng nhau, hiệu ứng karaoke biến mất hẳn trong video.

⚠ Màu phụ đề là MỘT màu cho cả video. Đổi một nửa nền sang sáng là phụ đề
chết ở nửa đó (xem bẫy ở KD-01).

## Hình ảnh

* **Chọn chân dung theo hướng nhìn**: người bên trái nhìn sang phải, người bên
  phải nhìn sang trái — cả hai nhìn vào giữa, về phía nhau. **Không lật ngược
  ảnh tư liệu** để chữa hướng; đổi ảnh khác.
* **Cân hai bên**: vòng nào một bên có ảnh thì ưu tiên bên kia là số lớn.
* **Lập trường, không phải trích dẫn**: không đặt ngoặc kép vào miệng ai khi
  không có lời nói thật được ghi lại.

## Bẫy đã dính khi dựng mẫu này

1. **Ảnh Edison đúng thời kỳ nhất nhìn ra mép khung** → đổi ảnh, không lật.
2. **Một ảnh "Edison khoảng 1878" là Edison lúc già** — tên sai, ngày ghi là
   ngày tải lên. Mở ra nhìn mới thấy.
3. **Nhãn vòng nhảy vị trí** giữa các vòng vì căn giữa — xem mục vị trí.
4. **Tiêu đề thẻ lặp đúng con số in to bên dưới** ("121 trạm" hai lần) — tiêu
   đề phải nói điều khác với bằng chứng.
5. **`text-wrap: balance` cắt "tới mọi / nhà"** — câu có ý phải ngắt bằng
   `<br />` đặt tay, và khi đã có `<br />` thì bỏ `balance`.
6. **Một câu vượt dữ kiện**: bản nháp ghi "có mặt ở hàng trăm thành phố" cho
   121 trạm — 121 trạm không có nghĩa là hàng trăm thành phố. Đã đổi. Lượt soát
   lại gỡ thêm "phủ khắp nước Mỹ" và "một nhà máy thay cả trăm trạm".
7. **Bộ chọn chung theo thẻ bắt luôn phần tử thêm sau.** `.ben-dau span` (cho
   nhãn phe) biến sóng âm thành một cột gạch dọc; `.bc-so span` (cho chú thích)
   làm số đếm teo còn 12px. Viết `div > span`, `.bc-so > span`.
8. **`text-wrap: balance` ngắt ở dấu gạch nối** — "mô- / tơ". Bọc từ có gạch nối
   bằng `<span class="lien">` (`white-space: nowrap`) — thêm từ mới có gạch
   nối là phải bọc tay.
9. **Giữ chỗ bằng `ch` sai với chữ số đậm**: `min-width: 3ch` rộng hơn ba chữ
   số tabular đậm 900, để lại khoảng hở "≈   800 m". Đã bỏ.

## Bộ soát

```
.venv/bin/python validate_slide.py slide/<project> --semantic-report
```

⚠ Bộ soát ĐẠT không có nghĩa là nhìn được. Chụp cả dải slide, và sau khi dựng
thì trích vài khung hình thật từ `demo.mp4` (mở trong trình duyệt, tua, chụp)
— hiệu ứng "bên đang nói sáng hơn" chỉ thấy đúng ở khung hình giữa câu thứ hai.
