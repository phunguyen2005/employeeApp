-- Security-first schema redesign migration.

IF OBJECT_ID(N'[dbo].[__LegacyAuditLog]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[AuditLog]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.AuditLog', N'changes') IS NOT NULL
    SELECT * INTO [dbo].[__LegacyAuditLog] FROM [dbo].[AuditLog];

IF OBJECT_ID(N'[dbo].[__LegacyDepartment]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[Department]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Department', N'isActive') IS NULL
    SELECT * INTO [dbo].[__LegacyDepartment] FROM [dbo].[Department];

IF OBJECT_ID(N'[dbo].[__LegacyEmployee]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[Employee]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Employee', N'password') IS NOT NULL
    SELECT * INTO [dbo].[__LegacyEmployee] FROM [dbo].[Employee];

IF OBJECT_ID(N'[dbo].[__LegacyAppUser]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[AppUser]', N'U') IS NOT NULL
    SELECT * INTO [dbo].[__LegacyAppUser] FROM [dbo].[AppUser];

IF OBJECT_ID(N'[dbo].[__LegacyEmployeeSensitive]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[EmployeeSensitive]', N'U') IS NOT NULL
    SELECT * INTO [dbo].[__LegacyEmployeeSensitive] FROM [dbo].[EmployeeSensitive];

IF OBJECT_ID(N'[dbo].[__LegacyRole]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[Role]', N'U') IS NOT NULL
    SELECT * INTO [dbo].[__LegacyRole] FROM [dbo].[Role];

IF OBJECT_ID(N'[dbo].[__LegacyUserRole]', N'U') IS NULL
   AND OBJECT_ID(N'[dbo].[UserRole]', N'U') IS NOT NULL
    SELECT * INTO [dbo].[__LegacyUserRole] FROM [dbo].[UserRole];

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'EmployeeFilterPolicy') DROP SECURITY POLICY [dbo].[EmployeeFilterPolicy];
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SensitiveDataPolicy') DROP SECURITY POLICY [dbo].[SensitiveDataPolicy];

