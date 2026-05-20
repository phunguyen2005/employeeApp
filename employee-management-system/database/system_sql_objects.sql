/*
  Employee Management System database-level SQL objects.

  Scope:
  - This script mirrors the current Prisma SQL Server schema and existing backend flows.
  - It is not a Prisma migration and is not executed automatically by the app.
  - No application code, Prisma schema, table definitions, or sensitive values are changed here.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* --------------------------------------------------------------------------
   Views
   --------------------------------------------------------------------------
   Read models used by employee/audit flows and direct SQL Server RBAC demos.
*/

CREATE OR ALTER VIEW [dbo].[vw_EmployeeDirectory] AS
SELECT
    e.[id] AS [employeeId],
    e.[employeeCode],
    e.[fullName],
    e.[dob],
    u.[email],
    e.[departmentId],
    d.[name] AS [departmentName],
    e.[status],
    e.[hireDate],
    u.[roleName] AS [primaryRole]
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.[userId] = u.[id]
LEFT JOIN [dbo].[Department] d ON e.[departmentId] = d.[id]
WHERE e.[status] = N'ACTIVE'
  AND u.[isActive] = 1;
GO

CREATE OR ALTER VIEW [dbo].[vw_EmployeeWithSensitive] AS
SELECT
    e.[id] AS [employeeId],
    e.[employeeCode],
    e.[fullName],
    e.[dob],
    u.[email],
    e.[departmentId],
    d.[name] AS [departmentName],
    e.[status],
    e.[hireDate],
    es.[salary],
    es.[taxCode],
    es.[bankAccount],
    u.[roleName] AS [primaryRole]
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.[userId] = u.[id]
LEFT JOIN [dbo].[EmployeeSensitive] es ON e.[id] = es.[employeeId]
LEFT JOIN [dbo].[Department] d ON e.[departmentId] = d.[id]
WHERE e.[status] = N'ACTIVE'
  AND u.[isActive] = 1;
GO

CREATE OR ALTER VIEW [dbo].[vw_PayrollSummary] AS
SELECT
    e.[id] AS [employeeId],
    e.[employeeCode],
    e.[fullName],
    e.[departmentId],
    d.[name] AS [departmentName],
    es.[salary],
    es.[taxCode],
    es.[bankAccount]
FROM [dbo].[Employee] e
INNER JOIN [dbo].[EmployeeSensitive] es ON e.[id] = es.[employeeId]
LEFT JOIN [dbo].[Department] d ON e.[departmentId] = d.[id]
WHERE e.[status] = N'ACTIVE';
GO

CREATE OR ALTER VIEW [dbo].[vw_DepartmentRoster] AS
SELECT
    e.[id] AS [employeeId],
    e.[employeeCode],
    e.[fullName],
    e.[dob],
    u.[email],
    e.[departmentId],
    d.[name] AS [departmentName],
    e.[status],
    u.[roleName] AS [primaryRole]
FROM [dbo].[Employee] e
INNER JOIN [dbo].[AppUser] u ON e.[userId] = u.[id]
LEFT JOIN [dbo].[Department] d ON e.[departmentId] = d.[id]
WHERE e.[status] = N'ACTIVE'
  AND u.[isActive] = 1;
GO

CREATE OR ALTER VIEW [dbo].[vw_AuditLogDetail] AS
SELECT
    al.[id],
    al.[timestamp],
    al.[actorId],
    COALESCE(actorEmployee.[fullName], N'[System]') AS [actorName],
    al.[targetTable],
    al.[targetId],
    COALESCE(
        CONCAT(targetEmployee.[employeeCode], N' - ', targetEmployee.[fullName]),
        targetDepartment.[name],
        targetUser.[email],
        targetRole.[name],
        CONCAT(targetPermission.[resource], N'.', targetPermission.[action], N'.', targetPermission.[scope]),
        CONVERT(NVARCHAR(36), al.[targetId])
    ) AS [targetName],
    al.[action],
    al.[oldValues],
    al.[newValues],
    al.[ipAddress],
    al.[userAgent]
