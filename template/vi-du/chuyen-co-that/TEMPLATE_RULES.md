# KC-02 · Chuyện có thật

Sáu chặng kể: móc → bối cảnh → diễn biến → công trình → **cú lật** → đọng lại.
Hợp chuyện có thật, chuyện nghề, biến cố, bài học đắt giá.

## Ba khối cho mỗi chặng — đúng thứ tự, đừng đổi

1. `.kc-canh` — sợi chỉ + hình + tên chặng
2. `.kc-loi` — lời kể
3. `.kc-so-hop` — một chi tiết **có số**

Slide cú lật mang thêm lớp `kc-lat` trên chính thẻ `.slide`.

## Ba thứ làm nên mẫu này

**1. Mỗi chặng một CẢNH, không phải một icon.** Kể chuyện mà chỉ có chữ thì
người xem phải tự dựng hình trong đầu — trên điện thoại, giữa lúc lướt, họ
không làm việc đó.

Cảnh vẽ trong khung **ngang** 232×114, viewBox `0 0 160 92`, mặt đất ở `y=78`.

⚠ **Vẽ NGANG ra, đừng vẽ CAO lên.** Khung 390 rộng nên bề ngang gần như miễn
phí, còn mỗi px chiều cao đều trừ thẳng vào vùng an toàn.

⚠ **Chuyện về một con người thì phải có bóng người trong hình.** Đây là thứ
kéo mẫu ra khỏi cảm giác khô khan nhanh nhất. Ở chặng công trình còn đặt một
người **rất nhỏ** đứng cạnh toà nhà — không có nó thì "26 m" chỉ là một con số.

⚠ **Tương phản LẠNH/ẤM.** Thế giới (mặt đất, con đường, đêm, người qua đường)
vẽ bằng `--accent-light` lạnh; nhân vật và thứ người đó làm ra vẽ bằng
`--primary` ấm. Một màu ở ba mức alpha thì không có gì để mắt bám vào.

**2. Sợi chỉ nét đứt nối các chặng**, và **chỉ đứt ở đúng chặng cú lật**. Nó
báo bước ngoặt bằng hình thay vì bằng chữ. Đứt ở chặng khác là mất hẳn ý nghĩa.

**3. Mỗi chặng một chi tiết CÓ SỐ.** Số giữ cho chuyện khỏi trôi thành cảm xúc
suông — người nghe bám vào một con số cụ thể để tin phần còn lại.

## Viết lời

⚠ **Xuống dòng ở đây KHÔNG phải do `<br/>`.** Engine đặt
`.slide-element { display: flex; flex-direction: column; gap: 10px }`, nên mỗi
mảnh chữ và mỗi thẻ `<b>` trong lời kể bị đẩy thành **một hàng riêng**. Đó mới
là thứ tạo ra nhịp hai dòng của mẫu này. Đo 23/9/2026: bỏ hết thẻ `<br>` đi thì
chiều cao không đổi một pixel.

Nên muốn tách nhịp thì **bọc cụm đó trong một thẻ** (`<b>` hoặc `<span>`), chứ
chèn `<br/>` vào giữa một thẻ thì không có tác dụng gì.

⚠ Cũng vì vậy mà `text-wrap: balance` vô nghĩa ở đây: mỗi hàng là một khối
riêng, không có gì để cân giữa chúng.
⚠ **Kết KHÔNG rút bài học hộ người xem.** Đặt xuống một sự thật cuối cùng rồi
dừng. Thêm câu "bài học là…" vào đây là hỏng nhịp.

⚠ **Mọi mốc thời gian, con số, tên riêng phải dẫn được về một nguồn**, và ghi
nguồn vào `source/source.md`. Thể loại này sống bằng chữ thật — một chi tiết
bịa lọt vào là mất cả video.

## Thêm phần tử mà không làm lệch bộ soát

Số `.slide-element` của một slide phải bằng số câu của dòng script. Muốn thêm
chi tiết nhìn (nhãn `.kc-nhan` ở slide móc, dòng tổng kết `.kc-tong` ở slide
cuối) thì đặt nó **bên trong** một `.slide-element` sẵn có, đừng thêm một
`.slide-element` mới.

## Chuyển động: chỉ `transform` và `opacity`

Hai thứ này không đụng bố cục nên phép đo vùng an toàn vẫn ra đúng số. Hoạt
cảnh bằng `width`/`height` thì bộ soát đo trúng khung hình đang dở và báo sai.

## Mặc định chung — giữ nguyên trừ khi được yêu cầu khác

- `preview-settings.json` phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`.
- Nhạc nền: tệp riêng `preview-assets/bgm/meta.mp3`.
- Tắt lưới căn.
- Safezone TikTok cho nội dung slide: `100px 26px 200px`.

## Ba nơi phải khớp từng chữ

Lời thoại nằm ở **ba** nơi. Lệch một chữ là bộ soát báo lỗi:

1. `script-90s.txt`
2. `slideScripts` trong `app.js`
3. `slides.scriptLines` trong `preview-settings.json`

## Số câu phải bằng số `.slide-element`

Bộ soát tách câu theo `(?<=[.!?])\s+`.

⚠ **Đừng viết số bằng chữ số trong script.** `200.000` bị tính thành **hai**
câu vì có dấu chấm. Trong script thì đọc thành chữ; chữ số chỉ để **trên màn
hình**.

## Soát trước khi coi là xong

```
python validate_slide.py slide/<ten-deck> --expected-slides <N>
```
