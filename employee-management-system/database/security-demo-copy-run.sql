/*
  Employee Management System - SQL Server security demo script.

  Run from the target EMS database in SSMS/Azure Data Studio.
  Recommended: run one section at a time.
  Mutation demos use transactions/TRY-CATCH and are intended to avoid
  leaving lasting demo changes.

  If direct database users such as ems_regular_user do not exist yet,
  run database/security-demo-users.sql first in a local/demo database.
*/

/* ============================================================================
   0. Preflight: objects, roles, permissions
   ============================================================================ */

SELECT name, type_desc
FROM sys.objects
WHERE name IN (
    N'vw_EmployeeDirectory', N'vw_EmployeeWithSensitive', N'vw_PayrollSummary',
    N'vw_DepartmentRoster', N'vw_AuditLogDetail',
    N'fn_EmployeeRowFilter', N'fn_SensitiveDataFilter',
    N'sp_CheckPermission', N'sp_Authenticate', N'sp_RecordLoginSuccess',
    N'sp_RecordLoginFailure', N'sp_UpdateEmployee', N'sp_SoftDeleteEmployee',
    N'tr_AppUser_UpdateTimestamp', N'tr_Employee_UpdateTimestamp',
    N'tr_EmployeeSensitive_UpdateTimestamp', N'tr_Department_UpdateTimestamp',
    N'tr_AuditLog_PreventModification', N'tr_Employee_PreventHardDelete',
    N'tr_EmployeeSensitive_AuditChanges', N'tr_UserRole_SyncRoleName'
)
ORDER BY type_desc, name;

SELECT
    name,
    CASE WHEN is_disabled = 0 THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS is_enabled
FROM sys.triggers
WHERE name LIKE N'tr[_]%'
ORDER BY name;

SELECT name, is_enabled
FROM sys.security_policies
WHERE name IN (N'EmployeeFilterPolicy', N'SensitiveDataPolicy');

SELECT name, type_desc
FROM sys.database_principals
WHERE name LIKE N'ems[_]%'
ORDER BY type_desc, name;

SELECT
    perm.state_desc,
    perm.permission_name,
    USER_NAME(perm.grantee_principal_id) AS grantee_name,
    OBJECT_SCHEMA_NAME(perm.major_id) + N'.' + OBJECT_NAME(perm.major_id) AS securable_name
FROM sys.database_permissions perm
WHERE USER_NAME(perm.grantee_principal_id) LIKE N'ems[_]%'
ORDER BY grantee_name, securable_name, permission_name;
GO

/* ============================================================================
   1. Initial data: users, roles, permissions, sample employees
   ============================================================================ */

EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

SELECT roleName, COUNT(*) AS user_count
FROM dbo.AppUser
GROUP BY roleName
ORDER BY roleName;

SELECT TOP (10)
    e.fullName,
    u.email,
    u.roleName,
    d.name AS departmentName,
    e.status
FROM dbo.Employee e
JOIN dbo.AppUser u ON u.id = e.userId
LEFT JOIN dbo.Department d ON d.id = e.departmentId
ORDER BY u.roleName, e.fullName;

SELECT
    r.name AS roleName,
    r.isSystem,
    p.resource,
    p.[action],
    p.scope
FROM dbo.Role r
LEFT JOIN dbo.RolePermission rp ON rp.roleId = r.id
LEFT JOIN dbo.Permission p ON p.id = rp.permissionId
ORDER BY r.name, p.resource, p.[action], p.scope;

EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
GO

/* ============================================================================
   2. Hashing proof: database stores bcrypt password hashes and token hashes
   ============================================================================ */

SELECT TOP (10)
    email,
    LEFT(passwordHash, 7) AS hash_prefix,
    LEN(passwordHash) AS hash_length,
    CASE WHEN passwordHash LIKE N'$2%' THEN N'bcrypt-like hash' ELSE N'check manually' END AS hash_note
FROM dbo.AppUser
ORDER BY email;

SELECT TOP (10)
    us.userId,
    LEFT(us.tokenHash, 12) AS token_hash_prefix,
    LEN(us.tokenHash) AS token_hash_length,
    us.issuedAt,
    us.expiresAt,
    us.revokedAt
