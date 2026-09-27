-- Idempotent upgrade script for IAMDb — adds Users.PushToken.
-- See IAMDb_Events.sql for why this is needed and how to run it.

USE IAMDb;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = 'PushToken'
)
BEGIN
    ALTER TABLE Users ADD PushToken NVARCHAR(200) NULL;
END
GO
