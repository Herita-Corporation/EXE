# DISA Travel - Đặc tả end-to-end và schemas cho Outcome 3

**Version:** 1.3 - 08/11/2026 (ghi nhận giảng viên đồng ý mô hình miễn phí năm đầu)

**Người nhận:** backend .NET, AI-Itinerary, web quản trị, QA.

**Trạng thái:** đặc tả đề xuất để triển khai.

**Phạm vi:** từ biết đến ứng dụng, lập kế hoạch, trải nghiệm chuyến đi, nhiệm vụ, sử dụng ưu đãi đến tổng kết và xuất bằng chứng OC3.

**Baseline source:** `Ethnic_Translate/main/EXE`, branch `main`, HEAD `1780adb6aa249954e9dd5cf2148afb4ae5e1934f`. Đây là snapshot local đã đọc, không khẳng định mới nhất trên GitHub/AWS; không fetch/pull/merge hoặc thay đổi code trong lần đối chiếu này. Mục tiêu “không conflict” là tránh thiết kế/contract/migration trùng; không thể bảo đảm Git merge không conflict khi có commit mới.

## 0. Quyết định đã chốt và cách đọc tài liệu

1. Thành viên DISA **nhập và cập nhật thông tin đối tác, địa điểm, chiến dịch, ưu đãi bằng web quản trị**. App đọc dữ liệu đã publish từ backend, không nhập bằng cách sửa code/mobile bundle.
2. MVP **không bắt buộc đối tác có portal tự đăng địa điểm/chiến dịch**. Đối tác vẫn cần tài khoản staff riêng trên web/PWA để quét/nhập mã và xác nhận tại quầy; DISA không xác nhận thay thường xuyên.
3. Ba cửa vào dùng chung một hệ thống voucher:
   - Khách đến cơ sở -> quét QR đối tác -> cài/mở app -> đăng nhập -> nhận ưu đãi tại đúng cơ sở.
   - Khách tạo lịch trình -> chọn điểm đối tác phù hợp -> nhận ưu đãi -> đến cơ sở -> trình QR cá nhân.
   - Khách xem voucher đối tác trên trang chủ -> lưu voucher -> tạo lịch trình hoặc ghé cơ sở sau -> sử dụng trong thời hạn.
4. Nhận voucher, xem QR, check-in, hoàn thành nhiệm vụ và sử dụng voucher là **các hành động khác nhau**.
5. Một account nhận tối đa **một voucher trong một campaign tại một location**, kể cả đi vào từ nhiều cửa vào khác nhau, hết hạn, đã dùng hoặc cài lại app. Không hiểu thành mỗi người chỉ được một voucher trên toàn ứng dụng suốt đời.
6. Để pilot đơn giản và đúng yêu cầu “quay lại đúng nơi đó”, **mỗi campaign MVP chỉ gắn một location và một offer**. Cùng brand có nhiều chi nhánh phải cấu hình campaign riêng; chưa hỗ trợ quota dùng chung nhiều chi nhánh.
7. Claim là lúc giữ chắc một suất. Campaign có 10 suất -> tối đa 10 VoucherInstance được cấp trong toàn campaign. Không phát 100 mã rồi chỉ cho 10 người đầu sử dụng.
8. Voucher đã dùng **biến mất khỏi ví đang dùng và mất QR**, nhưng vẫn còn trong lịch sử, database và báo cáo. Không hard-delete để “ẩn”.
9. Hết suất thì ẩn CTA nhận/ưu đãi khỏi danh sách có thể nhận; trang chi tiết, landing và điểm dừng còn giữ thông báo “Ưu đãi đã hết lượt nhận”. Voucher đã cấp còn hạn vẫn dùng được.
10. Các ưu đãi này là giảm giá dịch vụ vật lý tại cơ sở; chưa triển khai checkout, thanh toán trong app hoặc payout cho đối tác.
11. “Lưu voucher” ở trang chủ là **claim thật**, không chỉ bookmark: cấp một instance cá nhân và giữ một suất. Không yêu cầu đã có lịch trình; không tự bắt đầu chuyến đi hoặc tự trừ điểm.
12. Ví có mục **“Voucher của tôi”** cho mã chưa dùng còn hạn và mục **“Voucher hết hạn”** theo yêu cầu product cho các mã đã kết thúc, bao gồm cả “Đã sử dụng”. Mục thứ hai có mô tả “Đã sử dụng, hết hạn hoặc không còn hiệu lực” và badge chính xác theo từng mã; tên mục không làm thay đổi status backend.

Các giá trị TTL, bán kính và thời gian xử lý bên dưới là **default đề xuất có cấu hình**, không phải dữ liệu đã đo. Thay đổi cần ghi version và QA lại.

**Quyết định cập nhật:** Giảng viên đã đồng ý **app miễn phí + hợp tác đối tác miễn phí trong một năm đầu**, theo thông báo nhóm trưởng ngày 08/11/2026. Không đặt phí partner hoặc invoice Paid làm điều kiện kích hoạt/chạy pilot OC3. Giữ quy tắc vận hành 12 tháng theo ngày kích hoạt từng đối tác như kế hoạch hiện tại. Việc đồng ý mô hình không tự xác nhận mọi KPI hoặc ngưỡng chấm điểm cụ thể.

### 0.1. Quan hệ với hai tài liệu cũ

- `01_DISA_Partner_Acquisition_Pricing_Plan.md`: tài liệu kinh tế cũ. Không lấy các gói giá/pilot 14 ngày trong đó để tự động thu phí; định hướng hiện tại là miễn phí 12 tháng theo từng đối tác.
- `02_DISA_Partner_Backend_Implementation_Brief.md`: brief kỹ thuật nền. Tài liệu mới này thay thế các quy tắc chưa rõ về cấp mã, quota, reverse và quy trình tự đăng đối tác khi có khác biệt.
- Tài liệu này không thay thế thỏa thuận thương mại với đối tác và không xác nhận nhóm đã đạt điều kiện OC3.

### 0.2. Hiện trạng thực tế trên main local

Các đường dẫn tính từ **`Ethnic_Translate/main/EXE`**, không dùng bản dev `Ethnic_Translate/EXE` làm baseline ở version này:

| Thành phần hiện có | Điều đã thấy | Khoảng trống cần xử lý |
|---|---|---|
| `Disa-App/IAM.Infrastructure/Data/Entities/PartnerProfile.cs` + `IAMDbContext.cs` | Đã có PartnerProfiles, owner UserId unique, BusinessName/Address/contact, status `PendingApproval/Active/Rejected/Suspended` | Tái sử dụng tenant/profile, không tạo Organizations song song; thêm location, consent, staff membership khi cần |
| `IAMService/Controllers/PartnerAuthController.cs`, `PartnerController.cs` | Register/login partner, `/api/partner/me`, dashboard; role `Partner` | Giữ nguyên contract và login hiện có; bổ sung staff bằng membership, không tạo một profile cho mỗi nhân viên |
| `PartnerRequestController.cs`, `AdminPartnerController.cs` | Draft -> Pending -> Approved/Rejected; review serializable và PartnerReviewAudit; upload ảnh | Đã có workflow duyệt. Còn thiếu admin nhập nội dung thay đối tác và publish/read-model cho app; `Approved` không tự đồng nghĩa app đã có địa điểm |
| `IAM.Infrastructure/Data/Migrations/20261029151437_AddPartnerPortalTables.cs` và snapshot | Đã có migration partner portal trong source | Không tạo lại bảng đã có hoặc sửa migration này; kiểm DB thực tế trước migration bổ sung. README cũ ghi chưa có validated migration không thay thế hiện trạng source |
| `InvoiceController.cs`, `PartnerInvoice.cs` | `/api/invoices`, trạng thái Unpaid/Paid, Amount/PaidAt; admin đánh dấu paid | Mở rộng chứng từ/xác minh nếu cần; không dựng hệ invoice thứ hai hoặc xem status Paid là chứng từ tiền đã nhận |
| `Disa-App/Task.Domain/Entities/Voucher.cs` | Một `Code` thuộc định nghĩa voucher | Chưa phải mã riêng theo người nhận |
| `Task.Domain/Entities/VoucherRedemption.cs` | `UserId`, `VoucherId`, `RedeemedAt` | Chưa phân biệt nhận mã và dùng tại quầy; thiếu staff/location/quota |
| `Task.Application/Services/VoucherService.cs` | `RedeemAsync` trừ điểm và cấp quyền xem mã chung | Đây đang là **đổi điểm lấy voucher**, không phải merchant redemption |
| `Task.Presentation/Controllers/VoucherController.cs` | Các route balance/owned/redeem nhận userId; chưa có `[Authorize]` trên các action này | P0: bắt buộc JWT và lấy người dùng từ `sub`; không tin userId client gửi |
| `Task.Infrastructure/Persistence/Configurations/VoucherRedemptionConfiguration.cs` | Index userId, chưa có unique instance redemption | Chưa chứng minh chống dùng trùng bằng DB |
| `Front-End/src/api/endpoints/vouchers.ts` | Dùng `/api/vouchers`, `/owned/{userId}`, `/{id}/redeem` | Cần contract mới có version, không đổi nghĩa âm thầm route cũ |
| `Front-End/src/types/itinerary.ts`, `missions.ts` | DTO lịch trình snake_case, nhiệm vụ camelCase | Giữ tương thích; `placeId`/activity_id cũ không mặc nhiên là canonical locationId |
| `Task.Infrastructure/Repositories/UserMissionRepository.cs` | Đã có `GetOrAddAssignmentAsync`, serializable + SQL app lock; tìm cùng UserId + (Title hoặc PlaceId) + mission type, **không giới hạn TripId** | Không xóa cơ chế chống trùng hiện tại để thay bằng unique per-trip yếu hơn. Cần chốt định danh canonical khi nâng cấp; index hiện tại là non-unique |
| `Task.Domain/Enums/MissionStatus.cs` | Assigned0, PendingReview1, Completed2, Rejected3, Expired4 | Giữ enum numeric; từ SUBMITTED trong tài liệu là nhãn nghiệp vụ cho PendingReview, không thêm enum phá contract |
| `MissionSubmissionService.cs` | Đã kiểm ảnh/video bắt buộc, duration client gửi, timestamp/GPS; sau đó tự Approved | Không triển khai trùng các kiểm tra; cần đọc duration file thật, chống concurrent completion và bổ sung review đúng thay vì gọi auto-approve là đã có review thủ công |
| `AITour.Presentation/Controllers/AITourController.cs` + Python itinerary route/orchestrator | Generate/get/delete, alternatives/replace, resolve GPS; kết quả generate đã persist cả cache hit | Không viết lại generation/save; còn thiếu cloud list/lifecycle/link partner. Job async là nâng cấp additive, không thay route sync đang dùng |
| `IAMService/Controllers/AuthController.cs` | Đã có auth Google/password, reset, push/avatar, DELETE `/api/auth/delete-account` có xác nhận mật khẩu | Tái sử dụng, bổ sung cleanup/revocation và xử lý FK partner; không yêu cầu dựng delete-account từ đầu |

Không tìm thấy client đọc PartnerContentRequest/partner-portal trong các phần mobile/static-pages/AI-Itinerary đã search. Vì vậy chưa có bằng chứng app nhận nội dung Approved; cũng không kết luận web admin ở repo khác chưa tồn tại. Chưa build/integration-test/AWS trong lần rà soát này.

### 0.3. Nguyên tắc chống trùng schema và phá contract

1. **Giữ IAM là nơi quản lý partner/account/review/invoice.** `PartnerOrganization`/`organizationId` ở mô hình nghiệp vụ bên dưới là alias của `PartnerProfile`/`PartnerProfile.Id` (wire field hiện hữu vẫn là partnerId). Không tạo bảng Organization hoặc hệ đăng nhập đối tác mới.
2. **Giữ partner self-service đã có.** Yêu cầu mới chỉ là thành viên DISA chủ động nhập bằng admin web; không xóa portal/role Partner hoặc route đối tác đang dùng. Bổ sung route admin nhập thay, ghi actor và partnerId, không chia sẻ password/impersonate owner.
3. **Giữ Task là nơi sở hữu voucher/mission.** Luồng voucher cá nhân mới dùng schema SQL đề xuất `pv` trong TaskDbContext: `pv.Campaigns`, `pv.VoucherInstances`, `pv.Redemptions`... Không map vào dbo.Vouchers/dbo.VoucherRedemptions của đổi điểm hiện tại.
4. **Place/location mới không phải PartnerContentRequest.Id.** Một request là revision chờ duyệt, không phải chi nhánh ổn định. Thêm PartnerLocations trong IAM, liên kết approved request và publishedVersion. Mọi revision cùng chi nhánh dùng lại locationId, không đổi ID mỗi lần duyệt.
5. Task giữ read model `PartnerLocationSnapshots` với Id bằng PartnerLocation.Id và PartnerId/version/status; campaign FK location tới snapshot trong cùng DB. IAM -> Task/AI catalog đồng bộ theo outbox, idempotent/versioned. Không transaction/FK xuyên IAM, Task, PostgreSQL.
6. Bảng/DTO mục5 là **mô hình đích có mapping**, không lệnh tạo toàn bộ bảng từ đầu. Bảng đã có phải ALTER/additive migration hoặc adapter, không rename/drop để giống tài liệu.
7. Giữ role hiện hữu `Admin`, `Partner`, `Manager`, `Customer` theo thực tế seed/deploy. Các nhãn DISA_EDITOR/PARTNER_STAFF bên dưới là capability đề xuất, chưa phải role đã được cấp. **Manager toàn hệ thống không phải Partner Manager**; kiểm scope membership từng location.
8. Chuẩn hóa authenticated identity trong helper: JWT hiện phát cả `sub` và ClaimTypes.NameIdentifier, controller .NET đang đọc NameIdentifier. Giữ mapping hiện có, kiểm consistency nếu có cả hai; không xóa nameid hoặc thay pipeline claim chỉ để đúng chữ `sub` trong spec.
9. Sửa auth/ownership trên các route cũ là hardening được yêu cầu; bảo toàn response/field casing cho client hợp lệ, không bảo toàn quyền truy cập trái phép.

### 0.4. Checklist thay đổi so với main (không triển khai lại từ đầu)

| Module | Giữ/tái sử dụng | Bổ sung đúng chỗ |
|---|---|---|
| IAM partner/admin | Profile, auth, request/images, review/audit, invoice, migration hiện có | Admin nhập tay + location/version/consent + membership + publish/outbox |
| Task voucher | Catalog/đổi điểm cũ và API mobile cũ | Module pv + claim/presentation/staff confirm/quota/wallet mới, route /api/v2 |
| Task mission | Service/repository/enums và chống trùng đang có | Ownership, canonical identity migration, server media validation, atomic reward, archive policy |
| AITour/Python | Proxy, orchestrator, persist, alternatives/GPS và schema snake_case | List/lifecycle cloud, catalog partner projection, booking linkage; async job nếu cần |
| Mobile | request(service,path), API Settings, auth/session và các màn đang có | Home offer/wallet status/staff receipt updates + adapter, không hardcode một base URL chung |
| Evidence | PartnerInvoices, PartnerReviewAudits | Payment attachments/verification, event REAL/test, export theo module ownership |