FROM dbo.UserSession us
ORDER BY us.issuedAt DESC;
GO

/* ============================================================================
   3. Login stored procedures: authenticate, failure, success
   ============================================================================ */

DECLARE @Auth TABLE (
    userId UNIQUEIDENTIFIER NULL,
    passwordHash NVARCHAR(255) NULL,
    authStatus NVARCHAR(50) NOT NULL,
    failedAttempts INT NULL
);

INSERT INTO @Auth
EXEC dbo.sp_Authenticate
    @Email = N'an.nguyen@company.vn',
    @IPAddress = N'127.0.0.1',
    @UserAgent = N'SSMS demo';

SELECT
    userId,
    LEFT(passwordHash, 7) AS hash_prefix,
    LEN(passwordHash) AS hash_length,
    authStatus,
    failedAttempts
FROM @Auth;

EXEC dbo.sp_Authenticate
    @Email = N'not-found@company.vn',
    @IPAddress = N'127.0.0.1',
    @UserAgent = N'SSMS demo';
GO

DECLARE @LoginFailureUserId UNIQUEIDENTIFIER;
SELECT @LoginFailureUserId = id
FROM dbo.AppUser
WHERE email = N'chau.le@company.vn';

IF @LoginFailureUserId IS NULL
BEGIN
    PRINT N'Seed user chau.le@company.vn not found. Run npm run seed first.';
END
ELSE
BEGIN
    BEGIN TRANSACTION;

    EXEC dbo.sp_RecordLoginFailure
        @UserId = @LoginFailureUserId,
        @IPAddress = N'127.0.0.1',
        @UserAgent = N'SSMS demo';

    SELECT email, failedAttempts, lockedUntil
    FROM dbo.AppUser
    WHERE id = @LoginFailureUserId;

    SELECT TOP (5)
        [timestamp], actorId, targetTable, targetId, [action], newValues, ipAddress, userAgent
    FROM dbo.AuditLog
    WHERE actorId = @LoginFailureUserId
    ORDER BY [timestamp] DESC;

    ROLLBACK TRANSACTION;
END;
GO

DECLARE @LoginSuccessUserId UNIQUEIDENTIFIER;
SELECT @LoginSuccessUserId = id
FROM dbo.AppUser
WHERE email = N'an.nguyen@company.vn';

IF @LoginSuccessUserId IS NULL
BEGIN
    PRINT N'Seed user an.nguyen@company.vn not found. Run npm run seed first.';
END
ELSE
BEGIN
    BEGIN TRANSACTION;

    EXEC dbo.sp_RecordLoginSuccess
        @UserId = @LoginSuccessUserId,
        @TokenHash = N'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        @ExpiresAt = '2099-01-01T00:00:00',
        @IPAddress = N'127.0.0.1',
        @UserAgent = N'SSMS demo';

    SELECT TOP (5) userId, tokenHash, issuedAt, expiresAt, revokedAt, ipAddress
    FROM dbo.UserSession
    WHERE userId = @LoginSuccessUserId
    ORDER BY issuedAt DESC;

    SELECT TOP (5) [timestamp], [action], targetTable, targetId, ipAddress, userAgent
    FROM dbo.AuditLog
    WHERE actorId = @LoginSuccessUserId
    ORDER BY [timestamp] DESC;

    ROLLBACK TRANSACTION;
END;
GO

/* ============================================================================
   4. Application RBAC via sp_CheckPermission
   ============================================================================ */

DECLARE @RegularUserId UNIQUEIDENTIFIER;
DECLARE @HrManagerUserId UNIQUEIDENTIFIER;
DECLARE @ManagerUserId UNIQUEIDENTIFIER;

SELECT @RegularUserId = id FROM dbo.AppUser WHERE email = N'chau.le@company.vn';
SELECT @HrManagerUserId = id FROM dbo.AppUser WHERE email = N'dung.pham@company.vn';
SELECT @ManagerUserId = id FROM dbo.AppUser WHERE email = N'binh.tran@company.vn';

EXEC dbo.sp_CheckPermission
    @UserId = @RegularUserId,
    @Resource = N'audit_log',
    @Action = N'read',
    @Scope = N'all'; -- expected: 0