IF OBJECT_ID(N'[dbo].[vw_AuditLogDetail]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_AuditLogDetail];
IF OBJECT_ID(N'[dbo].[vw_DepartmentRoster]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_DepartmentRoster];
IF OBJECT_ID(N'[dbo].[vw_PayrollSummary]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_PayrollSummary];
IF OBJECT_ID(N'[dbo].[vw_EmployeeWithSensitive]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_EmployeeWithSensitive];
IF OBJECT_ID(N'[dbo].[vw_EmployeeDirectory]', N'V') IS NOT NULL DROP VIEW [dbo].[vw_EmployeeDirectory];

IF OBJECT_ID(N'[dbo].[sp_SoftDeleteEmployee]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_SoftDeleteEmployee];
IF OBJECT_ID(N'[dbo].[sp_UpdateEmployee]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_UpdateEmployee];
IF OBJECT_ID(N'[dbo].[sp_RecordLoginFailure]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_RecordLoginFailure];
IF OBJECT_ID(N'[dbo].[sp_RecordLoginSuccess]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_RecordLoginSuccess];
IF OBJECT_ID(N'[dbo].[sp_Authenticate]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_Authenticate];
IF OBJECT_ID(N'[dbo].[sp_CheckPermission]', N'P') IS NOT NULL DROP PROCEDURE [dbo].[sp_CheckPermission];

IF OBJECT_ID(N'[dbo].[tr_UserRole_AuditChanges]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_UserRole_AuditChanges];
IF OBJECT_ID(N'[dbo].[tr_EmployeeSensitive_AuditChanges]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_EmployeeSensitive_AuditChanges];
IF OBJECT_ID(N'[dbo].[tr_Employee_PreventHardDelete]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_Employee_PreventHardDelete];
IF OBJECT_ID(N'[dbo].[tr_AuditLog_PreventModification]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_AuditLog_PreventModification];
IF OBJECT_ID(N'[dbo].[tr_Department_UpdateTimestamp]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_Department_UpdateTimestamp];
IF OBJECT_ID(N'[dbo].[tr_EmployeeSensitive_UpdateTimestamp]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_EmployeeSensitive_UpdateTimestamp];
IF OBJECT_ID(N'[dbo].[tr_Employee_UpdateTimestamp]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_Employee_UpdateTimestamp];
IF OBJECT_ID(N'[dbo].[tr_AppUser_UpdateTimestamp]', N'TR') IS NOT NULL DROP TRIGGER [dbo].[tr_AppUser_UpdateTimestamp];

IF OBJECT_ID(N'[dbo].[fn_SensitiveDataFilter]', N'IF') IS NOT NULL DROP FUNCTION [dbo].[fn_SensitiveDataFilter];
IF OBJECT_ID(N'[dbo].[fn_EmployeeRowFilter]', N'IF') IS NOT NULL DROP FUNCTION [dbo].[fn_EmployeeRowFilter];

DECLARE @dropFkSql NVARCHAR(MAX) = N'';
SELECT @dropFkSql = @dropFkSql + N'ALTER TABLE '
  + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
  + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
FROM sys.foreign_keys
WHERE parent_object_id IN (
        OBJECT_ID(N'[dbo].[Employee]'), OBJECT_ID(N'[dbo].[Department]'), OBJECT_ID(N'[dbo].[AuditLog]'),
        OBJECT_ID(N'[dbo].[AppUser]'), OBJECT_ID(N'[dbo].[EmployeeSensitive]'), OBJECT_ID(N'[dbo].[Role]'),
        OBJECT_ID(N'[dbo].[Permission]'), OBJECT_ID(N'[dbo].[UserRole]'), OBJECT_ID(N'[dbo].[RolePermission]'),
        OBJECT_ID(N'[dbo].[UserSession]')
      )
   OR referenced_object_id IN (
        OBJECT_ID(N'[dbo].[Employee]'), OBJECT_ID(N'[dbo].[Department]'), OBJECT_ID(N'[dbo].[AuditLog]'),
        OBJECT_ID(N'[dbo].[AppUser]'), OBJECT_ID(N'[dbo].[EmployeeSensitive]'), OBJECT_ID(N'[dbo].[Role]'),
        OBJECT_ID(N'[dbo].[Permission]'), OBJECT_ID(N'[dbo].[UserRole]'), OBJECT_ID(N'[dbo].[RolePermission]'),
        OBJECT_ID(N'[dbo].[UserSession]')
      );
IF LEN(@dropFkSql) > 0 EXEC sp_executesql @dropFkSql;

IF OBJECT_ID(N'[dbo].[AuditLog]', N'U') IS NOT NULL DROP TABLE [dbo].[AuditLog];
IF OBJECT_ID(N'[dbo].[UserSession]', N'U') IS NOT NULL DROP TABLE [dbo].[UserSession];
IF OBJECT_ID(N'[dbo].[RolePermission]', N'U') IS NOT NULL DROP TABLE [dbo].[RolePermission];
IF OBJECT_ID(N'[dbo].[UserRole]', N'U') IS NOT NULL DROP TABLE [dbo].[UserRole];
IF OBJECT_ID(N'[dbo].[EmployeeSensitive]', N'U') IS NOT NULL DROP TABLE [dbo].[EmployeeSensitive];
IF OBJECT_ID(N'[dbo].[Department]', N'U') IS NOT NULL DROP TABLE [dbo].[Department];
IF OBJECT_ID(N'[dbo].[Employee]', N'U') IS NOT NULL DROP TABLE [dbo].[Employee];
IF OBJECT_ID(N'[dbo].[Permission]', N'U') IS NOT NULL DROP TABLE [dbo].[Permission];
IF OBJECT_ID(N'[dbo].[Role]', N'U') IS NOT NULL DROP TABLE [dbo].[Role];
IF OBJECT_ID(N'[dbo].[AppUser]', N'U') IS NOT NULL DROP TABLE [dbo].[AppUser];

CREATE TABLE [dbo].[AppUser] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [AppUser_id_df] DEFAULT NEWID(),
    [email] NVARCHAR(255) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [AppUser_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2(3) NULL,
    [failedAttempts] INT NOT NULL CONSTRAINT [AppUser_failedAttempts_df] DEFAULT 0,
    [lockedUntil] DATETIME2(3) NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [AppUser_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2(3) NOT NULL CONSTRAINT [AppUser_updatedAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_AppUser] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_AppUser_email] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [CK_AppUser_email] CHECK ([email] LIKE '%_@_%.__%'),
    CONSTRAINT [CK_AppUser_failedAttempts] CHECK ([failedAttempts] >= 0)
);

CREATE TABLE [dbo].[Department] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Department_id_df] DEFAULT NEWID(),
    [name] NVARCHAR(100) NOT NULL,
    [managerId] UNIQUEIDENTIFIER NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Department_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [Department_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2(3) NOT NULL CONSTRAINT [Department_updatedAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Department] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_Department_name] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [CK_Department_name] CHECK (LEN(LTRIM(RTRIM([name]))) >= 2)
);

CREATE TABLE [dbo].[Employee] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Employee_id_df] DEFAULT NEWID(),
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [fullName] NVARCHAR(200) NOT NULL,
    [dob] DATE NOT NULL,
    [phone] NVARCHAR(20) NULL,
    [departmentId] UNIQUEIDENTIFIER NULL,
    [hireDate] DATE NOT NULL CONSTRAINT [Employee_hireDate_df] DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Employee_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2(3) NOT NULL CONSTRAINT [Employee_updatedAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Employee] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_Employee_userId] UNIQUE NONCLUSTERED ([userId]),
    CONSTRAINT [FK_Employee_AppUser] FOREIGN KEY ([userId]) REFERENCES [dbo].[AppUser]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_Employee_Department] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_Employee_fullName] CHECK (LEN(LTRIM(RTRIM([fullName]))) >= 2),
    CONSTRAINT [CK_Employee_status] CHECK ([status] IN ('ACTIVE','INACTIVE','TERMINATED','ON_LEAVE')),
    CONSTRAINT [CK_Employee_dob] CHECK ([dob] <= DATEADD(YEAR, -16, CAST(GETDATE() AS DATE)))
);

ALTER TABLE [dbo].[Department]
ADD CONSTRAINT [FK_Department_Manager] FOREIGN KEY ([managerId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[EmployeeSensitive] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [EmployeeSensitive_id_df] DEFAULT NEWID(),
    [employeeId] UNIQUEIDENTIFIER NOT NULL,
    [salary] DECIMAL(12, 2) NOT NULL,
    [taxCode] NVARCHAR(20) NOT NULL,
    [bankAccount] NVARCHAR(50) NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [EmployeeSensitive_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2(3) NOT NULL CONSTRAINT [EmployeeSensitive_updatedAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_EmployeeSensitive] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_EmployeeSensitive_employeeId] UNIQUE NONCLUSTERED ([employeeId]),
    CONSTRAINT [FK_EmployeeSensitive_Employee] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_EmployeeSensitive_salary] CHECK ([salary] >= 0),
    CONSTRAINT [CK_EmployeeSensitive_taxCode] CHECK (LEN(LTRIM(RTRIM([taxCode]))) >= 3)
);

CREATE TABLE [dbo].[Role] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Role_id_df] DEFAULT NEWID(),
    [name] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(500) NULL,
    [isSystem] BIT NOT NULL CONSTRAINT [Role_isSystem_df] DEFAULT 0,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Role] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_Role_name] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [CK_Role_name] CHECK (LEN(LTRIM(RTRIM([name]))) >= 2)
);

CREATE TABLE [dbo].[Permission] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Permission_id_df] DEFAULT NEWID(),
    [resource] NVARCHAR(50) NOT NULL,
    [action] NVARCHAR(50) NOT NULL,
    [scope] NVARCHAR(50) NOT NULL CONSTRAINT [Permission_scope_df] DEFAULT 'all',
    [description] NVARCHAR(500) NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [Permission_createdAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Permission] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_Permission_resource_action_scope] UNIQUE NONCLUSTERED ([resource], [action], [scope])
);

CREATE TABLE [dbo].[UserRole] (
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [roleId] UNIQUEIDENTIFIER NOT NULL,
    [assignedAt] DATETIME2(3) NOT NULL CONSTRAINT [UserRole_assignedAt_df] DEFAULT SYSUTCDATETIME(),
    [assignedBy] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_UserRole] PRIMARY KEY CLUSTERED ([userId], [roleId]),
    CONSTRAINT [FK_UserRole_AppUser] FOREIGN KEY ([userId]) REFERENCES [dbo].[AppUser]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_UserRole_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_UserRole_Assigner] FOREIGN KEY ([assignedBy]) REFERENCES [dbo].[AppUser]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE [dbo].[RolePermission] (
    [roleId] UNIQUEIDENTIFIER NOT NULL,
    [permissionId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK_RolePermission] PRIMARY KEY CLUSTERED ([roleId], [permissionId]),
    CONSTRAINT [FK_RolePermission_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT [FK_RolePermission_Permission] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE [dbo].[AuditLog] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [AuditLog_id_df] DEFAULT NEWID(),
    [timestamp] DATETIME2(3) NOT NULL CONSTRAINT [AuditLog_timestamp_df] DEFAULT SYSUTCDATETIME(),
    [actorId] UNIQUEIDENTIFIER NULL,
    [targetTable] NVARCHAR(100) NOT NULL,
    [targetId] UNIQUEIDENTIFIER NOT NULL,
    [action] NVARCHAR(20) NOT NULL,
    [oldValues] NVARCHAR(MAX) NULL,
    [newValues] NVARCHAR(MAX) NULL,
    [ipAddress] NVARCHAR(45) NULL,
    [userAgent] NVARCHAR(500) NULL,
    CONSTRAINT [PK_AuditLog] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_AuditLog_AppUser] FOREIGN KEY ([actorId]) REFERENCES [dbo].[AppUser]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_AuditLog_action] CHECK ([action] IN ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FAILED')),
    CONSTRAINT [CK_AuditLog_values] CHECK (
        ([action] = 'CREATE' AND [oldValues] IS NULL AND [newValues] IS NOT NULL) OR
        ([action] = 'UPDATE' AND [oldValues] IS NOT NULL AND [newValues] IS NOT NULL) OR
        ([action] = 'DELETE' AND [oldValues] IS NOT NULL AND [newValues] IS NULL) OR
        ([action] IN ('READ','LOGIN','LOGOUT','LOGIN_FAILED'))
    )
);

CREATE TABLE [dbo].[UserSession] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [UserSession_id_df] DEFAULT NEWID(),
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [tokenHash] NVARCHAR(255) NOT NULL,
    [issuedAt] DATETIME2(3) NOT NULL CONSTRAINT [UserSession_issuedAt_df] DEFAULT SYSUTCDATETIME(),
    [expiresAt] DATETIME2(3) NOT NULL,
    [revokedAt] DATETIME2(3) NULL,
    [ipAddress] NVARCHAR(45) NULL,
    CONSTRAINT [PK_UserSession] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_UserSession_AppUser] FOREIGN KEY ([userId]) REFERENCES [dbo].[AppUser]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