## 1. Phạm vi OC3

Nguồn: `csv/OC3 Final Report Requirements _ EXE201SU26.pdf`, mục 1.4, 3.1-3.5 và chính sách trang 3.

**Mô hình áp dụng đã được đồng ý:** miễn phí ứng dụng cho user và hợp tác đối tác miễn phí trong năm đầu. Bảng dưới là các nhánh requirement gốc để truy nguyên, không tự áp ngưỡng khách hàng trả phí làm điều kiện kỹ thuật cho pilot miễn phí được giảng viên chấp thuận.

| Nhánh trong requirement | Ngưỡng được nêu cho mức 8/10 | Dữ liệu hệ thống cần hỗ trợ |
|---|---|---|
| Khách hàng cá nhân trả phí | Ít nhất 20 paying customers | Khách hàng, khoản thu, chứng từ, hành vi dùng sản phẩm |
| Khách hàng tổ chức trả phí | Ít nhất 2 paying organizations và tổng ít nhất 20 nhân sự trực tiếp sử dụng | Organization, payment evidence, staff account riêng, hoạt động nghiệp vụ |
| Freemium có doanh thu từ nguồn khác, ví dụ quảng cáo | Ít nhất 100 active users | Định nghĩa active/cohort, event, nguồn doanh thu và xác nhận cách áp dụng |
| Nền tảng hai phía | Ít nhất 20 users tạo ít nhất 100 paid transactions | Transaction thực, người dùng thực, hóa đơn và đối soát |

**Cách áp dụng:** Không yêu cầu khách/đối tác trả tiền chỉ để khớp một nhánh requirement gốc. Nhóm nên lưu ghi nhận trao đổi/biên bản đồng ý cùng hồ sơ OC3 khi có; chưa có file bằng chứng thì để null, không tự tạo. KPI/ngưỡng/chứng từ nào chưa được trao đổi riêng thì ghi rõ, không tự suy ra “100 active users là đủ” hoặc “đã được miễn toàn bộ bằng chứng”. Việc bổ sung rubric không chặn backend triển khai mô hình miễn phí đã được đồng ý.

Bằng chứng ưu tiên: đối tác đồng ý hợp tác và offer/quota; QR được đặt; staff account riêng có sử dụng; người dùng thật tạo lịch trình/nhận/dùng voucher; hoạt động nhiệm vụ/chuyến đi; KPI OC2 so với thực tế và feedback. Đây là dữ liệu cần thu, không phải ngưỡng điểm mới do tài liệu tự đặt.

- Redemption miễn phí không phải doanh thu DISA; một lần thử demo không phải paid transaction.
- Nếu khách trả hóa đơn cho quán, đó là giao dịch tại quán. Chỉ báo cáo là giao dịch quy nguồn DISA khi có phương pháp và bằng chứng được chấp nhận; không mặc nhiên là doanh thu DISA hoặc đáp ứng tiêu chí học phần.
- Tách `DEMO`, `INTERNAL_TEST`, `REAL` trong mọi record liên quan; không trộn báo cáo.
- OC3 còn cần journey map, BMC/pricing, so sánh KPI OC2 với thực tế, ảnh hoạt động/sản phẩm, bài học từng thành viên và khai báo sử dụng AI. Dashboard chỉ cung cấp dữ liệu, không thay thế bài báo cáo.

## 2. Quyền và các giao diện cần có

| Vai trò | Giao diện | Được làm | Không được làm |
|---|---|---|---|
| Guest | Landing/public place | Xem địa điểm, điều kiện, link tải app | Giữ suất, nhận voucher, redeem |
| TRAVELER | Mobile app | Lịch trình/voucher/nhiệm vụ/dữ liệu của mình | Tự xác nhận ưu đãi đã sử dụng hoặc tự cộng điểm |
| DISA_EDITOR | Web quản trị | Nhập partner/place, campaign draft, ảnh và bằng chứng đồng ý | Tự duyệt khi cấu hình tách người duyệt; xác minh thay quán không có audit |
| DISA_ADMIN | Web quản trị | Duyệt/publish, cấp quyền staff, khóa hoạt động, đối soát, xử lý tranh chấp | Sửa/xóa lịch sử dùng mã để làm đẹp số liệu |
| PARTNER_STAFF | Web/PWA tại quầy | Resolve/confirm voucher đúng location được gán; xem lịch sử của mình | Tạo campaign, xem voucher của org khác, tự tăng quota |
| PARTNER_MANAGER | Web/PWA | Quyền staff và báo cáo địa điểm được gán; yêu cầu sửa dữ liệu | Truy cập org khác hoặc sửa lịch sử chứng từ |

Mỗi nhân viên có tài khoản riêng. Có thể một người vừa là traveler vừa là staff nhưng server kiểm tra quyền trên từng endpoint. Reject tự redeem voucher của chính staff; trường hợp ngoại lệ admin xử lý và audit, không tự cộng vào bằng chứng thực.

## 3. Bản đồ hành trình khép kín

```text
DISA team nhập thông tin + bằng chứng đồng ý
    -> Admin publish place/campaign -> cấp staff và QR acquisition

A. Khách thấy QR tại quán -> Landing -> cài/mở app -> đăng nhập -> claim
B. Khách mở app -> tạo/lưu lịch trình -> điểm dừng đối tác -> claim
C. Trang chủ -> lưu voucher đối tác -> tạo lịch trình hoặc ghé trực tiếp
                                  |
                           ví voucher cá nhân
                                  |
                      đến đúng cơ sở -> mở QR động
                                  |
                   staff resolve -> xem điều kiện/hóa đơn
                                  |
                       staff confirm -> một redemption
                                  |
             voucher ra khỏi ví đang dùng, QR bị vô hiệu hóa
                                  |
        tiếp tục chuyến đi/nhiệm vụ -> tổng kết -> phản hồi
                                  |
                  lịch sử + báo cáo + bằng chứng OC3
```

### 3.1. Nhận biết, cài app và giữ ngữ cảnh đối tác

1. Web quản trị phát QR/link HTTPS riêng, ví dụ đường dẫn đề xuất `/q/{qrKey}` trên domain DISA. Backend resolve key sang location/campaign; không tin locationId do người quét tự sửa.
2. Đã cài app: App Link/Universal Link mở đúng chi tiết. Chưa cài: landing hiển thị quán, điều kiện, “còn suất tại thời điểm kiểm tra”, nút tải, nút mở lại app và hướng dẫn quét lại QR sau khi cài.
3. Landing tạo `AcquisitionContext` ngẫu nhiên, TTL đề xuất 7 ngày, gắn QrLink/source/location/campaign. **Chưa claim, chưa giữ suất**.
4. Android: có thể đưa opaque context vào Google Play referrer và đọc qua native integration. Phải kiểm tra server khi bind; referrer không phải quyền nhận ưu đãi hoặc bằng chứng hiện diện.
5. Không mặc định cookie/UTM hoặc Universal Link tự đi xuyên qua App Store. MVP có fallback **quét lại QR sau khi cài**, hoặc đăng nhập web để gắn pending context vào cùng account rồi mở app. Thiếu context thì cho chọn lại, không đoán nguồn.
6. Đăng nhập xong, app khôi phục màn offer, hiển thị điều kiện rồi yêu cầu nhận. Có thể tự cấp sau đăng nhập nếu product chọn, nhưng phải gọi cùng claim service và hiển thị kết quả; MVP mặc định nút “Nhận ưu đãi”.
7. Nếu nhận tự động/bind lại do retry, vẫn chỉ có một VoucherInstance cho user/campaign.

Không phát redeem QR trên landing công khai. Acquisition QR có thể được chia sẻ; **không phải bằng chứng khách đã tới quán**. Không cam kết xác minh con người duy nhất chỉ bằng account/device.

### 3.2. Tài khoản và phiên đăng nhập

- Register, login, refresh, logout, reset password, profile; lỗi rõ ràng, timeout có retry, không để nút bấm im lặng.
- JWT `sub` là identity duy nhất cho thao tác “của tôi”; JWT phải được kiểm chữ ký, issuer, audience, expiry.
- Password/reset/refresh token không ghi log. Refresh rotation/revoke theo thiết kế IAM.
- Sau logout hoặc đổi account, xóa cache voucher/QR/context riêng của account trước; không cho xem nhầm ví.
- Auth của owner Partner hiện trả AccessToken từ `/api/partner-auth/login`, chưa phải session/refresh contract giống mobile auth. Không ép frontend dùng response shape của `/api/auth/login` cho partner login. Staff không phải owner không tạo PartnerProfile riêng để qua login này: dùng IAM user/auth hiện hữu và capability endpoint kiểm membership, hoặc mở rộng partner login có chủ đích và test backward compatibility.
- Khôi phục ví/lịch trình từ server khi đổi điện thoại. AsyncStorage không là dữ liệu chuẩn duy nhất.
- Delete account: xác thực lại, revoke sessions, vô hiệu hóa presentation và voucher chưa dùng; tách/xóa PII theo chính sách được phê duyệt, giữ audit tối thiểu đã pseudonymize phục vụ đối soát. Không cascade xóa hóa đơn/redemption.
- Nếu staff là người duy nhất của một location thì admin bàn giao quyền trước khi đóng account; không để account đã xóa vẫn redeem.

### 3.3. Nhập đối tác thủ công qua web -> hiển thị trong app

**Hiện có trên main:** owner Partner tạo Draft qua `/api/partner/requests`, submit Pending, Admin review Approved/Rejected. Chưa có API admin nhập draft thay và chưa có bước publish/read model. Các bước sau là phần bổ sung trên nền đó, không xóa workflow hiện hữu.

1. Thành viên có capability phù hợp tạo/liên kết **PartnerProfile hiện hữu** và location mới qua admin web; ghi người liên hệ, bằng chứng đồng ý dùng thông tin/ảnh/QR/offer. PartnerProfile.UserId hiện bắt buộc và unique: phải liên kết account owner thật, hoặc tạo account/invite owner chưa kích hoạt có dữ liệu được đồng ý. Không dùng một UserId của thành viên DISA cho mọi partner và không tạo account staff thành profile mới. Nếu chưa có owner hợp lệ thì giữ onboarding draft, chưa publish partner.
2. Nhập địa chỉ, GPS đã xác minh, loại hình, giờ mở cửa theo thứ, ngoại lệ ngày lễ, khoảng giá, nguồn/ngày cập nhật, ảnh và quyền sử dụng.
3. Gắn `PARTNER_VERIFIED` chỉ khi có xác nhận hợp tác; địa điểm tham khảo là `INDEPENDENT_LISTING`, không được gọi là đối tác.
4. Editor nhập revision qua API admin bổ sung; tái sử dụng PartnerContentRequest/PartnerRequestImage và rule Draft -> Pending -> Approved/Rejected. Không đổi status hiện hữu sang SUBMITTED/ACTIVE. Campaign/quota/offer là entity pv mới, không nhét discount vào Price của content request.
5. Admin duyệt nội dung qua review service dùng chung với route review hiện hữu. Approved mới là đủ điều kiện để **publish sang PartnerLocation + outbox**, không mặc nhiên đã xuất hiện trên app. Publish kiểm PartnerProfile.Active, consent, GPS/giờ/giá; có publishedVersion. Campaign chỉ active khi location snapshot sẵn sàng; không tạo mission vị trí cho location chưa đạt chuẩn.
6. Sau sửa, tăng version và phát cache invalidation. App đọc mới khi refresh/mở lại; mục tiêu đồng bộ foreground tối đa 30 giây, không cần build lại app.
7. Nếu campaign đã cấp mã: không sửa bất lợi điều kiện/giá trị/hạn của voucher đã cấp. Thay đổi material -> version/campaign mới; giữ snapshot cũ.
8. Đối tác có thể dùng request Draft/Pending hiện hữu hoặc liên hệ thành viên; cả hai dùng cùng review/publish service. Self-service **request đã có**, self-publish chưa được cho phép. Request Rejected/Approved hiện không sửa lại qua PUT Draft: thêm action tạo revision mới có liên kết lịch sử nếu cần, không âm thầm đổi rule route cũ.
9. Publish và thao tác nhạy cảm có audit. Khi thiếu nhân sự tách editor/reviewer, admin phải ghi lý do tự duyệt; không giả lập hai người.

### 3.4. Tạo, sửa và lưu lịch trình

- Nhập khu vực, ngân sách, số người, sở thích, ngày bắt đầu/kết thúc; tối đa 5 ngày, tính inclusive.
- Server chặn ngày quá khứ theo timezone của chuyến đi; nếu bắt đầu hôm nay, chỉ xếp hoạt động sau `serverNow + preparationBuffer` (đề xuất 60 phút) và trước giờ đóng cửa. Không còn đủ slot thì đề xuất ngày kế tiếp.
- UI chỉ cho chọn ngày bắt đầu hợp lệ; endDate trong khoảng startDate đến startDate + 4 ngày. API phải tự kiểm tra lại, không dựa UI.
- Main đang generate đồng bộ qua `/api/v1/itinerary/generate` và đã lưu server. Ưu tiên tái sử dụng orchestrator/validation/persistence; nếu thêm job có jobId/idempotency/status thì làm endpoint additive gọi cùng pipeline, không ép mobile cũ chuyển ngay hoặc tự viết một bộ generate khác. Không yêu cầu user bấm tạo lại vô hạn khi upstream trả thiếu ngày.
- Server chuẩn hóa và kiểm chất lượng: đủ ngày, thời gian không trùng, đường đi khả thi, GPS, bữa ăn theo khung giờ, hoạt động khám phá, chỗ ở có giá đúng số đêm nếu qua đêm.
- Khung ngày rất ngắn không ép đủ bữa/khách sạn không cần thiết; bộ kiểm tra phải xét giờ bắt đầu/kết thúc và nhu cầu nghỉ đêm, không dùng một rule cứng sai ngữ cảnh.
- Tạo lịch trình theo catalog xác minh trước; AI chỉ hỗ trợ lựa chọn/diễn giải, không tự tạo khách sạn hoặc giá không có nguồn. Thiếu dữ liệu -> mở rộng khu vực nếu user đồng ý hoặc trả lỗi có hành động cụ thể; không tạo lịch trình chỉ toàn khách sạn 0đ.
- Nhận budget cao không có nghĩa phải tiêu hết: chọn phân hạng luxury khi phù hợp; tách `budgetCap`, `estimatedTotal`, `unallocatedBudget`, báo thiếu dữ liệu luxury nếu có. Không bịa giá để lấp ngân sách.
- Orchestrator main đã persist itinerary ở cả cache hit/miss: giữ cơ chế này, kiểm thử hồi quy thay vì ghi “chưa lưu”. Cần bổ sung list-my-itineraries + lifecycle/status server để khôi phục lịch sử trên máy khác; local history chỉ là cache. Job nếu có chỉ trả SUCCEEDED sau persist.
- Cho sửa điểm dừng bằng catalog đã xác minh; tính lại thời gian, đường đi, chi phí và toàn bộ booking lodging liên quan. Lưu version bằng optimistic concurrency.
- Khách sạn: tách `AccommodationBooking` khỏi các stop “về khách sạn”. Một booking có tổng giá/số đêm, các stop nghỉ lại chỉ tham chiếu booking. Thay khách sạn phải thay booking và tính lại tất cả stop liên quan; không cho thay riêng stop giá 0 để ở khách sạn khác miễn phí.
- Điểm đối tác chỉ được đề xuất khi phù hợp khu vực, budget, thời gian và giới hạn đi vòng. Hiển thị nhãn nội dung đối tác, user có thể bỏ qua; không bảo đảm mọi lịch trình có đối tác.