EXEC dbo.sp_CheckPermission
    @UserId = @HrManagerUserId,
    @Resource = N'audit_log',
    @Action = N'read',
    @Scope = N'all'; -- expected: 1

EXEC dbo.sp_CheckPermission
    @UserId = @ManagerUserId,
    @Resource = N'employee_sensitive',
    @Action = N'read',
    @Scope = N'own_department'; -- expected: 1

EXEC dbo.sp_CheckPermission
    @UserId = @RegularUserId,
    @Resource = N'employee_sensitive',
    @Action = N'read',
    @Scope = N'all'; -- expected: 0
GO

/* ============================================================================
   5. RLS functions and security policies through SESSION_CONTEXT
   ============================================================================ */

DECLARE @RlsRegularUserId UNIQUEIDENTIFIER;
DECLARE @RlsRegularEmployeeId UNIQUEIDENTIFIER;
DECLARE @RlsRegularDepartmentId UNIQUEIDENTIFIER;
DECLARE @RlsHrManagerUserId UNIQUEIDENTIFIER;
DECLARE @RlsHrManagerDepartmentId UNIQUEIDENTIFIER;

EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

SELECT
    @RlsRegularUserId = u.id,
    @RlsRegularEmployeeId = e.id,
    @RlsRegularDepartmentId = e.departmentId
FROM dbo.AppUser u
JOIN dbo.Employee e ON e.userId = u.id
WHERE u.email = N'chau.le@company.vn';

SELECT
    @RlsHrManagerUserId = u.id,
    @RlsHrManagerDepartmentId = e.departmentId
FROM dbo.AppUser u
JOIN dbo.Employee e ON e.userId = u.id
WHERE u.email = N'dung.pham@company.vn';

EXEC sp_set_session_context @key = N'UserId', @value = @RlsRegularUserId;
EXEC sp_set_session_context @key = N'RoleName', @value = N'REGULAR';
EXEC sp_set_session_context @key = N'DepartmentId', @value = @RlsRegularDepartmentId;

SELECT N'REGULAR Employee rows after RLS' AS demo, COUNT(*) AS visible_rows
FROM dbo.Employee;

SELECT N'REGULAR sensitive rows after RLS' AS demo, COUNT(*) AS visible_rows
FROM dbo.EmployeeSensitive;

SELECT * FROM dbo.fn_EmployeeRowFilter(@RlsRegularDepartmentId, @RlsRegularUserId);
SELECT * FROM dbo.fn_SensitiveDataFilter(@RlsRegularEmployeeId);

EXEC sp_set_session_context @key = N'UserId', @value = @RlsHrManagerUserId;
EXEC sp_set_session_context @key = N'RoleName', @value = N'HR_MANAGER';
EXEC sp_set_session_context @key = N'DepartmentId', @value = @RlsHrManagerDepartmentId;

SELECT N'HR_MANAGER Employee rows after RLS' AS demo, COUNT(*) AS visible_rows
FROM dbo.Employee;

SELECT N'HR_MANAGER sensitive rows after RLS' AS demo, COUNT(*) AS visible_rows
FROM dbo.EmployeeSensitive;

EXEC sp_set_session_context @key = N'UserId', @value = NULL;
EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
GO

/* ============================================================================
   6. Native SQL Server permissions: direct user denied base table, allowed view
   ============================================================================ */

IF DATABASE_PRINCIPAL_ID(N'ems_regular_user') IS NULL
BEGIN
    PRINT N'ems_regular_user not found. Run database/security-demo-users.sql first for direct SQL user demos.';
END
ELSE
BEGIN
    BEGIN TRY
        EXECUTE AS USER = N'ems_regular_user';
        SELECT TOP (1) * FROM dbo.Employee; -- expected: permission denied
        REVERT;
    END TRY
    BEGIN CATCH
        SELECT N'Expected denial on dbo.Employee' AS demo, ERROR_MESSAGE() AS error_message;
        REVERT;
    END CATCH;
END;
GO

