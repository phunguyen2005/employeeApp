IF COL_LENGTH(N'dbo.Employee', N'employeeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Employee]
    ADD [employeeCode] NVARCHAR(20) NULL;
END;

EXEC(N'
;WITH OrderedEmployees AS (
    SELECT
        [id],
        ROW_NUMBER() OVER (ORDER BY [createdAt], [id]) AS [codeNumber]
    FROM [dbo].[Employee]
    WHERE [employeeCode] IS NULL OR LTRIM(RTRIM([employeeCode])) = N''''
)
UPDATE e
SET [employeeCode] = CONCAT(N''NV-'', RIGHT(N''000000'' + CONVERT(NVARCHAR(6), oe.[codeNumber]), 6))
FROM [dbo].[Employee] e
INNER JOIN OrderedEmployees oe ON e.[id] = oe.[id];
');

EXEC(N'
IF EXISTS (SELECT 1 FROM [dbo].[Employee] WHERE [employeeCode] IS NULL OR LTRIM(RTRIM([employeeCode])) = N'''')
BEGIN
    THROW 51000, ''Employee.employeeCode backfill failed.'', 1;
END;
');

EXEC(N'ALTER TABLE [dbo].[Employee] ALTER COLUMN [employeeCode] NVARCHAR(20) NOT NULL;');

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE [name] = N'UQ_Employee_employeeCode'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[Employee]')
)
BEGIN
    EXEC(N'ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [UQ_Employee_employeeCode] UNIQUE NONCLUSTERED ([employeeCode]);');
END;

IF OBJECT_ID(N'[dbo].[EmployeeCodeSequence]', N'SO') IS NULL
BEGIN
    EXEC(N'CREATE SEQUENCE [dbo].[EmployeeCodeSequence] AS BIGINT START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE CACHE 10;');
END;

DECLARE @NextEmployeeCode BIGINT;
EXEC sp_executesql
    N'SELECT @NextEmployeeCodeOutput = COALESCE(MAX(TRY_CONVERT(BIGINT, SUBSTRING([employeeCode], 4, 6))), 0) + 1
      FROM [dbo].[Employee]
      WHERE [employeeCode] LIKE N''NV-[0-9][0-9][0-9][0-9][0-9][0-9]'';',
    N'@NextEmployeeCodeOutput BIGINT OUTPUT',
    @NextEmployeeCodeOutput = @NextEmployeeCode OUTPUT;

DECLARE @RestartEmployeeCodeSequenceSql NVARCHAR(MAX) =
    N'ALTER SEQUENCE [dbo].[EmployeeCodeSequence] RESTART WITH ' + CONVERT(NVARCHAR(20), @NextEmployeeCode);
EXEC sp_executesql @RestartEmployeeCodeSequenceSql;

EXEC(N'CREATE OR ALTER VIEW [dbo].[vw_EmployeeDirectory] AS
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
WHERE e.[status] = N''ACTIVE''
  AND u.[isActive] = 1;');

EXEC(N'CREATE OR ALTER VIEW [dbo].[vw_EmployeeWithSensitive] AS
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
WHERE e.[status] = N''ACTIVE''
  AND u.[isActive] = 1;');

EXEC(N'CREATE OR ALTER VIEW [dbo].[vw_PayrollSummary] AS
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
WHERE e.[status] = N''ACTIVE'';');

EXEC(N'CREATE OR ALTER VIEW [dbo].[vw_DepartmentRoster] AS
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
WHERE e.[status] = N''ACTIVE''
  AND u.[isActive] = 1;');

EXEC(N'CREATE OR ALTER VIEW [dbo].[vw_AuditLogDetail] AS
SELECT
    al.[id],
    al.[timestamp],
    al.[actorId],
    COALESCE(actorEmployee.[fullName], N''[System]'') AS [actorName],
    al.[targetTable],
    al.[targetId],
    COALESCE(
        CONCAT(targetEmployee.[employeeCode], N'' - '', targetEmployee.[fullName]),
        targetDepartment.[name],
        targetUser.[email],
        targetRole.[name],
        CONCAT(targetPermission.[resource], N''.'', targetPermission.[action], N''.'', targetPermission.[scope]),
        CONVERT(NVARCHAR(36), al.[targetId])
    ) AS [targetName],
    al.[action],
    al.[oldValues],
    al.[newValues],
    al.[ipAddress],
    al.[userAgent]
FROM [dbo].[AuditLog] al
LEFT JOIN [dbo].[Employee] actorEmployee ON al.[actorId] = actorEmployee.[userId]
LEFT JOIN [dbo].[Employee] targetEmployee ON al.[targetTable] = N''Employee'' AND al.[targetId] = targetEmployee.[id]
LEFT JOIN [dbo].[Department] targetDepartment ON al.[targetTable] = N''Department'' AND al.[targetId] = targetDepartment.[id]
LEFT JOIN [dbo].[AppUser] targetUser ON al.[targetTable] IN (N''AppUser'', N''UserRole'') AND al.[targetId] = targetUser.[id]
LEFT JOIN [dbo].[Role] targetRole ON al.[targetTable] IN (N''Role'', N''RolePermission'') AND al.[targetId] = targetRole.[id]
LEFT JOIN [dbo].[Permission] targetPermission ON al.[targetTable] = N''Permission'' AND al.[targetId] = targetPermission.[id];');
