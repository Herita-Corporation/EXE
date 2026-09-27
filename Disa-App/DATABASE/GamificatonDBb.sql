IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'TaskDb')
BEGIN
    CREATE DATABASE TaskDb;
END
Go
use	TaskDb	;
Go
IF OBJECT_ID(N'dbo.MissionTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE MissionTemplates
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        Name NVARCHAR(200) NOT NULL,

        Description NVARCHAR(MAX),

        Type INT NOT NULL,

        RewardXP INT NOT NULL DEFAULT 0,

        RewardCoins INT NOT NULL DEFAULT 0,

        RequiresPhoto BIT NOT NULL DEFAULT 0,

        RequiresVideo BIT NOT NULL DEFAULT 0,

        RequiresLocation BIT NOT NULL DEFAULT 0,

        MinVideoSeconds INT NULL,

        IsActive BIT NOT NULL DEFAULT 1
    );
END
-- Reusable "capture memory" templates — assigned per itinerary activity with a
-- custom Title (e.g. "Chụp ảnh tại Cầu Rồng") via AssignMissionRequest.Title,
-- so a single generic template covers every place instead of one row each.
IF NOT EXISTS (SELECT 1 FROM MissionTemplates WHERE Name = N'Chụp ảnh kỷ niệm')
BEGIN
    INSERT INTO MissionTemplates (Id, Name, Description, Type, RewardXP, RewardCoins, RequiresPhoto, RequiresVideo, RequiresLocation, IsActive)
    VALUES (NEWID(), N'Chụp ảnh kỷ niệm', N'Chụp một tấm ảnh để lưu giữ kỷ niệm tại địa điểm này.', 1, 10, 5, 1, 0, 1, 1);
END
IF NOT EXISTS (SELECT 1 FROM MissionTemplates WHERE Name = N'Quay video khám phá')
BEGIN
    INSERT INTO MissionTemplates (Id, Name, Description, Type, RewardXP, RewardCoins, RequiresPhoto, RequiresVideo, RequiresLocation, MinVideoSeconds, IsActive)
    VALUES (NEWID(), N'Quay video khám phá', N'Quay một video ngắn khám phá địa điểm này.', 2, 20, 10, 0, 1, 1, 5, 1);
END
IF OBJECT_ID(N'dbo.UserMissions', N'U') IS NULL
BEGIN
    CREATE TABLE UserMissions
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        UserId UNIQUEIDENTIFIER NOT NULL,

        TripId UNIQUEIDENTIFIER NOT NULL,

        PlaceId UNIQUEIDENTIFIER NOT NULL,

        TemplateId UNIQUEIDENTIFIER NOT NULL,

        Title NVARCHAR(255) NOT NULL,

        Status INT NOT NULL DEFAULT 0,

        RewardXP INT NOT NULL DEFAULT 0,

        RewardCoins INT NOT NULL DEFAULT 0,

        StartAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        ExpiredAt DATETIME2,

        CompletedAt DATETIME2,

        CONSTRAINT FK_UserMission_Template
            FOREIGN KEY(TemplateId)
            REFERENCES MissionTemplates(Id)
    );
END
IF OBJECT_ID(N'dbo.MissionSubmissions', N'U') IS NULL
BEGIN
    CREATE TABLE MissionSubmissions
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        UserMissionId UNIQUEIDENTIFIER NOT NULL,

        SubmittedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        VerificationStatus INT NOT NULL DEFAULT 0,

        CONSTRAINT FK_Submission_UserMission
            FOREIGN KEY(UserMissionId)
            REFERENCES UserMissions(Id)
    );
END
IF OBJECT_ID(N'dbo.MissionEvidences', N'U') IS NULL
BEGIN
    CREATE TABLE MissionEvidences
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        SubmissionId UNIQUEIDENTIFIER NOT NULL,

        Type INT NOT NULL,

        MediaUrl NVARCHAR(500) NOT NULL,

        Latitude FLOAT,

        Longitude FLOAT,

        TakenAt DATETIME2,

        CONSTRAINT FK_Evidence_Submission
            FOREIGN KEY(SubmissionId)
            REFERENCES MissionSubmissions(Id)
    );
END
IF OBJECT_ID(N'dbo.UserRewards', N'U') IS NULL
BEGIN
    CREATE TABLE UserRewards
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        UserId UNIQUEIDENTIFIER NOT NULL,

        UserMissionId UNIQUEIDENTIFIER NOT NULL,

        XP INT NOT NULL,

        Coins INT NOT NULL,

        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),

        CONSTRAINT FK_UserReward_UserMission
            FOREIGN KEY(UserMissionId)
            REFERENCES UserMissions(Id)
    );
END
IF OBJECT_ID(N'dbo.UserProgress', N'U') IS NULL
BEGIN
    CREATE TABLE UserProgress
    (
        UserId UNIQUEIDENTIFIER PRIMARY KEY,

        TotalXP INT DEFAULT 0,

        Coins INT DEFAULT 0,

        CurrentLevel INT DEFAULT 1,

        CurrentStreak INT DEFAULT 0
    );
END
IF OBJECT_ID(N'dbo.Badges', N'U') IS NULL
BEGIN
    CREATE TABLE Badges
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        Name NVARCHAR(200),

        Description NVARCHAR(MAX),

        IconUrl NVARCHAR(500)
    );
END
IF OBJECT_ID(N'dbo.UserBadges', N'U') IS NULL
BEGIN
    CREATE TABLE UserBadges
    (
        UserId UNIQUEIDENTIFIER NOT NULL,

        BadgeId UNIQUEIDENTIFIER NOT NULL,

        EarnedAt DATETIME2 DEFAULT GETUTCDATE(),

        PRIMARY KEY(UserId, BadgeId),

        CONSTRAINT FK_UserBadge_Badge
            FOREIGN KEY(BadgeId)
            REFERENCES Badges(Id)
    );
END
IF OBJECT_ID(N'dbo.Vouchers', N'U') IS NULL
BEGIN
    CREATE TABLE Vouchers
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        Category NVARCHAR(100) NOT NULL,

        Title NVARCHAR(200) NOT NULL,

        Description NVARCHAR(MAX),

        ImageUrl NVARCHAR(500),

        PointsCost INT NOT NULL DEFAULT 0,

        DiscountLabel NVARCHAR(50),

        Location NVARCHAR(200),

        ExpiresAt DATETIME2 NOT NULL,

        Code NVARCHAR(100) NOT NULL,

        TermsJson NVARCHAR(MAX) NOT NULL DEFAULT N'[]',

        IsActive BIT NOT NULL DEFAULT 1,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END
IF OBJECT_ID(N'dbo.VoucherRedemptions', N'U') IS NULL
BEGIN
    CREATE TABLE VoucherRedemptions
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        UserId UNIQUEIDENTIFIER NOT NULL,

        VoucherId UNIQUEIDENTIFIER NOT NULL,

        RedeemedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_VoucherRedemption_Voucher
            FOREIGN KEY(VoucherId)
            REFERENCES Vouchers(Id)
    );
    CREATE INDEX IX_VoucherRedemptions_UserId ON VoucherRedemptions(UserId);
END
IF OBJECT_ID(N'dbo.PointSpends', N'U') IS NULL
BEGIN
    CREATE TABLE PointSpends
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),

        UserId UNIQUEIDENTIFIER NOT NULL,

        Points INT NOT NULL,

        Reason NVARCHAR(255),

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_PointSpends_UserId ON PointSpends(UserId);
END
