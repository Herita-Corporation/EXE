# OC3 dev pilot - triển khai và kiểm thử

Ngày bàn giao: 09/11/2026. Đặc tả nguồn: `outputs/DISA_OC3_App_End_to_End_Schemas_Backend_2026-11-08.md` trong workspace môn học (v1.3).

## 1. Trạng thái: pilot increment, KHÔNG phải hoàn tất toàn bộ đặc tả

Đã triển khai:

- Giữ portal, PartnerProfile, review và invoice của main; tích hợp main vào dev, không thay cấu hình SQL/JWT/SMTP của thành viên.
- Admin nhập profile/content/location thủ công; dùng route review hiện có, publish qua outbox IAM -> snapshot Task có version. Đối tác miễn phí năm đầu, không cần invoice Paid để publish hoặc sử dụng.
- Campaign riêng cho một location, quota tích lũy; một user/campaign chỉ một instance. Claim và xác nhận dùng transaction + SQL application lock + UNIQUE constraints.
- Nhận qua trang chủ, QR acquisition và điểm dừng trùng tên/GPS trong lịch trình. Không chèn điểm quảng cáo gây đi vòng. Không tự coi GPS gần quán là cùng đối tác: matcher yêu cầu tên chuẩn hóa và GPS trong 150m.
- Ví active/history; hết hạn suy ra bằng giờ server; REDEEMED không đổi thành EXPIRED khi qua hạn. QR/short code90s, ticket staff30s, confirm có idempotency và không dùng lại.
- Web quầy và admin pilot tại `/oc3.html`; landing acquisition tại `/q.html?key=...`. Web admin hiện là operation console với JSON input, chưa phải dashboard kinh tế hoàn chỉnh.
- Thu hồi staff được kiểm lại qua IAM; tài khoản đã xóa/khóa không được tạo/sử dụng voucher bằng token cũ. Owner partner cần admin handoff qua API có audit trước xóa, không cascade mất profile/invoice.
- Lịch sử itinerary cloud và START/COMPLETE/CANCEL + expense/summary trên JSONB hiện tại. Mobile lấy cloud list, có fallback rõ ràng cho server cũ chưa có list.
- Chặn lịch trình >5 ngày ở server và UI; endDate không vượt startDate+4. Default bắt đầu ngày mai.
- JWT/ownership trên voucher đổi điểm và mission legacy; mission đối chiếu trip/activity server thay vì tin tọa độ client. Video đọc stream/duration thật bằng ffprobe, tối thiểu5s.
- Media mission mới nằm trong PrivateUploads và phải xác thực để xem. Submission chờ admin review trước khi được tính completed/điểm.
- Ticket phản hồi cơ bản, report voucher REAL/test riêng, CSV staff chống formula injection, adjustment không mở lại mã cũ.
- Bổ sung IEmailSender/SmtpEmailSender vào DI của IAM: tránh lỗi tạo AuthController khi login; không đổi SMTP credentials.

Chưa hoàn thành/không được coi là đã nghiệm thu:

- Chưa triển khai AWS, chưa chạy migration vào DB ứng dụng/AWS, chưa test trên điện thoại thật trong đợt code này.
- Chưa kiểm đủ60 acceptance cases của đặc tả. SQL/HTTP tests dưới đây không chứng minh toàn bộ60 trường hợp đã đạt.
- Universal/App Links, native deferred Install Referrer qua cài app và in/triển khai QR thực tế tại quán: chưa xác minh; pilot dùng custom scheme và quét lại/mở lại trang sau khi cài.
- Chưa đưa read model partner vào nguồn tạo lịch trình AI. Voucher trong itinerary chỉ xuất hiện nếu itinerary hiện hữu khớp địa điểm partner; không hứa AI tự xếp partner vào trip.
- Chưa chuẩn hóa AccommodationBooking theo số phòng/đêm và lan truyền đổi hotel trên toàn booking; giữ cơ chế hotel hiện hữu, cần đợt xử lý riêng và test hồi quy.
- Chưa có generation job async, full visit/skip/review/notification inbox, quản lý bằng chứng/payment và retention tự động đầy đủ theo schemas.
- Chưa có canonical mission identity migration/backfill. Giữ semantic dedup hiện có; các mission legacy vẫn cần rà định danh venue khi thay địa điểm hoặc khác ngôn ngữ.
- Media legacy `/uploads/...` chưa di chuyển sang private; audit/retention media cũ cần kế hoạch chuyển đổi riêng. Media mới dùng endpoint bảo vệ.
- Chưa có full staff manager dashboard hoặc dashboard đối soát kinh doanh nâng cao; staff chỉ xem lịch sử/CSV của chính mình trong location được gán.
- Chưa auto tái kích hoạt voucher sau void (chủ đích: không được dùng lại); bồi hoàn phải là campaign/quota được duyệt riêng.