### 3.5. Bắt đầu, di chuyển và check-in

- “Bắt đầu chuyến đi” chuyển PLANNED -> IN_PROGRESS khi hợp lệ; mở chỉ đường không tự check-in và không tự redeem.
- Từng stop có PLANNED / VISITED / SKIPPED. GPS phải do server đối chiếu canonical Place, không nhận tọa độ đích do client tùy ý.
- Check-in online kiểm timestamp và accuracy; đề xuất mẫu GPS <=60 giây, accuracy <=100m, radius theo place mặc định 150m, tất cả có cấu hình.
- Từ chối/cấp thiếu quyền GPS -> hướng dẫn bật lại, vẫn xem lịch trình và chỉ đường; không giả check-in hoặc tự cộng điểm. Venue redemption dùng staff xác nhận, không bắt buộc GPS khách.
- GPS không phải chống giả mạo tuyệt đối. Dữ liệu đáng ngờ đưa review; không tuyên bố chứng minh hiện diện chắc chắn.
- Địa điểm đóng cửa/sai thông tin -> report issue, thay thế và tính lại lịch; tạm ẩn khỏi generation nếu admin xác nhận lỗi.

### 3.6. Nhiệm vụ và phần thưởng

- Main đã chống trùng theo user + (Title hoặc PlaceId) + template.Type, kể cả khác TripId/templateId, bằng transaction/app lock. **Giữ hành vi đó trong pilot**, không thay bằng UNIQUE per-trip/template cho phép cùng quán nhận lại từ trip khác. PlaceId hiện liên quan activity ID, cần adapter để tách canonical venueId với stopId.
- Đích nâng cấp đề xuất là `AssignmentKey = hash(userId + canonicalPlaceKey + missionType + repeatPolicyVersion)`; một place/type không nhận lại trong policy pilot. Phải backfill/map mission cũ, chốt repeatPolicy rồi mới tạo unique AssignmentKey nullable/filtered cho dữ liệu mới. Nếu location chưa có canonical ID, tiếp tục cơ chế legacy và đánh dấu cần chuẩn hóa, không bịa ID từ tên.
- Vào màn lịch trình phải tải lại trạng thái server theo identity mission hiện hành; Assigned(0) “Đã nhận”, PendingReview(1) “Đang xác minh”, Completed(2) “Đã hoàn thành”, Rejected(3), Expired(4). SUBMITTED chỉ là từ nghiệp vụ tương đương PendingReview, không thêm enum value mới.
- Template/điểm thưởng/GPS/requirements phải do server chọn; không tin title, rewardXP hoặc targetLatitude của client.
- Chỉ nhận nhiệm vụ cho chuyến/stop thuộc user, trong khoảng thời gian cho phép. Có thể nhận trước, nhưng chỉ submit trong cửa sổ ghé hợp lệ. Không để lịch trình cũ làm nhiệm vụ vô hạn.
- Ảnh/video upload qua object storage riêng tư, giới hạn size/mime, kiểm content thực và malware khi có hạ tầng; URL xem evidence có thời hạn.
- Video >=5 giây: server đọc metadata media thực, không tin duration client. Video ngắn bị REJECTED, không thưởng. App bắt promise lỗi camera, unlock UI và cho quay lại, không crash.
- Chụp ảnh bất kỳ không đủ tự động chứng minh nhiệm vụ: tối thiểu GPS + khung giờ + chống tái dùng evidence theo hash trong phạm vi hợp lý, và review thủ công khi không thể xác minh nội dung. Không tuyên bố AI vision chính xác tuyệt đối.
- Mỗi mission chỉ một lần thưởng; UNIQUE reward ledger reference theo mission. Nếu cần ảnh và video riêng, dùng template riêng và unique riêng.
- Rejected có thể nộp lại theo số lượt cấu hình, không tạo assignment/reward mới. Completed không quay về Assigned khi app reload.
- Mục tiêu xóa trên app là archive/hide, không xóa reward để làm lại nhận điểm. Main hiện có DELETE/prune và DELETE user missions xóa thật cả completed để cleanup: phải tách account-deletion flow có quyền/retention rõ với nút “xóa mission” thường, giữ API cho client hợp lệ qua adapter và không tuyên bố main đã archive.
- Voucher campaign trong đặc tả này miễn phí claim, **không trừ XP/coin**. Voucher đổi điểm cũ là chương trình khác, cần ledger transaction riêng nếu vẫn giữ.

### 3.7. Voucher dùng ngay hoặc lần sau

- `IMMEDIATE_OR_LATER`: dùng từ lúc claim đến expiresAt.
- `RETURN_VISIT`: MVP định nghĩa rõ là dùng từ **00:00 ngày địa phương kế tiếp** sau ngày claim. Đây là proxy “lần sau”, không khẳng định chứng minh đã có hai lần đến.
- Nếu đối tác cần “lần mua tiếp theo sau hóa đơn hiện tại”, phải thêm purchase reference xác minh; chưa đưa vào MVP.
- `redeemableFrom`/`expiresAt` được tính server, snapshot lúc cấp. Ví dụ hiệu lực 30 ngày nhưng không vượt `campaign.redeemEndsAt`; không còn đủ cửa sổ sử dụng thì không cấp mã.
- Tài khoản cũ có được nhận không do `newAccountOnly` campaign quyết định; default **false**. Nếu true, dùng thời điểm tạo account ở IAM, không dùng thời điểm cài app tự khai.
- Campaign cấu hình `allowedSources` là tập con của `ACQUISITION_QR`, `ITINERARY`, `HOME`; không dùng enum `BOTH` vì đã có ba cửa vào. Nguồn không được tin từ body tự khai: server kiểm context liên quan khi có và phân biệt eligibility thật với nhãn analytics. `HOME` không phải bằng chứng hiện diện. Link QR công khai vẫn không chứng minh khách mới/đã đến quán.
- User đã có voucher: trả lại instance đó, kể cả campaign hết suất, không lỗi stock trước khi kiểm tra đã có.

#### 3.7.1. Voucher đối tác trên trang chủ -> lưu -> lên kế hoạch

1. Trang chủ có khối “Ưu đãi từ đối tác”, chỉ hiển thị campaign đã publish, trong thời gian claim, cho phép nguồn HOME và đáp ứng điều kiện người dùng.
2. Card có ảnh đã được cấp quyền, tên/chi nhánh đối tác, giá trị giảm/quà, điều kiện tối thiểu, phạm vi áp dụng và thời hạn dự kiến. Không chỉ ghi “30 ngày” mà thiếu mốc thực tế: trước claim ghi “Dùng trong 30 ngày từ lúc nhận, không quá [ngày kết thúc]”; sau claim hiển thị chính xác expiresAt.
3. User nhấn “Lưu voucher”: guest được chuyển đăng nhập và khôi phục card đang chọn; traveler gọi claim service hiện hữu. Server tính redeemableFrom/expiresAt ngay khi cấp. **Hạn bắt đầu từ lúc nhận theo campaign, không chờ đến lúc bắt đầu chuyến đi.**
4. Thành công: badge “Đã lưu”, nút “Xem voucher” và tùy chọn “Lên lịch đến đây”. Một lần lưu giữ một suất; bấm lại/đổi máy/đến qua QR không cấp mã mới.
5. “Lên lịch đến đây” mở form có destination/điểm muốn ghé, không tự tạo trip hoặc tự đổi kế hoạch đang có. Suggest thời gian trước khi hết hạn; nếu không phù hợp tuyến/giờ/budget thì giải thích và cho bỏ qua. Không tự gia hạn voucher cho chuyến được tạo sau.
6. Không bắt buộc tạo lịch trình để dùng voucher. Khách có thể ghé đúng location và staff xác nhận như luồng thông thường. Sau này liên kết trip/stop chỉ bổ sung context có kiểm tra quyền, không thay owner/quota/hạn và không tạo instance thứ hai.
7. Voucher hết lượt: không xuất hiện trong feed nhận mới; card đã mở trả thông báo hết lượt. User đã lưu vẫn truy cập mã còn hiệu lực trong ví. Card của chính họ nếu còn hiển thị phải ghi “Đã lưu”, không ghi “Không thể dùng vì hết lượt”.
8. Với user đã lưu từ QR/itinerary, trang chủ cũng nhận biết `ownedVoucherId` và không hiện lại CTA “Lưu voucher”. Nếu mã đã dùng/hết hạn, không cho nhận lại cùng campaign; có thể ẩn card hoặc dẫn tới lịch sử.

#### 3.7.2. Hai mục trong ví và status bắt buộc

| Mục UI | Điều kiện backend | Badge / hành động |
|---|---|---|
| Voucher của tôi | status ISSUED và serverNow < expiresAt | “Có thể sử dụng”, “Chưa đến ngày sử dụng” hoặc “Tạm ngừng sử dụng”; chỉ mã đủ điều kiện mới có nút trình QR |
| Voucher hết hạn | status REDEEMED | “Đã sử dụng”, redeemedAt, cơ sở và receiptRef; không có QR/CTA dùng lại |
| Voucher hết hạn | status EXPIRED hoặc ISSUED nhưng serverNow >= expiresAt | “Hết hạn”, expiresAt; không có QR |
| Voucher hết hạn | status REVOKED | “Đã thu hồi”, lý do được phép hiển thị và hỗ trợ; không có QR |

- Đề xuất nhãn dễ hiểu hơn nếu product đồng ý sau này: “Đã sử dụng & hết hạn”; MVP vẫn có thể giữ tên “Voucher hết hạn” như yêu cầu, nhưng phải có mô tả và badge trên.
- Bộ lọc trong mục lịch sử: Tất cả / Đã sử dụng / Hết hạn / Đã thu hồi. Sort theo thời điểm kết thúc tương ứng; không xóa khi user refresh.
- Voucher đã REDEEMED tiếp tục mang status “Đã sử dụng” dù ngày expiresAt sau đó đã qua. Không cập nhật REDEEMED -> EXPIRED; job hết hạn chỉ xử lý ISSUED.
- API wallet phải suy ra trạng thái hết hạn ngay theo serverNow kể cả job chưa chạy. App tự refresh tại mốc expiresAt khi foreground; sau resume phải fetch lại.
- Đề xuất sắp mã đang có theo ngày hết hạn gần nhất; hiển thị “Sắp hết hạn” trong 48 giờ nếu còn hiệu lực. Thông báo nhắc hạn chỉ gửi khi user đồng ý, không tự gia hạn/claim thêm.

### 3.8. Trình mã, staff xác minh, dùng một lần

1. User mở voucher còn dùng được, nhấn “Sử dụng tại quầy”. Backend tạo presentation TTL 90 giây, gồm QR opaque token và mã nhập tay 10 ký tự ngẫu nhiên. Không chứa email, phone, JWT hoặc userId.
2. Mỗi instance chỉ có một presentation hiện hành; yêu cầu mới vô hiệu hóa mã cũ. Không tự refresh liên tục khi staff đang xác nhận; hiển thị countdown và nút tạo mã mới.
3. Staff đăng nhập, chọn location được phân quyền; quét QR hoặc nhập mã. Không dùng camera điện thoại chưa đăng nhập để tự xác nhận.
4. `resolve` kiểm token, instance, tenant/location, hạn, thời điểm dùng, trạng thái; hiển thị tên ưu đãi, điều kiện snapshot, voucherRef duy nhất và thông tin hóa đơn cần nhập. Chưa đổi trạng thái voucher/quota.
5. Staff kiểm tra hóa đơn, mức chi tối thiểu, mặt hàng, quy định cộng dồn; server tính số tiền giảm từ dữ liệu được xác nhận. Staff không tự ghi đè giá trị discount.
6. Backend trả verification ticket 30 giây, bound staff + location + presentation + quote. Đổi số tiền hóa đơn phải resolve/quote lại.
7. Staff đối chiếu với khách và bấm “Xác nhận áp dụng”. Confirm transaction tạo một Redemption, cập nhật instance REDEEMED, consumed presentation, audit, outbox.
8. Chỉ sau response COMMITTED staff hoàn tất áp dụng giảm giá/POS. Nếu POS ngoài DISA lỗi sau đó, tạo tranh chấp/void có audit; không giả định có distributed transaction với POS.
9. Ví app refetch/push/poll nhận trạng thái; QR đóng, chuyển lịch sử “Đã sử dụng”, hiển thị receiptRef/thời điểm/đúng cơ sở. Staff xem cùng voucherRef/redemptionRef trong lịch sử để đối chứng.
10. Mã đã dùng, ảnh chụp lại, refresh hoặc gọi API từ máy khác không redeem được lần nữa. Screenshot đang còn hạn vẫn có thể bị chuyển tiếp: giảm rủi ro bằng TTL và staff đối chiếu, không hứa chống chia sẻ tuyệt đối.

**Không cần gửi danh sách raw QR của toàn bộ khách cho quán.** Staff được xem voucherRef, trạng thái, điều kiện và redemption thuộc location được phép. Mã redemption là credential tạm thời, không đưa vào CSV hay nhóm chat.

### 3.9. Kết thúc chuyến đi và quay lại

- User nhấn kết thúc -> xác nhận, lưu `completedAt`; job tự kết thúc chuyến đã qua endAt nếu cần, ghi `completionSource=AUTO_TIME` và không giả tất cả stop đã ghé.
- Trip summary: số stop ghé/bỏ qua, mission hoàn thành, XP, dự toán/chi phí thực đã khai, ưu đãi đã dùng. Không gọi khoản ước tính là chi thực hoặc tiết kiệm thực.
- Voucher chưa dùng vẫn trong ví đến hết hạn; kết thúc/hủy chuyến không tự xóa voucher. Ưu đãi dùng lần sau tiếp tục dẫn về đúng location.
- Mời đánh giá trip/địa điểm/offer sau sử dụng; gắn verifiedVisit/verifiedRedemption khi thực sự có record tương ứng; không trả quà đổi lấy đánh giá tích cực.
- Report vấn đề/tranh chấp có ticket và theo dõi trạng thái, không lặng lẽ reset voucher để khách dùng lại.
- Danh sách chuyến: Upcoming khi chưa đến startAt; Ongoing khi đang trong cửa sổ và chưa terminal; Past khi COMPLETED/CANCELLED hoặc qua endAt. Trạng thái thực thi và nhóm hiển thị tách riêng, dùng serverNow, không so chuỗi ngày format US/VI.

