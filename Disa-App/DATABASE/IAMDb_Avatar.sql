-- Idempotent upgrade script for IAMDb — adds Users.AvatarUrl.
-- See IAMDb_Events.sql for why this is needed (EnsureCreated() does not
-- retrofit schema changes onto an already-existing database) and how to run it.

USE IAMDb;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = 'AvatarUrl'
)
BEGIN
    ALTER TABLE Users ADD AvatarUrl NVARCHAR(500) NULL;
END
GO
