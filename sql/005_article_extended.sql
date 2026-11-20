SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @result int;
EXEC @result=sys.sp_getapplock @Resource=N'POS365.Schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
IF @result<0 THROW 51000,'No se pudo bloquear migracion',1;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=5)
BEGIN
 CREATE TABLE dbo.POS365_ProductExtended(
   ProductId uniqueidentifier NOT NULL PRIMARY KEY REFERENCES dbo.POS365_Product(ProductId),
   GeneralJson nvarchar(max) NOT NULL,
   CostsJson nvarchar(max) NOT NULL,
   PricesJson nvarchar(max) NOT NULL,
   OtherJson nvarchar(max) NOT NULL,
   UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(5);
END;
COMMIT;