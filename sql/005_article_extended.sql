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
 CREATE TABLE dbo.POS365_ProductField(
   ProductId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Product(ProductId),
   Section nvarchar(20) NOT NULL CHECK(Section IN(N'General',N'Costos',N'Precios')),
   FieldIndex int NOT NULL CHECK(FieldIndex>=0),
   FieldName nvarchar(150) NOT NULL,
   FieldValue nvarchar(max) NOT NULL,
   IsChecked bit NULL,
   CONSTRAINT PK_POS365_ProductField PRIMARY KEY(ProductId,Section,FieldIndex)
 );
 CREATE INDEX IX_POS365_ProductField_Name ON dbo.POS365_ProductField(ProductId,Section,FieldName);
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(5);
END;
COMMIT;