### 3.10. AI Guide / Ethnic Translate

- Giữ cảnh báo dịch có thể sai, không dùng cho tình huống an toàn/y tế quan trọng; Bahnar có biến thể địa phương, vùng tương thích dataset **chưa xác minh** thì ghi chưa xác minh, không tự gán một tỉnh.
- Server cung cấp language/direction capability; không hiện hỗ trợ hai chiều/ngôn ngữ khác khi backend chưa có.
- Text/speech có timeout, hạn độ dài, retry có kiểm soát, lỗi 503 rõ ràng; không giữ spinner vô hạn.
- Ghi feedback chất lượng và latency với consent; không mặc định lưu bản ghi giọng nói nhạy cảm. Không để lỗi translate làm mất lịch trình/voucher.

## 4. Ba loại mã phải khác nhau

| Loại | Payload | Ai quét | TTL / tác dụng |
|---|---|---|---|
| Acquisition QR tại đối tác | HTTPS `/q/{qrKey}` | Traveler | Tồn tại theo campaign; chỉ điều hướng/quy nguồn |
| Voucher reference | `voucherRef`, ví dụ `DV-...` | Con người đối chiếu | ID hiển thị duy nhất, **không có quyền redeem** |
| Redemption QR / short code | Opaque random token / random short code | Staff đã đăng nhập | 90 giây; dùng resolve/confirm server-side |

`qrKey`, `voucherRef`, `presentationToken`, `shortCode`, `verificationTicket` không dùng thay thế nhau. Mã referral dùng nhập tay trên landing phải có nhãn khác mã sử dụng ưu đãi.

## 5. Schema nghiệp vụ và ownership

### 5.1. Quy ước chung

- Partner/IAM và voucher/Task có DbContext/migration riêng. UUID `uniqueidentifier`; trường mới đề xuất UTC datetime2(3), rowversion. **Giữ precision hiện hữu**: content Price/invoice Amount decimal(18,2), Latitude/Longitude decimal(10,7). Không ALTER xuống decimal(18,0)/decimal(9,6) chỉ để đồng nhất spec. VND nghiệp vụ làm tròn rõ ràng; column mới chọn precision không mất dữ liệu.
- `currency='VND'` trong MVP. Percent dùng basis points: 10% = 1000; không dùng float tiền/percent.
- SQL datetime2 không chứa timezone: serializer .NET phải trả ISO8601 UTC có `Z`; không trả datetime không rõ timezone.
- Tất cả bảng nghiệp vụ có `id`, `createdAt`, `updatedAt`, `dataMode`, `createdBy` khi có actor; nếu bảng append-only chỉ cần createdAt.
- FK có thật trong cùng database. IAM userId và itineraryId ở dịch vụ khác là logical reference + kiểm tra service/auth, **không giả FK xuyên database**.
- Metadata JSON có size limit, schemaVersion; không đưa rule cốt lõi/quota vào JSON tùy ý.
- Mọi đề xuất bảng mới được map sang entity hiện có nếu phù hợp; không cần dựng microservice mới chỉ để đúng tên tài liệu.

#### Mapping vật lý bắt buộc trước migration

| Khái niệm trong spec | Main hiện tại / mapping đích | Cách thay đổi |
|---|---|---|
| PartnerOrganization / organizationId | IAM PartnerProfile / PartnerProfiles.Id | Alias nghiệp vụ, không bảng Organizations mới; DTO cũ vẫn partnerId |
| ContentRevision chờ duyệt | IAM PartnerContentRequest + PartnerRequestImage + PartnerReviewAudit | Giữ entity/status, thêm revision/location/publication metadata khi cần |
| Place cho partner / locationId | IAM **PartnerLocations** mới, gắn PartnerProfile.Id + approved request revision | ID chi nhánh ổn định; không dùng PartnerContentRequest.Id làm location |
| Read model location để voucher | Task **PartnerLocationSnapshots** mới | Local FK cho pv campaign; Id giữ bằng locationId nguồn IAM |
| PartnerMembership / scope | IAM PartnerMemberships + MembershipLocations mới | Link user thật vào partnerId, không một profile/nhân viên |
| Campaign, OfferVersion, Instance, Presentation, Verification, Redemption, Adjustment | Task schema **pv** với tên bảng mục8.4 | Additive; không thay dbo.Vouchers/dbo.VoucherRedemptions |
| Partner invoice | IAM PartnerInvoice hiện có | Invoice là invoice; thêm chứng từ thanh toán/verification linked invoiceId, không tạo invoice duplicate |
| Trip / TripDay / TripStop | Python Itinerary record + generated_itinerary JSONB, itinerary_id/activity_id hiện có | Đây là logical model; mở rộng JSON/sidecar có version hoặc migration PostgreSQL bổ sung, không tạo Trips song song trong Task |
| UserMission | Task UserMissions(UserId,TripId,PlaceId,TemplateId) | Không rename sang TravelerId/StopId; thêm canonical identity/AssignmentKey có migration/backfill nếu cần |
| RewardLedger | Nguồn hiện có: completed UserMissions + PointSpends; repository còn nhắc bảng legacy UserRewards | Inventory DB trước, không tạo hai nguồn cộng XP; adapter/ledger transition phải giữ số dư |

Các bảng mới khác như consent/hours/evidence là extension có owner rõ, không mặc nhiên đã có. Audit review hiện hữu giữ nguyên; audit voucher ở pv tách mục đích, không chồng đè PartnerReviewAudit.

### 5.2. Đối tác, địa điểm, nội dung

| Entity | Trường chính ngoài trường chung | Constraints / ghi chú |
|---|---|---|
| PartnerOrganization (logical alias PartnerProfile) | BusinessName, BusinessType, OwnerName, PhoneNumber, Email, Address, TaxCode, Status hiện có; freeStartsAt/freeEndsAt qua agreement bổ sung | Không đổi enum string: PendingApproval/Active/Rejected/Suspended; lifecycle archive mới phải additive |
| PartnerConsent | organizationId, scope, evidenceAssetId, confirmedBy, confirmedAt, validUntil?, withdrawnAt? | Phân biệt quyền listing, logo, ảnh, QR, offer; withdrawal phải có xử lý các voucher còn hiệu lực |
| Place | organizationId?, name, normalizedAddress, province, district?, lat?, lng?, timeZone, category, priceMin?, priceMax?, priceSource?, priceCheckedAt?, listingKind, moderationStatus, publishedVersion, missionEligible, generationEligible | CHECK lat -90..90, lng -180..180; thiếu GPS -> missionEligible=false, generationEligible=false |
| PlaceHours | placeId, weekday, opensLocal, closesLocal, closesNextDay | Một ngày nhiều khoảng; validate giao nhau |
| PlaceDateException | placeId, localDate, isClosed, overrideHoursJson | Ngày nghỉ/ngoại lệ ưu tiên giờ thường |
| MediaAsset | storageKey, mime, bytes, sha256, ownerId, rightsType, rightsEvidenceId?, accessScope, moderationStatus | Không publish ảnh chưa có quyền; evidence PRIVATE |
| PartnerMembership | organizationId, userId, role, status | UNIQUE org,user; không lưu danh sách role/location chỉ ở mobile |
| MembershipLocation | membershipId, locationId | UNIQUE membership,location; server kiểm cùng organization |
| ContentRevision | entityType, entityId, version, snapshotJson, state, submittedBy, approvedBy?, publishedAt?, reason? | Audit source of truth cho nội dung đã publish |

`locationId` trong voucher/campaign là PartnerLocation.Id (Place nghiệp vụ) thuộc PartnerProfile; Task kiểm qua PartnerLocationSnapshot local. Canonical ID ổn định khi đổi tên/revision. Không dùng UserMission.PlaceId legacy làm locationId khi chưa map. Xóa place đã có trip/voucher -> archive, không cascade.

### 5.3. Campaign, quota và voucher

| Entity | Trường chính | Constraints / hành vi |
|---|---|---|
| Campaign | organizationId, locationId, name, status, claimStartsAt, claimEndsAt, redeemEndsAt, allowedSources, newAccountOnly, usageMode, validDaysAfterClaim, totalQuota, issuedCount, redeemedCount, version, approvedBy?, publishedAt? | Một location/một offer; start < claimEnd <= redeemEnd; quota >= issued >= redeemed >=0 |
| CampaignOfferVersion | campaignId, version, title, terms, discountType, percentageBps?, fixedAmount?, maxDiscountAmount?, minEligibleSubtotal, applicableItemsRule, stackable, imageAssetId? | Immutable khi đã cấp voucher; UNIQUE campaign,version; discountType PERCENT/FIXED/GIFT |
| PartnerQrLink | campaignId, qrKey, status, source, issuedAt, revokedAt? | qrKey unique, không chứa PII; pause/revoke không xóa attribution cũ |
| AcquisitionContext | qrLinkId, contextTokenHash, boundTravelerId?, expiresAt, boundAt?, source, anonymousSessionId? | Context opaque ngẫu nhiên; bind tối đa một account, không tự cấp voucher |
| VoucherInstance | campaignId, offerVersionId, travelerId, voucherRef, locationId, status, issuedAt, redeemableFrom, expiresAt, source, acquisitionContextId?, tripId?, tripStopId?, termsSnapshotJson, rowVersion | UNIQUE campaign,traveler; UNIQUE voucherRef; ISSUED/REDEEMED/EXPIRED/REVOKED |
| VoucherPresentation | voucherInstanceId, tokenHash, shortCodeHash, expiresAt, status, createdBy, rowVersion | ACTIVE/CONSUMED/REVOKED; hết TTL tính hiệu lực bằng serverNow; không cần job mới hết hạn |
| VoucherVerification | presentationId, staffUserId, locationId, ticketHash, expiresAt, quotedSubtotal, calculatedDiscount, orderRef?, quoteHash, consumedAt? | Ticket bound đúng staff/location/quote; preview không redeem |
| Redemption | voucherInstanceId, presentationId, verificationId, organizationId, locationId, staffUserId, redeemedAt, voucherRefSnapshot, orderRef?, eligibleSubtotal, discountAmount, netAmount, evidenceAssetId?, paymentVerificationStatus | UNIQUE voucherInstanceId; snapshot offer; không hard-delete |
| RedemptionAdjustment | redemptionId, type, reason, actorId, reviewedBy?, createdAt | VOID/DISPUTE_RESOLVED; append-only; không mở lại mã cũ, không giảm issuedCount |
| IdempotencyRecord | actorId, operation, key, requestHash, httpStatus, responseJson, completedAt | UNIQUE actor,operation,key; cùng key khác payload ->409; dữ liệu trả lại không chứa presentation raw token |
| AuditLog | actorId, actorRole, action, entityType, entityId, requestId, beforeJson?, afterJson?, occurredAt | Append-only, mask PII, không chứa token/mật khẩu |
| OutboxEvent | eventId, eventType, aggregateId, payloadJson, occurredAt, processedAt?, attempts | Commit cùng nghiệp vụ, consumer dedup eventId |

**Quota V1:** `availableToClaim = totalQuota - issuedCount`. `issuedCount` là số cấp tích lũy, không giảm khi voucher expire/revoke/redeem/void. Điều này bảo đảm đối tác đồng ý 10 mã thì không bao giờ có người thứ 11 nhận mã từ campaign đó.

- `redeemedCount` đếm số Redemption gốc, kể cả sau này void; dashboard lấy net redemption trừ adjustment riêng, không sửa lịch sử.
- `VoucherInstance.source` bổ sung HOME. `tripId`/`tripStopId` nullable khi lưu từ trang chủ; có thể thêm linkage sau mà không làm thay đổi identity, thời hạn, source ban đầu hoặc quota. Nếu cần nhiều trip dùng bảng liên kết context riêng, không phát thêm instance.
- Số mã đang có hiệu lực phải query trạng thái + hạn; không lấy `issuedCount - redeemedCount` vì còn expired/revoked.
- Muốn cấp thêm: admin tăng totalQuota (không nhỏ hơn issuedCount) có xác nhận đối tác và audit, hoặc campaign mới. Không tái chế suất ngầm.
- Stock hết chỉ chặn claim mới; không chặn redeem các instance đã giữ suất.
- Campaign có `CLAIM_PAUSED` vẫn cho dùng voucher đã cấp. `REDEMPTION_SUSPENDED` chỉ admin dùng khi có sự cố, có thông báo/support; không tự hủy mã vì quán tạm ngừng nhận mới.

### 5.4. Lịch trình, nhiệm vụ và hậu chuyến đi

| Entity / chủ dữ liệu | Trường tối thiểu | Ràng buộc |
|---|---|---|
| GenerationJob / AITour | travelerId, requestHash, idempotencyKey, status, attemptCount, resultTripId?, failureCode?, createdAt, finishedAt? | QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED; bounded retry |
| Trip / AITour | travelerId, timeZone, startAt, endAt, budgetCap, travelers, status, version, estimatedTotal, actualTotal?, completedAt?, completionSource? | PLANNED/IN_PROGRESS/COMPLETED/CANCELLED; tối đa5 ngày địa phương |
| TripDay / AITour | tripId, localDate, dayIndex | UNIQUE trip,date và trip,dayIndex; ngày đủ liên tục |
| TripStop / AITour | tripId, tripDayId, canonicalPlaceId?, externalActivityId?, startsAt, endsAt, estimatedCost, stopStatus, placeSnapshotJson, accommodationBookingId? | Stable stopId; không dùng tên quán để join |
| AccommodationBooking / AITour | tripId, placeId, checkInDate, checkOutDate, nights, rooms, nightlyRate, estimatedTotal, quoteSource, quotedAt, version | Tổng tính một lần theo phòng/đêm; stop quay lại chỉ tham chiếu |
| TripExpense / AITour | tripId, stopId?, travelerId, amount, category, source, spentAt, receiptAssetId? | User khai và receipt xác minh phân biệt; không đếm hai lần hóa đơn voucher |
| VisitEvent / AITour hoặc Task | travelerId, tripId?, stopId?, placeId, verificationMethod, gpsAccuracy?, verifiedAt, status | VERIFIED_GPS/STAFF_CONFIRMED/SELF_REPORTED; không tự coi direction tap là visit |
| UserMission / Task | UserId, TripId, PlaceId, TemplateId, Status, StartAt, ExpiredAt, CompletedAt, TargetLatitude/Longitude hiện có; CanonicalPlaceKey/AssignmentKey/window bổ sung | Giữ semantic dedup main; không tạo unique per-trip yếu hơn, không rename cột/enum cũ |
| MissionSubmission / Task | missionId, attemptNo, evidenceAssetId, clientCapturedAt?, serverReceivedAt, gpsSample?, measuredDuration?, status, rejectionCode? | UNIQUE mission,attemptNo; server validation/reviewer |
| RewardLedger / Task | travelerId, missionId?, eventType, currency, amount, referenceId, createdAt | UNIQUE reward event/reference; XP và coin tách loại, không cộng hai lần |
| Review / app backend | travelerId, entityType, entityId, tripId?, redemptionId?, rating, text, verifiedFlag, moderationStatus | Chỉ gắn verified khi có evidence; edit có history |
| SupportTicket / admin | travelerId?, organizationId?, tripId?, voucherId?, category, description, status, assignedTo?, resolution? | OPEN/IN_PROGRESS/RESOLVED/CLOSED; attachment private |
| Notification / app backend | recipientId, eventId, type, payload, readAt?, sentAt? | UNIQUE recipient,event; deeplink chỉ tới dữ liệu người nhận có quyền |

