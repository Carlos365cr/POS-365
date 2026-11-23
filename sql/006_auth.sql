SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @result int;
EXEC @result=sys.sp_getapplock @Resource=N'POS365.Schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
IF @result<0 THROW 51000,'No se pudo bloquear migracion de usuarios',1;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=6)
BEGIN
  IF OBJECT_ID(N'dbo.POS365_User',N'U') IS NOT NULL
    THROW 51001,'La tabla POS365_User ya existe sin la version de esquema. Revisar antes de continuar.',1;
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
  INSERT dbo.POS365_SchemaVersion(Version) VALUES(6);
END;
COMMIT;
