SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @lockResult int;
EXEC @lockResult=sys.sp_getapplock @Resource=N'POS365.Schema', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
IF @lockResult<0 THROW 51000, 'No se pudo bloquear la migracion.', 1;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=2)
BEGIN
 CREATE TABLE dbo.POS365_Product(
  ProductId uniqueidentifier NOT NULL PRIMARY KEY,
  Code nvarchar(100) COLLATE Latin1_General_100_CI_AS NOT NULL UNIQUE,
  Barcode nvarchar(100) NOT NULL,
  Name nvarchar(250) NOT NULL,
  Cabys nvarchar(13) NOT NULL,
  IncludesVAT bit NOT NULL,
  SourceJson nvarchar(max) NOT NULL,
  UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL);
 CREATE INDEX IX_POS365_Product_Name ON dbo.POS365_Product(Name);
 CREATE TABLE dbo.POS365_ProductIdentifier(
  Identifier nvarchar(100) COLLATE Latin1_General_100_CI_AS NOT NULL PRIMARY KEY,
  ProductId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Product(ProductId));
 CREATE INDEX IX_POS365_ProductIdentifier_Product ON dbo.POS365_ProductIdentifier(ProductId);
 CREATE TABLE dbo.POS365_ProductPrice(
  ProductId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Product(ProductId),
  ListNumber int NOT NULL CHECK(ListNumber BETWEEN 0 AND 99),
  Amount decimal(19,4) NULL CHECK(Amount>=0),
  Currency nvarchar(20) NOT NULL,
  PRIMARY KEY(ProductId,ListNumber));
 CREATE TABLE dbo.POS365_CatalogImport(
  ContentHash char(64) NOT NULL PRIMARY KEY,
  ProductCount int NOT NULL,
  ImportedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(2);
END;
COMMIT;
