-- Minimize RBAC tables for the course project: keep fixed application roles
-- on AppUser, and keep native SQL Server roles/views/procs/RLS as the DB layer.

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'EmployeeFilterPolicy') ALTER SECURITY POLICY [dbo].[EmployeeFilterPolicy] WITH (STATE = OFF);
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SensitiveDataPolicy') ALTER SECURITY POLICY [dbo].[SensitiveDataPolicy] WITH (STATE = OFF);

IF OBJECT_ID(N'[dbo].[vw_AuditLogDetail]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_AuditLogDetail];
IF OBJECT_ID(N'[dbo].[vw_DepartmentRoster]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_DepartmentRoster];
IF OBJECT_ID(N'[dbo].[vw_PayrollSummary]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_PayrollSummary];
IF OBJECT_ID(N'[dbo].[vw_EmployeeWithSensitive]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_EmployeeWithSensitive];
IF OBJECT_ID(N'[dbo].[vw_EmployeeDirectory]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_EmployeeDirectory];

IF OBJECT_ID(N'[dbo].[sp_CheckPermission]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_CheckPermission];
IF OBJECT_ID(N'[dbo].[tr_UserRole_AuditChanges]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_UserRole_AuditChanges];

IF COL_LENGTH(N'dbo.AppUser', N'roleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AppUser]
    ADD [roleName] NVARCHAR(50) NOT NULL CONSTRAINT [AppUser_roleName_df] DEFAULT 'REGULAR';
END;

IF OBJECT_ID(N'[dbo].[UserRole]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Role]', N'U') IS NOT NULL
BEGIN
    EXEC(N'
    UPDATE u
    SET u.roleName = ranked.roleName
    FROM [dbo].[AppUser] u
    INNER JOIN (
        SELECT ur.userId, r.name AS roleName,
               ROW_NUMBER() OVER (
                 PARTITION BY ur.userId
                 ORDER BY CASE r.name
                   WHEN ''ADMIN'' THEN 1
                   WHEN ''HR_MANAGER'' THEN 2
                   WHEN ''HR_EMPLOYEE'' THEN 3
                   WHEN ''ACCOUNTING'' THEN 4
                   WHEN ''MANAGER'' THEN 5
                   ELSE 6
                 END
               ) AS rn
        FROM [dbo].[UserRole] ur
        INNER JOIN [dbo].[Role] r ON ur.roleId = r.id
    ) ranked ON ranked.userId = u.id AND ranked.rn = 1;
    ');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AppUser_roleName')
BEGIN
    EXEC(N'ALTER TABLE [dbo].[AppUser]
    ADD CONSTRAINT [CK_AppUser_roleName]
    CHECK ([roleName] IN (''REGULAR'',''MANAGER'',''HR_EMPLOYEE'',''HR_MANAGER'',''ACCOUNTING'',''ADMIN''));');
END;

IF OBJECT_ID(N'[dbo].[RolePermission]', N'U') IS NOT NULL DROP TABLE [dbo].[RolePermission];
IF OBJECT_ID(N'[dbo].[UserRole]', N'U') IS NOT NULL DROP TABLE [dbo].[UserRole];
IF OBJECT_ID(N'[dbo].[Permission]', N'U') IS NOT NULL DROP TABLE [dbo].[Permission];
IF OBJECT_ID(N'[dbo].[Role]', N'U') IS NOT NULL DROP TABLE [dbo].[Role];

EXEC(N'
CREATE VIEW [dbo].[vw_EmployeeDirectory] AS
SELECT e.id AS employeeId, e.fullName, e.dob, u.email, e.departmentId,
       d.name AS departmentName, e.status, e.hireDate, u.roleName AS primaryRole
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.userId = u.id
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
WHERE e.status = ''ACTIVE'' AND u.isActive = 1;
');

EXEC(N'
CREATE VIEW [dbo].[vw_EmployeeWithSensitive] AS
SELECT e.id AS employeeId, e.fullName, e.dob, u.email, e.departmentId,
       d.name AS departmentName, e.status, e.hireDate,
       es.salary, es.taxCode, es.bankAccount, u.roleName AS primaryRole
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.userId = u.id
LEFT JOIN [dbo].[EmployeeSensitive] es ON e.id = es.employeeId
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
WHERE e.status = ''ACTIVE'' AND u.isActive = 1;
');

EXEC(N'
CREATE VIEW [dbo].[vw_PayrollSummary] AS
SELECT e.id AS employeeId, e.fullName, e.departmentId, d.name AS departmentName,
       es.salary, es.taxCode, es.bankAccount
FROM [dbo].[Employee] e
INNER JOIN [dbo].[EmployeeSensitive] es ON e.id = es.employeeId
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
WHERE e.status = ''ACTIVE'';
');

EXEC(N'
CREATE VIEW [dbo].[vw_DepartmentRoster] AS
SELECT e.id AS employeeId, e.fullName, e.dob, u.email, e.departmentId,
       d.name AS departmentName, e.status, u.roleName AS primaryRole
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.userId = u.id
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
WHERE e.status = ''ACTIVE'' AND u.isActive = 1;
');

EXEC(N'
CREATE VIEW [dbo].[vw_AuditLogDetail] AS
SELECT al.id, al.[timestamp], al.actorId,
       COALESCE(actorEmployee.fullName, ''[System]'') AS actorName,
       al.targetTable, al.targetId,
       COALESCE(targetEmployee.fullName, targetDepartment.name, targetUser.email, CONVERT(NVARCHAR(36), al.targetId)) AS targetName,
       al.[action], al.oldValues, al.newValues, al.ipAddress, al.userAgent
FROM [dbo].[AuditLog] al
LEFT JOIN [dbo].[Employee] actorEmployee ON al.actorId = actorEmployee.userId
LEFT JOIN [dbo].[Employee] targetEmployee ON al.targetTable = ''Employee'' AND al.targetId = targetEmployee.id
LEFT JOIN [dbo].[Department] targetDepartment ON al.targetTable = ''Department'' AND al.targetId = targetDepartment.id
LEFT JOIN [dbo].[AppUser] targetUser ON al.targetTable IN (''AppUser'', ''UserRole'') AND al.targetId = targetUser.id;
');

EXEC(N'
CREATE PROCEDURE [dbo].[sp_CheckPermission]
    @UserId UNIQUEIDENTIFIER,
    @Resource NVARCHAR(50),
    @Action NVARCHAR(50),
    @Scope NVARCHAR(50) = ''all''
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleName NVARCHAR(50);
    SELECT @RoleName = roleName
    FROM [dbo].[AppUser]
    WHERE id = @UserId AND isActive = 1;

    IF @RoleName = ''ADMIN''
    BEGIN
        SELECT 1 AS [HasPermission];
        RETURN;
    END;

    IF (
        (@RoleName = ''REGULAR'' AND (
            (@Resource = ''employee'' AND @Action = ''read'' AND @Scope = ''own_department'') OR
            (@Resource = ''department'' AND @Action = ''read'' AND @Scope = ''all'')
        ))
        OR
        (@RoleName = ''MANAGER'' AND (
            (@Resource = ''employee'' AND @Action = ''read'' AND @Scope = ''own_department'') OR
            (@Resource = ''employee_sensitive'' AND @Action = ''read'' AND @Scope = ''own_department'') OR
            (@Resource = ''department'' AND @Action = ''read'' AND @Scope = ''all'')
        ))
        OR
        (@RoleName = ''HR_EMPLOYEE'' AND (
            (@Resource = ''employee'' AND @Action = ''read'') OR
            (@Resource = ''employee'' AND @Action IN (''create'',''update'',''delete'') AND @Scope = ''other_department'') OR
            (@Resource = ''employee_sensitive'' AND @Action = ''read'') OR
            (@Resource = ''employee_sensitive'' AND @Action = ''update'' AND @Scope = ''other_department'') OR
            (@Resource = ''department'' AND @Action = ''read'' AND @Scope = ''all'')
        ))
        OR
        (@RoleName = ''HR_MANAGER'' AND (
            (@Resource = ''employee'' AND @Action IN (''read'',''create'',''update'',''delete'')) OR
            (@Resource = ''employee_sensitive'' AND @Action IN (''read'',''update'')) OR
            (@Resource = ''department'' AND @Action IN (''read'',''manage'') AND @Scope = ''all'') OR
            (@Resource = ''audit_log'' AND @Action = ''read'' AND @Scope = ''all'')
        ))
        OR
        (@RoleName = ''ACCOUNTING'' AND (
            (@Resource = ''employee'' AND @Action = ''read'') OR
            (@Resource = ''employee_sensitive'' AND @Action = ''read'') OR
            (@Resource = ''department'' AND @Action = ''read'' AND @Scope = ''all'')
        ))
    )
        SELECT 1 AS [HasPermission];
    ELSE
        SELECT 0 AS [HasPermission];
END;
');

GRANT SELECT ON [dbo].[vw_EmployeeDirectory] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_DepartmentRoster] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_EmployeeWithSensitive] TO [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_PayrollSummary] TO [ems_accounting], [ems_hr_manager], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_hr_manager], [ems_admin], [ems_app_runtime];
DENY SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_accounting];
GRANT EXECUTE ON [dbo].[sp_CheckPermission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'EmployeeFilterPolicy') ALTER SECURITY POLICY [dbo].[EmployeeFilterPolicy] WITH (STATE = ON);
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SensitiveDataPolicy') ALTER SECURITY POLICY [dbo].[SensitiveDataPolicy] WITH (STATE = ON);