EXEC(N'CREATE NONCLUSTERED INDEX [IX_Employee_departmentId] ON [dbo].[Employee]([departmentId]) INCLUDE ([fullName], [status]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_Employee_userId] ON [dbo].[Employee]([userId]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_Employee_status] ON [dbo].[Employee]([status]) WHERE [status] = ''ACTIVE'';');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_AppUser_isActive] ON [dbo].[AppUser]([isActive]) WHERE [isActive] = 1;');
EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_Department_managerId] ON [dbo].[Department]([managerId]) WHERE [managerId] IS NOT NULL;');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_EmployeeSensitive_employeeId] ON [dbo].[EmployeeSensitive]([employeeId]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_AuditLog_timestamp] ON [dbo].[AuditLog]([timestamp] DESC);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_AuditLog_actorId] ON [dbo].[AuditLog]([actorId]) INCLUDE ([action], [timestamp]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_AuditLog_target] ON [dbo].[AuditLog]([targetTable], [targetId]) INCLUDE ([action], [timestamp]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_UserRole_roleId] ON [dbo].[UserRole]([roleId]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_RolePermission_permissionId] ON [dbo].[RolePermission]([permissionId]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_UserSession_userId] ON [dbo].[UserSession]([userId]) INCLUDE ([revokedAt], [expiresAt]);');
EXEC(N'CREATE NONCLUSTERED INDEX [IX_UserSession_tokenHash] ON [dbo].[UserSession]([tokenHash]) WHERE [revokedAt] IS NULL;');

