IF DB_NAME() <> N'POS365_DEV' THROW 51000,'Base no autorizada',1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'POS365.Schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
IF @lock<0 THROW 51000,'No se pudo bloquear migracion',1;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=7)
BEGIN
 CREATE TABLE dbo.POS365_PurchaseInbox(
  DocumentKey char(50) NOT NULL PRIMARY KEY,
  DocumentType nvarchar(40) NOT NULL,
  SupplierId nvarchar(50) NOT NULL,
  SupplierName nvarchar(250) NOT NULL,
  ReceiverId nvarchar(50) NOT NULL,
  IssuedAt datetimeoffset NOT NULL,
  Currency char(3) NOT NULL,
  Total decimal(19,5) NOT NULL,
  XmlContent nvarchar(max) NOT NULL,
  ContentHash binary(32) NOT NULL,
  Status nvarchar(20) NOT NULL DEFAULT N'Pending',
  ReceivedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_POS365_PurchaseInbox_Status CHECK(Status IN(N'Pending',N'Registered',N'Rejected'))
 );
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(7);
END;
COMMIT;
