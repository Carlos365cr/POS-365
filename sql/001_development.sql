SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock @Resource=N'POS365.Schema', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
IF @lockResult < 0 THROW 51000, 'No se pudo bloquear la migracion.', 1;
IF OBJECT_ID(N'dbo.POS365_SchemaVersion', N'U') IS NULL
 CREATE TABLE dbo.POS365_SchemaVersion(Version int NOT NULL PRIMARY KEY, AppliedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
IF NOT EXISTS(SELECT 1 FROM dbo.POS365_SchemaVersion WHERE Version=1)
BEGIN
 CREATE TABLE dbo.POS365_Branch(
  BranchId uniqueidentifier NOT NULL PRIMARY KEY,
  Code nvarchar(20) NOT NULL UNIQUE,
  Name nvarchar(150) NOT NULL,
  Version rowversion NOT NULL);
 CREATE TABLE dbo.POS365_Outbox(
  EventId uniqueidentifier NOT NULL PRIMARY KEY,
  BranchId uniqueidentifier NOT NULL REFERENCES dbo.POS365_Branch(BranchId),
  EventType nvarchar(100) NOT NULL,
  Payload nvarchar(max) NOT NULL,
  CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  DeliveredAt datetime2 NULL,
  Attempts int NOT NULL DEFAULT 0 CHECK(Attempts>=0));
 CREATE INDEX IX_POS365_Outbox_Pending ON dbo.POS365_Outbox(CreatedAt) WHERE DeliveredAt IS NULL;
 CREATE TABLE dbo.POS365_Inbox(
  EventId uniqueidentifier NOT NULL PRIMARY KEY,
  ReceivedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 INSERT dbo.POS365_SchemaVersion(Version) VALUES(1);
END;
-- SQL Server anterior a 2016 no reconoce ISJSON ni siquiera dentro de un IF.
-- SQL dinamico evita compilar la funcion en motores antiguos.
-- Los futuros productores de eventos deben validar JSON en .NET en todos los motores.
IF CAST(PARSENAME(CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)),4) AS int) >= 13
 AND OBJECT_ID(N'dbo.CK_POS365_Outbox_Json', N'C') IS NULL
 EXEC(N'ALTER TABLE dbo.POS365_Outbox WITH CHECK ADD CONSTRAINT CK_POS365_Outbox_Json CHECK (ISJSON(Payload)=1);');
COMMIT;