INSERT INTO [dbo].[Role] ([name], [description], [isSystem])
VALUES
('REGULAR', 'Standard employee with own-department directory access.', 1),
('MANAGER', 'Department manager with own-department sensitive read access.', 1),
('HR_EMPLOYEE', 'HR staff with cross-department employee management access.', 1),
('HR_MANAGER', 'HR manager with broad employee, payroll, department, and audit access.', 1),
('ACCOUNTING', 'Accounting user with payroll read access.', 1),
('ADMIN', 'System administrator with full access.', 1);

INSERT INTO [dbo].[Permission] ([resource], [action], [scope], [description])
VALUES
('employee', 'read', 'own_department', 'Read employees in own department.'),
('employee', 'read', 'all', 'Read all employees.'),
('employee', 'create', 'other_department', 'Create employees outside own department.'),
('employee', 'create', 'all', 'Create employees in any department.'),
('employee', 'update', 'other_department', 'Update employees outside own department.'),
('employee', 'update', 'all', 'Update employees in any department.'),
('employee', 'delete', 'other_department', 'Soft delete employees outside own department.'),
('employee', 'delete', 'all', 'Soft delete employees in any department.'),
('employee_sensitive', 'read', 'own_department', 'Read sensitive employee data in own department.'),
('employee_sensitive', 'read', 'all', 'Read all sensitive employee data.'),
('employee_sensitive', 'update', 'other_department', 'Update sensitive employee data outside own department.'),
('employee_sensitive', 'update', 'all', 'Update sensitive employee data in any department.'),
('department', 'read', 'all', 'Read department records.'),
('department', 'manage', 'all', 'Manage department records.'),
('audit_log', 'read', 'all', 'Read audit logs.'),
('user', 'manage', 'all', 'Manage users and role assignments.');

INSERT INTO [dbo].[RolePermission] ([roleId], [permissionId])
SELECT r.id, p.id
FROM [dbo].[Role] r
JOIN [dbo].[Permission] p ON
    (r.name = 'REGULAR' AND ((p.resource = 'employee' AND p.action = 'read' AND p.scope = 'own_department') OR (p.resource = 'department' AND p.action = 'read' AND p.scope = 'all'))) OR
    (r.name = 'MANAGER' AND ((p.resource = 'employee' AND p.action = 'read' AND p.scope = 'own_department') OR (p.resource = 'employee_sensitive' AND p.action = 'read' AND p.scope = 'own_department') OR (p.resource = 'department' AND p.action = 'read' AND p.scope = 'all'))) OR
    (r.name = 'HR_EMPLOYEE' AND ((p.resource = 'employee' AND p.action = 'read' AND p.scope = 'all') OR (p.resource = 'employee' AND p.action IN ('create','update','delete') AND p.scope = 'other_department') OR (p.resource = 'employee_sensitive' AND p.action = 'read' AND p.scope = 'all') OR (p.resource = 'employee_sensitive' AND p.action = 'update' AND p.scope = 'other_department') OR (p.resource = 'department' AND p.action = 'read' AND p.scope = 'all'))) OR
    (r.name = 'HR_MANAGER' AND ((p.resource = 'employee' AND p.action IN ('read','create','update','delete') AND p.scope = 'all') OR (p.resource = 'employee_sensitive' AND p.action IN ('read','update') AND p.scope = 'all') OR (p.resource = 'department' AND p.action IN ('read','manage') AND p.scope = 'all') OR (p.resource = 'audit_log' AND p.action = 'read' AND p.scope = 'all'))) OR
    (r.name = 'ACCOUNTING' AND ((p.resource = 'employee' AND p.action = 'read' AND p.scope = 'all') OR (p.resource = 'employee_sensitive' AND p.action = 'read' AND p.scope = 'all') OR (p.resource = 'department' AND p.action = 'read' AND p.scope = 'all'))) OR
    (r.name = 'ADMIN');

IF OBJECT_ID(N'[dbo].[__LegacyDepartment]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[Department] ([id], [name], [createdAt], [updatedAt])
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, [id]), [name], [createdAt], [updatedAt]
    FROM [dbo].[__LegacyDepartment]
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, [id]) IS NOT NULL;
END;