## 2. Không chỉ restart Expo

Module mới mặc định tắt. Nếu backend vẫn là bản AWS cũ, chạy `npx expo start -c` không tạo schema/API mới. Cần deploy backend dev + migration + cấu hình trước, hoặc chạy các service local và trỏ app tới IP LAN trong API Settings.

Mọi lệnh dưới đây chạy từ thư mục repo `Ethnic_Translate/EXE`, trừ lệnh Expo chạy trong `Front-End`.

Không commit `.env`, secrets, private media hoặc thay connection string cá nhân bằng cấu hình máy người khác.

## 3. Cấu hình bắt buộc

Dùng environment variables hoặc user-secrets, không sửa/commit appsettings chứa secrets.

| Service | Key | Ý nghĩa |
|---|---|---|
| IAM + Task | `PartnerVouchers__Enabled=true` | Bật pilot sau migration |
| IAM + Task | `PartnerVouchers__SyncKey` | Cùng một secret ngẫu nhiên, chỉ server biết |
| Task | `PartnerVouchers__TokenKey` | Secret ngẫu nhiên >=32 ký tự để HMAC short code |
| IAM | `PartnerVouchers__TaskBaseUrl` | URL Task nhìn từ IAM, local ví dụ `http://127.0.0.1:5020` |
| Task | `PartnerVouchers__IamBaseUrl` | URL IAM nhìn từ Task, local ví dụ `http://127.0.0.1:5195` |
| Task | `MissionValidation__AiTourBaseUrl` | URL AITour nhìn từ Task, local ví dụ `http://127.0.0.1:5289`; cần cho assign/submit và itinerary offers |
| Task | `MissionValidation__FfprobePath` | Local ví dụ `C:\ffmpeg\ffprobe.exe`, Docker là `ffprobe` |
| Task DEV ONLY | `PartnerVouchers__AllowTestCampaigns=true` | Cho mobile nhìn INTERNAL_TEST/DEMO trong pilot; production phải false |
| IAM | `PartnerVouchers__WebOrigins__0` (và __1...) | Origin web được phép; default localhost5173 và localhost5020. Thêm origin LAN/HTTPS chính xác nếu dùng |
| IAM / Task | `ConnectionStrings__IAMDb` / `ConnectionStrings__TaskDb` | DB đã xác nhận đúng môi trường, không tự dùng AWS/production |
| IAM + Task + AITour + Python | JWT settings hiện hữu | Phải tương thích issuer/audience/key; không thay key bằng key fixture trong test |

Sinh secret bằng crypto RNG, đặt cùng SyncKey ở hai service. Không dùng chuỗi TEST trong source test làm deployment secret. Worker gọi HTTP trong pilot local; production bắt buộc HTTPS/private network tin cậy, có quản lý key/rotation.

Các key trong bảng là tên cấu hình, không có giá trị secret thật trong repository.

## 4. Migration: không tự chạy trên AWS

### IAM

- Giữ migration `20261029151437_AddPartnerPortalTables` của main.
- Migration thêm `AddOc3PartnerPublication` chỉ thêm PartnerLocations/PartnerLocationMembers/PartnerPublications.
- Migration `AddPartnerOwnershipAudit` bổ sung audit chuyển account owner; không đổi ngày miễn phí hoặc xóa business records.
- DB IAM cũ phải khớp baseline và lịch sử migration trước khi apply. Nếu từng dựng bảng bằng SQL thủ công, reconcile schema/history trước; không giả đánh dấu đã chạy.

### Task

- `AddPartnerVoucherPilot` chỉ tạo schema/tables `pv`; không tạo lại hoặc drop dbo.Vouchers/UserMissions/PointSpends và bảng legacy.
- `LinkPartnerVoucherTrip` chỉ thêm TripId nullable trên pv.VoucherInstances.
- Snapshot Task bao gồm model legacy để migration sau có baseline. Migration pilot **không bootstrap toàn bộ DB gamification legacy**: DB sạch dùng để test module pv được; app mission/đổi điểm cần baseline gamification hiện hữu đã kiểm tra.

Design-time factory dùng connection placeholder, không tự đọc production. Truyền `--connection` đã xác nhận, ví dụ:

```powershell
# Chạy sau backup và xác minh đúng DB, không copy connection string vào chat.
dotnet ef database update --project Disa-App/IAM.Infrastructure --startup-project Disa-App/IAMService --context IAMDbContext --connection $env:ConnectionStrings__IAMDb
dotnet ef database update --project Disa-App/Task.Infrastructure --startup-project Disa-App/Task.Presentation --context TaskDbContext --connection $env:ConnectionStrings__TaskDb
```