Không bắt claim voucher phụ thuộc transaction xuyên Python/PostgreSQL và .NET/SQL Server. Trip linkage là metadata logical được kiểm tra; quota và redemption phải nằm **cùng một database transaction** trong service sở hữu voucher.

### 5.5. Commercial và bằng chứng OC3

| Entity | Trường | Ý nghĩa |
|---|---|---|
| PartnerAgreement | organizationId, version, startAt, freeEndsAt, proposedCommissionBps?, acceptedAt?, evidenceAssetId, status | Chính sách miễn phí theo cohort; chưa tự thu tiền |
| AssessmentAgreement (metadata báo cáo bổ sung) | modelCode, approvalSource, reportedBy, reportedAt, approvalEvidenceAssetId?, agreedMetricsJson?, notes | modelCode=APPROVED_FREE_PILOT; nguồn hiện tại TEAM_LEADER_REPORT. Evidence/metric chưa có để null, không tự tạo chứng từ/KPI được duyệt |
| CommercialPayment (payment evidence extension IAM) | partnerInvoiceId?, partnerId?, payerUserId?, amount, currency, receivedAt, status, receiptAssetId, verifiedBy?, verifiedAt?, purpose | Link PartnerInvoice hiện có; payment không phải invoice thứ hai. Chỉ record tiền DISA thực nhận, không dùng hóa đơn quán thay thế |
| MerchantTransactionEvidence | redemptionId?, locationId, orderRef, grossAmount, discountAmount, paidAmount, paymentStatus, paidAt?, receiptAssetId?, verifiedBy? | Giao dịch ở quán, không mặc nhiên là DISA revenue |
| MetricDefinition | metricCode, definitionVersion, qualifyingEvents, window, exclusions | Chốt trước đo, không đổi giữa kỳ để đạt KPI |
| KPIComparison | metricCode, baseline, target, actual?, periodStart, periodEnd, evidenceQueryId?, explanation | Null actual = chưa đo; 0 = đã đo và bằng0 |
| EvidenceArtifact | kind, privateStorageKey, sha256, capturedAt, relatedEntityId?, dataMode, verifiedBy?, redactionStatus | Chứng từ/ảnh/biên bản; quyền download có audit |

## 6. State machine và quy tắc hiển thị

### 6.1. Campaign

State machine dưới đây **chỉ áp dụng campaign pv mới**. PartnerProfile vẫn PendingApproval/Active/Rejected/Suspended; PartnerContentRequest vẫn Draft/Pending/Approved/Rejected. Review Approved không tự chuyển PartnerProfile.Active hoặc campaign.ACTIVE; mỗi bước kiểm quyền và readiness riêng.

```text
DRAFT -> SUBMITTED -> APPROVED -> ACTIVE
                       |           |-> CLAIM_PAUSED -> ACTIVE
                       |           |-> REDEMPTION_SUSPENDED -> ACTIVE (admin review)
                       |           |-> ENDED
                       |-> REJECTED -> DRAFT (version mới)
```

Claim còn phải kiểm claimStartsAt <= now < claimEndsAt; redeem còn phải kiểm redeemEndsAt và snapshot instance. Hết claimEndsAt không đồng nghĩa hết quyền dùng đã cấp. Scheduler cập nhật trạng thái giúp vận hành nhưng endpoint luôn kiểm thời gian, không phụ thuộc scheduler chạy đúng phút.

### 6.2. Voucher

```text
CLAIM -> ISSUED -> REDEEMED (terminal, duy nhất)
              |-> EXPIRED (terminal)
              |-> REVOKED (terminal)
```

`WAITING_FOR_NEXT_VISIT`, `READY_TO_USE`, `TEMPORARILY_SUSPENDED` là display/eligibility state suy ra, không tạo lại instance. `EXPIRED` có thể được materialize bởi job nhưng effective state phải đúng ngay tại API.

### 6.3. Quy tắc UI theo ưu tiên

1. User có instance: ưu tiên trạng thái instance (đã dùng, hết hạn, bị thu hồi, chưa tới giờ, còn dùng được); không bị che bởi “hết suất”.
2. Chưa có instance: kiểm quyền user -> campaign/time -> eligibility -> quota. Trả `canClaim=false` cùng reasonCode.
3. Hết quota: danh sách `claimableOnly=true` không trả offer; màn đã mở/landing vẫn có summary “Ưu đãi đã hết lượt nhận”. Có thể xem quán nhưng không hiện QR redemption.
4. Voucher dùng xong: bỏ khỏi Active Wallet, giữ History, lịch trình ghi “Đã sử dụng ưu đãi”, không render lại CTA claim.
5. Dữ liệu cache chỉ dùng xem offline, không xác thực quyền dùng. Mở ví/đổi tab/foreground phải refetch; receipt server là chuẩn.
6. Mục UI “Voucher hết hạn” gọi `bucket=history`, gồm REDEEMED/EXPIRED/REVOKED theo effective status. Không đổi tên bucket thành `expired` rồi lọc bỏ voucher đã dùng. Trạng thái REDEEMED có ưu tiên hơn ngày expiresAt.
7. Trang chủ dùng `ownedVoucherId`, `alreadyClaimed`, `canClaim`, `claimUnavailableReason`, `effectiveStatus` để quyết định “Lưu voucher”/“Đã lưu”/“Xem lịch sử”; client không tự suy đoán từ danh sách cache.

## 7. Contract API đề xuất

**Phải xác định service host trước path:** mobile đang có ba ServiceKey `iam`, `task`, `aiTour` trong `Front-End/src/utils/apiConfigStore.ts`. Không có một gateway đang được chứng minh là phục vụ toàn bộ các route này.

- Mục7.1/7.3: route module voucher mới dưới **Task `/api/v2`**; mobile gọi `request("task", path, ...)`.
- Mục7.2: identity/profile/content/invoice dùng **IAM `/api/...` hiện hữu hoặc extension cùng namespace**; mobile/web gọi IAM baseURL. Campaign/quota/QR mới ở Task `/api/v2/admin/...`.
- Mục7.4: itinerary dùng **AITour `/api/v1/itinerary`** -> Python; không gọi Python trực tiếp từ mobile. Mission dùng Task route hiện hữu.
- Report commercial/profile lấy IAM, report voucher lấy Task; báo cáo tổng hợp kết hợp có kiểm soát, không giả JOIN xuyên DbContext/DB.
- Route `/api/vouchers` cũ không đổi nghĩa âm thầm. JSON IAM/Task mới camelCase; contract itinerary hiện hữu snake_case giữ nguyên.

### 7.1. Public / acquisition

| Method/path | Auth | Tác dụng |
|---|---|---|
| GET `/public/qr/{qrKey}` | Public | Resolve campaign/location, trạng thái, public download/open link; không cấp voucher |
| POST `/public/acquisition-contexts` | Public + rate limit | Tạo context opaque với qrKey; không giữ suất |
| POST `/me/acquisition-contexts/bind` | Traveler | Bind context sau login, server xác thực hash/TTL/account |
| GET `/public/places/{id}` | Public | Chỉ nội dung published và offer summary, không chứa code/token/staff/contact riêng |

### 7.2. Web quản trị nhập thủ công

**Các route sau đã có trên IAM - tái sử dụng, không tạo lại:**

| Method/path đầy đủ | Hiện trạng / giới hạn |
|---|---|
| POST `/api/partner-auth/register`, `/api/partner-auth/login` | Owner Partner; login cần profile Active; response accessToken theo serializer hiện tại |
| GET/PUT `/api/partner/me`, GET `/api/partner/dashboard` | Scope theo owner UserId hiện hữu |
| GET/POST `/api/partner/requests`; GET/PUT `/{id}`; POST `/{id}/submit` | Partner request; PUT chỉ Draft; submit Pending |
| POST `/api/partner/requests/{id}/images`; DELETE `/{id}/images/{imageId}` | Upload hiện có; giữ contract, bổ sung quyền/validation khi mở admin route |
| GET `/api/admin/partner-portal/dashboard`, `/users`, `/partners`, `/requests`, `/requests/{id}` | Admin portal hiện hữu |
| PATCH `/api/admin/partner-portal/partners/{id}/status` | PendingApproval/Active/Rejected/Suspended; không đổi casing |
| POST `/api/admin/partner-portal/requests/{id}/review` | Payload hiện có `{isApproved, reason}`; review audit + transaction; chỉ Pending |
| POST/GET `/api/invoices`, GET `/api/invoices/my`, GET `/{id}`, PATCH `/{id}/paid` | Giữ contract/PartnerInvoice; mark Paid chưa là evidence đã kiểm chứng |

**Extension cần thêm, chưa có trong source baseline:**

| Host / method/path đầy đủ | Tác dụng / quy tắc |
|---|---|
| IAM POST `/api/admin/partner-portal/partners` | Tạo/liên kết profile và owner thật theo rule mục3.3; không gọi đăng ký Partner bằng password dùng chung |
| IAM PATCH `/api/admin/partner-portal/partners/{id}` | Sửa thông tin có audit; không thay route PATCH status hiện hữu |
| IAM POST `/api/admin/partner-portal/partners/{partnerId}/requests` | Editor/Admin nhập content draft thay partner, cùng service/DTO validate, lưu createdBy/source |
| IAM PUT `/api/admin/partner-portal/requests/{id}`; POST `/{id}/submit` | Nhập/sửa Draft và submit với actor DISA; không giả UserId owner |
| IAM POST `/api/admin/partner-portal/requests/{id}/images` | Admin upload thay, dùng chung media policy; ảnh quyền riêng tư không để route anonymous |
| IAM POST `/api/admin/partner-portal/requests/{id}/revisions` | Revision draft mới từ request Approved/Rejected, liên kết history; không mở PUT cũ cho mọi status |
| IAM POST/PATCH `/api/admin/partner-portal/locations[/{id}]` | Location canonical + partnerId/sourceRequestId; version/concurrency |
| IAM POST `/api/admin/partner-portal/locations/{id}/publish` | Approved request + Active profile + consent -> publishedVersion/outbox |
| IAM POST `/api/admin/partner-portal/partners/{id}/staff-invitations` | User thật + membership; không profile mới cho từng staff |
| IAM PATCH `/api/admin/partner-portal/memberships/{id}` | Location scope/revoke, check current authorization |
| Task POST `/api/v2/admin/campaigns` | Campaign/offer/quota draft, location snapshot readiness |
| Task PATCH `/api/v2/admin/campaigns/{id}` | If-Match rowVersion; không sửa snapshot đã cấp |
| Task POST `/api/v2/admin/campaigns/{id}/publish` | Policy Admin + consent/version nguồn hợp lệ |
| Task POST `/api/v2/admin/campaigns/{id}/pause-claims` | Reason, giữ quyền đã cấp |
| Task POST `/api/v2/admin/campaigns/{id}/suspend-redemptions` | Admin incident + support notice |
| Task POST `/api/v2/admin/campaigns/{id}/quota-adjustments` | Evidence đối tác và quota mới |
| Task POST `/api/v2/admin/campaigns/{id}/qr-links` | Acquisition QR đúng location/campaign |

Editor capability chưa được main cấp: MVP có thể dùng Admin có audit; nếu thêm Editor policy thì authorize riêng endpoint mới/service, **không nới toàn bộ AdminPartnerController từ Admin sang mọi Partner/Manager**. Staff voucher mới kiểm IAM membership hiện tại, không dùng global role Partner làm quyền redeem ở tất cả quán.

#### 7.2.1. Publish từ IAM sang app/AI/Task

1. Review giữ route, DTO và PartnerReviewAudit cũ. Publish action bổ sung đọc approved request, partner active, location ổn định và quyền nội dung.
2. Transaction IAM cập nhật PartnerLocation publishedVersion và ghi outbox; event payload tối thiểu `eventId`, `partnerId`, `locationId`, `sourceRequestId`, `version`, `status`, public name/address/GPS/hours/price/image references, rights-valid flag. Không gửi contact riêng, password hoặc invoice.
3. Consumer Task upsert PartnerLocationSnapshot, consumer catalog AI upsert location projection. UNIQUE eventId và version monotonic: event cũ không ghi đè bản mới. Không đổi legacy activity_id khi đồng bộ.
4. Admin UI có `publicationStatus`/lỗi đồng bộ; Approved nhưng consumer lỗi thì chưa hiện “đã xuất bản thành công trên app”. Retry outbox không tạo location mới.
5. Campaign chỉ claim được khi location snapshot đúng version/trạng thái và quyền nguồn còn hợp lệ. Mất membership/partner bị Suspended phải fail closed ở claim/redeem theo policy incident, không đợi cache vô hạn.
6. Nếu pilot chưa có message broker, dùng worker đọc outbox và API nội bộ authenticated để upsert; không cho public/mobile gọi endpoint projection. Không gọi HTTP trong transaction review rồi xem đó là atomic publish xuyên service.

### 7.3. Traveler và quầy đối tác

| Method/path | Hành vi |
|---|---|
| GET `/me/offers?locationId=&tripId=&claimableOnly=true` | Catalog personalized; không trả mã dùng |
| GET `/me/offers?surface=home&claimableOnly=false` | Feed trang chủ theo HOME, published/eligibility; chỉ trả card có thể nhận hoặc card còn active đã lưu. Mã terminal ẩn khỏi feed nhận mới; vẫn ở history. Không trả raw token |
| POST `/me/campaigns/{campaignId}/claim` | JWT + Idempotency-Key; context/trip optional validated; một instance |
| GET `/me/vouchers?bucket=active\|history&status=` | Phân trang, effective status, eligibility, serverNow. active: chưa dùng còn hạn; history: đã dùng/hết hạn/thu hồi, có bộ lọc status |
| GET `/me/vouchers/{id}` | Ownership từ JWT; instance + lịch sử/receipt, không trả token cũ |
| POST `/me/vouchers/{id}/presentations` | JWT; mint token90s, chống spam; revoke previous; response no-store |
| DELETE `/me/vouchers/{id}/presentations/current` | Traveler đóng màn có thể revoke mã, không revoke voucher |
| POST `/partner/voucher-verifications` | Staff resolve QR hoặc short code, location + eligibleSubtotal/orderRef; trả preview + ticket |
| POST `/partner/redemptions` | Staff + Idempotency-Key; verification ticket, quote kiểm lại; atomically redeem |
| GET `/partner/redemptions?locationId=&from=&to=` | Scope staff/manager, dữ liệu đối chứng, không raw token |
| POST `/partner/redemptions/{id}/disputes` | Staff/manager mở ticket, không mở lại mã |
| POST `/admin/redemptions/{id}/adjustments` | Admin VOID có reason/evidence; không phục hồi instance |