IF OBJECT_ID(N'[dbo].[__LegacyEmployee]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.__LegacyEmployee', N'password') IS NOT NULL
BEGIN
    EXEC(N'INSERT INTO [dbo].[AppUser] ([id], [email], [passwordHash], [createdAt], [updatedAt])
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, [id]), [email], [password], [createdAt], [updatedAt]
    FROM [dbo].[__LegacyEmployee]
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, [id]) IS NOT NULL;');

    EXEC(N'INSERT INTO [dbo].[Employee] ([id], [userId], [fullName], [dob], [departmentId], [createdAt], [updatedAt])
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, e.[id]), TRY_CONVERT(UNIQUEIDENTIFIER, e.[id]), e.[fullName], CAST(e.[dob] AS DATE),
           TRY_CONVERT(UNIQUEIDENTIFIER, e.[departmentId]), e.[createdAt], e.[updatedAt]
    FROM [dbo].[__LegacyEmployee] e
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, e.[id]) IS NOT NULL;');

    EXEC(N'INSERT INTO [dbo].[EmployeeSensitive] ([employeeId], [salary], [taxCode], [createdAt], [updatedAt])
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, [id]), CAST([salary] AS DECIMAL(12, 2)), [taxCode], [createdAt], [updatedAt]
    FROM [dbo].[__LegacyEmployee]
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, [id]) IS NOT NULL;');

    EXEC(N'INSERT INTO [dbo].[UserRole] ([userId], [roleId])
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, e.[id]), r.[id]
    FROM [dbo].[__LegacyEmployee] e
    INNER JOIN [dbo].[Role] r ON r.[name] = e.[role]
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, e.[id]) IS NOT NULL;');
END;

