IF OBJECT_ID(N'dbo.POS365_User',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.POS365_User (
    UserId uniqueidentifier NOT NULL CONSTRAINT PK_POS365_User PRIMARY KEY,
    Username nvarchar(64) NOT NULL,
    DisplayName nvarchar(150) NOT NULL,
    PasswordSalt varbinary(32) NOT NULL,
    PasswordHash varbinary(32) NOT NULL,
    IsAdmin bit NOT NULL CONSTRAINT DF_POS365_User_Admin DEFAULT (0),
    IsActive bit NOT NULL CONSTRAINT DF_POS365_User_Active DEFAULT (1),
    FailedAttempts int NOT NULL CONSTRAINT DF_POS365_User_Failed DEFAULT (0),
    LockedUntil datetime2(0) NULL,
    CreatedUtc datetime2(0) NOT NULL CONSTRAINT DF_POS365_User_Created DEFAULT SYSUTCDATETIME(),
    UpdatedUtc datetime2(0) NOT NULL CONSTRAINT DF_POS365_User_Updated DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_POS365_User_Username ON dbo.POS365_User(Username);
END;
