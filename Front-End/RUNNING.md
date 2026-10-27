# Cách khởi chạy — Disa Travel Front-End

## 1. Cài đặt

```bash
cd Front-End
npm install
npx expo install --fix     # đồng bộ thư viện với phiên bản Expo SDK của dự án
```

## 2. Cấu hình địa chỉ API

```bash
cp .env.example .env
```

Mở `.env` và sửa các URL trỏ về **IP LAN của máy tính** (không dùng
`localhost`) — vì Expo Go chạy trên điện thoại thật, `localhost` trên điện
thoại sẽ trỏ về chính điện thoại chứ không phải máy tính đang chạy backend.

Lấy IP LAN trên Windows:

```powershell
ipconfig
```

→ lấy IPv4 Address của adapter Wi-Fi (dạng `192.168.x.x`), điền vào `.env`
cho cả 3 service, ví dụ:

```
EXPO_PUBLIC_IAM_URL=http://192.168.1.10:5195
EXPO_PUBLIC_AITOUR_URL=http://192.168.1.10:5289
EXPO_PUBLIC_TASK_URL=http://192.168.1.10:5020
```

**Điện thoại và máy tính phải cùng một mạng Wi-Fi.**

Nếu sau này IP đổi (đổi Wi-Fi, DHCP cấp IP mới…) thì **không cần** sửa
`.env` và khởi động lại — vào thẳng app: **Profile → ⚙ Cấu hình địa chỉ
API**, sửa và bấm "Kiểm tra kết nối" / "Lưu cấu hình".

## 3. Chạy các service backend

Chạy song song, mỗi service một terminal riêng:

| Service | Lệnh chạy | Ghi chú |
|---|---|---|
| `AI-Itinerary` | `uvicorn main:app --reload` (hoặc `docker-compose up`) | Cần Postgres + biến môi trường `OPENAI_API_KEY` |
| `IAMService` | `dotnet run` | Cần connection string SQL Server trong `appsettings.json` |
| `AITourService` (`AITour.Presentation`) | `dotnet run` | Cần `AIItinerary:BaseUrl` trỏ đúng tới nơi AI-Itinerary đang chạy (IP LAN nếu test qua điện thoại) |
| `Task.Presentation` | `dotnet run` | Cần connection string SQL Server |
| `Bahnar-Translator` (tùy chọn — dịch Ba Na → Việt) | xem `../Bahnar-Translator/README.md` | Cần ~8 GB RAM + model tải từ Hugging Face. AITour cần `Translator:BaseUrl` (+ `Translator:ApiKey`) trỏ tới nó. Không chạy thì chỉ màn hình dịch Ba Na báo "chưa khả dụng" |

## 4. Chạy app

```bash
npx expo start
```

Quét mã QR hiện ra bằng app **Expo Go** (Android/iOS).

## 5. Nếu gặp lỗi

- **Expo Go báo SDK không tương thích** → dự án hiện dùng **Expo SDK 58**,
  nên điện thoại cần Expo Go hỗ trợ SDK 58. Sau khi cập nhật code, chạy trong
  đúng thư mục `Front-End`:
  ```powershell
  npm.cmd ci
  npx.cmd expo install --check
  npx.cmd expo start -c
  ```
  `-c` chỉ xóa cache Metro, không nâng SDK. Dùng `npm.cmd`/`npx.cmd` nếu
  PowerShell chặn `npm.ps1`/`npx.ps1`. Development build/APK cần build lại
  khi nâng SDK để đồng bộ phần native.
- **App không kết nối được service nào** → vào Profile → ⚙ API Settings,
  bấm "Kiểm tra kết nối" từng service để biết cái nào sai IP/chưa chạy.
- **Đổi Wi-Fi / đổi máy** → chỉ cần sửa lại trong Settings, không cần build
  lại app.
- **Lỗi `Unable to resolve module`** → xoá cache rồi chạy lại:
  ```bash
  npx expo start -c
  ```

Chi tiết kiến trúc, lý do thiết kế, và quy ước mở rộng code xem tại
[`CLAUDE.md`](./CLAUDE.md).
