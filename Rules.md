# DISA Travel — vận hành dự án và handover context

Tài liệu này là quy ước làm việc và context đã xác nhận trong session. Đọc trước khi merge, deploy hoặc build mobile.

## 1. Repository và trạng thái branch

- Repository: `https://github.com/Herita-Corporation/EXE.git`
- Branch deploy mặc định: `main`.
- Branch phát triển Google Sign-In hiện tại: `tunkit`.
- Commit Google Sign-In trên `tunkit`:
  - `5579b56 feat: add Google sign-in flow`
  - `a01d74c config: add Google OAuth client IDs`
- `main` đã từng được rollback về `84f0041` (`Merge branch 'ditan' into main`), là first parent ngay trước merge `73f383f Merge branch 'dev' into main`.
- Không giả định local `main` luôn mới nhất. Luôn `git fetch origin` và kiểm tra `git status -sb` trước khi làm việc.

### Quy trình làm việc với Git

```powershell
# Kiểm tra trước khi thay đổi
git status -sb
git fetch origin
git log --oneline --decorate -10 origin/main

# Làm tính năng trên branch riêng
git switch main
git pull --ff-only origin main
git switch -c <feature-branch>

# Sau khi kiểm thử xong
git add <các-file-cần-commit>
git commit -m "<type>: <mô tả ngắn>"
git push -u origin <feature-branch>
```

Không commit `.env`, file PEM/keystore, mật khẩu, token Expo/EAS hay Client Secret.

### Merge vào main

Trước merge, phải đọc diff và kiểm thử. Ưu tiên merge qua Pull Request. Nếu merge bằng local:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git merge --no-ff origin/<feature-branch>
git push origin main
```

Nếu cần rollback một merge commit, xác định **first parent** rồi mới reset:

```powershell
git rev-list --parents -n 1 <merge-commit>
# parent đầu tiên là trạng thái main ngay trước merge
git switch main
git reset --hard <first-parent>
git push --force-with-lease origin main
```

`reset --hard` + force push làm thay đổi lịch sử remote; chỉ dùng khi đã được chủ dự án chấp thuận.

## 2. Cấu trúc chính

- `Front-End/`: Expo / React Native, dùng Expo Router.
- `Disa-App/`: các backend .NET, gồm `IAMService`, `AITour`, `Task`.
- `AI-Itinerary/`: service sinh lịch trình.
- `docker-compose.prod.yml`: cấu hình deploy production.
- `static-pages/downloads/`: nơi host file APK trên server.

## 3. Production AWS / EC2

- AWS region: `ap-southeast-1`.
- EC2 instance ID: `i-0f875e95e5d2f2786`.
- SSH host: `ec2-54-251-107-214.ap-southeast-1.compute.amazonaws.com`.
- SSH user: `ubuntu`.
- Repository trên EC2: `/home/ubuntu/EXE`.
- APK public URL: `https://disatravel.id.vn/downloads/DisaTravel.apk`.
- APK production path: `/home/ubuntu/EXE/static-pages/downloads/DisaTravel.apk` (cần kiểm tra lại trên server trước thao tác ghi/đè).

Không đưa path private key SSH, mật khẩu, hoặc nội dung `/home/ubuntu/EXE/.env` vào Git hay tài liệu công khai.

### Deploy backend

Chỉ deploy sau khi `origin/main` đã đúng commit muốn phát hành. Trên EC2:

```bash
cd /home/ubuntu/EXE
git fetch origin
git status --short --branch
git log -1 --oneline origin/main
git reset --hard origin/main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

- Không xóa `static-pages/downloads/`: thư mục này có thể untracked nhưng chứa APK đang public.
- Sau deploy, xác minh commit: `git log -1 --oneline HEAD`.
- Xác minh container: IAM, AITour, Task, AI Itinerary, SQL Server, PostgreSQL phải chạy; AI Itinerary/PostgreSQL cần trạng thái `healthy` khi có health check.
- Nếu build đầy đủ lâu hơn giới hạn SSH, chạy `docker compose ... up -d --build` nền, ghi log tạm, sau đó kiểm tra `docker compose ... ps` và `docker logs`.

## 4. Build Expo: APK và AAB

Thư mục chạy lệnh: `Front-End/`.

- Expo/EAS owner: `disa-travel`.
- EAS project ID: `dceb64b3-b47b-4c32-ac03-9c37ff2578ab`.
- APK profile: `preview` (internal distribution, `buildType: apk`).
- AAB profile: `production`.

Trước build:

```powershell
cd Front-End
npm.cmd ci
npx.cmd tsc --noEmit
npx.cmd eas whoami
```

Build APK:

```powershell
npx.cmd eas build --platform android --profile preview
```

Build AAB:

```powershell
npx.cmd eas build --platform android --profile production
```

- Production profile có `autoIncrement: true`; kiểm tra version/versionCode trên EAS trước khi upload Play Console.
- Không tự submit lên Google Play qua EAS; việc upload AAB/rollout hiện do người quản trị Play Console thực hiện.
- Đợi EAS build hoàn tất, tải APK từ build artifact, sau đó mới cập nhật link tải APK.

### Cập nhật APK tại link public

1. Tải APK artifact từ EAS về local và kiểm tra tên/kích thước.
2. SSH lên EC2, kiểm tra target thực tế và backup APK đang dùng.
3. Giữ một backup với tên `DisaTravel-previous.apk`.
4. Đưa APK mới vào đúng thư mục hosting với tên `DisaTravel.apk`.
5. Kiểm tra HTTP URL `https://disatravel.id.vn/downloads/DisaTravel.apk` và tải lại file để xác nhận đúng bản mới.