Trong mọi API `/me`, request **không có userId quyết định owner**. Trong `/partner`, server tra membership/location hiện tại, không tin organizationId của client.

DTO card trang chủ tối thiểu: `campaignId`, `locationId`, `partnerName`, `title`, `imageUrl`, `discountLabel`, `minSpend`, `validityDescription`, `claimEndsAt`, `redeemEndsAt`, `ownedVoucherId?`, `alreadyClaimed`, `canClaim`, `claimUnavailableReason?`, `effectiveStatus?`, `redeemableFrom?`, `expiresAt?`, `serverNow`. Khi chưa claim, expiresAt cá nhân chưa tồn tại: trả null và validityDescription, không bịa một hạn cá nhân.

DTO ví/lịch sử bổ sung: `bucket`, `status`, `displayState`, `statusLabel`, `redeemedAt?`, `revokedAt?`, `receiptRef?`, `canPresent`, `locationId`, `expiresAt`, `serverNow`. Bucket suy ra từ trạng thái hiện tại, không cần cột persist riêng. `status` máy đọc giữ ổn định; statusLabel dịch VI/EN ở client hoặc theo locale contract.

### 7.4. Trip / mission / hậu chuyến đi

Các path đích chưa có chỉ là extension; ưu tiên tái sử dụng route chính xác hiện tại:

| Nhóm | API tối thiểu / hành vi |
|---|---|
| Generate | Có: AITour POST `/api/v1/itinerary/generate`; thêm `/api/v1/itinerary/generation-jobs` + GET job nếu cần, dùng cùng orchestrator |
| Trip cloud history | Có GET `/api/v1/itinerary/{id}`, DELETE `/{id}`, GET `/{id}/activities/{activityId}/alternatives`, PATCH `/{id}/activities/{activityId}`, POST `/{id}/activities/{activityId}/coordinates`; thêm list/lifecycle/metadata có version, không tạo /me/trips như hệ thứ hai |
| Lifecycle | POST trip `/start`, `/complete`, `/cancel`; PUT stop `/visit` hoặc `/skip` idempotent |
| Mission | Giữ Task POST `/api/user-missions/assign`, GET `/api/user-missions/user/{userId}`, GET summary/detail và submission hiện hữu; thêm ownership/JWT và status adapter. Route /me hoặc accept mới nếu cần là facade cùng service, không assignment repository thứ hai |
| Reward | GET `/me/rewards/ledger`, `/me/rewards/balance`; không có endpoint traveler tự cộng |
| Expense/summary | POST/PATCH trip `/expenses`; GET trip `/summary`; tách estimated và actual |
| Feedback | POST `/me/reviews`, `/me/support-tickets`; report place data và voucher issue |
| Notifications | GET/PATCH `/me/notifications`; preference/consent; deep link có auth |
| Account | Giữ IAM `/api/auth/...`, DELETE `/api/auth/delete-account` và POST `/api/auth/verify-password` hiện có; thêm cleanup/revoke/membership handoff, không tạo POST account-deletion song song |
| Translate | GET capability/status, POST text/speech, POST quality feedback; không lộ service key |
| Admin QA | Review submissions, issues, data corrections; audit khi đổi kết quả/reward |

### 7.5. Ví dụ claim và response

```http
POST /api/v2/me/campaigns/{campaignId}/claim
Authorization: Bearer <traveler-access-token>
Idempotency-Key: <uuid-generated-once-for-this-action>
Content-Type: application/json
```

```json
{
  "acquisitionContextToken": "<optional-opaque-context>",
  "tripId": null,
  "tripStopId": null
}
```

```json
{
  "voucherId": "<uuid>",
  "voucherRef": "DV-EXAMPLE-ONLY",
  "campaignId": "<uuid>",
  "locationId": "<uuid>",
  "status": "ISSUED",
  "displayState": "WAITING_FOR_NEXT_VISIT",
  "redeemableFrom": "2026-11-08T17:00:00Z",
  "expiresAt": "2026-12-08T17:00:00Z",
  "alreadyClaimed": false,
  "canPresent": false,
  "serverNow": "2026-11-08T08:00:00Z"
}
```

Timestamp chỉ minh họa, không là hạn cố định. Retry cùng key nhận đúng response cũ; request mới sau đã claim trả instance hiện tại và `alreadyClaimed=true`. Mã snapshot ngày mai không được tạo nếu campaign kết thúc trước redeemableFrom.

### 7.6. Presentation / verification / confirm

```json
{
  "presentationId": "<uuid>",
  "qrPayload": "disa-voucher:v1:<random-opaque-token>",
  "shortCode": "<10-random-characters>",
  "expiresAt": "<UTC-now-plus-90-seconds>",
  "serverNow": "<UTC-now>"
}
```

Presentation không dùng URL mở website tùy ý; scanner kiểm prefix/purpose và gửi token qua HTTPS body. Chấp nhận một trong QR token hoặc shortCode, không cả hai. Mã nhập tay là secret tạm thời, không phải voucherRef.

```json
{
  "locationId": "<assigned-location>",
  "presentationToken": "<opaque-token-from-QR>",
  "eligibleSubtotal": 200000,
  "orderRef": "POS-EXAMPLE-001"
}
```

Verification response gồm `verificationTicket`, `expiresAt`, `voucherRef`, title/terms snapshot, `eligibleSubtotal`, `discountAmount`, `netAmount`, `canConfirm`. Ví dụ 10%, cap30.000đ, eligibleSubtotal200.000đ -> giảm20.000đ. Server tính fixed/percent, floor tiền VND sau tính, không âm hoặc vượt subtotal; GIFT trả mô tả quyền lợi, không bịa giá tiền quà.

```http
POST /api/v2/partner/redemptions
Authorization: Bearer <staff-access-token>
Idempotency-Key: <persisted-client-action-uuid>
```

```json
{ "verificationTicket": "<short-lived-ticket>" }
```

```json
{
  "redemptionId": "<uuid>",
  "receiptRef": "DR-EXAMPLE-001",
  "voucherRef": "DV-EXAMPLE-ONLY",
  "status": "COMMITTED",
  "voucherStatus": "REDEEMED",
  "locationId": "<uuid>",
  "eligibleSubtotal": 200000,
  "discountAmount": 20000,
  "netAmount": 180000,
  "redeemedAt": "<UTC-time>"
}
```

Receipt này xác nhận áp dụng ưu đãi, **không tự xác nhận đã thanh toán hóa đơn**. PaymentEvidence là bước riêng nếu cần chứng minh giao dịch thực.

## 8. Transaction, concurrency và idempotency bắt buộc

### 8.1. Claim nguyên tử

```text
Authenticate traveler; normalize body; compute requestHash
BEGIN SQL TRANSACTION
  Obtain/create idempotency record under UNIQUE(actor,operation,key)
  If completed same key+hash -> return stored result; different hash ->409
  Lock Campaign row (UPDLOCK,HOLDLOCK; consistent lock order)
  Query UNIQUE(campaignId,travelerId)
  If existing -> return that instance; do not increment stock
  Check current claim policy, offer version, source eligibility, dates
  Check quota: issuedCount < totalQuota
  Compute redeemableFrom/expiresAt; require a nonempty usable interval
  INSERT VoucherInstance (unique campaign,user)
  Increment issuedCount; insert AuditLog + OutboxEvent
  Store idempotency success response (no sensitive raw token)
COMMIT
```

Hai account tranh suất thứ10 -> một request thành công, request còn lại409 STOCK_EXHAUSTED. Hai request cùng user từ QR và itinerary -> cùng instance, một lần issuedCount. Nếu lỗi unique/deadlock, rollback toàn transaction rồi đọc/retry có giới hạn; không catch rồi commit counter riêng.

### 8.2. Present và resolve

- Presentation lock instance; kiểm owner, effective status, hạn dùng và campaign redemption suspension. Revoke active cũ rồi insert mới cùng transaction.
- Token cryptographically random >=128 bits; lưu SHA-256 hash của token entropy cao; shortCode/ticket lưu HMAC hash với secret server và keyVersion, token không log.
- Unique ACTIVE presentation theo instance; expired active được revoke trong transaction trước insert. TTL vẫn phải so khi đọc.
- Response presentation `Cache-Control: no-store`; tạo lại sau timeout có thể cấp token mới và revoke token cũ, **không lưu raw token trong IdempotencyRecord**. Chỉ claim/redeem cần replay response chính xác.
- Resolve tạo verification không consume instance; throttle và ràng buộc location/staff. Hạn ticket = min(now+30s,presentation.expiresAt,voucher.expiresAt).

### 8.3. Confirm nguyên tử

```text
Authenticate staff; verify current account + active location membership
BEGIN SQL TRANSACTION
  Lock/read idempotency actor+operation+key
  If same completed request -> return original COMMITTED receipt (even ticket now expired)
  Validate requestHash; do not reveal another staff's idempotency result
  Resolve immutable references; lock Campaign -> VoucherInstance
       -> Presentation -> Verification (same ordering across operations)
  Recheck tenant/location/membership, no self-redemption
  Recheck voucher ISSUED, now >= redeemableFrom, now < expiresAt
  Recheck presentation ACTIVE/not expired, verification bound/not consumed/not expired
  Recheck redemption suspension, quote/conditions and snapshot
  INSERT Redemption (UNIQUE voucherInstanceId)
  UPDATE voucher ISSUED -> REDEEMED; affected rows must equal1
  UPDATE presentation CONSUMED; verification consumedAt
  Increment redeemedCount (NOT issuedCount)
  INSERT audit + outbox; save idempotent receipt response
COMMIT
```

Nếu dùng key khác sau mã đã dùng ->409 VOUCHER_ALREADY_REDEEMED; không tạo redemption thứ2. Nếu mất mạng sau commit, staff retry **cùng key**, không chuyển sang “đã thất bại” hoặc tự áp dụng hai lần. UNIQUE DB vẫn là lớp bảo vệ cuối.

Không giữ SQL transaction mở lúc gọi AI, gửi email, upload file hoặc gọi dịch vụ ngoài. Gửi event sau commit qua outbox; consumer chịu được gửi lặp.

### 8.4. SQL skeleton cho các invariants cốt lõi

Đây là DDL minh họa constraints **chỉ cho schema pv mới trong Task**, không phải migration hoàn chỉnh. EF phải cấu hình schema/table rõ; không chạy vào dbo legacy. UserMissions/reward cũ không nằm trong script này vì cần backfill và bảo toàn semantic dedup trước khi thêm UNIQUE.

```sql
CREATE UNIQUE INDEX UX_VoucherInstance_Campaign_Traveler
  ON pv.VoucherInstances(CampaignId, TravelerId);
CREATE UNIQUE INDEX UX_VoucherInstance_Reference
  ON pv.VoucherInstances(VoucherRef);
CREATE UNIQUE INDEX UX_Redemption_Instance
  ON pv.Redemptions(VoucherInstanceId);
CREATE UNIQUE INDEX UX_Presentation_TokenHash
  ON pv.VoucherPresentations(TokenHash);
CREATE UNIQUE INDEX UX_Presentation_ShortCodeHash_Active
  ON pv.VoucherPresentations(ShortCodeHash) WHERE Status = 'ACTIVE';
CREATE UNIQUE INDEX UX_Presentation_ActivePerInstance
  ON pv.VoucherPresentations(VoucherInstanceId) WHERE Status = 'ACTIVE';
CREATE UNIQUE INDEX UX_Verification_TicketHash
  ON pv.VoucherVerifications(TicketHash);
CREATE UNIQUE INDEX UX_Idempotency_Actor_Operation_Key
  ON pv.IdempotencyRecords(ActorId, Operation, [Key]);
ALTER TABLE pv.Campaigns ADD CONSTRAINT CK_Campaign_Quota
  CHECK (TotalQuota >= 0 AND IssuedCount >= 0
     AND RedeemedCount >= 0 AND RedeemedCount <= IssuedCount
     AND IssuedCount <= TotalQuota);
ALTER TABLE pv.VoucherInstances ADD CONSTRAINT CK_Voucher_TimeWindow
  CHECK (IssuedAt <= RedeemableFrom AND RedeemableFrom < ExpiresAt);
CREATE INDEX IX_Voucher_Wallet
  ON pv.VoucherInstances(TravelerId, Status, ExpiresAt);
CREATE INDEX IX_Redemption_LocationTime
  ON pv.Redemptions(LocationId, RedeemedAt);
```

Thêm FK kép hoặc validation transaction để instance/campaign/offer/location cùng scope; offerVersion thuộc đúng campaign; membershipLocation thuộc cùng org. Thiết kế one-active presentation không dùng predicate `ExpiresAt > GETUTCDATE()` trong filtered index: không hợp lệ cho mục đích này; cập nhật ACTIVE -> REVOKED khi thay mã và kiểm TTL trong service.

### 8.5. Void, lỗi quầy và hoàn lại quyền lợi

- MVP **không mở lại voucher cũ** sau void/reverse; yêu cầu “không tái sử dụng” được giữ ngay cả khi có tranh chấp.
- Void là adjustment có lý do/evidence, không xóa redemption và không hoàn quota. Báo cáo gross/net phải thể hiện adjustment.
- Nếu cần bồi hoàn, admin tạo ưu đãi bồi hoàn riêng, có xác nhận đối tác/quota mới và liên kết ticket gốc. Không reset status về ISSUED.
- Không xác nhận offline. Khi backend mất kết nối, staff chưa được hiển thị “Voucher hợp lệ/đã dùng thành công” chỉ từ cache hoặc QR đọc được.

## 9. Error contract và trải nghiệm lỗi

```json
{
  "code": "STOCK_EXHAUSTED",
  "message": "Ưu đãi tại địa điểm này đã hết lượt nhận.",
  "requestId": "<trace-id>",
  "retryable": false,
  "fieldErrors": null
}
```