FROM [dbo].[AuditLog] al
LEFT JOIN [dbo].[Employee] actorEmployee ON al.[actorId] = actorEmployee.[userId]
LEFT JOIN [dbo].[Employee] targetEmployee ON al.[targetTable] = N'Employee' AND al.[targetId] = targetEmployee.[id]
LEFT JOIN [dbo].[Department] targetDepartment ON al.[targetTable] = N'Department' AND al.[targetId] = targetDepartment.[id]
LEFT JOIN [dbo].[AppUser] targetUser ON al.[targetTable] IN (N'AppUser', N'UserRole') AND al.[targetId] = targetUser.[id]
LEFT JOIN [dbo].[Role] targetRole ON al.[targetTable] IN (N'Role', N'RolePermission') AND al.[targetId] = targetRole.[id]
LEFT JOIN [dbo].[Permission] targetPermission ON al.[targetTable] = N'Permission' AND al.[targetId] = targetPermission.[id];
GO

/* --------------------------------------------------------------------------
   Functions
   --------------------------------------------------------------------------
   RLS predicates based on session context set by src/server/context.ts.
*/

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE [name] = N'EmployeeFilterPolicy')
    DROP SECURITY POLICY [dbo].[EmployeeFilterPolicy];

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE [name] = N'SensitiveDataPolicy')
    DROP SECURITY POLICY [dbo].[SensitiveDataPolicy];
GO

CREATE OR ALTER FUNCTION [dbo].[fn_EmployeeRowFilter]
(
    @DepartmentId UNIQUEIDENTIFIER,
    @UserId UNIQUEIDENTIFIER
)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
(
    SELECT 1 AS [result]
    WHERE
        @UserId = TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N'UserId') AS NVARCHAR(36)))
        OR CAST(SESSION_CONTEXT(N'RoleName') AS NVARCHAR(50)) IN (N'ADMIN', N'HR_MANAGER', N'HR_EMPLOYEE', N'ACCOUNTING')
        OR (
            CAST(SESSION_CONTEXT(N'RoleName') AS NVARCHAR(50)) IN (N'REGULAR', N'MANAGER')
            AND @DepartmentId = TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N'DepartmentId') AS NVARCHAR(36)))
        )
);
GO

CREATE OR ALTER FUNCTION [dbo].[fn_SensitiveDataFilter]
(
    @EmployeeId UNIQUEIDENTIFIER
)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
(
    SELECT 1 AS [result]
    WHERE
        CAST(SESSION_CONTEXT(N'RoleName') AS NVARCHAR(50)) IN (N'ADMIN', N'HR_MANAGER', N'ACCOUNTING', N'HR_EMPLOYEE')
        OR (
            CAST(SESSION_CONTEXT(N'RoleName') AS NVARCHAR(50)) = N'MANAGER'
            AND EXISTS
            (
                SELECT 1
                FROM [dbo].[Employee] e
                WHERE e.[id] = @EmployeeId
                  AND e.[departmentId] = TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N'DepartmentId') AS NVARCHAR(36)))
            )
        )
);
GO

/* --------------------------------------------------------------------------
   Stored Procedures
   --------------------------------------------------------------------------
   Procedures called by auth, RBAC, employee update, and soft-delete flows.
*/