Ví dụ logic server (điều chỉnh đường dẫn thực tế trước khi chạy):

```bash
cd /home/ubuntu/EXE/static-pages/downloads
cp DisaTravel.apk DisaTravel-previous.apk
# upload DisaTravel.apk mới bằng scp/SFTP, sau đó xác minh ls -lh và checksum
```

Không xóa bản cũ trước khi bản mới đã upload và kiểm tra thành công.

## 5. Google Sign-In

### Mã nguồn hiện có trên `tunkit`

- UI/nút Google: `Front-End/app/(auth)/login.tsx`.
- Expo OAuth: `expo-auth-session`, `expo-web-browser`.
- API frontend: `POST /api/auth/google-login` trong `Front-End/src/api/endpoints/auth.ts`.
- Quản lý phiên dùng lại `AuthContext` và token store hiện có.
- Backend: `Disa-App/IAMService/Controllers/AuthController.cs` xác thực Google ID token.
- Backend tự tạo customer mới khi Google email chưa tồn tại; nếu email đã tồn tại nhưng chưa link Google, API trả `409 Conflict`.
- Schema IAM cần cột `GoogleId`. Các commit sửa schema/startup repair liên quan: `93dc505`, `c2e297b`, `09f4d5d`.

### Client IDs đã tạo

Các Client ID là định danh công khai; **không** thêm OAuth Client Secret vào app hay repository.

| Mục đích | Client ID |
| --- | --- |
| Web/backend | `506948056952-rtv6uch08hspdkor2bt313mi6mfvrdco.apps.googleusercontent.com` |
| Android EAS/Direct APK | `506948056952-bvv50gogt7hfudeu8pll5dkdbthln02r.apps.googleusercontent.com` |
| Android Google Play | `506948056952-5uoaa2n5sdqv1kpbv8ipqnt7p6gcckm6.apps.googleusercontent.com` |

Quy ước cấu hình:

- `preview` trong `Front-End/eas.json`: dùng Web ID + Android EAS/Direct APK ID.
- `production` trong `Front-End/eas.json`: dùng Web ID + Android Google Play ID.
- IAM Service phải chấp nhận **cả ba** audience qua `GoogleAuth:ClientIds`.
- `docker-compose.prod.yml` cho phép override bằng các biến EC2 `.env`:
  - `GOOGLE_WEB_CLIENT_ID`
  - `GOOGLE_ANDROID_CLIENT_ID`
  - `GOOGLE_ANDROID_PLAY_CLIENT_ID`
  - `GOOGLE_IOS_CLIENT_ID` (để trống nếu chưa phát hành iOS)

### Điều kiện trước khi phát hành Google Sign-In

1. Google OAuth consent screen đã hoàn tất; nếu đang Testing, email kiểm thử phải có trong Test users.
2. Các Android OAuth client dùng package `com.disa.travel.frontend`.
3. Android EAS client dùng SHA-1 của signing certificate EAS.
4. Android Play client dùng SHA-1 **App signing key** tại Play Console → App integrity, không dùng Upload key.
5. Merge/cherry-pick phần backend Google Sign-In sang `main` trước khi deploy; `main` rollback `84f0041` không có endpoint `/api/auth/google-login`.
6. Deploy IAM Service trước khi phát hành APK/AAB Google-enabled.
7. Test account Google mới, đăng nhập lại, hủy OAuth, token lỗi/hết hạn, email trùng và tài khoản bị vô hiệu hóa.

## 6. Kiểm thử bắt buộc

```powershell
# Frontend
cd Front-End
npx.cmd tsc --noEmit

# IAM backend
cd ..\Disa-App
dotnet build IAMService/IAM.Presentation.csproj -c Release --no-restore
```

`expo lint` có thể cố tự cấu hình ESLint/lỗi truy cập mạng trong môi trường local. Không coi đây là lỗi sản phẩm nếu TypeScript build thành công; xử lý cấu hình lint riêng khi cần.

## 7. Checklist phát hành đầy đủ

- [ ] `git fetch origin`, kiểm tra branch/commit đúng.
- [ ] Review diff và chạy build/test phù hợp.
- [ ] Commit/push branch tính năng.
- [ ] Merge hoặc cherry-pick có chủ đích vào `main`.
- [ ] Push `main` và kiểm tra `origin/main`.
- [ ] Deploy EC2 từ đúng `origin/main`.
- [ ] Kiểm tra container và endpoint production.
- [ ] Build `preview` APK nếu cần link tải trực tiếp.
- [ ] Backup APK cũ, thay APK server, kiểm tra URL public.
- [ ] Build `production` AAB, tự upload/rollout trên Play Console.
- [ ] Test bản cài thực tế (APK direct và bản từ Google Play là hai chữ ký khác nhau).
