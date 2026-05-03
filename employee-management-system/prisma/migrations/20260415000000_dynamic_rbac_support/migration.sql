-- Re-introduce dynamic role and permission management while keeping the
-- existing fixed-role SQL Server security layer intact.

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_AppUser_roleName'
      AND parent_object_id = OBJECT_ID(N'[dbo].[AppUser]')
)
BEGIN
    ALTER TABLE [dbo].[AppUser] DROP CONSTRAINT [CK_AppUser_roleName];
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_AppUser_roleName_not_blank'
      AND parent_object_id = OBJECT_ID(N'[dbo].[AppUser]')
)
BEGIN
    ALTER TABLE [dbo].[AppUser]
    ADD CONSTRAINT [CK_AppUser_roleName_not_blank]
    CHECK (LEN(LTRIM(RTRIM([roleName]))) >= 2);
END;

IF OBJECT_ID(N'[dbo].[Role]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Role] (
        [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Role_id_df] DEFAULT NEWID(),
        [name] NVARCHAR(50) NOT NULL,
        [description] NVARCHAR(255) NULL,
        [isSystem] BIT NOT NULL CONSTRAINT [Role_isSystem_df] DEFAULT 0,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT SYSUTCDATETIME(),
        [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Role_updatedAt_df] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Role] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [UQ_Role_name] UNIQUE NONCLUSTERED ([name]),
        CONSTRAINT [CK_Role_name] CHECK (LEN(LTRIM(RTRIM([name]))) >= 2)
    );
END;

