# Nguồn — Tiền của bạn (TC-06)

Deck mẫu đi kèm Beeknoee Studio. Ví dụ mẫu: **ly cà phê 25.000 đ mỗi sáng,
để dành suốt 20 năm**. Tra ngày **23/9/2026**.

## ⚠ Phải đọc trước khi dùng lại

Thể loại này nói về **tiền của người khác**. Một con số sai ở đây không chỉ là
sai — nó thành lời hứa, và có người sẽ quyết định theo nó.

Nên mọi con số phải:

1. **Tính được lại từ đầu** bằng một công thức ghi rõ.
2. **Ghi giả thiết ngay trên màn hình**, không giấu trong phần mô tả.
3. **Chọn giả thiết thận trọng.** Deck mẫu dùng lãi 6%/năm trong khi mặt bằng
   kỳ hạn 12 tháng lúc tra cứu là khoảng 6,8–7,2%/năm. Thà ra con số nhỏ hơn
   thực tế còn hơn hứa quá tay.

## Phép tính

Công thức giá trị tương lai của một dòng tiền đều (annuity):

```
FV = P × ((1 + r)^n − 1) / r
```

với `P` = tiền gửi mỗi tháng, `r` = lãi suất **tháng**, `n` = số tháng.

| Đại lượng | Giá trị |
|---|---|
| Giá một ly | 25.000 đ/ngày |
| Một năm | 25.000 × 365 = **9.125.000 đ** |
| Mỗi tháng `P` | 9.125.000 ÷ 12 ≈ **760.417 đ** |
| Lãi suất `r` | 6%/năm ÷ 12 = **0,5%/tháng** |
| Số tháng `n` | 20 × 12 = **240** |

Kết quả:

| Mốc | Tiền mình bỏ vào | Có thêm lãi |
|---|---|---|
| năm 5 | 45,6 triệu | 53,1 triệu |
| năm 10 | 91,2 triệu | 124,6 triệu |
| năm 15 | 136,9 triệu | 221,1 triệu |
| **năm 20** | **182,5 triệu** | **351,3 triệu** |

Tiền lãi sau 20 năm: **169 triệu**, tức gần bằng chính tiền gốc.

⚠ **Chiều cao cột trong biểu đồ tính bằng Python từ chính bảng trên**, không
ước lượng bằng mắt. Đổi số liệu thì phải tính lại chiều cao.

## Nguồn tham khảo

| Chi tiết | Nguồn |
|---|---|
| Mặt bằng lãi suất tiết kiệm kỳ hạn 12 tháng khoảng 6,8–7,2%/năm (9/2026) | Bảng lãi suất các ngân hàng, cập nhật 9/2026 |
| Công thức giá trị tương lai của dòng tiền đều | Công thức tài chính phổ thông |

## Ảnh — nguồn và giấy phép

| Tệp | Tệp gốc trên Commons | Giấy phép |
|---|---|---|
| `anh/ca-phe.jpg` | `File:Vietnamese Hot Drip Coffee - The Big Bowl.jpg` | CC0 |

Ảnh đã **cắt vuông giữa** quanh ly cà phê rồi thu về 560×560 (48 KB). Cắt vuông
lúc chuẩn bị chứ không ỷ vào `object-fit`, vì ảnh hiển thị trong khung bo góc.

⚠ Trong ảnh có cánh tay một người ở hậu cảnh, **không thấy mặt**. Đã cố ý chọn
khung cắt cao hơn để giảm phần người trong hình.

## Lựa chọn biên tập (không phải fact)

- **Chọn ly cà phê chứ không phải một khoản tiết kiệm trừu tượng.** Ai cũng
  uống, nên ai cũng tự tính theo được. Một bài toán về "gửi 2 triệu mỗi tháng"
  thì đúng nhưng không ai thấy mình trong đó.
- **Kết KHÔNG bảo người ta bỏ cà phê.** Mẫu đưa cái giá của một thói quen, còn
  chọn là việc của họ. Dạy đời là mất người xem.
- **So với "cất dưới gối"**, không so với chứng khoán hay vàng. So với cái đơn
  giản nhất thì bài học rõ nhất, và không kéo theo rủi ro phải giải thích thêm.
