-- Native SQL Server RBAC layer.
-- These database roles complement the application RBAC tables by restricting
-- direct database access to views and stored procedures.

IF DATABASE_PRINCIPAL_ID(N'ems_regular') IS NULL CREATE ROLE [ems_regular];
IF DATABASE_PRINCIPAL_ID(N'ems_manager') IS NULL CREATE ROLE [ems_manager];
IF DATABASE_PRINCIPAL_ID(N'ems_hr_employee') IS NULL CREATE ROLE [ems_hr_employee];
IF DATABASE_PRINCIPAL_ID(N'ems_hr_manager') IS NULL CREATE ROLE [ems_hr_manager];
IF DATABASE_PRINCIPAL_ID(N'ems_accounting') IS NULL CREATE ROLE [ems_accounting];
IF DATABASE_PRINCIPAL_ID(N'ems_admin') IS NULL CREATE ROLE [ems_admin];
IF DATABASE_PRINCIPAL_ID(N'ems_app_runtime') IS NULL CREATE ROLE [ems_app_runtime];

-- Direct end-user roles should not read or mutate base tables. They receive
-- access through curated views and procedures, while RLS continues to filter rows.
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

-- Directory and department visibility.
GRANT SELECT ON [dbo].[vw_EmployeeDirectory] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_DepartmentRoster] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[Department] TO [ems_admin], [ems_app_runtime];

-- Sensitive views are intentionally narrower than base-table access.
GRANT SELECT ON [dbo].[vw_EmployeeWithSensitive] TO [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[vw_PayrollSummary] TO [ems_accounting], [ems_hr_manager], [ems_admin], [ems_app_runtime];

-- Audit view is limited to HR managers, admins, and the app runtime.
GRANT SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_hr_manager], [ems_admin], [ems_app_runtime];
DENY SELECT ON [dbo].[vw_AuditLogDetail] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_accounting];

-- Permission checks are safe to expose; the result remains based on UserRole/RolePermission rows.
GRANT EXECUTE ON [dbo].[sp_CheckPermission] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];

-- Mutating operations go through procedures for direct database users.
GRANT EXECUTE ON [dbo].[sp_UpdateEmployee] TO [ems_hr_employee], [ems_hr_manager], [ems_admin], [ems_app_runtime];
GRANT EXECUTE ON [dbo].[sp_SoftDeleteEmployee] TO [ems_hr_employee], [ems_hr_manager], [ems_admin], [ems_app_runtime];
DENY EXECUTE ON [dbo].[sp_UpdateEmployee] TO [ems_regular], [ems_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_SoftDeleteEmployee] TO [ems_regular], [ems_manager], [ems_accounting];

-- Authentication/session procedures are for the application runtime.
GRANT EXECUTE ON [dbo].[sp_Authenticate] TO [ems_app_runtime], [ems_admin];
GRANT EXECUTE ON [dbo].[sp_RecordLoginSuccess] TO [ems_app_runtime], [ems_admin];
GRANT EXECUTE ON [dbo].[sp_RecordLoginFailure] TO [ems_app_runtime], [ems_admin];
DENY EXECUTE ON [dbo].[sp_Authenticate] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_RecordLoginSuccess] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];
DENY EXECUTE ON [dbo].[sp_RecordLoginFailure] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting];

-- Admin and app runtime retain controlled base access for maintenance and the current Prisma code paths.
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