IF OBJECT_ID(N'[dbo].[__LegacyEmployee]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.__LegacyEmployee', N'userId') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[__LegacyAppUser]', N'U') IS NOT NULL
BEGIN
    EXEC(N'INSERT INTO [dbo].[AppUser] ([id], [email], [passwordHash], [isActive], [lastLoginAt], [failedAttempts], [lockedUntil], [createdAt], [updatedAt])
    SELECT [id], [email], [passwordHash], [isActive], [lastLoginAt], [failedAttempts], [lockedUntil], [createdAt], [updatedAt]
    FROM [dbo].[__LegacyAppUser];');

    EXEC(N'INSERT INTO [dbo].[Employee] ([id], [userId], [fullName], [dob], [phone], [departmentId], [hireDate], [status], [createdAt], [updatedAt])
    SELECT [id], [userId], [fullName], [dob], [phone], [departmentId], [hireDate], [status], [createdAt], [updatedAt]
    FROM [dbo].[__LegacyEmployee];');

    IF OBJECT_ID(N'[dbo].[__LegacyEmployeeSensitive]', N'U') IS NOT NULL
    BEGIN
        EXEC(N'INSERT INTO [dbo].[EmployeeSensitive] ([id], [employeeId], [salary], [taxCode], [bankAccount], [createdAt], [updatedAt])
        SELECT [id], [employeeId], [salary], [taxCode], [bankAccount], [createdAt], [updatedAt]
        FROM [dbo].[__LegacyEmployeeSensitive];');
    END;

    IF OBJECT_ID(N'[dbo].[__LegacyUserRole]', N'U') IS NOT NULL
       AND OBJECT_ID(N'[dbo].[__LegacyRole]', N'U') IS NOT NULL
    BEGIN
        EXEC(N'INSERT INTO [dbo].[UserRole] ([userId], [roleId], [assignedAt], [assignedBy])
        SELECT lur.[userId], r.[id], lur.[assignedAt], lur.[assignedBy]
        FROM [dbo].[__LegacyUserRole] lur
        INNER JOIN [dbo].[__LegacyRole] lr ON lur.[roleId] = lr.[id]
        INNER JOIN [dbo].[Role] r ON r.[name] = lr.[name];');
    END;
END;

IF OBJECT_ID(N'[dbo].[__LegacyDepartment]', N'U') IS NOT NULL
BEGIN
    UPDATE d
    SET d.[managerId] = TRY_CONVERT(UNIQUEIDENTIFIER, ld.[managerId])
    FROM [dbo].[Department] d
    INNER JOIN [dbo].[__LegacyDepartment] ld ON TRY_CONVERT(UNIQUEIDENTIFIER, ld.[id]) = d.[id]
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, ld.[managerId]) IS NOT NULL
      AND EXISTS (SELECT 1 FROM [dbo].[Employee] e WHERE e.[id] = TRY_CONVERT(UNIQUEIDENTIFIER, ld.[managerId]));
END;

IF OBJECT_ID(N'[dbo].[__LegacyAuditLog]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.__LegacyAuditLog', N'changes') IS NOT NULL
BEGIN
    EXEC(N'INSERT INTO [dbo].[AuditLog] ([id], [timestamp], [actorId], [targetTable], [targetId], [action], [oldValues], [newValues])
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, al.[id]), al.[timestamp],
           TRY_CONVERT(UNIQUEIDENTIFIER, al.[actorId]), ''Employee'',
           TRY_CONVERT(UNIQUEIDENTIFIER, al.[targetId]), al.[action],
           CASE WHEN al.[action] IN (''UPDATE'', ''DELETE'') THEN al.[changes] ELSE NULL END,
           CASE WHEN al.[action] IN (''CREATE'', ''UPDATE'') THEN al.[changes] ELSE NULL END
    FROM [dbo].[__LegacyAuditLog] al
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, al.[id]) IS NOT NULL
      AND TRY_CONVERT(UNIQUEIDENTIFIER, al.[targetId]) IS NOT NULL
      AND al.[action] IN (''CREATE'', ''UPDATE'', ''DELETE'');');
END;

IF OBJECT_ID(N'[dbo].[__LegacyAuditLog]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.__LegacyAuditLog', N'oldValues') IS NOT NULL
BEGIN
    EXEC(N'INSERT INTO [dbo].[AuditLog] ([id], [timestamp], [actorId], [targetTable], [targetId], [action], [oldValues], [newValues], [ipAddress], [userAgent])
    SELECT [id], [timestamp], [actorId], [targetTable], [targetId], [action], [oldValues], [newValues], [ipAddress], [userAgent]
    FROM [dbo].[__LegacyAuditLog];');
END;

DROP TABLE IF EXISTS [dbo].[__LegacyAuditLog];
DROP TABLE IF EXISTS [dbo].[__LegacyDepartment];
DROP TABLE IF EXISTS [dbo].[__LegacyEmployee];
DROP TABLE IF EXISTS [dbo].[__LegacyAppUser];
DROP TABLE IF EXISTS [dbo].[__LegacyEmployeeSensitive];
DROP TABLE IF EXISTS [dbo].[__LegacyRole];
DROP TABLE IF EXISTS [dbo].[__LegacyUserRole];

EXEC(N'
CREATE VIEW [dbo].[vw_EmployeeDirectory] AS
SELECT e.id AS employeeId, e.fullName, e.dob, u.email, e.departmentId,
       d.name AS departmentName, e.status, e.hireDate, pr.name AS primaryRole
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.userId = u.id
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
OUTER APPLY (
    SELECT TOP (1) r.name
    FROM [dbo].[UserRole] ur
    INNER JOIN [dbo].[Role] r ON ur.roleId = r.id
    WHERE ur.userId = u.id
    ORDER BY CASE r.name
        WHEN ''ADMIN'' THEN 1 WHEN ''HR_MANAGER'' THEN 2 WHEN ''HR_EMPLOYEE'' THEN 3
        WHEN ''ACCOUNTING'' THEN 4 WHEN ''MANAGER'' THEN 5 ELSE 6 END
) pr
WHERE e.status = ''ACTIVE'' AND u.isActive = 1;
');

EXEC(N'
CREATE VIEW [dbo].[vw_EmployeeWithSensitive] AS
SELECT e.id AS employeeId, e.fullName, e.dob, u.email, e.departmentId,
       d.name AS departmentName, e.status, e.hireDate,
       es.salary, es.taxCode, es.bankAccount, pr.name AS primaryRole
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.userId = u.id
LEFT JOIN [dbo].[EmployeeSensitive] es ON e.id = es.employeeId
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
OUTER APPLY (
    SELECT TOP (1) r.name
    FROM [dbo].[UserRole] ur
    INNER JOIN [dbo].[Role] r ON ur.roleId = r.id
    WHERE ur.userId = u.id
    ORDER BY CASE r.name
        WHEN ''ADMIN'' THEN 1 WHEN ''HR_MANAGER'' THEN 2 WHEN ''HR_EMPLOYEE'' THEN 3
        WHEN ''ACCOUNTING'' THEN 4 WHEN ''MANAGER'' THEN 5 ELSE 6 END
) pr
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
       d.name AS departmentName, e.status, pr.name AS primaryRole
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.userId = u.id
LEFT JOIN [dbo].[Department] d ON e.departmentId = d.id
OUTER APPLY (
    SELECT TOP (1) r.name
    FROM [dbo].[UserRole] ur
    INNER JOIN [dbo].[Role] r ON ur.roleId = r.id
    WHERE ur.userId = u.id
    ORDER BY CASE r.name
        WHEN ''ADMIN'' THEN 1 WHEN ''HR_MANAGER'' THEN 2 WHEN ''HR_EMPLOYEE'' THEN 3
        WHEN ''ACCOUNTING'' THEN 4 WHEN ''MANAGER'' THEN 5 ELSE 6 END
) pr
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
    IF EXISTS (
        SELECT 1
        FROM [dbo].[UserRole] ur
        INNER JOIN [dbo].[RolePermission] rp ON ur.roleId = rp.roleId
        INNER JOIN [dbo].[Permission] p ON rp.permissionId = p.id
        WHERE ur.userId = @UserId
          AND p.resource = @Resource
          AND p.action = @Action
          AND (p.scope = @Scope OR p.scope = ''all'')
    )
        SELECT 1 AS [HasPermission];
    ELSE
        SELECT 0 AS [HasPermission];
END;
');

EXEC(N'
CREATE PROCEDURE [dbo].[sp_Authenticate]
    @Email NVARCHAR(255), @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @UserId UNIQUEIDENTIFIER, @PasswordHash NVARCHAR(255),
            @IsActive BIT, @LockedUntil DATETIME2(3), @FailedAttempts INT,
            @NewValues NVARCHAR(MAX);

    SELECT @UserId = id, @PasswordHash = passwordHash, @IsActive = isActive,
           @LockedUntil = lockedUntil, @FailedAttempts = failedAttempts
    FROM [dbo].[AppUser] WHERE email = @Email;

    IF @UserId IS NULL BEGIN
        SELECT NULL AS userId, NULL AS passwordHash, ''USER_NOT_FOUND'' AS authStatus, NULL AS failedAttempts; RETURN; END
    IF @IsActive = 0 BEGIN
        SELECT @UserId AS userId, NULL AS passwordHash, ''ACCOUNT_DISABLED'' AS authStatus, @FailedAttempts AS failedAttempts; RETURN; END
    IF @LockedUntil IS NOT NULL AND @LockedUntil > SYSUTCDATETIME() BEGIN
        SELECT @UserId AS userId, NULL AS passwordHash, ''ACCOUNT_LOCKED'' AS authStatus, @FailedAttempts AS failedAttempts;
        SELECT @NewValues = (SELECT @Email AS email, ''Account locked'' AS reason FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], newValues, ipAddress)
        VALUES (@UserId, ''AppUser'', @UserId, ''LOGIN_FAILED'', @NewValues, @IPAddress);
        RETURN; END

    SELECT @UserId AS userId, @PasswordHash AS passwordHash,
           ''PENDING_VERIFY'' AS authStatus, @FailedAttempts AS failedAttempts;
END;
');

EXEC(N'
CREATE PROCEDURE [dbo].[sp_RecordLoginSuccess]
    @UserId UNIQUEIDENTIFIER, @TokenHash NVARCHAR(255),
    @ExpiresAt DATETIME2(3), @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[AppUser]
    SET failedAttempts = 0, lockedUntil = NULL, lastLoginAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME()
    WHERE id = @UserId;

    INSERT INTO [dbo].[UserSession] (userId, tokenHash, expiresAt, ipAddress)
    VALUES (@UserId, @TokenHash, @ExpiresAt, @IPAddress);

    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], ipAddress)
    VALUES (@UserId, ''AppUser'', @UserId, ''LOGIN'', @IPAddress);
END;
');

EXEC(N'
CREATE PROCEDURE [dbo].[sp_RecordLoginFailure]
    @UserId UNIQUEIDENTIFIER, @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewFailedAttempts INT, @NewValues NVARCHAR(MAX);
    UPDATE [dbo].[AppUser]
    SET failedAttempts = failedAttempts + 1,
        lockedUntil = CASE WHEN failedAttempts + 1 >= 5 THEN DATEADD(MINUTE, 30, SYSUTCDATETIME()) ELSE lockedUntil END,
        updatedAt = SYSUTCDATETIME()
    WHERE id = @UserId;

    SELECT @NewFailedAttempts = failedAttempts FROM [dbo].[AppUser] WHERE id = @UserId;
    SELECT @NewValues = (SELECT @NewFailedAttempts AS failedAttempts FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], newValues, ipAddress)
    VALUES (@UserId, ''AppUser'', @UserId, ''LOGIN_FAILED'', @NewValues, @IPAddress);
END;
');

EXEC(N'
CREATE PROCEDURE [dbo].[sp_UpdateEmployee]
    @ActorUserId UNIQUEIDENTIFIER, @EmployeeId UNIQUEIDENTIFIER,
    @FullName NVARCHAR(200) = NULL, @Dob DATE = NULL,
    @DepartmentId UNIQUEIDENTIFIER = NULL, @Status NVARCHAR(20) = NULL,
    @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    DECLARE @OldValues NVARCHAR(MAX), @NewValues NVARCHAR(MAX);

    SELECT @OldValues = (
        SELECT CASE WHEN @FullName IS NOT NULL THEN fullName END AS fullName,
               CASE WHEN @Dob IS NOT NULL THEN CONVERT(NVARCHAR(10), dob, 23) END AS dob,
               CASE WHEN @DepartmentId IS NOT NULL THEN CAST(departmentId AS NVARCHAR(36)) END AS departmentId,
               CASE WHEN @Status IS NOT NULL THEN status END AS status
        FROM [dbo].[Employee] WHERE id = @EmployeeId
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    UPDATE [dbo].[Employee]
    SET fullName = COALESCE(@FullName, fullName),
        dob = COALESCE(@Dob, dob),
        departmentId = COALESCE(@DepartmentId, departmentId),
        status = COALESCE(@Status, status),
        updatedAt = SYSUTCDATETIME()
    WHERE id = @EmployeeId;

    SELECT @NewValues = (
        SELECT CASE WHEN @FullName IS NOT NULL THEN fullName END AS fullName,
               CASE WHEN @Dob IS NOT NULL THEN CONVERT(NVARCHAR(10), dob, 23) END AS dob,
               CASE WHEN @DepartmentId IS NOT NULL THEN CAST(departmentId AS NVARCHAR(36)) END AS departmentId,
               CASE WHEN @Status IS NOT NULL THEN status END AS status
        FROM [dbo].[Employee] WHERE id = @EmployeeId
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    IF @OldValues IS NOT NULL AND @NewValues IS NOT NULL AND @OldValues <> ''{}''
    BEGIN
        INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], oldValues, newValues, ipAddress)
        VALUES (@ActorUserId, ''Employee'', @EmployeeId, ''UPDATE'', @OldValues, @NewValues, @IPAddress);
    END;

    COMMIT TRANSACTION;
END;
');

EXEC(N'
CREATE PROCEDURE [dbo].[sp_SoftDeleteEmployee]
    @ActorUserId UNIQUEIDENTIFIER, @EmployeeId UNIQUEIDENTIFIER, @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    DECLARE @UserId UNIQUEIDENTIFIER, @OldValues NVARCHAR(MAX);

    SELECT @UserId = userId FROM [dbo].[Employee] WHERE id = @EmployeeId;

    SELECT @OldValues = (
        SELECT e.fullName, e.dob, e.departmentId, e.status, es.salary, es.taxCode
        FROM [dbo].[Employee] e
        LEFT JOIN [dbo].[EmployeeSensitive] es ON e.id = es.employeeId
        WHERE e.id = @EmployeeId
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    UPDATE [dbo].[Employee] SET status = ''TERMINATED'', updatedAt = SYSUTCDATETIME() WHERE id = @EmployeeId;
    UPDATE [dbo].[AppUser] SET isActive = 0, updatedAt = SYSUTCDATETIME() WHERE id = @UserId;
    UPDATE [dbo].[Department] SET managerId = NULL, updatedAt = SYSUTCDATETIME() WHERE managerId = @EmployeeId;
    UPDATE [dbo].[UserSession] SET revokedAt = SYSUTCDATETIME() WHERE userId = @UserId AND revokedAt IS NULL;

    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], oldValues, ipAddress)
    VALUES (@ActorUserId, ''Employee'', @EmployeeId, ''DELETE'', @OldValues, @IPAddress);

    COMMIT TRANSACTION;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_AppUser_UpdateTimestamp]
ON [dbo].[AppUser] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;
    UPDATE u SET u.updatedAt = SYSUTCDATETIME()
    FROM [dbo].[AppUser] u INNER JOIN inserted i ON u.id = i.id;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_Employee_UpdateTimestamp]
ON [dbo].[Employee] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;
    UPDATE e SET e.updatedAt = SYSUTCDATETIME()
    FROM [dbo].[Employee] e INNER JOIN inserted i ON e.id = i.id;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_EmployeeSensitive_UpdateTimestamp]
ON [dbo].[EmployeeSensitive] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;
    UPDATE es SET es.updatedAt = SYSUTCDATETIME()
    FROM [dbo].[EmployeeSensitive] es INNER JOIN inserted i ON es.id = i.id;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_Department_UpdateTimestamp]
ON [dbo].[Department] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;
    UPDATE d SET d.updatedAt = SYSUTCDATETIME()
    FROM [dbo].[Department] d INNER JOIN inserted i ON d.id = i.id;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_AuditLog_PreventModification]
