/*
  SQL Server database-user demo setup for the Employee Management System.

  Run this script after applying Prisma migrations, from the target EMS database.
  The passwords below are for local/course demonstration only. Do not reuse them
  in production or in any shared environment.

  Required server/database permissions for the executor:
  - CREATE LOGIN, or equivalent server-level permission.
  - CREATE USER and ALTER ROLE in the EMS database.
*/

SET NOCOUNT ON;

DECLARE @MissingRoles TABLE ([name] SYSNAME NOT NULL PRIMARY KEY);

INSERT INTO @MissingRoles ([name])
VALUES
    (N'ems_regular'),
    (N'ems_manager'),
    (N'ems_hr_employee'),
    (N'ems_hr_manager'),
    (N'ems_accounting'),
    (N'ems_admin'),
    (N'ems_app_runtime');

DELETE FROM @MissingRoles
WHERE DATABASE_PRINCIPAL_ID([name]) IS NOT NULL;

IF EXISTS (SELECT 1 FROM @MissingRoles)
BEGIN
    SELECT [name] AS missing_database_role
    FROM @MissingRoles
    ORDER BY [name];

    THROW 51000, 'Missing EMS database roles. Run Prisma migrations before security-demo-users.sql.', 1;
END;

-- Server logins. These are SQL Server instance-level principals.
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_regular_login')
    CREATE LOGIN [ems_regular_login]
    WITH PASSWORD = N'Regular@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_manager_login')
    CREATE LOGIN [ems_manager_login]
    WITH PASSWORD = N'Manager@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_hr_employee_login')
    CREATE LOGIN [ems_hr_employee_login]
    WITH PASSWORD = N'HrEmployee@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_hr_manager_login')
    CREATE LOGIN [ems_hr_manager_login]
    WITH PASSWORD = N'HrManager@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_accounting_login')
    CREATE LOGIN [ems_accounting_login]
    WITH PASSWORD = N'Accounting@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_admin_login')
    CREATE LOGIN [ems_admin_login]
    WITH PASSWORD = N'Admin@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE [name] = N'ems_app_runtime_login')
    CREATE LOGIN [ems_app_runtime_login]
    WITH PASSWORD = N'AppRuntime@12345!', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

-- Database users. These are scoped to the current EMS database.
IF DATABASE_PRINCIPAL_ID(N'ems_regular_user') IS NULL
    CREATE USER [ems_regular_user] FOR LOGIN [ems_regular_login];

IF DATABASE_PRINCIPAL_ID(N'ems_manager_user') IS NULL
    CREATE USER [ems_manager_user] FOR LOGIN [ems_manager_login];

IF DATABASE_PRINCIPAL_ID(N'ems_hr_employee_user') IS NULL
    CREATE USER [ems_hr_employee_user] FOR LOGIN [ems_hr_employee_login];

IF DATABASE_PRINCIPAL_ID(N'ems_hr_manager_user') IS NULL
    CREATE USER [ems_hr_manager_user] FOR LOGIN [ems_hr_manager_login];

IF DATABASE_PRINCIPAL_ID(N'ems_accounting_user') IS NULL
    CREATE USER [ems_accounting_user] FOR LOGIN [ems_accounting_login];

IF DATABASE_PRINCIPAL_ID(N'ems_admin_user') IS NULL
    CREATE USER [ems_admin_user] FOR LOGIN [ems_admin_login];

IF DATABASE_PRINCIPAL_ID(N'ems_app_runtime_user') IS NULL
    CREATE USER [ems_app_runtime_user] FOR LOGIN [ems_app_runtime_login];

-- Role memberships for direct SQL Server security demos.
IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_regular' AND dp.[name] = N'ems_regular_user'
)
    ALTER ROLE [ems_regular] ADD MEMBER [ems_regular_user];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_manager' AND dp.[name] = N'ems_manager_user'
)
    ALTER ROLE [ems_manager] ADD MEMBER [ems_manager_user];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_hr_employee' AND dp.[name] = N'ems_hr_employee_user'
)
    ALTER ROLE [ems_hr_employee] ADD MEMBER [ems_hr_employee_user];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_hr_manager' AND dp.[name] = N'ems_hr_manager_user'
)
    ALTER ROLE [ems_hr_manager] ADD MEMBER [ems_hr_manager_user];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_accounting' AND dp.[name] = N'ems_accounting_user'
)
    ALTER ROLE [ems_accounting] ADD MEMBER [ems_accounting_user];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_admin' AND dp.[name] = N'ems_admin_user'
)
    ALTER ROLE [ems_admin] ADD MEMBER [ems_admin_user];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE rp.[name] = N'ems_app_runtime' AND dp.[name] = N'ems_app_runtime_user'
)
    ALTER ROLE [ems_app_runtime] ADD MEMBER [ems_app_runtime_user];

IF EXISTS (
    SELECT 1
    FROM sys.database_role_members drm
    JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
    JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
    WHERE dp.[name] = N'ems_app_runtime_user'
      AND rp.[name] LIKE N'ems[_]%'
      AND rp.[name] <> N'ems_app_runtime'
)
BEGIN
    THROW 51001, 'ems_app_runtime_user must only be a member of ems_app_runtime among EMS roles.', 1;
END;

PRINT 'EMS security demo logins, users, and role memberships are ready.';

/*
  Optional demo checks:

  -- 1. Membership overview.
  SELECT dp.name AS database_user, rp.name AS database_role
  FROM sys.database_role_members drm
  JOIN sys.database_principals rp ON drm.role_principal_id = rp.principal_id
  JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
  WHERE rp.name LIKE 'ems_%'
  ORDER BY rp.name, dp.name;

  -- 2. Direct user cannot read base tables, but can read curated views.
  EXECUTE AS USER = 'ems_regular_user';
  SELECT TOP 1 * FROM dbo.Employee; -- expected: permission denied
  SELECT TOP 1 * FROM dbo.vw_EmployeeDirectory; -- expected: allowed, subject to RLS/session context
  REVERT;

  -- 3. Application runtime has the permissions required by the current app.
  EXECUTE AS USER = 'ems_app_runtime_user';
  SELECT TOP 1 * FROM dbo.AppUser; -- expected: allowed by current grants
  EXEC dbo.sp_Authenticate @Email = N'an.nguyen@company.vn';
  REVERT;
*/
