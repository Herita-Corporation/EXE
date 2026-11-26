/* Idempotent Premium mission schema for TaskDb. TaskDb is initialized from
   SQL scripts, so this avoids applying legacy EF migrations to an existing DB. */
/* Filtered indexes below require these SQL Server session options. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'premium') EXEC(N'CREATE SCHEMA premium');

IF OBJECT_ID(N'premium.PremiumProvinces', N'U') IS NULL
CREATE TABLE premium.PremiumProvinces (
  Id uniqueidentifier NOT NULL PRIMARY KEY, Code nvarchar(32) NOT NULL UNIQUE,
  Name nvarchar(120) NOT NULL, IsActive bit NOT NULL CONSTRAINT DF_PremiumProvinces_Active DEFAULT 1);

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