| HTTP / code | Xử lý client |
|---|---|
| 401 AUTH_REQUIRED / SESSION_EXPIRED | Đăng nhập/refresh một lần, giữ navigation context, không vòng lặp |
| 403 STAFF_FORBIDDEN / SELF_REDEMPTION_FORBIDDEN | Chặn xác nhận; không lộ dữ liệu tenant khác |
| 404 NOT_FOUND | Entity không tồn tại/không thuộc scope, không enumerate voucher |
| 409 STOCK_EXHAUSTED | Ẩn CTA nhận, giữ lời giải thích; không ảnh hưởng mã đã có |
| 409 VOUCHER_ALREADY_REDEEMED | Đóng QR, refetch lịch sử; staff thấy trạng thái đã sử dụng |
| 409 IDEMPOTENCY_KEY_REUSED / VERSION_CONFLICT | Không tự gửi payload khác cùng key; reload/review |
| 422 VOUCHER_NOT_YET_VALID / VOUCHER_EXPIRED | Hiển thị mốc giờ địa phương từ server |
| 422 WRONG_LOCATION / CAMPAIGN_INACTIVE | Hướng dẫn đúng cơ sở/offer; không tự đổi location |
| 422 TOKEN_INVALID / TOKEN_EXPIRED / TOKEN_REVOKED | QR mới nếu voucher còn hợp lệ; không brute-force |
| 422 MIN_SPEND_NOT_MET / TERMS_NOT_MET | Staff sửa hóa đơn hoặc giải thích điều kiện, không consume |
| 422 INVALID_TRIP_DATES / INSUFFICIENT_PLACE_DATA | Chỉ rõ trường/khu vực cần đổi, giữ form đã nhập |
| 422 VIDEO_TOO_SHORT / LOCATION_UNVERIFIED | Không thưởng; hướng dẫn quay lại/cấp quyền/điểm đúng |
| 429 RATE_LIMITED | Retry-After, cooldown; không tự spam retry |
| 503 SERVICE_UNAVAILABLE / GENERATION_TIMEOUT | Giữ form/jobId/idempotencyKey; cho kiểm tra kết quả/retry an toàn |

Không trả stack trace/connection string/PII. Server lỗi không được làm mất lịch trình đã lưu hoặc trừ điểm/quota nửa chừng.

## 10. Đồng bộ, thông báo và hiệu năng

- Backend là source of truth; query keys có travelerId, tripId/campaignId/locationId phù hợp; clear cache khi account đổi.
- Sau claim: invalidate wallet và offer eligibility. Sau accept mission: invalidate trip mission state và mission list. Sau completion: invalidate reward balance/mission/trip summary.
- Sau redemption: outbox phát `voucher.redeemed`, notification cho traveler, cập nhật report; mobile refetch ngay khi foreground hoặc quay lại ví.
- MVP không bắt buộc WebSocket. Khi màn QR đang mở có thể poll trạng thái mỗi3 giây tối đa90 giây, dừng khi background/terminal; chỉ một request đang chạy. SSE/push là nâng cấp, reconnect luôn GET lại trạng thái.
- Mọi response trạng thái thời gian có `serverNow`; client hiển thị countdown theo offset, không dùng giờ máy để quyết định hợp lệ.
- Catalog cache theo publishedVersion; personalize wallet/eligibility không dùng shared public cache. Stock có thể stale khi xem nhưng claim transaction phải đúng.
- Generation job bounded timeout/retry; validation/candidate selection local trước, không nhiều lần gọi LLM cho từng ngày/địa điểm không cần thiết.
- Đề xuất SLO pilot: claim/redeem p95 <=2 giây không tính mạng khách; generate p95 <=45 giây trên bộ test cố định. Báo giá trị **đo thực**, không ghi đã đạt khi chưa benchmark.
- Có `/health/live` cho process và `/health/ready` cho dependency DB; live200 không có nghĩa DB/AI sẵn sàng. Admin runbook chỉ rõ service AWS do ai deploy, version, health và rollback; restart Expo không cập nhật backend AWS.

## 11. Analytics, report và evidence OC3

### 11.1. Event tối thiểu

| Nhóm | Event | Nguồn tin cậy |
|---|---|---|
| Acquisition | qr_resolved, landing_viewed, store_link_clicked, app_opened_from_partner | Client/server kết hợp, chỉ là touchpoint |
| Activation | account_created, first_itinerary_created | Server business event; first dedup account |
| Trip | trip_started, stop_visited, stop_skipped, trip_completed | Server lifecycle; phân loại auto/user |
| Mission | mission_assigned, mission_submitted, mission_completed, reward_granted | Server sau commit |
| Voucher | offer_viewed, voucher_claimed, voucher_presented, voucher_redeemed, voucher_expired, redemption_voided | Claim/redeem/void bắt buộc server |
| Trang chủ / lưu | home_offer_viewed, home_offer_save_clicked, trip_planning_started_from_voucher | View/click là tương tác; chỉ voucher_claimed sau commit mới tính cấp suất, có source HOME |
| Partner | place_published, staff_invited, staff_invite_accepted, staff_business_action | Server + actor riêng |
| Quality | generation_failed, media_validation_failed, support_ticket_opened, translation_feedback | Không log text/audio nhạy cảm mặc định |

Envelope: `eventId`, `eventType`, `schemaVersion`, `occurredAtUtc`, `receivedAtUtc`, `actorPseudonym`, `organizationId?`, `locationId?`, `campaignId?`, `tripId?`, `source?`, `dataMode`, `requestId`. Event transport có thể at-least-once, consumer unique eventId; metric distinct theo business IDs khi cần.

### 11.2. Định nghĩa đo

- First itinerary user: distinct traveler có generation SUCCEEDED và trip đã persist, không phải bấm nút generate.
- Active user cho report nội bộ: distinct account có hành động giá trị (tạo/bắt đầu trip, verified visit, mission submit hợp lệ, claim/redeem) trong kỳ; báo số mở app riêng. Giảng viên phải chấp thuận định nghĩa/kỳ khi dùng ngưỡng OC3.
- D7/D30 retention: cohort first activation, qualifying event tại ngày/khung được định nghĩa, timezone cố định; không lấy danh sách tester tick hằng ngày thay thế.
- Active QR partner: location đã publish, staff active, có ảnh đặt QR và có hoạt động thật trong kỳ theo định nghĩa chốt; tách onboarded, deployed QR, traffic-active, redemption-active.
- Staff trực tiếp dùng: account riêng accepted invite + ít nhất một hành động nghiệp vụ hợp lệ trong kỳ; không tính 20 invite chưa dùng hoặc team test giả staff.
- Claim/redemption theo distinct voucherInstanceId/redemptionId; refresh QR hoặc resolve nhiều lần không tăng.
- Paid organization: khoản DISA đã nhận, chứng từ được xác minh; miễn phí/đã ký nhưng chưa trả không tính.
- Free partner trong pilot đã đồng ý: lưu agreement/consent, startAt/freeEndsAt và trạng thái triển khai/sử dụng; không cần PartnerInvoice.Paid để Active/publish/claim/redeem. Doanh thu thực tế bằng0 thì báo0; chưa đo thì null, không đổi tên GMV thành doanh thu DISA.
- Store click != install; claim != visit; redemption != paid transaction; merchant GMV != DISA revenue.

### 11.3. Report APIs

- GET `/partner/reports/summary` và `/partner/reports/redemptions.csv`: đúng org/location scope; voucherRef, redemptionRef, offer, issued/redeemed time, orderRef, discount, paymentVerificationStatus, adjustment; không raw QR/PII toàn bộ khách.
- GET `/admin/reports/oc3`: date filter, assessmentModel=APPROVED_FREE_PILOT, metadata đồng ý, metric definition version, real/test exclusions; trả actual và evidence links. Tách freePartners/activeStaff/realUsers/claims/redemptions khỏi paidOrganizations/paidTransactions/DISARevenue; không bắt có invoice để xuất report pilot.
- GET `/admin/reports/oc2-comparison`: baseline/target/actual/achievementPercent/reason; target0 phải trả tỷ lệ null hoặc notApplicable, không chia0.
- GET `/admin/reports/commercial-payments`: riêng các khoản DISA thu; nguồn khác quán tách loại.
- POST `/admin/evidence-exports`: export async, private download TTL, audit ai tải. Có index chứng từ và bản redacted dùng trình bày; chứng từ đầy đủ chỉ chia sẻ đúng người được phép.
- CSV chống formula injection với trường bắt đầu `=`, `+`, `-`, `@`; dùng encoding UTF-8 và ngày UTC rõ ràng. Tổng report phải khớp records cùng filter/timezone/dataMode.

## 12. Bảo mật, quyền riêng tư và chống lạm dụng

- Không lưu token QR, shortCode, verificationTicket trong log, analytics, Sentry breadcrumbs, URL query, ảnh debug hoặc CSV. Web/app tắt capture dữ liệu nhạy cảm khi gửi telemetry.
- Web staff/admin dùng cookie HttpOnly/Secure/SameSite và CSRF nếu cookie auth; hoặc cơ chế bearer phù hợp nhưng không đặt token vào link công khai. RBAC server trên mọi action.
- Default rate-limit đề xuất: claim10/phút/account; present6/phút/voucher; resolve20/phút/staff và chặn10 mã sai/5 phút; giới hạn IP thêm lớp, không khóa toàn quán chỉ vì dùng chung NAT. Load test và cấu hình lại khi cần.
- Không thể bảo đảm “một người thật một mã” chỉ bằng email/account. Nếu đối tác yêu cầu, bổ sung xác minh số điện thoại/anti-abuse có consent, phân biệt với giới hạn một account/campaign.
- Device/IP chỉ là risk signal có TTL; không dùng fingerprint ngầm để giả nhận diện chắc chắn.
- Attachment evidence private, signed URL ngắn hạn, upload allowlist và size limit; không nhận URL tùy ý để backend fetch nội bộ (SSRF).
- Audit append-only, quyền xuất riêng, backup/restore test. Retention duration phải được owner phê duyệt trước production; không để mặc định lưu PII/ảnh/vị trí vô hạn.
- Khóa staff phải có hiệu lực ở request tiếp theo, không đợi JWT dài hạn hết hạn; check membership hoặc security stamp/version server.
- Tắt QR acquisition không hard-delete record; lịch sử source vẫn còn. Khóa campaign redemption phải có incident, thông báo và kế hoạch xử lý các quyền lợi đã cấp.

## 13. Migration và tương thích với app hiện tại

1. Baseline main local là commit ở đầu tài liệu. Trước code phải so main thực tế và migration history từng DB; source chưa chứng minh AWS đã chạy migration. Backup trước khi đổi, giữ nguyên config/secrets/máy thành viên. Không fetch/pull/merge hoặc force-push chỉ vì tài liệu yêu cầu.
2. IAM đã có `20261029151437_AddPartnerPortalTables` và snapshot: tạo migration **mới kế tiếp** cho extension, không sửa migration cũ hoặc CreateTable PartnerProfiles/PartnerContentRequests/PartnerInvoices lần2. Nếu DB được tạo thủ công/khác snapshot, reconcile có kiểm chứng, không tự đánh dấu migration đã chạy. Task thêm schema pv + read model bằng migration riêng; Python dùng migration PostgreSQL riêng. Không dùng EnsureCreated thay migration.
3. **Không đổi tên VoucherRedemption cũ thành chứng từ sử dụng tại quầy.** Record cũ chỉ chứng minh đổi điểm, chưa có staff/location/unique code. Gắn `LEGACY_POINTS_CLAIM` và `dataMode` phù hợp; không đưa vào real merchant redemption.
4. Mã voucher cũ dùng chung: không tự biến thành mã mới hợp lệ. Chỉ reissue khi admin có đối tác/campaign/quota đã xác nhận, liên kết legacy record và không trừ điểm lần nữa.
5. Ngăn lỗ hổng route cũ: add auth/ownership, rate-limit, khóa raw-code exposure; app cũ không còn có thể dùng mã chung tại quầy. Thông báo update rõ ràng, không fallback âm thầm sang luồng thiếu bảo mật.
6. Feature flags tách partner catalog, claim, staff redemption, mission validation; pilot bằng dataMode INTERNAL_TEST trước REAL.
7. Test staging với hai tenant/two accounts, seed quota10. Không seed brand/offer demo thành đối tác thật hoặc để `DEMO` lẫn catalog public.
8. Deploy migration tương thích trước -> backend -> web -> mobile development/release build. Xác minh API baseURL Settings/env trên máy thật; không commit config cá nhân/secret.
9. Nếu rollback, dừng claim/redeem bằng maintenance flag, giữ records đã phát sinh và dùng forward fix/restore kế hoạch có đối soát. Không rollback bằng cách drop bảng đang có redemption thật.
10. QR App Links/referrer/native media cần kiểm trên development/release build; không lấy việc mở Expo Go làm bằng chứng install-to-voucher đã hoạt động production.

### 13.1. File/module boundary để hạn chế Git conflict

- IAM: extension service/DTO/controller riêng cho manual entry/publication/membership; review logic dùng service chung, gọi từ route cũ và route mới. Chỉ chỉnh IAMDbContext và migration/snapshot khi thật sự cần; phân một người sở hữu migration trong mỗi DbContext.
- Task: lớp mới đặt theo namespace/module PartnerVoucher, EF map schema pv; giữ VoucherController/VoucherService legacy ngoài module mới, chỉ harden auth/ownership nơi cần. Không rename entity VoucherRedemption cũ.
- Mobile: thêm `src/api/endpoints/partnerVouchers.ts` và types tương ứng, tiếp tục request("task",...). Không thay `vouchers.ts` đổi điểm thành luồng mới mà không adapter; kiểm role/route với IAM baseURL riêng.
- Python: thêm catalog adapter/location projection và metadata hợp lý; không copy orchestrator sang module mới hoặc chuyển persistence sang .NET.
- Trước PR: rebase/merge theo quy trình nhóm đã chọn, xem diff/snapshot/migrations với người sửa portal; không auto-resolve bằng xóa file, bỏ migration hoặc chọn ours/theirs toàn bộ. Đặc tả không bảo đảm hết Git conflict.

### 13.2. Khoảng trống phải harden, không nhầm là chưa có chức năng

- Main đã có review transaction/audit nhưng chưa có publish cầu nối; chưa thể lấy status Approved làm bằng chứng app đã hiển thị.
- Main image GET của partner request hiện AllowAnonymous: không dùng chung kho đó cho consent, hóa đơn, giấy phép riêng tư. Tách attachment private và quyền xem draft; giữ public ảnh published có quyền hợp lệ.
- Main `PartnerInvoice.Paid` được admin đánh dấu, chưa có receipt verification. Dashboard TotalPaid hiện không đủ làm bằng chứng khách trả tiền nếu thiếu chứng từ; đừng thay thế bằng doanh số quán.
- Main có delete-account, nhưng PartnerProfile -> User DeleteBehavior.Restrict có thể chặn xóa owner, và Task cleanup đang có route riêng. Cần orchestration/handoff/revoke có retry và retention; không chỉ thêm nút xóa mới.
- Main submission dựa vào VideoDurationSeconds client và auto-approve: bổ sung validation file/thực thi atomically; enum PendingReview có sẵn không có nghĩa đã có UI người duyệt.
- Main generate đã persist và có xử lý hotel/validation. Các yêu cầu chất lượng ở mục3 là mục tiêu regression/cải tiến; không gỡ code đang có để thay bằng bản đơn giản hoặc ép rewrite tất cả trước pilot.

## 14. Bộ acceptance tests bắt buộc

