/* Idempotent Premium mission schema for TaskDb. TaskDb is initialized from
   SQL scripts, so this avoids applying legacy EF migrations to an existing DB. */
/* Filtered indexes below require these SQL Server session options. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'premium') EXEC(N'CREATE SCHEMA premium');

IF OBJECT_ID(N'premium.PremiumProvinces', N'U') IS NULL
CREATE TABLE premium.PremiumProvinces (
  Id uniqueidentifier NOT NULL PRIMARY KEY, Code nvarchar(32) NOT NULL UNIQUE,
  Name nvarchar(120) NOT NULL, AreaType nvarchar(16) NOT NULL CONSTRAINT DF_PremiumProvinces_AreaType DEFAULT 'PROVINCE',
  ParentProvinceId uniqueidentifier NULL, Aliases nvarchar(2000) NOT NULL CONSTRAINT DF_PremiumProvinces_Aliases DEFAULT '',
  IsActive bit NOT NULL CONSTRAINT DF_PremiumProvinces_Active DEFAULT 1);

/* Upgrades installations created before destination areas existed. */
IF COL_LENGTH('premium.PremiumProvinces', 'AreaType') IS NULL
  ALTER TABLE premium.PremiumProvinces ADD AreaType nvarchar(16) NOT NULL CONSTRAINT DF_PremiumProvinces_AreaType_Upgrade DEFAULT 'PROVINCE';
IF COL_LENGTH('premium.PremiumProvinces', 'ParentProvinceId') IS NULL
  ALTER TABLE premium.PremiumProvinces ADD ParentProvinceId uniqueidentifier NULL;
IF COL_LENGTH('premium.PremiumProvinces', 'Aliases') IS NULL
  ALTER TABLE premium.PremiumProvinces ADD Aliases nvarchar(2000) NOT NULL CONSTRAINT DF_PremiumProvinces_Aliases_Upgrade DEFAULT '';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PremiumProvinces_AreaType_Active_Name' AND object_id = OBJECT_ID(N'premium.PremiumProvinces'))
  CREATE INDEX IX_PremiumProvinces_AreaType_Active_Name ON premium.PremiumProvinces (AreaType, IsActive, Name);

IF OBJECT_ID(N'premium.PremiumMissionDefinitions', N'U') IS NULL
CREATE TABLE premium.PremiumMissionDefinitions (
  Id uniqueidentifier NOT NULL PRIMARY KEY, ProvinceId uniqueidentifier NOT NULL,
  Title nvarchar(250) NOT NULL, Instruction nvarchar(max) NOT NULL,
  PlaceName nvarchar(250) NOT NULL, PlaceQuery nvarchar(500) NOT NULL,
  EvidenceType nvarchar(10) NOT NULL, SortOrder int NOT NULL, IsActive bit NOT NULL CONSTRAINT DF_PremiumMissionDefinitions_Active DEFAULT 1,
  CONSTRAINT FK_PremiumMissionDefinitions_Province FOREIGN KEY (ProvinceId) REFERENCES premium.PremiumProvinces(Id),
  CONSTRAINT UQ_PremiumMissionDefinitions_ProvinceSort UNIQUE (ProvinceId, SortOrder));

IF OBJECT_ID(N'premium.PremiumGroups', N'U') IS NULL
CREATE TABLE premium.PremiumGroups (
  Id uniqueidentifier NOT NULL PRIMARY KEY, ProvinceId uniqueidentifier NOT NULL, CreatedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL, CONSTRAINT FK_PremiumGroups_Province FOREIGN KEY (ProvinceId) REFERENCES premium.PremiumProvinces(Id));

IF OBJECT_ID(N'premium.PremiumGroupMembers', N'U') IS NULL
CREATE TABLE premium.PremiumGroupMembers (
  Id uniqueidentifier NOT NULL PRIMARY KEY, GroupId uniqueidentifier NOT NULL, UserId uniqueidentifier NOT NULL, DisplayName nvarchar(120) NOT NULL,
  CONSTRAINT FK_PremiumGroupMembers_Group FOREIGN KEY (GroupId) REFERENCES premium.PremiumGroups(Id) ON DELETE CASCADE,
  CONSTRAINT UQ_PremiumGroupMembers_GroupUser UNIQUE (GroupId, UserId));