ON [dbo].[AuditLog] INSTEAD OF UPDATE, DELETE AS
BEGIN
    RAISERROR(''Audit log records cannot be modified or deleted.'', 16, 1);
    ROLLBACK TRANSACTION;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_Employee_PreventHardDelete]
ON [dbo].[Employee] INSTEAD OF DELETE AS
BEGIN
    RAISERROR(''Hard deletion of employee records is not permitted. Use sp_SoftDeleteEmployee.'', 16, 1);
    ROLLBACK TRANSACTION;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_EmployeeSensitive_AuditChanges]
ON [dbo].[EmployeeSensitive] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], oldValues, newValues)
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N''UserId'') AS NVARCHAR(36))),
        ''EmployeeSensitive'', i.employeeId, ''UPDATE'',
        (SELECT d.salary, d.taxCode FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.salary, i.taxCode FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i INNER JOIN deleted d ON i.id = d.id
    WHERE i.salary <> d.salary OR i.taxCode <> d.taxCode;
END;
');

EXEC(N'
CREATE TRIGGER [dbo].[tr_UserRole_AuditChanges]
ON [dbo].[UserRole] AFTER INSERT, DELETE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], newValues)
    SELECT i.assignedBy, ''UserRole'', i.userId, ''CREATE'',
        (SELECT r.name AS roleName, i.assignedAt FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i INNER JOIN [dbo].[Role] r ON i.roleId = r.id;

    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], oldValues)
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N''UserId'') AS NVARCHAR(36))),
        ''UserRole'', d.userId, ''DELETE'',
        (SELECT r.name AS roleName FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d INNER JOIN [dbo].[Role] r ON d.roleId = r.id;
END;
');

EXEC(N'
CREATE FUNCTION [dbo].[fn_EmployeeRowFilter](@DepartmentId UNIQUEIDENTIFIER, @UserId UNIQUEIDENTIFIER)
RETURNS TABLE WITH SCHEMABINDING AS
RETURN (
    SELECT 1 AS result WHERE
        @UserId = TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N''UserId'') AS NVARCHAR(36)))
        OR CAST(SESSION_CONTEXT(N''RoleName'') AS NVARCHAR(50)) IN (''ADMIN'',''HR_MANAGER'',''HR_EMPLOYEE'',''ACCOUNTING'')
        OR (CAST(SESSION_CONTEXT(N''RoleName'') AS NVARCHAR(50)) IN (''REGULAR'',''MANAGER'')
            AND @DepartmentId = TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N''DepartmentId'') AS NVARCHAR(36))))
);
');

