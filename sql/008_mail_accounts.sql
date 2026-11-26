IF DB_NAME() <> N'POS365_DEV' THROW 51000,'Base no autorizada',1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'POS365.Schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
IF @lock<0 THROW 51000,'No se pudo bloquear migracion',1;
IF OBJECT_ID(N'dbo.POS365_MailAccount',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.POS365_MailAccount(
 AccountId uniqueidentifier NOT NULL PRIMARY KEY,
 Email nvarchar(254) NOT NULL UNIQUE,
 ProtectedPassword nvarchar(max) NOT NULL,
 ReceiverId nvarchar(50) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
END;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=8)
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(8);
COMMIT;
