SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @lockResult int;
EXEC @lockResult=sys.sp_getapplock @Resource=N'POS365.Schema', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
IF @lockResult<0 THROW 51000, 'No se pudo bloquear la migracion.', 1;
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=3)
BEGIN
 CREATE TABLE dbo.POS365_Sale(
  SaleId uniqueidentifier NOT NULL PRIMARY KEY,
  RequestId uniqueidentifier NOT NULL UNIQUE,
  BranchId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Branch(BranchId),
  RegisterCode nvarchar(30) NOT NULL,
  DocumentNumber nvarchar(40) NULL,
  OccurredAt datetime2 NOT NULL,
  Currency nvarchar(20) NOT NULL CHECK(Currency IN (N'Colón',N'Dólar')),
  Subtotal decimal(19,4) NOT NULL CHECK(Subtotal>=0),
  Discount decimal(19,4) NOT NULL CHECK(Discount>=0),
  Tax decimal(19,4) NOT NULL CHECK(Tax>=0),
  Total decimal(19,4) NOT NULL CHECK(Total>=0),
  Status nvarchar(20) NOT NULL DEFAULT N'Draft'
    CHECK(Status IN (N'Draft',N'Completed',N'Voided')),
  CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  CONSTRAINT CK_POS365_SaleAmounts CHECK(Discount<=Subtotal AND Total=Subtotal-Discount+Tax)
 );
 CREATE UNIQUE INDEX UX_POS365_Sale_Document ON dbo.POS365_Sale(BranchId,DocumentNumber)
 WHERE DocumentNumber IS NOT NULL;
 CREATE TABLE dbo.POS365_SaleLine(
  SaleId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Sale(SaleId),
  LineNumber int NOT NULL CHECK(LineNumber>0),
  ProductId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Product(ProductId),
  Code nvarchar(100) NOT NULL,
  Description nvarchar(250) NOT NULL,
  Cabys nvarchar(13) NOT NULL,
  Quantity decimal(19,4) NOT NULL CHECK(Quantity>0),
  UnitPrice decimal(19,4) NOT NULL CHECK(UnitPrice>=0),
  Subtotal decimal(19,4) NOT NULL CHECK(Subtotal>=0),
  Discount decimal(19,4) NOT NULL CHECK(Discount>=0),
  Tax decimal(19,4) NOT NULL CHECK(Tax>=0),
  Total decimal(19,4) NOT NULL CHECK(Total>=0),
  CONSTRAINT PK_POS365_SaleLine PRIMARY KEY(SaleId,LineNumber),
  CONSTRAINT CK_POS365_SaleLineAmounts CHECK(Discount<=Subtotal AND Total=Subtotal-Discount+Tax)
 );
 CREATE TABLE dbo.POS365_SalePayment(
  SaleId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Sale(SaleId),
  PaymentNumber int NOT NULL CHECK(PaymentNumber>0),
  Method nvarchar(30) NOT NULL,
  Currency nvarchar(20) NOT NULL CHECK(Currency IN (N'Colón',N'Dólar')),
  Amount decimal(19,4) NOT NULL CHECK(Amount>0),
  Reference nvarchar(100) NULL,
  CONSTRAINT PK_POS365_SalePayment PRIMARY KEY(SaleId,PaymentNumber)
 );
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(3);
END;
COMMIT;
