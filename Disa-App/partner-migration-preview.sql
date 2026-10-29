IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

CREATE TABLE [PartnerProfiles] (
    [Id] uniqueidentifier NOT NULL,
    [UserId] uniqueidentifier NOT NULL,
    [BusinessName] nvarchar(250) NOT NULL,
    [BusinessType] nvarchar(max) NOT NULL,
    [OwnerName] nvarchar(max) NOT NULL,
    [PhoneNumber] nvarchar(max) NOT NULL,
    [Email] nvarchar(255) NOT NULL,
    [Address] nvarchar(max) NOT NULL,
    [TaxCode] nvarchar(max) NULL,
    [BusinessLicenseUrl] nvarchar(max) NULL,
    [Status] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_PartnerProfiles] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PartnerProfiles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [PartnerContentRequests] (
    [Id] uniqueidentifier NOT NULL,
    [PartnerId] uniqueidentifier NOT NULL,
    [Title] nvarchar(250) NOT NULL,
    [Content] nvarchar(max) NOT NULL,
    [Price] decimal(18,2) NULL,
    [OpeningTime] time NULL,
    [ClosingTime] time NULL,
    [Location] nvarchar(max) NOT NULL,
    [Latitude] decimal(10,7) NULL,
    [Longitude] decimal(10,7) NULL,
    [Status] nvarchar(max) NOT NULL,
    [RejectReason] nvarchar(max) NULL,
    [ReviewedBy] uniqueidentifier NULL,
    [ReviewedAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_PartnerContentRequests] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PartnerContentRequests_PartnerProfiles_PartnerId] FOREIGN KEY ([PartnerId]) REFERENCES [PartnerProfiles] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [PartnerInvoices] (
    [Id] uniqueidentifier NOT NULL,
    [PartnerId] uniqueidentifier NOT NULL,
    [InvoiceNumber] nvarchar(450) NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [Description] nvarchar(max) NULL,
    [Status] nvarchar(max) NOT NULL,
    [IssuedAt] datetime2 NOT NULL,
    [DueAt] datetime2 NULL,
    [PaidAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_PartnerInvoices] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PartnerInvoices_PartnerProfiles_PartnerId] FOREIGN KEY ([PartnerId]) REFERENCES [PartnerProfiles] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [PartnerRequestImages] (
    [Id] uniqueidentifier NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [ImageUrl] nvarchar(max) NOT NULL,
    [SortOrder] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_PartnerRequestImages] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PartnerRequestImages_PartnerContentRequests_RequestId] FOREIGN KEY ([RequestId]) REFERENCES [PartnerContentRequests] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [PartnerReviewAudits] (
    [Id] uniqueidentifier NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [AdminId] uniqueidentifier NOT NULL,
    [OldStatus] nvarchar(max) NOT NULL,
    [NewStatus] nvarchar(max) NOT NULL,
    [Reason] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_PartnerReviewAudits] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PartnerReviewAudits_PartnerContentRequests_RequestId] FOREIGN KEY ([RequestId]) REFERENCES [PartnerContentRequests] ([Id]) ON DELETE NO ACTION
);
GO

CREATE INDEX [IX_PartnerContentRequests_PartnerId] ON [PartnerContentRequests] ([PartnerId]);
GO

CREATE UNIQUE INDEX [IX_PartnerInvoices_InvoiceNumber] ON [PartnerInvoices] ([InvoiceNumber]);
GO

CREATE INDEX [IX_PartnerInvoices_PartnerId] ON [PartnerInvoices] ([PartnerId]);
GO

CREATE UNIQUE INDEX [IX_PartnerProfiles_UserId] ON [PartnerProfiles] ([UserId]);
GO

CREATE INDEX [IX_PartnerRequestImages_RequestId] ON [PartnerRequestImages] ([RequestId]);
GO

CREATE INDEX [IX_PartnerReviewAudits_RequestId] ON [PartnerReviewAudits] ([RequestId]);
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261029151437_AddPartnerPortalTables', N'8.0.8');
GO

COMMIT;
GO

