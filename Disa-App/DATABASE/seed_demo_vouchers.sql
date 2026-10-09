-- Demo voucher catalog for the Voucher tab and Home "Special Offers".
-- Safe to re-run: each voucher is inserted only if its Code doesn't exist yet.
-- Run against the Task service database (the one holding dbo.Vouchers),
-- e.g. in SSMS / Azure Data Studio, or:
--   sqlcmd -S <server> -d <TaskDb> -U <user> -P <password> -i seed_demo_vouchers.sql
--
-- Images are Wikimedia Commons photos — the app sends the identifying
-- User-Agent Wikimedia requires (src/data/regionImages.ts#remoteImage).

SET NOCOUNT ON;

DECLARE @Seed TABLE
(
    Category NVARCHAR(100),
    Title NVARCHAR(200),
    Description NVARCHAR(MAX),
    ImageUrl NVARCHAR(500),
    PointsCost INT,
    DiscountLabel NVARCHAR(50),
    Location NVARCHAR(200),
    ExpiresAt DATETIME2,
    Code NVARCHAR(100),
    TermsJson NVARCHAR(MAX)
);

INSERT INTO @Seed VALUES
(N'Dining', N'Highland Coffee – Mua 1 tặng 1',
 N'Mua một đồ uống bất kỳ, tặng thêm một đồ uống cùng loại tại các cửa hàng Highland Coffee tham gia.',
 N'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/B%E1%BB%9D_%C4%91%C3%B4ng_c%E1%BA%A7u_R%E1%BB%93ng.jpg/960px-B%E1%BB%9D_%C4%91%C3%B4ng_c%E1%BA%A7u_R%E1%BB%93ng.jpg',
 150, N'1 TẶNG 1', N'Đà Nẵng', DATEADD(MONTH, 6, GETUTCDATE()), N'DISA-HLC-1T1',
 N'["Áp dụng cho đồ uống size M","Không áp dụng cùng khuyến mãi khác","Mỗi khách dùng 1 lần"]'),

(N'Hotels', N'Giảm 15% phòng nghỉ Đà Lạt',
 N'Ưu đãi 15% giá phòng tại các khách sạn đối tác ở trung tâm Đà Lạt, gần hồ Xuân Hương.',
 N'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Da_Lat_-_Viet_Nam.jpg/960px-Da_Lat_-_Viet_Nam.jpg',
 600, N'-15%', N'Đà Lạt, Lâm Đồng', DATEADD(MONTH, 6, GETUTCDATE()), N'DISA-DL-HOTEL15',
 N'["Lưu trú tối thiểu 2 đêm","Đặt trước ít nhất 3 ngày","Không áp dụng dịp Lễ, Tết"]'),

(N'Travel', N'Phòng chờ hạng thương gia sân bay',
 N'Một lượt sử dụng phòng chờ hạng thương gia miễn phí tại nhà ga quốc nội.',
 N'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Phu_Quoc%2C_Viet_Nam.jpg/960px-Phu_Quoc%2C_Viet_Nam.jpg',
 900, N'MIỄN PHÍ', N'Sân bay Phú Quốc', DATEADD(MONTH, 6, GETUTCDATE()), N'DISA-LOUNGE-FREE',
 N'["Xuất trình thẻ lên máy bay cùng ngày","Sử dụng tối đa 3 giờ"]'),

(N'Experience', N'Du thuyền ngắm vịnh Hạ Long',
 N'Giảm 20% tour du thuyền 4 giờ trên vịnh Hạ Long, bao gồm chèo kayak tại hang Luồn.',
 N'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Ha_Long_2019_taken_by_DJI_FC220.jpg/960px-Ha_Long_2019_taken_by_DJI_FC220.jpg',
 800, N'-20%', N'Vịnh Hạ Long, Quảng Ninh', DATEADD(MONTH, 6, GETUTCDATE()), N'DISA-HALONG-20',
 N'["Đặt chỗ trước 24 giờ","Áp dụng cho tối đa 4 khách"]'),

(N'Wellness', N'Spa thảo dược Nha Trang',
 N'Giảm 25% gói massage thảo dược 60 phút tại các spa đối tác ven biển Nha Trang.',
 N'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg/960px-Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg',
 450, N'-25%', N'Nha Trang, Khánh Hòa', DATEADD(MONTH, 6, GETUTCDATE()), N'DISA-NT-SPA25',
 N'["Đặt lịch trước qua hotline của spa","Không quy đổi thành tiền mặt"]'),

(N'Transport', N'Xe đưa đón tham quan Huế',
 N'Giảm 30% xe riêng tham quan Đại Nội và lăng tẩm Huế trong ngày.',
 N'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Th%C3%A0nh_ph%E1%BB%91_Hu%E1%BA%BF_nh%C3%ACn_t%E1%BB%AB_tr%C3%AAn_cao_%282%29.jpg/960px-Th%C3%A0nh_ph%E1%BB%91_Hu%E1%BA%BF_nh%C3%ACn_t%E1%BB%AB_tr%C3%AAn_cao_%282%29.jpg',
 350, N'-30%', N'Thành phố Huế', DATEADD(MONTH, 6, GETUTCDATE()), N'DISA-HUE-CAR30',
 N'["Xe 4–7 chỗ, tối đa 8 giờ","Đặt trước ít nhất 1 ngày"]');

INSERT INTO dbo.Vouchers
    (Id, Category, Title, Description, ImageUrl, PointsCost, DiscountLabel, Location, ExpiresAt, Code, TermsJson, IsActive)
SELECT NEWID(), s.Category, s.Title, s.Description, s.ImageUrl, s.PointsCost, s.DiscountLabel,
       s.Location, s.ExpiresAt, s.Code, s.TermsJson, 1
FROM @Seed s
WHERE NOT EXISTS (SELECT 1 FROM dbo.Vouchers v WHERE v.Code = s.Code);

PRINT CONCAT(@@ROWCOUNT, N' demo voucher(s) inserted.');
