-- Idempotent upgrade script for IAMDb — adds the Events table.
--
-- IAMService seeds its schema via EF Core's Database.EnsureCreated() on every
-- startup (see SeedData.cs), which only creates the FULL current model on a
-- brand-new database — it does NOT retrofit new tables/DbSets onto an IAMDb
-- that already exists. A fresh `docker compose down -v && up` gets Events
-- automatically via EnsureCreated; an existing dev database needs this run
-- once by hand:
--   docker exec disa-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -i /path/to/this/file
--
-- (Not wired into docker-compose.yml — same as IAMDb.sql, which nothing runs
-- automatically either; IAMService relies on EnsureCreated instead.)

USE IAMDb;
GO

IF OBJECT_ID(N'dbo.Events', N'U') IS NULL
BEGIN
    CREATE TABLE Events
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NOT NULL,
        Tag NVARCHAR(100) NOT NULL,
        City NVARCHAR(100) NOT NULL,
        CoverImageUrl NVARCHAR(500) NULL,
        StartDate DATETIME2 NOT NULL,
        EndDate DATETIME2 NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_Events_City ON Events(City);
END
GO