/* Public partner links are reusable; no private voucher-code inventory is kept. */
IF OBJECT_ID(N'premium.PremiumPublicOffers', N'U') IS NULL
BEGIN
CREATE TABLE premium.PremiumPublicOffers (
  Id uniqueidentifier NOT NULL PRIMARY KEY, ProvinceId uniqueidentifier NOT NULL,
  MissionId uniqueidentifier NULL, Scope nvarchar(16) NOT NULL,
  Provider nvarchar(160) NOT NULL, Category nvarchar(100) NOT NULL,
  Title nvarchar(250) NOT NULL, Benefit nvarchar(500) NOT NULL,
  Terms nvarchar(max) NOT NULL, PublicUrl nvarchar(1000) NOT NULL,
  StartsAtUtc datetime2 NULL, ExpiresAtUtc datetime2 NULL,
  IsActive bit NOT NULL CONSTRAINT DF_PremiumPublicOffers_Active DEFAULT 1,
  CONSTRAINT FK_PremiumPublicOffers_Province FOREIGN KEY (ProvinceId) REFERENCES premium.PremiumProvinces(Id),
  CONSTRAINT FK_PremiumPublicOffers_Mission FOREIGN KEY (MissionId) REFERENCES premium.PremiumMissionDefinitions(Id));
CREATE INDEX IX_PremiumPublicOffers_Visible ON premium.PremiumPublicOffers (ProvinceId, MissionId, Scope, IsActive, ExpiresAtUtc);
END

IF OBJECT_ID(N'premium.PremiumMissionAssignments', N'U') IS NULL
BEGIN
CREATE TABLE premium.PremiumMissionAssignments (
  Id uniqueidentifier NOT NULL PRIMARY KEY, MissionId uniqueidentifier NOT NULL, UserId uniqueidentifier NOT NULL,
  GroupId uniqueidentifier NULL, AcceptedAtUtc datetime2 NOT NULL, CompletedAtUtc datetime2 NULL,
  EvidenceUrl nvarchar(1000) NULL,
  CONSTRAINT FK_PremiumMissionAssignments_Mission FOREIGN KEY (MissionId) REFERENCES premium.PremiumMissionDefinitions(Id));
CREATE UNIQUE INDEX UX_PremiumMissionAssignments_Special ON premium.PremiumMissionAssignments (MissionId, UserId) WHERE GroupId IS NULL;
CREATE UNIQUE INDEX UX_PremiumMissionAssignments_Group ON premium.PremiumMissionAssignments (MissionId, UserId, GroupId) WHERE GroupId IS NOT NULL;
END

/* Virtual rewards are user-specific records, backed only by reusable public
   demo links. No private code or real partner inventory is stored. */
IF OBJECT_ID(N'premium.PremiumVirtualVoucherTemplates', N'U') IS NULL
CREATE TABLE premium.PremiumVirtualVoucherTemplates (
  Id uniqueidentifier NOT NULL PRIMARY KEY, PartnerKey nvarchar(80) NOT NULL UNIQUE,
  Provider nvarchar(160) NOT NULL, Category nvarchar(100) NOT NULL,
  Title nvarchar(250) NOT NULL, Benefit nvarchar(500) NOT NULL, Terms nvarchar(max) NOT NULL,
  PublicUrl nvarchar(1000) NOT NULL, IsActive bit NOT NULL CONSTRAINT DF_PremiumVirtualVoucherTemplates_Active DEFAULT 1);

IF OBJECT_ID(N'premium.PremiumVirtualVouchers', N'U') IS NULL
BEGIN
CREATE TABLE premium.PremiumVirtualVouchers (
  Id uniqueidentifier NOT NULL PRIMARY KEY, AssignmentId uniqueidentifier NOT NULL, UserId uniqueidentifier NOT NULL,
  TemplateId uniqueidentifier NOT NULL, IssuedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_PremiumVirtualVouchers_Assignment FOREIGN KEY (AssignmentId) REFERENCES premium.PremiumMissionAssignments(Id),
  CONSTRAINT FK_PremiumVirtualVouchers_Template FOREIGN KEY (TemplateId) REFERENCES premium.PremiumVirtualVoucherTemplates(Id),
  CONSTRAINT UQ_PremiumVirtualVouchers_Assignment UNIQUE (AssignmentId));
CREATE INDEX IX_PremiumVirtualVouchers_UserIssued ON premium.PremiumVirtualVouchers (UserId, IssuedAtUtc DESC);
END