IF OBJECT_ID(N'[dbo].[Permission]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Permission] (
        [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [Permission_id_df] DEFAULT NEWID(),
        [resource] NVARCHAR(50) NOT NULL,
        [action] NVARCHAR(20) NOT NULL,
        [scope] NVARCHAR(30) NOT NULL,
        [description] NVARCHAR(255) NULL,
        CONSTRAINT [PK_Permission] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [UQ_Permission_resource_action_scope] UNIQUE NONCLUSTERED ([resource], [action], [scope])
    );
END;

IF OBJECT_ID(N'[dbo].[RolePermission]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RolePermission] (
        [roleId] UNIQUEIDENTIFIER NOT NULL,
        [permissionId] UNIQUEIDENTIFIER NOT NULL,
        [grantedAt] DATETIME2 NOT NULL CONSTRAINT [RolePermission_grantedAt_df] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_RolePermission] PRIMARY KEY CLUSTERED ([roleId], [permissionId]),
        CONSTRAINT [FK_RolePermission_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT [FK_RolePermission_Permission] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
    );
END;

IF OBJECT_ID(N'[dbo].[UserRole]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[UserRole] (
        [userId] UNIQUEIDENTIFIER NOT NULL,
        [roleId] UNIQUEIDENTIFIER NOT NULL,
        [assignedAt] DATETIME2 NOT NULL CONSTRAINT [UserRole_assignedAt_df] DEFAULT SYSUTCDATETIME(),
        [assignedBy] UNIQUEIDENTIFIER NULL,
        CONSTRAINT [PK_UserRole] PRIMARY KEY CLUSTERED ([userId], [roleId]),
        CONSTRAINT [UQ_UserRole_userId] UNIQUE NONCLUSTERED ([userId]),
        CONSTRAINT [FK_UserRole_AppUser] FOREIGN KEY ([userId]) REFERENCES [dbo].[AppUser]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT [FK_UserRole_Role] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_RolePermission_permissionId'
      AND object_id = OBJECT_ID(N'[dbo].[RolePermission]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RolePermission_permissionId] ON [dbo].[RolePermission]([permissionId]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_UserRole_roleId'
      AND object_id = OBJECT_ID(N'[dbo].[UserRole]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserRole_roleId] ON [dbo].[UserRole]([roleId]);
END;

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_AuditLog_values'
      AND parent_object_id = OBJECT_ID(N'[dbo].[AuditLog]')
)
BEGIN
    ALTER TABLE [dbo].[AuditLog] DROP CONSTRAINT [CK_AuditLog_values];
END;

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_AuditLog_action'
      AND parent_object_id = OBJECT_ID(N'[dbo].[AuditLog]')
)
BEGIN
    ALTER TABLE [dbo].[AuditLog] DROP CONSTRAINT [CK_AuditLog_action];
END;

ALTER TABLE [dbo].[AuditLog]
ADD CONSTRAINT [CK_AuditLog_action]
CHECK ([action] IN ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FAILED','LOGIN_SUCCESS','LOGIN_FAILURE'));

ALTER TABLE [dbo].[AuditLog]
ADD CONSTRAINT [CK_AuditLog_values]
CHECK (
    ([action] = 'CREATE' AND [oldValues] IS NULL AND [newValues] IS NOT NULL) OR
    ([action] = 'UPDATE' AND [oldValues] IS NOT NULL AND [newValues] IS NOT NULL) OR
    ([action] = 'DELETE' AND [oldValues] IS NOT NULL AND [newValues] IS NULL) OR
    ([action] IN ('READ','LOGIN','LOGOUT','LOGIN_FAILED','LOGIN_SUCCESS','LOGIN_FAILURE'))
);

IF OBJECT_ID(N'[dbo].[tr_UserRole_SyncRoleName]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[tr_UserRole_SyncRoleName];

EXEC(N'
CREATE TRIGGER [dbo].[tr_UserRole_SyncRoleName]
ON [dbo].[UserRole] AFTER INSERT, DELETE AS
BEGIN
    SET NOCOUNT ON;

    ;WITH ChangedUsers AS (
        SELECT userId FROM inserted
        UNION
        SELECT userId FROM deleted
    )
    UPDATE u
    SET u.roleName = COALESCE(r.name, ''REGULAR''),
        u.updatedAt = SYSUTCDATETIME()
    FROM [dbo].[AppUser] u
    INNER JOIN ChangedUsers c ON c.userId = u.id
    LEFT JOIN [dbo].[UserRole] ur ON ur.userId = u.id
    LEFT JOIN [dbo].[Role] r ON r.id = ur.roleId;
END;
');

IF OBJECT_ID(N'[dbo].[vw_AuditLogDetail]', N'V') IS NOT NULL
    DROP VIEW [dbo].[vw_AuditLogDetail];

EXEC(N'
CREATE VIEW [dbo].[vw_AuditLogDetail] AS
SELECT al.id, al.[timestamp], al.actorId,
       COALESCE(actorEmployee.fullName, ''[System]'') AS actorName,
       al.targetTable, al.targetId,
       COALESCE(
           targetEmployee.fullName,
           targetDepartment.name,
           targetUser.email,
           targetRole.name,
           CONCAT(targetPermission.resource, ''.'', targetPermission.[action], ''.'', targetPermission.scope),
           CONVERT(NVARCHAR(36), al.targetId)
       ) AS targetName,
       al.[action], al.oldValues, al.newValues, al.ipAddress, al.userAgent
FROM [dbo].[AuditLog] al
LEFT JOIN [dbo].[Employee] actorEmployee ON al.actorId = actorEmployee.userId
LEFT JOIN [dbo].[Employee] targetEmployee ON al.targetTable = ''Employee'' AND al.targetId = targetEmployee.id
LEFT JOIN [dbo].[Department] targetDepartment ON al.targetTable = ''Department'' AND al.targetId = targetDepartment.id
LEFT JOIN [dbo].[AppUser] targetUser ON al.targetTable IN (''AppUser'', ''UserRole'') AND al.targetId = targetUser.id
LEFT JOIN [dbo].[Role] targetRole ON al.targetTable IN (''Role'', ''RolePermission'') AND al.targetId = targetRole.id
LEFT JOIN [dbo].[Permission] targetPermission ON al.targetTable = ''Permission'' AND al.targetId = targetPermission.id;
');

IF OBJECT_ID(N'[dbo].[sp_CheckPermission]', N'P') IS NOT NULL
    DROP PROCEDURE [dbo].[sp_CheckPermission];

EXEC(N'
CREATE PROCEDURE [dbo].[sp_CheckPermission]
    @UserId UNIQUEIDENTIFIER,
    @Resource NVARCHAR(50),
    @Action NVARCHAR(50),
    @Scope NVARCHAR(50) = ''all''
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleName NVARCHAR(50), @IsSystem BIT;
    SELECT @RoleName = roleName
    FROM [dbo].[AppUser]
    WHERE id = @UserId AND isActive = 1;

    IF @RoleName IS NULL
    BEGIN
        SELECT 0 AS [HasPermission];
        RETURN;
    END;

    SELECT @IsSystem = isSystem
    FROM [dbo].[Role]
    WHERE name = @RoleName;

    IF ISNULL(@IsSystem, 0) = 0
       AND @RoleName NOT IN (''REGULAR'',''MANAGER'',''HR_EMPLOYEE'',''HR_MANAGER'',''ACCOUNTING'',''ADMIN'')
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM [dbo].[UserRole] ur
            INNER JOIN [dbo].[Role] r ON ur.roleId = r.id
            INNER JOIN [dbo].[RolePermission] rp ON r.id = rp.roleId
            INNER JOIN [dbo].[Permission] p ON rp.permissionId = p.id
            WHERE ur.userId = @UserId
              AND r.name = @RoleName
              AND p.resource = @Resource
              AND p.[action] = @Action
              AND (p.scope = @Scope OR p.scope = ''all'')
        )
            SELECT 1 AS [HasPermission];
        ELSE
            SELECT 0 AS [HasPermission];

        RETURN;
    END;

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

IF OBJECT_ID(N'[dbo].[sp_Authenticate]', N'P') IS NOT NULL
    DROP PROCEDURE [dbo].[sp_Authenticate];

EXEC(N'
CREATE PROCEDURE [dbo].[sp_Authenticate]
    @Email NVARCHAR(255), @IPAddress NVARCHAR(45) = NULL, @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @UserId UNIQUEIDENTIFIER, @PasswordHash NVARCHAR(255),
            @IsActive BIT, @LockedUntil DATETIME2, @FailedAttempts INT,
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
        INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], newValues, ipAddress, userAgent)
        VALUES (@UserId, ''AppUser'', @UserId, ''LOGIN_FAILURE'', @NewValues, @IPAddress, @UserAgent);
        RETURN; END

    SELECT @UserId AS userId, @PasswordHash AS passwordHash,
           ''PENDING_VERIFY'' AS authStatus, @FailedAttempts AS failedAttempts;
END;
');

IF OBJECT_ID(N'[dbo].[sp_RecordLoginSuccess]', N'P') IS NOT NULL
    DROP PROCEDURE [dbo].[sp_RecordLoginSuccess];

EXEC(N'
CREATE PROCEDURE [dbo].[sp_RecordLoginSuccess]
    @UserId UNIQUEIDENTIFIER, @TokenHash NVARCHAR(255),
    @ExpiresAt DATETIME2, @IPAddress NVARCHAR(45) = NULL, @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[AppUser]
    SET failedAttempts = 0, lockedUntil = NULL, lastLoginAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME()
    WHERE id = @UserId;

    INSERT INTO [dbo].[UserSession] (userId, tokenHash, expiresAt, ipAddress)
    VALUES (@UserId, @TokenHash, @ExpiresAt, @IPAddress);

    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], ipAddress, userAgent)
    VALUES (@UserId, ''AppUser'', @UserId, ''LOGIN_SUCCESS'', @IPAddress, @UserAgent);
END;
');

IF OBJECT_ID(N'[dbo].[sp_RecordLoginFailure]', N'P') IS NOT NULL
    DROP PROCEDURE [dbo].[sp_RecordLoginFailure];

EXEC(N'
CREATE PROCEDURE [dbo].[sp_RecordLoginFailure]
    @UserId UNIQUEIDENTIFIER, @IPAddress NVARCHAR(45) = NULL, @UserAgent NVARCHAR(500) = NULL
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
    INSERT INTO [dbo].[AuditLog] (actorId, targetTable, targetId, [action], newValues, ipAddress, userAgent)
    VALUES (@UserId, ''AppUser'', @UserId, ''LOGIN_FAILURE'', @NewValues, @IPAddress, @UserAgent);
END;
');

DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[Role] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[Permission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[RolePermission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[UserRole] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Role] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[Permission] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[RolePermission] TO [ems_admin], [ems_app_runtime];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[UserRole] TO [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_hr_manager], [ems_admin], [ems_app_runtime];
GRANT EXECUTE ON [dbo].[sp_CheckPermission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT EXECUTE ON [dbo].[sp_Authenticate] TO [ems_app_runtime], [ems_admin];
GRANT EXECUTE ON [dbo].[sp_RecordLoginSuccess] TO [ems_app_runtime], [ems_admin];
GRANT EXECUTE ON [dbo].[sp_RecordLoginFailure] TO [ems_app_runtime], [ems_admin];