EXEC(N'
CREATE FUNCTION [dbo].[fn_SensitiveDataFilter](@EmployeeId UNIQUEIDENTIFIER)
RETURNS TABLE WITH SCHEMABINDING AS
RETURN (
    SELECT 1 AS result WHERE
        CAST(SESSION_CONTEXT(N''RoleName'') AS NVARCHAR(50)) IN (''ADMIN'',''HR_MANAGER'',''ACCOUNTING'',''HR_EMPLOYEE'')
        OR (CAST(SESSION_CONTEXT(N''RoleName'') AS NVARCHAR(50)) = ''MANAGER''
            AND EXISTS (SELECT 1 FROM [dbo].[Employee] e WHERE e.id = @EmployeeId
                AND e.departmentId = TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N''DepartmentId'') AS NVARCHAR(36)))))
);
');

EXEC(N'
CREATE SECURITY POLICY [dbo].[EmployeeFilterPolicy]
ADD FILTER PREDICATE [dbo].[fn_EmployeeRowFilter]([departmentId], [userId]) ON [dbo].[Employee]
WITH (STATE = ON, SCHEMABINDING = OFF);
');

EXEC(N'
CREATE SECURITY POLICY [dbo].[SensitiveDataPolicy]
ADD FILTER PREDICATE [dbo].[fn_SensitiveDataFilter]([employeeId]) ON [dbo].[EmployeeSensitive]
WITH (STATE = ON, SCHEMABINDING = OFF);
');