Máy chưa có EF CLI: cài dotnet-ef8.0.8 bằng tool path riêng hoặc local tool. Workspace môn học đang có `.dotnet/dotnet.exe` SDK8; có thể dùng binary đó thay `dotnet`, và thêm folder vào PATH của terminal khi gọi EF tool.

Không rollback bằng drop bảng nếu đã có claim/redemption thật. Tắt feature flag, đối soát và forward-fix. Không chạy EnsureCreated để thay thế migration pilot.

## 5. Chạy local

Mở terminal riêng cho từng service; cấu hình các env phía trên trong đúng terminal. Chọn HTTP cho mạng LAN test tin cậy; HTTPS cho production.

```powershell
dotnet run --project Disa-App/IAMService/IAM.Presentation.csproj --no-launch-profile --urls http://0.0.0.0:5195
dotnet run --project Disa-App/Task.Presentation/Task.Presentation.csproj --no-launch-profile --urls http://0.0.0.0:5020
dotnet run --project Disa-App/AITour.Presentation/AITour.Presentation.csproj --no-launch-profile --urls http://0.0.0.0:5289
```

Python AI-Itinerary tiếp tục cần PostgreSQL/API dependencies hiện có. Không gọi generate vào AWS để test nếu chưa được người vận hành đồng ý.

```powershell
cd Front-End
npx expo start -c
```

Điện thoại phải dùng IP LAN trong API Settings cho IAM/Task/AITour, không dùng127.0.0.1 của điện thoại. Env/runtime override cũ trong Settings có thể thắng `.env`: kiểm tra cả hai.

Web pilot: `http://localhost:5020/oc3.html`. Nhập IAM URL tương ứng (local `http://localhost:5195`), đăng nhập bằng account hiện hữu. Không có mật khẩu staff chung hoặc secret mặc định trong trang.

## 6. Thứ tự demo end-to-end

1. Owner và staff có account thật trong IAM. Admin tạo/link PartnerProfile bằng OwnerUserId; không dùng UserId của trưởng nhóm cho tất cả quán.
2. Kích hoạt profile bằng API admin hiện hữu; nhập content draft, submit, review Approved.
3. Tạo location canonical từ request đã duyệt + consent reference thật, publish. Xem pendingSync chuyển false; worker retry10s. Không gọi Approved là đã hiển thị trên app nếu còn pending sync.
4. Invite staff account vào location. Staff đăng nhập web bằng tài khoản của mình, tải memberships, accept rồi chọn đúng location.
5. Tạo campaign INTERNAL_TEST, quota10, đúng điều kiện/thời gian, rồi publish. Admin console có thể mở nhóm JSON form để nhập trong pilot.
6. Trang chủ mobile hiển thị offer; lưu -> một mã trong ví active. Tạo trip không tự gia hạn voucher.
7. Nhận từ QR: lấy qrKey do create campaign trả về, encode URL public của Task `/q.html?key={qrKey}` thành QR tại quán. QR acquisition là URL public, không phải QR redemption. Có thể dùng bộ công cụ QR/landing đang có của nhóm để in. Production cần public HTTPS host thật, không in localhost/IP LAN.
8. Custom scheme `disatravel://partner-offer?...` cần development/release build có scheme; Expo Go không chứng minh deep-link sau cài đặt. Test fallback quét/mở lại sau cài hoặc mở route trong Expo bằng development URL phù hợp.
9. User trình QR/short code trong ví. Staff nhập code/QR payload trên web, subtotal và orderRef, xem preview rồi confirm. Mã dùng xong ra khỏi active, history giữ REDEEMED.
10. Hai user khác nhau có mã khác nhau; refresh/nhận từ hai cửa vào không nhân instance. Hết quota không chặn mã đã cấp.
11. Chọn RETURN_VISIT để kiểm ngày mai theo giờ Việt Nam; không chỉnh giờ máy để vượt server rule.
12. Lịch trình có đúng địa điểm partner (tên+GPS) sẽ có khối offer phù hợp. Hệ thống không tự thêm partner vào route hoặc tự chọn quán có vị trí ngược đường.
13. Nộp nhiệm vụ -> PendingReview, chưa cộng điểm. Admin dùng GET `/api/mission-reviews` và POST `/api/mission-reviews/{submissionId}` với `{ "approved": true/false }` để duyệt. UI quản trị nhiệm vụ chuyên dụng chưa hoàn thiện.

## 7. API thực tế cần dùng

Để tránh đụng controller hiện hữu, extension IAM pilot dùng prefix **`/api/oc3`**, không ghi đè các route cũ:

- GET `/api/oc3/session`, `/memberships`; POST `/memberships/{id}/accept`.
- POST `/api/oc3/partners`; POST `/partners/{partnerId}/requests`; POST `/requests/{id}/submit`.
- POST `/api/oc3/partners/{id}/owner` với ownerUserId và reason, Admin-only; chuyển account quản lý, không tự thay legal owner hoặc quyền staff.
- GET/POST `/api/oc3/locations`; PATCH `/locations/{id}` để nối approved revision với expectedPublishedVersion; POST `/locations/{id}/publish`.
- POST `/api/oc3/locations/{id}/staff-invitations`; DELETE `/api/oc3/memberships/{id}` để thu hồi.
- Review/status của main giữ `/api/admin/partner-portal/...`; invoices giữ `/api/invoices`.

Task mới: `/api/v2/me/offers`, `/me/trips/{id}/offers`, `/me/campaigns/{id}/claim`, `/me/vouchers`, `/me/vouchers/{id}/presentations`, `/partner/voucher-verifications`, `/partner/redemptions`, `/admin/campaigns`, `/admin/reports/oc3`, `/me/support-tickets`.

Claim body có `acquisitionContextToken` optional, `tripId` optional; server tự kiểm trip/điểm dừng khi có tripId. Không truyền userId để quyết định owner.

Public context API body là JSON **string qrKey**, không phải object. Mọi mã bí mật chỉ ở body/memory, không query/log/CSV. GET public QR chỉ trả dữ liệu đã publish và số suất tại thời điểm kiểm tra.

Trip list/lifecycle: AITour `/api/v1/itinerary` GET, `/{id}/lifecycle` POST, `/{id}/expenses` POST, `/{id}/summary` GET. AITour forward JWT tới Python; mobile không gọi Python trực tiếp.

## 8. Kiểm thử và giới hạn kết quả

```powershell
dotnet build Disa-App/IAMService/IAM.Presentation.csproj
dotnet build Disa-App/Task.Presentation/Task.Presentation.csproj
dotnet build Disa-App/AITour.Presentation/AITour.Presentation.csproj
dotnet run --project Disa-App/Oc3.Tests
# Chỉ khi muốn tạo DB test trên SQL LOCAL có quyền Windows:
dotnet run --project Disa-App/Oc3.Tests -- --sql '.\SERVERMSQL' --http
```

Harness tạo tên DB ngẫu nhiên tiền tố DISA_OC3_TEST_, không xóa DB ứng dụng. DB test được giữ để kiểm tra; không tự xóa collection/database hiện có. HTTP tests dùng port55195/55020, tài khoản/key fixture ngẫu nhiên/chỉ cho test, kill host test trong finally. Không dùng key fixture để deploy.

Đã chạy và qua ở máy phát triển:

- Build IAM, Task, AITour; TypeScript noEmit.
- SQL:50 account tranh10 suất ->10 instance,30 claim lặp không tăng quota,2 staff confirm đồng thời ->1 redemption, idempotent receipt và ví history đúng.
- HTTP: password login, manual entry/review/outbox publish, quyền tenant/staff, claim/present/confirm/retry/history và UTC `Z`.
- HTTP bổ sung: card trang chủ phản ánh mã đã lưu; QR acquisition trùng mã home; thu hồi quyền staff và xóa account vô hiệu token/presentation cũ.
- Video fixture1s được ffprobe đọc thời lượng thực, không tin client khai5s.
- Python validators/lifecycle:17 test qua.

Full Python unit suite có59/61 test qua ở lần chạy hồi quy: hai failure trong `test_retrieval_service::test_trim_to_50_max` và `test_route_optimizer::test_known_distance`. Các file source/test tương ứng không bị sửa trong đợt này; cần xử lý baseline riêng, không xóa hoặc sửa assertion chỉ để làm xanh báo cáo.

Chưa test model AI live, cloud database, physical GPS/camera, Store install/referrer, hiệu năng production và toàn bộ màn hình trên thiết bị thật. Local SQL cũ phát cảnh báo TLS1.0; không áp cấu hình đó cho production, cần SQL/TLS hiện đại khi vận hành thật.

## 9. Git và bàn giao

- Không merge vào main, không force-push, không deploy AWS.
- Năm file đăng nhập đang dirty trước khi làm được giữ ngoài commit OC3: login.tsx, http.ts, Button.tsx, AuthContext.tsx, jwt.ts. Không giả coi chúng là code đã đẩy lên remote.
- Thử trên dev bằng backend và frontend cùng phiên bản. Nếu gặp lỗi, gửi requestId/build/endpoint/status, không gửi password/token/QR đang còn hiệu lực.