| ID | Kịch bản | Kết quả phải đạt |
|---|---|---|
| P01 | Editor nhập quán/offer chưa publish | App không nhìn thấy |
| P02 | Publish/sửa quán từ web | App nhận version mới, không cần build app |
| P03 | Listing tham khảo chưa xác nhận | Không có nhãn partner/voucher thật |
| P04 | Thiếu GPS/giá/giờ bắt buộc | Không vào generation/mission pool; không bịa dữ liệu |
| A01 | Chưa cài -> QR quán -> cài -> login -> mở lại/quét lại | Đúng location/offer, nguồn rõ; không mất ngữ cảnh âm thầm |
| A02 | Referrer không về hoặc context hết hạn | Có fallback; không phát nhầm voucher/quy nguồn |
| A03 | User đã cài/đã có account quét QR | Mở đúng offer; eligibility theo campaign |
| V01 | Cùng user claim qua QR rồi itinerary | Một instance, issuedCount tăng1 |
| V02 | Hai user nhận offer | voucherRef và presentation riêng, không dùng chung code |
| V03 | Quota10, 50 account claim đồng thời | Chính xác tối đa10 instance, counter khớp; không âm |
| V04 | 30 request cùng account đồng thời | Một instance, một audit nghiệp vụ cấp, không mất quota |
| V05 | Hết quota nhưng user đã có mã còn hạn | User vẫn dùng mã; người khác thấy hết lượt |
| V06 | RETURN_VISIT claim hôm nay | Hôm nay không present/redeem; ngày kế tiếp hợp lệ theo timezone |
| V07 | IMMEDIATE_OR_LATER | Có thể dùng ngay nếu đủ điều kiện |
| V08 | Token hết90s hoặc tạo QR mới | Token cũ bị từ chối; voucher không tự mất |
| V09 | Resolve nhiều lần | Không consume voucher/quota; không tính là redemption |
| V10 | Hai staff confirm cùng mã đồng thời | Chỉ một Redemption, một receipt, reward không bị ảnh hưởng |
| V11 | Mất response sau commit, retry cùng key | Đúng receipt cũ; không giảm giá/đếm lần2 |
| V12 | Cùng key khác payload/actor |409 hoặc chặn scope; không trả dữ liệu người khác |
| V13 | Staff quánA dùng mã quánB/orgB | Chặn cả resolve và confirm |
| V14 | Staff bị khóa giữa resolve và confirm | Confirm bị chặn |
| V15 | Dùng mã xong, đổi tab/đăng nhập lại/máy thứ2 | Ví active không có QR cũ; lịch sử đã dùng nhất quán |
| V16 | Expired/revoked/void, claim lại | Không cấp lại cùng campaign; quota không được tái chế |
| V17 | Campaign pause claim sau khi cấp | Voucher đã cấp vẫn redeem; suspended riêng thì có lý do |
| V18 | Sửa offer sau khi cấp | Mã cũ dùng terms snapshot; không bị đổi điều kiện bất lợi |
| V19 | Hóa đơn dưới minSpend/đổi quote | Không consume; sửa quote cần verify lại |
| V20 | Staff tự redeem, token brute-force, guest gọi API | Bị chặn và audit/rate-limit thích hợp |
| T01 | Chọn ngày quá khứ/gần nửa đêm/giờ máy sai | Backend chặn hoặc lập từ giờ tương lai bằng serverNow |
| T02 | Tạo5 ngày, đổi endDate sang ngày6 qua API |5 ngày đủ, request6 ngày bị chặn |
| T03 | AI trả thiếu ngày/toàn hotel0đ | Không lưu SUCCEEDED sai; bounded repair/fallback hoặc lỗi có hành động |
| T04 | Tạo xong -> tab mission -> kill app -> login lại | Lịch trình còn trên server, đủ ngày |
| T05 | Thay hotel ở stop quay lại giá0 | Đổi booking + tính lại tổng, không hotel khác miễn phí |
| T06 | Điểm partner gây vòng/đóng cửa | Không ép chèn, có phương án bỏ qua/thay |
| T07 | Trip tương lai/đang đi/đã kết thúc | Nhóm hiển thị đúng theo server time và status |
| M01 | Swipe accept -> mission tab -> quay lại -> swipe | Một assignment, CTA “Đã nhận” |
| M02 | Submit video1s, client tự khai5s | Server từ chối, không thưởng |
| M03 | Submit ảnh bất kỳ/sai GPS/quá cửa sổ | Reject hoặc review theo rule, không auto cộng điểm |
| M04 | Completed retry30 lần hoặc archive history | Chỉ một reward, không mở lại nhiệm vụ |
| M05 | Camera lỗi/quyền bị từ chối/media upload timeout | App không crash; UI thoát loading và retry có kiểm soát |
| E01 | Hoàn tất/hủy trip còn voucher | Mã không mất vì trip kết thúc; hạn campaign vẫn áp dụng |
| E02 | Delete account rồi gọi token cũ | Token/presentation vô hiệu; evidence không bị cascade delete |
| E03 | Report có REAL/TEST/DEMO/void/payment chưa xác minh | Chỉ tính đúng filter; revenue/GMV/redemption tách biệt |
| E04 | Hai staff/two tenant export | Không lộ dữ liệu chéo; raw QR/PII không xuất hiện CSV |
| E05 | AI Translate503 hoặc tiếng không hỗ trợ | Thông báo đúng, không giả dịch hoặc làm mất trip |
| E06 | API/DB AWS mất kết nối trong claim/confirm | Không trừ quota nửa chừng, không báo dùng thành công giả |
| H01 | Trang chủ lưu voucher khi chưa có trip | Claim thành công, tripId null, một suất được giữ; không bắt đầu chuyến đi tự động |
| H02 | Lưu từ home rồi quét QR/nhận từ itinerary | Cùng một instance, ngày hết hạn không đổi, quota tăng đúng1 |
| H03 | Voucher còn ISSUED đến mốc hết hạn, job chưa chạy | API/app chuyển history “Hết hạn” theo serverNow, không present được |
| H04 | Voucher đã dùng sau đó tới expiresAt | Vẫn ở mục Voucher hết hạn với badge “Đã sử dụng”, không bị đổi EXPIRED |
| H05 | Lưu rồi lên lịch sau ngày voucher hết hạn | Cảnh báo, không tự gia hạn/cấp lại; user vẫn có thể tạo chuyến không dùng voucher |
| H06 | User đã lưu suất cuối; user khác mở trang chủ | Người có mã vẫn dùng được; người khác không có CTA lưu và thấy thông báo hết lượt khi mở link cũ |
| H07 | Guest bấm lưu, login xong hoặc đổi account | Khôi phục đúng offer, chỉ claim sau auth; không rò ví account trước |
| C01 | Owner dùng portal/auth/request/invoice cũ sau deploy | Contract/role/status cũ vẫn hoạt động; không buộc dùng API mới |
| C02 | Admin nhập tay cho partner đã có profile | Dùng lại PartnerProfile.Id, không tạo tenant/owner/account giả trùng |
| C03 | Review Approved nhưng consumer publish lỗi | Admin thấy pending sync; app chưa claim campaign từ dữ liệu chưa sẵn sàng; retry không nhân đôi location |
| C04 | Revision mới của cùng chi nhánh, outbox gửi lặp/đảo thứ tự | Một locationId, version mới không bị event cũ ghi đè; voucher snapshot cũ không đổi |
| C05 | Cùng quán/type từ trip hoặc template khác | Giữ semantic dedup main; không mở lại mission/điểm khi nâng identity |
| C06 | Upgrade IAM DB đã có AddPartnerPortalTables và dữ liệu | Không CreateTable trùng/drop/rename cũ; profile/request/invoice còn nguyên |
| C07 | Global Manager hoặc Partner owner không có scope location | Không tự được quyền staff redeem; đúng membership mới được |
| C08 | Account owner đang có PartnerProfile/FK hoặc cleanup Task thất bại | Handoff/cleanup retry an toàn, không báo xóa xong giả hoặc cascade mất chứng từ |

Ngoài test API, cần video/screenshot trên thiết bị thật cho ba cửa vào acquisition, itinerary và home; có nhân viên thử thực sự, không chỉ mock response.

## 15. Thứ tự triển khai và bàn giao

### P0 - Không bỏ để chạy pilot thật

1. **Nền bảo mật + dữ liệu:** auth/ownership hiện hữu, schema/constraints/migration, dataMode, audit, config/server time.
2. **Web nhập tay:** partner/place/campaign draft -> publish, evidence consent, staff invitation/location scope.
3. **Luồng voucher khép kín:** acquisition landing/fallback hoặc card trang chủ -> login -> atomic claim/lưu -> wallet -> tùy chọn tạo chuyến -> QR/mã riêng -> staff verify/confirm -> history/report. Hai mục ví và status phải đúng; scanner camera có thể sau mã nhập tay, nhưng mã vẫn unique/dynamic/server-confirmed.
4. **Trip ổn định:** giới hạn5 ngày, thời gian hợp lệ, catalog xác minh, đủ ngày, tự lưu server, sửa hotel đúng, nhóm current/future/past.
5. **Mission đúng:** assign unique, đồng bộ trạng thái, evidence validation/video5s, reward một lần.
6. **Kết thúc + hỗ trợ:** summary, voucher còn hạn, feedback/ticket, delete account.
7. **OC3 evidence:** event thật, dashboard/filter REAL, CAP comparison, xác nhận hợp tác miễn phí/đặt QR/staff sử dụng, explicit zero/null; xuất receipt nếu thực có. Payment/commission automation không là P0 hoặc điều kiện go-live của pilot miễn phí được đồng ý.

### P1 - Hoàn thiện vận hành

- Native deferred attribution Android đã kiểm thử; Universal/App Links, push/SSE, dashboard nâng cao, discrepancy alerts, media/content review tooling, restore drill.
- Translate quality feedback/capability UI và hardening theo trạng thái backend thật; không thêm ngôn ngữ chưa có model chỉ để trình diễn.

### P2 - Sau pilot

- Partner tự đăng/cập nhật campaign, multi-branch shared quota, POS integration, thanh toán/commission tự động, loyalty nâng cao.
- Không dựng các phần P2 trước khi P0 claim/redeem và trip/mission hoạt động đúng.

### Bộ bàn giao từ backend

- [ ] ERD/mapping theo baseline main, migrations chạy trên DB sạch **và DB đã có portal/dữ liệu**; không có secret.
- [ ] OpenAPI mới + mapping/deprecation route cũ, enum/JSON casing rõ ràng.
- [ ] Seed hai organization, hai staff/location, userA/userB, campaign10 suất, campaign dùng lần sau; tất cả INTERNAL_TEST.
- [ ] Postman/HTTP collection và integration test concurrency tự chạy, kiểm trực tiếp DB.
- [ ] Account/role matrix, negative authorization tests, logs đã mask.
- [ ] Demo cả ba cửa vào trên Android thật; kiểm reopen sau install/login, lưu từ trang chủ và cache sau redeem/hết hạn.
- [ ] Report/CSV khớp database cùng filter, tách paid/claim/demo/redemption/GMV.
- [ ] Runbook deploy AWS/service owner, env keys không chứa value, health, queue/job, rollback và incident quầy.
- [ ] Danh sách known limitations; screenshot/video và test results có ngày/build/API version.

## 16. Những điều cần product/đối tác duyệt trước go-live

| Nội dung | Default đặc tả | Cần xác nhận |
|---|---|---|
| Người nhập thông tin | Thành viên DISA qua admin web | Danh sách editor/admin |
| Staff dùng tại quầy | Account riêng, scope location, không cần tự tạo campaign | Ai thực sự xác nhận trên ca |
| Một mã mỗi người | Một account/campaign/location, không cấp lại sau terminal | Có cần phone verification không |
| Quota10 | Cấp tối đa10 lần toàn campaign; không tái chế expiry | Bằng chứng đối tác đồng ý số lượng |
| Dùng ngay/lần sau | Campaign chọn; lần sau từ ngày địa phương kế tiếp | Không viết mơ hồ “quay lại” |
| Hiệu lực | Default30 ngày, không quá redeemEndsAt | Khoảng ngày và minSpend/loại trừ cụ thể |
| Tiền giảm | PERCENT/FIXED/GIFT, cap rõ, không cộng dồn default | Quán xác nhận công thức và quà |
| Mất mạng | Không xác nhận offline | Quy trình hỗ trợ tại quầy |
| Reverse | Không mở lại mã; adjustment/support | Người duyệt bồi hoàn |
| Mô hình dùng cho OC3 | Giảng viên đã đồng ý app miễn phí + hợp tác miễn phí năm đầu, theo thông báo nhóm trưởng 08/11/2026 | Lưu evidence trao đổi khi có; bổ sung rubric/KPI cụ thể nếu chưa chốt, không chặn triển khai miễn phí |
| Retention dữ liệu | Chưa tự đặt thời hạn pháp lý | Owner duyệt policy retention và account deletion |

Các default trên giúp dev làm đúng một bản nhất quán. Product thay đổi bằng version/documented approval, không để mỗi frontend/backend tự hiểu khác nhau.

## 17. Nguồn kỹ thuật và nguồn nội bộ

- [Android App Links](https://developer.android.com/training/app-links): link website đã xác minh có thể mở nội dung app; không tự giải quyết mọi trường hợp qua cài đặt.
- [Google Play Install Referrer](https://developer.android.com/google/play/installreferrer): API nhận thông tin referrer; dùng opaque context và kiểm server, không xem là quyền nhận hoặc chứng minh ghé quán.
- [Google giới thiệu Install Referrer](https://android-developers.googleblog.com/2017/11/google-play-referrer-api-track-and.html): nguồn chính thức bổ sung về referral content.
- [Apple Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app): tham chiếu cấu hình domain/app; luồng qua cài đặt phải test riêng và có fallback.
- Requirement OC3 nội bộ: `csv/OC3 Final Report Requirements _ EXE201SU26.pdf`.
- Context kiến trúc đã đọc: `Ethnic_Translate/main/EXE/Front-End/CLAUDE.md`; phải đối chiếu source mới vì một số mô tả có thể đã cũ.
- Source partner/auth/invoice/voucher/mission/itinerary đã kiểm tra: mục0.2, tại commit main local ghi đầu tài liệu; không bao gồm kiểm chứng runtime production hoặc remote HEAD.

**Kết luận bàn giao:** Thành viên DISA nhập dữ liệu trên web; backend publish để app dùng. Ba cửa vào QR, lịch trình và trang chủ gặp nhau ở một instance cá nhân, giữ quota lúc claim/lưu, xác minh tại quầy bằng staff và transaction, không dùng lại được. Ví giữ mã còn hạn riêng; mục Voucher hết hạn chứa mã đã dùng/hết hạn/thu hồi với status đúng. Triển khai mô hình miễn phí năm đầu đã được giảng viên đồng ý; không ép thanh toán để kích hoạt pilot. Lịch trình/nhiệm vụ/tổng kết và báo cáo OC3 dùng hoạt động/bằng chứng thật.