IF DATABASE_PRINCIPAL_ID(N'ems_regular_user') IS NULL
BEGIN
    PRINT N'ems_regular_user not found. Run database/security-demo-users.sql first for direct SQL user demos.';
END
ELSE
BEGIN
    DECLARE @DirectRegularUserId UNIQUEIDENTIFIER;
    DECLARE @DirectRegularDepartmentId UNIQUEIDENTIFIER;

    EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

    SELECT
        @DirectRegularUserId = u.id,
        @DirectRegularDepartmentId = e.departmentId
    FROM dbo.AppUser u
    JOIN dbo.Employee e ON e.userId = u.id
    WHERE u.email = N'chau.le@company.vn';

    BEGIN TRY
        EXECUTE AS USER = N'ems_regular_user';
        EXEC sp_set_session_context @key = N'UserId', @value = @DirectRegularUserId;
        EXEC sp_set_session_context @key = N'RoleName', @value = N'REGULAR';
        EXEC sp_set_session_context @key = N'DepartmentId', @value = @DirectRegularDepartmentId;

        SELECT TOP (5)
            employeeCode, fullName, email, departmentName, primaryRole
        FROM dbo.vw_EmployeeDirectory
        ORDER BY fullName; -- expected: allowed, filtered by RLS/session context

        REVERT;
    END TRY
    BEGIN CATCH
        SELECT N'Unexpected error on vw_EmployeeDirectory' AS demo, ERROR_MESSAGE() AS error_message;
        REVERT;
    END CATCH;

    EXEC sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
    EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
END;
GO

IF DATABASE_PRINCIPAL_ID(N'ems_regular_user') IS NULL
BEGIN
    PRINT N'ems_regular_user not found. Run database/security-demo-users.sql first for direct SQL user demos.';
END
ELSE
BEGIN
    BEGIN TRY
        EXECUTE AS USER = N'ems_regular_user';
        SELECT TOP (1) * FROM dbo.vw_PayrollSummary; -- expected: permission denied
        REVERT;
    END TRY
    BEGIN CATCH
        SELECT N'Expected denial on payroll view for regular user' AS demo, ERROR_MESSAGE() AS error_message;
        REVERT;
    END CATCH;
END;
GO

/* ============================================================================
   7. Stored procedure grant/deny: HR manager allowed, regular denied
   ============================================================================ */

IF DATABASE_PRINCIPAL_ID(N'ems_hr_manager_user') IS NULL
BEGIN
    PRINT N'ems_hr_manager_user not found. Run database/security-demo-users.sql first for direct SQL user demos.';
END
ELSE
BEGIN
    DECLARE @ProcActorUserId UNIQUEIDENTIFIER;
    DECLARE @ProcActorDepartmentId UNIQUEIDENTIFIER;
    DECLARE @ProcTargetEmployeeId UNIQUEIDENTIFIER;

    EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

    SELECT
        @ProcActorUserId = u.id,
        @ProcActorDepartmentId = e.departmentId
    FROM dbo.AppUser u
    JOIN dbo.Employee e ON e.userId = u.id
    WHERE u.email = N'dung.pham@company.vn';

    SELECT TOP (1) @ProcTargetEmployeeId = e.id
    FROM dbo.Employee e
    JOIN dbo.AppUser u ON u.id = e.userId
    WHERE u.email = N'chau.le@company.vn';

    BEGIN TRY
        EXECUTE AS USER = N'ems_hr_manager_user';
        EXEC sp_set_session_context @key = N'UserId', @value = @ProcActorUserId;
        EXEC sp_set_session_context @key = N'RoleName', @value = N'HR_MANAGER';
        EXEC sp_set_session_context @key = N'DepartmentId', @value = @ProcActorDepartmentId;

        BEGIN TRANSACTION;

        EXEC dbo.sp_UpdateEmployee
            @ActorUserId = @ProcActorUserId,
            @EmployeeId = @ProcTargetEmployeeId,
            @FullName = N'DEMO Updated Name',
            @IPAddress = N'127.0.0.1';

        SELECT TOP (5)
            [timestamp], actorId, targetTable, targetId, [action], oldValues, newValues
        FROM dbo.AuditLog
        WHERE targetId = @ProcTargetEmployeeId
        ORDER BY [timestamp] DESC;

        ROLLBACK TRANSACTION;
        REVERT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT N'Unexpected error on HR manager procedure demo' AS demo, ERROR_MESSAGE() AS error_message;
        REVERT;
    END CATCH;

    EXEC sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
    EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
