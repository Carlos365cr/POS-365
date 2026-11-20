SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @lockResult int;
EXEC @lockResult=sys.sp_getapplock @Resource=N'POS365.Schema', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
IF @lockResult<0 THROW 51000, 'No se pudo bloquear la migracion.', 1;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=4)
BEGIN
 CREATE TABLE dbo.POS365_ProductTax(
  ProductId uniqueidentifier NOT NULL PRIMARY KEY REFERENCES dbo.POS365_Product(ProductId),
  TaxRate decimal(7,4) NOT NULL CHECK(TaxRate BETWEEN 0 AND 100),
  UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(4);
END;
COMMIT;