CREATE OR ALTER PROCEDURE [dbo].[sp_CheckPermission]
    @UserId UNIQUEIDENTIFIER,
    @Resource NVARCHAR(50),
    @Action NVARCHAR(20),
    @Scope NVARCHAR(30) = N'all'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleName NVARCHAR(50);
    DECLARE @IsSystem BIT;

    SELECT @RoleName = u.[roleName]
    FROM [dbo].[AppUser] u
    WHERE u.[id] = @UserId
      AND u.[isActive] = 1;

    IF @RoleName IS NULL
    BEGIN
        SELECT 0 AS [HasPermission];
        RETURN;
    END;

    SELECT @IsSystem = r.[isSystem]
    FROM [dbo].[Role] r
    WHERE r.[name] = @RoleName;

    IF ISNULL(@IsSystem, 0) = 0
       AND @RoleName NOT IN (N'REGULAR', N'MANAGER', N'HR_EMPLOYEE', N'HR_MANAGER', N'ACCOUNTING', N'ADMIN')
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM [dbo].[UserRole] ur
            INNER JOIN [dbo].[Role] r ON ur.[roleId] = r.[id]
            INNER JOIN [dbo].[RolePermission] rp ON r.[id] = rp.[roleId]
            INNER JOIN [dbo].[Permission] p ON rp.[permissionId] = p.[id]
            WHERE ur.[userId] = @UserId
              AND r.[name] = @RoleName
              AND p.[resource] = @Resource
              AND p.[action] = @Action
              AND (p.[scope] = @Scope OR p.[scope] = N'all')
        )
            SELECT 1 AS [HasPermission];
        ELSE
            SELECT 0 AS [HasPermission];

        RETURN;
    END;

    IF @RoleName = N'ADMIN'
    BEGIN
        SELECT 1 AS [HasPermission];
        RETURN;
    END;

    IF
    (
        (@RoleName = N'REGULAR' AND
            (
                (@Resource = N'employee' AND @Action = N'read' AND @Scope = N'own_department')
                OR (@Resource = N'department' AND @Action = N'read' AND @Scope = N'all')
            )
        )
        OR
        (@RoleName = N'MANAGER' AND
            (
                (@Resource = N'employee' AND @Action = N'read' AND @Scope = N'own_department')
                OR (@Resource = N'employee_sensitive' AND @Action = N'read' AND @Scope = N'own_department')
                OR (@Resource = N'department' AND @Action = N'read' AND @Scope = N'all')
            )
        )
        OR
        (@RoleName = N'HR_EMPLOYEE' AND
            (
                (@Resource = N'employee' AND @Action = N'read')
                OR (@Resource = N'employee' AND @Action IN (N'create', N'update', N'delete') AND @Scope = N'other_department')
                OR (@Resource = N'employee_sensitive' AND @Action = N'read')
                OR (@Resource = N'employee_sensitive' AND @Action = N'update' AND @Scope = N'other_department')
                OR (@Resource = N'department' AND @Action = N'read' AND @Scope = N'all')
            )
        )
        OR
        (@RoleName = N'HR_MANAGER' AND
            (
                (@Resource = N'employee' AND @Action IN (N'read', N'create', N'update', N'delete'))
                OR (@Resource = N'employee_sensitive' AND @Action IN (N'read', N'update'))
                OR (@Resource = N'department' AND @Action IN (N'read', N'manage') AND @Scope = N'all')
                OR (@Resource = N'audit_log' AND @Action = N'read' AND @Scope = N'all')
            )
        )
        OR
        (@RoleName = N'ACCOUNTING' AND
            (
                (@Resource = N'employee' AND @Action = N'read')
                OR (@Resource = N'employee_sensitive' AND @Action = N'read')
                OR (@Resource = N'department' AND @Action = N'read' AND @Scope = N'all')
            )
        )
    )
        SELECT 1 AS [HasPermission];
    ELSE
        SELECT 0 AS [HasPermission];
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_Authenticate]
    @Email NVARCHAR(255),
    @IPAddress NVARCHAR(45) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId UNIQUEIDENTIFIER;
    DECLARE @PasswordHash NVARCHAR(255);
    DECLARE @IsActive BIT;
    DECLARE @LockedUntil DATETIME2;
    DECLARE @FailedAttempts INT;
    DECLARE @NewValues NVARCHAR(MAX);

    SELECT
        @UserId = u.[id],
        @PasswordHash = u.[passwordHash],
        @IsActive = u.[isActive],
        @LockedUntil = u.[lockedUntil],
        @FailedAttempts = u.[failedAttempts]
    FROM [dbo].[AppUser] u
    WHERE u.[email] = @Email;

    IF @UserId IS NULL
    BEGIN
        SELECT
            CAST(NULL AS UNIQUEIDENTIFIER) AS [userId],
            CAST(NULL AS NVARCHAR(255)) AS [passwordHash],
            N'USER_NOT_FOUND' AS [authStatus],
            CAST(NULL AS INT) AS [failedAttempts];
        RETURN;
    END;

    IF @IsActive = 0
    BEGIN
        SELECT
            @UserId AS [userId],
            CAST(NULL AS NVARCHAR(255)) AS [passwordHash],
            N'ACCOUNT_DISABLED' AS [authStatus],
            @FailedAttempts AS [failedAttempts];
        RETURN;
    END;

    IF @LockedUntil IS NOT NULL AND @LockedUntil > SYSUTCDATETIME()
    BEGIN
        SELECT
            @UserId AS [userId],
            CAST(NULL AS NVARCHAR(255)) AS [passwordHash],
            N'ACCOUNT_LOCKED' AS [authStatus],
            @FailedAttempts AS [failedAttempts];

        SELECT @NewValues =
        (
            SELECT @Email AS [email], N'Account locked' AS [reason]
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO [dbo].[AuditLog] ([actorId], [targetTable], [targetId], [action], [newValues], [ipAddress], [userAgent])
        VALUES (@UserId, N'AppUser', @UserId, N'LOGIN_FAILURE', @NewValues, @IPAddress, @UserAgent);

        RETURN;
    END;

    SELECT
        @UserId AS [userId],
        @PasswordHash AS [passwordHash],
        N'PENDING_VERIFY' AS [authStatus],
        @FailedAttempts AS [failedAttempts];
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_RecordLoginSuccess]
    @UserId UNIQUEIDENTIFIER,
    @TokenHash NVARCHAR(255),
    @ExpiresAt DATETIME2,
    @IPAddress NVARCHAR(45) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE [dbo].[AppUser]
    SET [failedAttempts] = 0,
        [lockedUntil] = NULL,
        [lastLoginAt] = SYSUTCDATETIME(),
        [updatedAt] = SYSUTCDATETIME()
    WHERE [id] = @UserId;

    INSERT INTO [dbo].[UserSession] ([userId], [tokenHash], [expiresAt], [ipAddress])
    VALUES (@UserId, @TokenHash, @ExpiresAt, @IPAddress);

    INSERT INTO [dbo].[AuditLog] ([actorId], [targetTable], [targetId], [action], [ipAddress], [userAgent])
    VALUES (@UserId, N'AppUser', @UserId, N'LOGIN_SUCCESS', @IPAddress, @UserAgent);
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_RecordLoginFailure]
    @UserId UNIQUEIDENTIFIER,
    @IPAddress NVARCHAR(45) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewFailedAttempts INT;
    DECLARE @NewValues NVARCHAR(MAX);

    UPDATE [dbo].[AppUser]
    SET [failedAttempts] = [failedAttempts] + 1,
        [lockedUntil] = CASE
            WHEN [failedAttempts] + 1 >= 5 THEN DATEADD(MINUTE, 30, SYSUTCDATETIME())
            ELSE [lockedUntil]
        END,
        [updatedAt] = SYSUTCDATETIME()
    WHERE [id] = @UserId;

    SELECT @NewFailedAttempts = [failedAttempts]
    FROM [dbo].[AppUser]
    WHERE [id] = @UserId;

    SELECT @NewValues =
    (
        SELECT @NewFailedAttempts AS [failedAttempts]
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    INSERT INTO [dbo].[AuditLog] ([actorId], [targetTable], [targetId], [action], [newValues], [ipAddress], [userAgent])
    VALUES (@UserId, N'AppUser', @UserId, N'LOGIN_FAILURE', @NewValues, @IPAddress, @UserAgent);
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateEmployee]
    @ActorUserId UNIQUEIDENTIFIER,
    @EmployeeId UNIQUEIDENTIFIER,
    @FullName NVARCHAR(200) = NULL,
    @Dob DATE = NULL,
    @DepartmentId UNIQUEIDENTIFIER = NULL,
    @Status NVARCHAR(20) = NULL,
    @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @OldValues NVARCHAR(MAX);
        DECLARE @NewValues NVARCHAR(MAX);

        SELECT @OldValues =
        (
            SELECT
                CASE WHEN @FullName IS NOT NULL THEN e.[fullName] END AS [fullName],
                CASE WHEN @Dob IS NOT NULL THEN CONVERT(NVARCHAR(10), e.[dob], 23) END AS [dob],
                CASE WHEN @DepartmentId IS NOT NULL THEN CONVERT(NVARCHAR(36), e.[departmentId]) END AS [departmentId],
                CASE WHEN @Status IS NOT NULL THEN e.[status] END AS [status]
            FROM [dbo].[Employee] e
            WHERE e.[id] = @EmployeeId
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        UPDATE [dbo].[Employee]
        SET [fullName] = COALESCE(@FullName, [fullName]),
            [dob] = COALESCE(@Dob, [dob]),
            [departmentId] = COALESCE(@DepartmentId, [departmentId]),
            [status] = COALESCE(@Status, [status]),
            [updatedAt] = SYSUTCDATETIME()
        WHERE [id] = @EmployeeId;

        SELECT @NewValues =
        (
            SELECT
                CASE WHEN @FullName IS NOT NULL THEN e.[fullName] END AS [fullName],
                CASE WHEN @Dob IS NOT NULL THEN CONVERT(NVARCHAR(10), e.[dob], 23) END AS [dob],
                CASE WHEN @DepartmentId IS NOT NULL THEN CONVERT(NVARCHAR(36), e.[departmentId]) END AS [departmentId],
                CASE WHEN @Status IS NOT NULL THEN e.[status] END AS [status]
            FROM [dbo].[Employee] e
            WHERE e.[id] = @EmployeeId
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        IF @OldValues IS NOT NULL
           AND @NewValues IS NOT NULL
           AND @OldValues <> N'{}'
        BEGIN
            INSERT INTO [dbo].[AuditLog] ([actorId], [targetTable], [targetId], [action], [oldValues], [newValues], [ipAddress])
            VALUES (@ActorUserId, N'Employee', @EmployeeId, N'UPDATE', @OldValues, @NewValues, @IPAddress);
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_SoftDeleteEmployee]
    @ActorUserId UNIQUEIDENTIFIER,
    @EmployeeId UNIQUEIDENTIFIER,
    @IPAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @UserId UNIQUEIDENTIFIER;
        DECLARE @OldValues NVARCHAR(MAX);

        SELECT @UserId = e.[userId]
        FROM [dbo].[Employee] e
        WHERE e.[id] = @EmployeeId;

        SELECT @OldValues =
        (
            SELECT
                e.[fullName],
                e.[dob],
                e.[departmentId],
                e.[status],
                es.[salary],
                es.[taxCode],
                es.[bankAccount]
            FROM [dbo].[Employee] e
            LEFT JOIN [dbo].[EmployeeSensitive] es ON e.[id] = es.[employeeId]
            WHERE e.[id] = @EmployeeId
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        UPDATE [dbo].[Employee]
        SET [status] = N'TERMINATED',
            [updatedAt] = SYSUTCDATETIME()
        WHERE [id] = @EmployeeId;

        UPDATE [dbo].[AppUser]
        SET [isActive] = 0,
            [updatedAt] = SYSUTCDATETIME()
        WHERE [id] = @UserId;

        UPDATE [dbo].[Department]
        SET [managerId] = NULL,
            [updatedAt] = SYSUTCDATETIME()
        WHERE [managerId] = @EmployeeId;

        UPDATE [dbo].[UserSession]
        SET [revokedAt] = SYSUTCDATETIME()
        WHERE [userId] = @UserId
          AND [revokedAt] IS NULL;

        INSERT INTO [dbo].[AuditLog] ([actorId], [targetTable], [targetId], [action], [oldValues], [ipAddress])
        VALUES (@ActorUserId, N'Employee', @EmployeeId, N'DELETE', @OldValues, @IPAddress);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Triggers
   --------------------------------------------------------------------------
   SQL Server triggers must be recreated in separate batches.
*/

IF OBJECT_ID(N'[dbo].[tr_AppUser_UpdateTimestamp]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_AppUser_UpdateTimestamp];
GO

CREATE TRIGGER [dbo].[tr_AppUser_UpdateTimestamp]
ON [dbo].[AppUser]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;

    UPDATE u
    SET u.[updatedAt] = SYSUTCDATETIME()
    FROM [dbo].[AppUser] u
    INNER JOIN inserted i ON u.[id] = i.[id];
END;
GO

IF OBJECT_ID(N'[dbo].[tr_Employee_UpdateTimestamp]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_Employee_UpdateTimestamp];
GO

CREATE TRIGGER [dbo].[tr_Employee_UpdateTimestamp]
ON [dbo].[Employee]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;

    UPDATE e
    SET e.[updatedAt] = SYSUTCDATETIME()
    FROM [dbo].[Employee] e
    INNER JOIN inserted i ON e.[id] = i.[id];
END;
GO

IF OBJECT_ID(N'[dbo].[tr_EmployeeSensitive_UpdateTimestamp]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_EmployeeSensitive_UpdateTimestamp];
GO

CREATE TRIGGER [dbo].[tr_EmployeeSensitive_UpdateTimestamp]
ON [dbo].[EmployeeSensitive]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;

    UPDATE es
    SET es.[updatedAt] = SYSUTCDATETIME()
    FROM [dbo].[EmployeeSensitive] es
    INNER JOIN inserted i ON es.[id] = i.[id];
END;
GO

IF OBJECT_ID(N'[dbo].[tr_Department_UpdateTimestamp]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_Department_UpdateTimestamp];
GO

CREATE TRIGGER [dbo].[tr_Department_UpdateTimestamp]
ON [dbo].[Department]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF (TRIGGER_NESTLEVEL() > 1) RETURN;

    UPDATE d
    SET d.[updatedAt] = SYSUTCDATETIME()
    FROM [dbo].[Department] d
    INNER JOIN inserted i ON d.[id] = i.[id];
END;
GO

IF OBJECT_ID(N'[dbo].[tr_AuditLog_PreventModification]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_AuditLog_PreventModification];
GO

CREATE TRIGGER [dbo].[tr_AuditLog_PreventModification]
ON [dbo].[AuditLog]
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR(N'Audit log records cannot be modified or deleted.', 16, 1);
    ROLLBACK TRANSACTION;
END;
GO

IF OBJECT_ID(N'[dbo].[tr_Employee_PreventHardDelete]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_Employee_PreventHardDelete];
GO

CREATE TRIGGER [dbo].[tr_Employee_PreventHardDelete]
ON [dbo].[Employee]
INSTEAD OF DELETE
AS
BEGIN
    RAISERROR(N'Hard deletion of employee records is not permitted. Use sp_SoftDeleteEmployee.', 16, 1);
    ROLLBACK TRANSACTION;
END;
GO

IF OBJECT_ID(N'[dbo].[tr_EmployeeSensitive_AuditChanges]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_EmployeeSensitive_AuditChanges];
GO

CREATE TRIGGER [dbo].[tr_EmployeeSensitive_AuditChanges]
ON [dbo].[EmployeeSensitive]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[AuditLog] ([actorId], [targetTable], [targetId], [action], [oldValues], [newValues])
    SELECT
        TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N'UserId') AS NVARCHAR(36))),
        N'EmployeeSensitive',
        i.[employeeId],
        N'UPDATE',
        (SELECT d.[salary], d.[taxCode], d.[bankAccount] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.[salary], i.[taxCode], i.[bankAccount] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    INNER JOIN deleted d ON i.[id] = d.[id]
    WHERE i.[salary] <> d.[salary]
       OR i.[taxCode] <> d.[taxCode]
       OR (i.[bankAccount] <> d.[bankAccount])
       OR (i.[bankAccount] IS NULL AND d.[bankAccount] IS NOT NULL)
       OR (i.[bankAccount] IS NOT NULL AND d.[bankAccount] IS NULL);
END;
GO

IF OBJECT_ID(N'[dbo].[tr_UserRole_SyncRoleName]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_UserRole_SyncRoleName];
GO

CREATE TRIGGER [dbo].[tr_UserRole_SyncRoleName]
ON [dbo].[UserRole]
AFTER INSERT, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH ChangedUsers AS
    (
        SELECT [userId] FROM inserted
        UNION
        SELECT [userId] FROM deleted
    )
    UPDATE u
    SET u.[roleName] = COALESCE(r.[name], N'REGULAR'),
        u.[updatedAt] = SYSUTCDATETIME()
    FROM [dbo].[AppUser] u
    INNER JOIN ChangedUsers c ON c.[userId] = u.[id]
    LEFT JOIN [dbo].[UserRole] ur ON ur.[userId] = u.[id]
    LEFT JOIN [dbo].[Role] r ON r.[id] = ur.[roleId];
END;
GO

/* --------------------------------------------------------------------------
   Indexes
   --------------------------------------------------------------------------
   Nonclustered indexes for active app queries and audit/session lookup paths.
*/

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Employee_departmentId' AND [object_id] = OBJECT_ID(N'[dbo].[Employee]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Employee_departmentId]
    ON [dbo].[Employee] ([departmentId])
    INCLUDE ([fullName], [status]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Employee_userId' AND [object_id] = OBJECT_ID(N'[dbo].[Employee]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Employee_userId]
    ON [dbo].[Employee] ([userId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Employee_status' AND [object_id] = OBJECT_ID(N'[dbo].[Employee]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Employee_status]
    ON [dbo].[Employee] ([status])
    WHERE [status] = N'ACTIVE';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_AppUser_isActive' AND [object_id] = OBJECT_ID(N'[dbo].[AppUser]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AppUser_isActive]
    ON [dbo].[AppUser] ([isActive])
    WHERE [isActive] = 1;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_EmployeeSensitive_employeeId' AND [object_id] = OBJECT_ID(N'[dbo].[EmployeeSensitive]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_EmployeeSensitive_employeeId]
    ON [dbo].[EmployeeSensitive] ([employeeId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_AuditLog_timestamp' AND [object_id] = OBJECT_ID(N'[dbo].[AuditLog]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AuditLog_timestamp]
    ON [dbo].[AuditLog] ([timestamp] DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_AuditLog_actorId' AND [object_id] = OBJECT_ID(N'[dbo].[AuditLog]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AuditLog_actorId]
    ON [dbo].[AuditLog] ([actorId])
    INCLUDE ([action], [timestamp]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_AuditLog_target' AND [object_id] = OBJECT_ID(N'[dbo].[AuditLog]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AuditLog_target]
    ON [dbo].[AuditLog] ([targetTable], [targetId])
    INCLUDE ([action], [timestamp]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_UserRole_roleId' AND [object_id] = OBJECT_ID(N'[dbo].[UserRole]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserRole_roleId]
    ON [dbo].[UserRole] ([roleId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_RolePermission_permissionId' AND [object_id] = OBJECT_ID(N'[dbo].[RolePermission]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RolePermission_permissionId]
    ON [dbo].[RolePermission] ([permissionId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_UserSession_userId' AND [object_id] = OBJECT_ID(N'[dbo].[UserSession]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserSession_userId]
    ON [dbo].[UserSession] ([userId])
    INCLUDE ([revokedAt], [expiresAt]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_UserSession_tokenHash' AND [object_id] = OBJECT_ID(N'[dbo].[UserSession]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserSession_tokenHash]
    ON [dbo].[UserSession] ([tokenHash])
    WHERE [revokedAt] IS NULL;
END;
GO

/* --------------------------------------------------------------------------
   Security policies and grants
   --------------------------------------------------------------------------
   Native database roles complement application RBAC tables.
*/

CREATE SECURITY POLICY [dbo].[EmployeeFilterPolicy]
ADD FILTER PREDICATE [dbo].[fn_EmployeeRowFilter]([departmentId], [userId]) ON [dbo].[Employee]
WITH (STATE = ON, SCHEMABINDING = OFF);
GO

CREATE SECURITY POLICY [dbo].[SensitiveDataPolicy]
ADD FILTER PREDICATE [dbo].[fn_SensitiveDataFilter]([employeeId]) ON [dbo].[EmployeeSensitive]
WITH (STATE = ON, SCHEMABINDING = OFF);
GO

IF DATABASE_PRINCIPAL_ID(N'ems_regular') IS NULL CREATE ROLE [ems_regular];
IF DATABASE_PRINCIPAL_ID(N'ems_manager') IS NULL CREATE ROLE [ems_manager];
IF DATABASE_PRINCIPAL_ID(N'ems_hr_employee') IS NULL CREATE ROLE [ems_hr_employee];
IF DATABASE_PRINCIPAL_ID(N'ems_hr_manager') IS NULL CREATE ROLE [ems_hr_manager];
IF DATABASE_PRINCIPAL_ID(N'ems_accounting') IS NULL CREATE ROLE [ems_accounting];
IF DATABASE_PRINCIPAL_ID(N'ems_admin') IS NULL CREATE ROLE [ems_admin];
IF DATABASE_PRINCIPAL_ID(N'ems_app_runtime') IS NULL CREATE ROLE [ems_app_runtime];
GO

DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[AppUser] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[Employee] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[EmployeeSensitive] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[Department] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[Role] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[Permission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[UserRole] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[RolePermission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[UserSession] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[AuditLog] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
GO

GRANT SELECT ON [dbo].[vw_EmployeeDirectory] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_DepartmentRoster] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_EmployeeWithSensitive] TO [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_PayrollSummary] TO [ems_accounting], [ems_hr_manager], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_hr_manager], [ems_admin], [ems_app_runtime];
DENY SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_accounting];
GO

GRANT SELECT ON [dbo].[fn_EmployeeRowFilter] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[fn_SensitiveDataFilter] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GO

GRANT EXECUTE ON [dbo].[sp_CheckPermission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT EXECUTE ON [dbo].[sp_UpdateEmployee] TO [ems_hr_employee], [ems_hr_manager], [ems_admin], [ems_app_runtime];
GRANT EXECUTE ON [dbo].[sp_SoftDeleteEmployee] TO [ems_hr_employee], [ems_hr_manager], [ems_admin], [ems_app_runtime];
GRANT EXECUTE ON [dbo].[sp_Authenticate] TO [ems_app_runtime], [ems_admin];
GRANT EXECUTE ON [dbo].[sp_RecordLoginSuccess] TO [ems_app_runtime], [ems_admin];
GRANT EXECUTE ON [dbo].[sp_RecordLoginFailure] TO [ems_app_runtime], [ems_admin];
GO

DENY EXECUTE ON [dbo].[sp_UpdateEmployee] TO [ems_regular], [ems_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_SoftDeleteEmployee] TO [ems_regular], [ems_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_Authenticate] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_RecordLoginSuccess] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_RecordLoginFailure] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[AppUser] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Employee] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[EmployeeSensitive] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Department] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Role] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Permission] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[UserRole] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[RolePermission] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[UserSession] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[AuditLog] TO [ems_admin], [ems_app_runtime];
GO

/* --------------------------------------------------------------------------
   Notes / skipped items
   --------------------------------------------------------------------------
   - No server login, database user, or credential statements are included.
   - No table creation or Prisma migration DDL is included.
   - No Department mutation procedures are included because the current backend only reads active departments.
   - No UserRole audit trigger is included because user/role routers already write AuditLog rows for role changes.
   - No procedure updates EmployeeSensitive.bankAccount because no current backend flow writes that field.
*/