END;
GO

IF DATABASE_PRINCIPAL_ID(N'ems_regular_user') IS NULL
BEGIN
    PRINT N'ems_regular_user not found. Run database/security-demo-users.sql first for direct SQL user demos.';
END
ELSE
BEGIN
    DECLARE @DeniedRegularUserId UNIQUEIDENTIFIER;
    DECLARE @DeniedTargetEmployeeId UNIQUEIDENTIFIER;

    EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

    SELECT @DeniedRegularUserId = id
    FROM dbo.AppUser
    WHERE email = N'chau.le@company.vn';

    SELECT TOP (1) @DeniedTargetEmployeeId = id
    FROM dbo.Employee
    WHERE userId <> @DeniedRegularUserId
    ORDER BY fullName;

    BEGIN TRY
        EXECUTE AS USER = N'ems_regular_user';
        BEGIN TRANSACTION;
        EXEC dbo.sp_UpdateEmployee
            @ActorUserId = @DeniedRegularUserId,
            @EmployeeId = @DeniedTargetEmployeeId,
            @FullName = N'Should Not Happen',
            @IPAddress = N'127.0.0.1';
        ROLLBACK TRANSACTION;
        REVERT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT N'Expected EXECUTE denial on sp_UpdateEmployee' AS demo, ERROR_MESSAGE() AS error_message;
        REVERT;
    END CATCH;

    EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
END;
GO

/* ============================================================================
   8. Trigger demos: timestamps, sensitive audit, hard-delete block, audit immutability
   ============================================================================ */

DECLARE @TimestampDepartmentId UNIQUEIDENTIFIER;
SELECT TOP (1) @TimestampDepartmentId = id FROM dbo.Department ORDER BY name;

IF @TimestampDepartmentId IS NOT NULL
BEGIN
    SELECT N'before' AS phase, id, name, updatedAt
    FROM dbo.Department
    WHERE id = @TimestampDepartmentId;

    BEGIN TRANSACTION;
    WAITFOR DELAY '00:00:01';
    UPDATE dbo.Department
    SET name = name
    WHERE id = @TimestampDepartmentId;

    SELECT N'after update inside transaction' AS phase, id, name, updatedAt
    FROM dbo.Department
    WHERE id = @TimestampDepartmentId;

    ROLLBACK TRANSACTION;
END;
GO

DECLARE @SensitiveActorUserId UNIQUEIDENTIFIER;
DECLARE @SensitiveActorDepartmentId UNIQUEIDENTIFIER;
DECLARE @SensitiveEmployeeId UNIQUEIDENTIFIER;

EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

SELECT
    @SensitiveActorUserId = u.id,
    @SensitiveActorDepartmentId = e.departmentId
FROM dbo.AppUser u
JOIN dbo.Employee e ON e.userId = u.id
WHERE u.email = N'an.nguyen@company.vn';

SELECT TOP (1) @SensitiveEmployeeId = es.employeeId
FROM dbo.EmployeeSensitive es
ORDER BY es.createdAt;

IF @SensitiveActorUserId IS NOT NULL AND @SensitiveEmployeeId IS NOT NULL
BEGIN
    EXEC sp_set_session_context @key = N'UserId', @value = @SensitiveActorUserId;
    EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';
    EXEC sp_set_session_context @key = N'DepartmentId', @value = @SensitiveActorDepartmentId;

    BEGIN TRANSACTION;

    UPDATE dbo.EmployeeSensitive
    SET salary = salary + 1000
    WHERE employeeId = @SensitiveEmployeeId;

    SELECT TOP (5)
        [timestamp], actorId, targetTable, targetId, [action], oldValues, newValues
    FROM dbo.AuditLog
    WHERE targetTable = N'EmployeeSensitive'
      AND targetId = @SensitiveEmployeeId
    ORDER BY [timestamp] DESC;

    ROLLBACK TRANSACTION;

    EXEC sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
    EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
