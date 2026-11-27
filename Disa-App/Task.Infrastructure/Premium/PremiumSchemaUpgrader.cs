using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Premium;

/// <summary>
/// Small additive bridge for already-running SQL Server installations. The
/// normal SQL init script remains the source of truth for fresh databases.
/// </summary>
public static class PremiumSchemaUpgrader
{
    public static async global::System.Threading.Tasks.Task ApplyAsync(TaskDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'premium') EXEC(N'CREATE SCHEMA premium');
            IF OBJECT_ID(N'premium.PremiumProvinces', N'U') IS NULL
            CREATE TABLE premium.PremiumProvinces (
              Id uniqueidentifier NOT NULL PRIMARY KEY, Code nvarchar(32) NOT NULL UNIQUE, Name nvarchar(120) NOT NULL,
              AreaType nvarchar(16) NOT NULL CONSTRAINT DF_PremiumProvinces_AreaType_Runtime DEFAULT 'PROVINCE',
              ParentProvinceId uniqueidentifier NULL, Aliases nvarchar(2000) NOT NULL CONSTRAINT DF_PremiumProvinces_Aliases_Runtime DEFAULT '',
              IsActive bit NOT NULL CONSTRAINT DF_PremiumProvinces_Active_Runtime DEFAULT 1);
            IF OBJECT_ID(N'premium.PremiumMissionDefinitions', N'U') IS NULL
            CREATE TABLE premium.PremiumMissionDefinitions (
              Id uniqueidentifier NOT NULL PRIMARY KEY, ProvinceId uniqueidentifier NOT NULL, Title nvarchar(250) NOT NULL,
              Instruction nvarchar(max) NOT NULL, PlaceName nvarchar(250) NOT NULL, PlaceQuery nvarchar(500) NOT NULL,
              EvidenceType nvarchar(10) NOT NULL, SortOrder int NOT NULL, IsActive bit NOT NULL CONSTRAINT DF_PremiumMissionDefinitions_Active_Runtime DEFAULT 1,
              CONSTRAINT FK_PremiumMissionDefinitions_Province_Runtime FOREIGN KEY (ProvinceId) REFERENCES premium.PremiumProvinces(Id),
              CONSTRAINT UQ_PremiumMissionDefinitions_ProvinceSort_Runtime UNIQUE (ProvinceId, SortOrder));
            IF OBJECT_ID(N'premium.PremiumMissionAssignments', N'U') IS NULL
            CREATE TABLE premium.PremiumMissionAssignments (
              Id uniqueidentifier NOT NULL PRIMARY KEY, MissionId uniqueidentifier NOT NULL, UserId uniqueidentifier NOT NULL,
              GroupId uniqueidentifier NULL, AcceptedAtUtc datetime2 NOT NULL, CompletedAtUtc datetime2 NULL, EvidenceUrl nvarchar(1000) NULL,
              CONSTRAINT FK_PremiumMissionAssignments_Mission_Runtime FOREIGN KEY (MissionId) REFERENCES premium.PremiumMissionDefinitions(Id));
            IF COL_LENGTH('premium.PremiumMissionAssignments', 'BonusPoints') IS NULL
              ALTER TABLE premium.PremiumMissionAssignments ADD BonusPoints int NOT NULL DEFAULT 0;
            IF COL_LENGTH('premium.PremiumProvinces', 'AreaType') IS NULL
              ALTER TABLE premium.PremiumProvinces ADD AreaType nvarchar(16) NOT NULL CONSTRAINT DF_PremiumProvinces_AreaType_Runtime DEFAULT 'PROVINCE';
            IF COL_LENGTH('premium.PremiumProvinces', 'ParentProvinceId') IS NULL
              ALTER TABLE premium.PremiumProvinces ADD ParentProvinceId uniqueidentifier NULL;
            IF COL_LENGTH('premium.PremiumProvinces', 'Aliases') IS NULL
              ALTER TABLE premium.PremiumProvinces ADD Aliases nvarchar(2000) NOT NULL CONSTRAINT DF_PremiumProvinces_Aliases_Runtime DEFAULT '';
            IF OBJECT_ID(N'premium.PremiumVirtualVoucherTemplates', N'U') IS NULL
            CREATE TABLE premium.PremiumVirtualVoucherTemplates (
              Id uniqueidentifier NOT NULL PRIMARY KEY, PartnerKey nvarchar(80) NOT NULL UNIQUE,
              Provider nvarchar(160) NOT NULL, Category nvarchar(100) NOT NULL, Title nvarchar(250) NOT NULL,
              Benefit nvarchar(500) NOT NULL, Terms nvarchar(max) NOT NULL, PublicUrl nvarchar(1000) NOT NULL,
              IsActive bit NOT NULL CONSTRAINT DF_PremiumVirtualVoucherTemplates_Active_Runtime DEFAULT 1);
            IF OBJECT_ID(N'premium.PremiumVirtualVouchers', N'U') IS NULL
            BEGIN
              CREATE TABLE premium.PremiumVirtualVouchers (
                Id uniqueidentifier NOT NULL PRIMARY KEY, AssignmentId uniqueidentifier NOT NULL, UserId uniqueidentifier NOT NULL,
                TemplateId uniqueidentifier NOT NULL, IssuedAtUtc datetime2 NOT NULL,
                CONSTRAINT FK_PremiumVirtualVouchers_Assignment_Runtime FOREIGN KEY (AssignmentId) REFERENCES premium.PremiumMissionAssignments(Id),
                CONSTRAINT FK_PremiumVirtualVouchers_Template_Runtime FOREIGN KEY (TemplateId) REFERENCES premium.PremiumVirtualVoucherTemplates(Id),
                CONSTRAINT UQ_PremiumVirtualVouchers_Assignment_Runtime UNIQUE (AssignmentId));
              CREATE INDEX IX_PremiumVirtualVouchers_UserIssued_Runtime ON premium.PremiumVirtualVouchers (UserId, IssuedAtUtc DESC);
            END
            """);
    }
}
