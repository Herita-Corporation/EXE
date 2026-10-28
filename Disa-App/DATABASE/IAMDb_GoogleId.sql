-- Idempotent IAMDb upgrade for the Google Login feature.
-- Existing IAM databases were originally created with EnsureCreated(), which
-- does not add new columns when the application model changes.

IF DB_ID(N'IAMDb') IS NOT NULL
BEGIN
    EXEC(N'
        USE IAMDb;

        IF COL_LENGTH(N''dbo.Users'', N''GoogleId'') IS NULL
        BEGIN
            ALTER TABLE dbo.Users ADD GoogleId NVARCHAR(255) NULL;
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE object_id = OBJECT_ID(N''dbo.Users'')
              AND name = N''IX_Users_GoogleId''
        )
        BEGIN
            CREATE UNIQUE INDEX IX_Users_GoogleId
                ON dbo.Users (GoogleId)
                WHERE GoogleId IS NOT NULL;
        END;
    ');
END;
GO