END;
GO

DECLARE @HardDeleteEmployeeId UNIQUEIDENTIFIER;
DECLARE @HardDeleteActorUserId UNIQUEIDENTIFIER;
DECLARE @HardDeleteActorDepartmentId UNIQUEIDENTIFIER;

EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

SELECT
    @HardDeleteActorUserId = u.id,
    @HardDeleteActorDepartmentId = e.departmentId
FROM dbo.AppUser u
JOIN dbo.Employee e ON e.userId = u.id
WHERE u.email = N'an.nguyen@company.vn';

SELECT TOP (1) @HardDeleteEmployeeId = e.id
FROM dbo.Employee e
JOIN dbo.AppUser u ON u.id = e.userId
WHERE u.email = N'chau.le@company.vn';

IF @HardDeleteEmployeeId IS NOT NULL
BEGIN
    EXEC sp_set_session_context @key = N'UserId', @value = @HardDeleteActorUserId;
    EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';
    EXEC sp_set_session_context @key = N'DepartmentId', @value = @HardDeleteActorDepartmentId;

    BEGIN TRY
        DELETE FROM dbo.Employee
        WHERE id = @HardDeleteEmployeeId; -- expected: trigger blocks hard delete
    END TRY
    BEGIN CATCH
        SELECT N'Expected hard-delete block' AS demo, ERROR_MESSAGE() AS error_message;
    END CATCH;

    EXEC sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
    EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
END;
GO

DECLARE @AuditId UNIQUEIDENTIFIER;
SELECT TOP (1) @AuditId = id
FROM dbo.AuditLog
ORDER BY [timestamp] DESC;

IF @AuditId IS NULL
BEGIN
    PRINT N'No AuditLog row exists yet. Run a login/update demo first, then rerun this section.';
END
ELSE
BEGIN
    BEGIN TRY
        UPDATE dbo.AuditLog
        SET ipAddress = ipAddress
        WHERE id = @AuditId; -- expected: trigger blocks UPDATE
    END TRY
    BEGIN CATCH
        SELECT N'Expected audit immutability block' AS demo, ERROR_MESSAGE() AS error_message;
    END CATCH;
END;
GO

DECLARE @RoleSyncUserId UNIQUEIDENTIFIER;
DECLARE @RoleSyncAdminUserId UNIQUEIDENTIFIER;
DECLARE @RoleSyncRoleId UNIQUEIDENTIFIER;

SELECT @RoleSyncUserId = id FROM dbo.AppUser WHERE email = N'chau.le@company.vn';
SELECT @RoleSyncAdminUserId = id FROM dbo.AppUser WHERE email = N'an.nguyen@company.vn';
SELECT @RoleSyncRoleId = id FROM dbo.Role WHERE name = N'ACCOUNTING';

IF @RoleSyncUserId IS NOT NULL AND @RoleSyncRoleId IS NOT NULL
BEGIN
    SELECT N'before' AS phase, email, roleName
    FROM dbo.AppUser
    WHERE id = @RoleSyncUserId;

    BEGIN TRANSACTION;

    DELETE FROM dbo.UserRole
    WHERE userId = @RoleSyncUserId;

    SELECT N'after UserRole delete' AS phase, email, roleName
    FROM dbo.AppUser
    WHERE id = @RoleSyncUserId;

    INSERT INTO dbo.UserRole (userId, roleId, assignedBy)
    VALUES (@RoleSyncUserId, @RoleSyncRoleId, @RoleSyncAdminUserId);

    SELECT N'after UserRole insert' AS phase, email, roleName
    FROM dbo.AppUser
    WHERE id = @RoleSyncUserId;

    ROLLBACK TRANSACTION;
END;
GO

/* ============================================================================
   9. Data integrity: invalid data is blocked by constraints
   ============================================================================ */

DECLARE @BadDataActorUserId UNIQUEIDENTIFIER;
DECLARE @BadDataActorDepartmentId UNIQUEIDENTIFIER;
DECLARE @BadDataEmployeeId UNIQUEIDENTIFIER;

EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

SELECT
    @BadDataActorUserId = u.id,
    @BadDataActorDepartmentId = e.departmentId
