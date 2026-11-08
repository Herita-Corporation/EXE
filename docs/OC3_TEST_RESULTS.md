# OC3 pilot - kết quả kiểm thử 09/11/2026

Phạm vi: code dev local, .NET8, SQL Server local riêng, Python3.12, TypeScript. Không dùng database ứng dụng/AWS và không coi đây là nghiệm thu toàn bộ đặc tả.

## Qua

- Build Task.Presentation, IAMService, AITour.Presentation.
- TypeScript `tsc --noEmit`.
- JavaScript trong hai trang oc3.html/q.html parse được.
- Python validators + trip lifecycle:17/17.
- Rules discount/cap, next-day Vietnam midnight, expiry suy ra không cần scheduler, trạng thái REDEEMED không đổi sau hạn.
- Fixture video1s: ffprobe đọc video stream duration thực, không dùng client duration để xác minh.
- SQL:50 account cùng nhận campaign10 suất, chỉ10 instance;30 lần nhận lặp của account đã có không tăng issuedCount.
- SQL:hai staff confirm cùng voucher đồng thời, chỉ1 redemption; retry cùng key trả cùng receipt; quota không được tái chế; ví active/history đúng.
- HTTP: password login/IEmailSender DI; manual PartnerProfile/content -> Pending -> Approved -> canonical location -> publication outbox -> Task snapshot -> campaign.
- HTTP: card trang chủ nhận biết mã đã lưu; JWT/ownership, staff location scope, short code verify/confirm, idempotent receipt, used history và ISO UTC cóZ.
- HTTP: acquisition QR + home không tạo hai mã; revoke membership giữa verify/confirm bị từ chối.
- HTTP: account đã xóa không xem ví bằng JWT cũ hoặc dùng presentation cũ tại quầy.
- HTTP: owner account bị chặn xóa khi còn profile; admin handoff có audit xong thì được xóa account mà giữ hồ sơ đối tác.

## Chưa xanh/chưa thực hiện

- Full Python unit suite:59/61, còn hai assertion baseline ở test_retrieval_service::test_trim_to_50_max và test_route_optimizer::test_known_distance. Source/test tương ứng không bị sửa trong thay đổi OC3. Không sửa assertion để che lỗi.
- Cold build IAM có warning CS0108 ở method Request(Guid) của AdminPartnerController trên main, không phải lỗi build. Không đổi route chỉ để xóa warning.
- NuGet vulnerability feed có lúc không truy cập được trong sandbox (NU1900); không có kết luận dependency security scan đã sạch.
- SQL local cũ cảnh báo TLS1.0. Fixture test chỉ chạy local, không đề xuất dùng TLS đó cho production.
- Chưa test native deep-link/Store install, GPS/camera thật, UI đầy đủ trên thiết bị, AI live, AWS deployment, production latency hoặc toàn bộ60 acceptance cases.

Database fixture tạo bằng tên ngẫu nhiên DISA_OC3_TEST_* / DISA_OC3_TEST_IAM_* được giữ lại để kiểm tra; không drop database người dùng. Test hosts local được dừng trong finally.

Xem OC3_DEV_TESTING.md để biết config/migration và phần việc còn lại. Không ghi “đã hoàn tất toàn bộ kế hoạch” dựa trên các kết quả này.
