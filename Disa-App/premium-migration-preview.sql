IF OBJECT_ID(N'[__PremiumMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__PremiumMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___PremiumMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

CREATE TABLE [PremiumPlans] (
    [Id] int NOT NULL IDENTITY,
    [Code] nvarchar(30) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [DurationMonths] int NOT NULL,
    [PriceVnd] int NOT NULL,
    [IsActive] bit NOT NULL,
    [GoogleProductId] nvarchar(120) NOT NULL,
    [AppleProductId] nvarchar(120) NOT NULL,
    CONSTRAINT [PK_PremiumPlans] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [PremiumPayments] (
    [Id] bigint NOT NULL IDENTITY,
    [UserId] uniqueidentifier NOT NULL,
    [PlanId] int NOT NULL,
    [Provider] nvarchar(30) NOT NULL,
    [Status] nvarchar(30) NOT NULL,
    [AmountVnd] int NOT NULL,
    [OrderCode] nvarchar(50) NOT NULL,
    [ProviderTransactionId] nvarchar(200) NULL,
    [StoreTokenHash] nvarchar(64) NULL,
    [CreatedAtUtc] datetime2 NOT NULL,
    [ExpiresAtUtc] datetime2 NOT NULL,
    [PaidAtUtc] datetime2 NULL,
    [AccessUntilUtc] datetime2 NULL,
    CONSTRAINT [PK_PremiumPayments] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PremiumPayments_PremiumPlans_PlanId] FOREIGN KEY ([PlanId]) REFERENCES [PremiumPlans] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [UserPremiumSubscriptions] (
    [UserId] uniqueidentifier NOT NULL,
    [PlanId] int NOT NULL,
    [Status] nvarchar(30) NOT NULL,
    [StartAtUtc] datetime2 NOT NULL,
    [EndAtUtc] datetime2 NOT NULL,
    [LastPaymentId] bigint NULL,
    CONSTRAINT [PK_UserPremiumSubscriptions] PRIMARY KEY ([UserId]),
    CONSTRAINT [FK_UserPremiumSubscriptions_PremiumPlans_PlanId] FOREIGN KEY ([PlanId]) REFERENCES [PremiumPlans] ([Id]) ON DELETE NO ACTION
);
GO

IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'AppleProductId', N'Code', N'DurationMonths', N'GoogleProductId', N'IsActive', N'Name', N'PriceVnd') AND [object_id] = OBJECT_ID(N'[PremiumPlans]'))
    SET IDENTITY_INSERT [PremiumPlans] ON;
INSERT INTO [PremiumPlans] ([Id], [AppleProductId], [Code], [DurationMonths], [GoogleProductId], [IsActive], [Name], [PriceVnd])
VALUES (1, N'disa_premium_1m', N'MONTHLY', 1, N'disa_premium_1m', CAST(1 AS bit), N'DISA Premium 1 tháng', 29000),
(2, N'disa_premium_6m', N'HALF_YEAR', 6, N'disa_premium_6m', CAST(1 AS bit), N'DISA Premium 6 tháng', 79000),
(3, N'disa_premium_12m', N'YEARLY', 12, N'disa_premium_12m', CAST(1 AS bit), N'DISA Premium 12 tháng', 129000);
IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'AppleProductId', N'Code', N'DurationMonths', N'GoogleProductId', N'IsActive', N'Name', N'PriceVnd') AND [object_id] = OBJECT_ID(N'[PremiumPlans]'))
    SET IDENTITY_INSERT [PremiumPlans] OFF;
GO

CREATE UNIQUE INDEX [IX_PremiumPayments_OrderCode] ON [PremiumPayments] ([OrderCode]);
GO

CREATE INDEX [IX_PremiumPayments_PlanId] ON [PremiumPayments] ([PlanId]);
GO

CREATE UNIQUE INDEX [IX_PremiumPayments_Provider_ProviderTransactionId] ON [PremiumPayments] ([Provider], [ProviderTransactionId]) WHERE [ProviderTransactionId] IS NOT NULL;
GO

CREATE UNIQUE INDEX [IX_PremiumPayments_Provider_StoreTokenHash] ON [PremiumPayments] ([Provider], [StoreTokenHash]) WHERE [StoreTokenHash] IS NOT NULL;
GO

CREATE UNIQUE INDEX [IX_PremiumPlans_Code] ON [PremiumPlans] ([Code]);
GO

CREATE INDEX [IX_UserPremiumSubscriptions_PlanId] ON [UserPremiumSubscriptions] ([PlanId]);
GO

INSERT INTO [__PremiumMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261122103357_AddPremiumBilling', N'8.0.11');
GO

COMMIT;
GO