FROM dbo.AppUser u
JOIN dbo.Employee e ON e.userId = u.id
WHERE u.email = N'an.nguyen@company.vn';

SELECT TOP (1) @BadDataEmployeeId = e.id
FROM dbo.Employee e
JOIN dbo.AppUser u ON u.id = e.userId
WHERE u.email = N'chau.le@company.vn';

EXEC sp_set_session_context @key = N'UserId', @value = @BadDataActorUserId;
EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';
EXEC sp_set_session_context @key = N'DepartmentId', @value = @BadDataActorDepartmentId;

BEGIN TRY
    UPDATE dbo.EmployeeSensitive
    SET salary = -1
    WHERE employeeId = @BadDataEmployeeId; -- expected: CK_EmployeeSensitive_salary violation
END TRY
BEGIN CATCH
    SELECT N'Expected negative salary constraint failure' AS demo, ERROR_MESSAGE() AS error_message;
END CATCH;

BEGIN TRY
    UPDATE dbo.Employee
    SET status = N'INVALID_STATUS'
    WHERE id = @BadDataEmployeeId; -- expected: CK_Employee_status violation
END TRY
BEGIN CATCH
    SELECT N'Expected employee status constraint failure' AS demo, ERROR_MESSAGE() AS error_message;
END CATCH;

BEGIN TRY
    INSERT INTO dbo.AuditLog (actorId, targetTable, targetId, [action])
    VALUES (@BadDataActorUserId, N'Employee', @BadDataEmployeeId, N'HACK'); -- expected: CK_AuditLog_action violation
END TRY
BEGIN CATCH
    SELECT N'Expected audit action constraint failure' AS demo, ERROR_MESSAGE() AS error_message;
END CATCH;

EXEC sp_set_session_context @key = N'UserId', @value = NULL;
EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
GO

/* ============================================================================
   10. Soft delete procedure demo with rollback
   ============================================================================ */

DECLARE @SoftDeleteActorUserId UNIQUEIDENTIFIER;
DECLARE @SoftDeleteActorDepartmentId UNIQUEIDENTIFIER;
DECLARE @SoftDeleteEmployeeId UNIQUEIDENTIFIER;

EXEC sp_set_session_context @key = N'RoleName', @value = N'ADMIN';

SELECT
    @SoftDeleteActorUserId = u.id,
    @SoftDeleteActorDepartmentId = e.departmentId
FROM dbo.AppUser u
JOIN dbo.Employee e ON e.userId = u.id
WHERE u.email = N'dung.pham@company.vn';

SELECT TOP (1) @SoftDeleteEmployeeId = e.id
FROM dbo.Employee e
JOIN dbo.AppUser u ON u.id = e.userId
WHERE u.email = N'chau.le@company.vn';

IF @SoftDeleteActorUserId IS NOT NULL AND @SoftDeleteEmployeeId IS NOT NULL
BEGIN
    EXEC sp_set_session_context @key = N'UserId', @value = @SoftDeleteActorUserId;
    EXEC sp_set_session_context @key = N'RoleName', @value = N'HR_MANAGER';
    EXEC sp_set_session_context @key = N'DepartmentId', @value = @SoftDeleteActorDepartmentId;

    BEGIN TRANSACTION;

    EXEC dbo.sp_SoftDeleteEmployee
        @ActorUserId = @SoftDeleteActorUserId,
        @EmployeeId = @SoftDeleteEmployeeId,
        @IPAddress = N'127.0.0.1';

    SELECT e.id, e.status, u.email, u.isActive
    FROM dbo.Employee e
    JOIN dbo.AppUser u ON u.id = e.userId
    WHERE e.id = @SoftDeleteEmployeeId;

    SELECT TOP (5)
        [timestamp], actorId, targetTable, targetId, [action], oldValues
    FROM dbo.AuditLog
    WHERE targetId = @SoftDeleteEmployeeId
    ORDER BY [timestamp] DESC;

    ROLLBACK TRANSACTION;

    EXEC sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sp_set_session_context @key = N'RoleName', @value = NULL;
    EXEC sp_set_session_context @key = N'DepartmentId', @value = NULL;
END;
GO
