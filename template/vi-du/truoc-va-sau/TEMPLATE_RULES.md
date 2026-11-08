# SP-03 · Trước và sau

Sáu slide: móc → trước → đã làm gì → sau → so sánh trực tiếp → lời chốt. Hợp
làm đẹp, sửa nhà, giảm cân, tiến bộ học tập, cải tạo — mọi thứ có hai mốc thời
gian và một quãng giữa.

## Ba thứ làm nên mẫu này

**1. Chia đôi theo chiều NGANG, không chia dọc.** Nửa trên tông xám nguội cho
"trước", nửa dưới tông ấm cho "sau". Nền của mọi slide đều mang cái chuyển tông
dọc khung đó.

⚠ **Chia ngang mới đọc ra "trước rồi sau"; chia dọc chỉ đọc ra "cái này và cái
kia".** Đây là khác biệt duy nhất giữa một mẫu kể được chuyện và một mẫu chỉ
đặt hai thứ cạnh nhau. Slide so sánh xếp hai khối số **chồng lên nhau** với mũi
tên chỉ xuống — đừng đổi thành hai cột.

**2. Hai ảnh phải CÙNG MỘT KHUNG HÌNH.** Cùng góc, cùng tỉ lệ, cùng kích thước
hiển thị. Lệch khung là người xem tưởng hai nơi khác nhau, và toàn bộ sức mạnh
của thể loại nằm ở chỗ họ tin đó là **một** chỗ.

⚠ **Cắt vuông giữa và thu về cùng kích thước ngay lúc chuẩn bị ảnh**, đừng cắt
bằng CSS.

**3. Khúc "ĐÃ LÀM GÌ" ở giữa.** Thiếu nó thì hai tấm ảnh chỉ là một trò ảo
thuật; có nó thì người xem mang được một thứ đi. Ba gạch đầu dòng, đánh số.

## Ảnh trước/sau lấy ở đâu

Với các chủ đề mẫu này sinh ra để phục vụ — làm đẹp, sửa nhà, giảm cân — **ảnh
trước/sau là ảnh của chính bạn**. Đó mới là cách dùng đúng.

⚠ **Đừng lấy ảnh mặt người hay ảnh cơ thể trước/sau của người khác trên mạng.**
Vừa là dữ liệu riêng tư, vừa gần như không bao giờ có giấy phép cho dùng
thương mại.

Cần ảnh minh hoạ cho chủ đề không phải cá nhân (địa điểm, công trình, cảnh
quan) thì tìm ở Wikimedia Commons và **lọc giấy phép bằng API**
(`action=query&prop=imageinfo&iiprop=extmetadata`, đọc `LicenseShortName`), chỉ
lấy `Public domain` hoặc `CC0`. Ghi nguồn từng tấm vào `source/source.md`.

## ⚠ Bẫy engine: flex cài sẵn trên `.slide-element`

Engine đặt ở `style.css` dòng 177:

```
.slide-element { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
```

Bốn thuộc tính đó **không biến mất** khi khai `display: block`, và **rò xuống**
mọi khối con khai lại `display: flex` mà quên khai chúng. Hậu quả trông y như
*thiếu CSS*. Đầu khối CSS của mẫu đã đặt lại cả bốn — giữ nguyên phần đó.

## ⚠ Bẫy chọn nhầm tổ hợp — bộ soát KHÔNG bắt được

Viết `.slide-element.visible .sp-ds li` là đòi `.sp-ds` phải là **con cháu** của
`.slide-element.visible`. Nhưng `.sp-ds` **chính là** cái `.slide-element` đó,
mà một phần tử không phải con cháu của chính nó — nên luật không bao giờ khớp
và `li` kẹt ở `opacity: 0`, tức **cả danh sách biến mất**.

Đúng phải là tổ hợp, không có dấu cách: `.slide-element.visible.sp-ds li`.

⚠ **`validate_slide.py` vẫn báo PASS** khi dính lỗi này: nó thêm `.visible` rồi
đo HỘP của từng phần tử, mà phần tử trong suốt vẫn có hộp đúng kích thước. Chỉ
**nhìn ảnh chụp** mới thấy. Nên chụp deck ra xem, đừng tin mỗi bộ soát.

## Mặc định chung — giữ nguyên trừ khi được yêu cầu khác

- `preview-settings.json` phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`.
- Nhạc nền: tệp riêng `preview-assets/bgm/meta.mp3`.
- Tắt lưới căn. Safezone nội dung: `100px 24px 200px`.
- Cặp màu: `--accent-light` là xám xanh **nguội** cho vế "trước", `--primary` là
  hổ phách **ấm** cho vế "sau". Đổi bảng màu thì phải giữ đúng cặp nguội/ấm đó,
  không thì mất luôn định danh của mẫu.

## Ba nơi phải khớp từng chữ

1. `script-90s.txt`
2. `slideScripts` trong `app.js`
3. `slides.scriptLines` trong `preview-settings.json`

## Số câu phải bằng số `.slide-element`

Bộ soát tách câu theo `(?<=[.!?])\s+`. Mẫu này là **2 / 2 / 3 / 2 / 2 / 2**.

⚠ **Đừng viết số bằng chữ số trong script** — số có dấu chấm bị tính thành hai
câu. Trong script đọc thành chữ; chữ số chỉ để **trên màn hình**.

## Soát trước khi coi là xong

```
python validate_slide.py slide/<ten-deck> --expected-slides 6
```
