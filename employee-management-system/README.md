# Employee Management System

A secure Human Resource Management (HRM) application built with React, Vite, Express, tRPC, Prisma, and SQL Server.

The project is designed for a data-security coursework/demo context. It combines application RBAC with SQL Server security features such as stored procedures, views, database roles, row-level security, session context, triggers, and audit logging.

## Features

- Employee directory with generated employee codes such as `NV-000001`.
- Employee profile create, update, and soft-delete workflows.
- Sensitive employee data handling for salary, tax code, and bank account fields.
- Department-aware access control for regular employees, managers, HR, accounting, and admins.
- Authentication with bcrypt password hashes, HttpOnly JWT cookie sessions, and hashed session tokens in the database.
- Dynamic role and permission management through admin screens.
- Audit log screen for governance and sensitive actions.
- SQL Server security layer with views, stored procedures, grants/denies, triggers, and RLS policies.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TanStack Router, TanStack Query, Tailwind CSS 4 |
| API | Express, tRPC 11, cookie-based auth |
| Database | SQL Server, Prisma 5 |
| Security | bcryptjs, JWT, SQL Server roles/grants/denies, RLS, stored procedures, triggers |
| Tooling | TypeScript, tsx, Prisma Migrate |

## Project Structure

```text
employee-management-system/
  database/                 SQL demo scripts and consolidated SQL security objects
  prisma/
    migrations/             Prisma SQL Server migrations
    schema.prisma           Prisma data model
    seed.ts                 Seed data, roles, permissions, and demo accounts
  src/
    pages/                  React pages and admin screens
    server/                 Express/tRPC backend, routers, auth context
    lib/                    Shared client/server helpers
    router.tsx              TanStack route tree
  README.md
```

## Prerequisites

- Node.js 18 or newer.
- SQL Server running locally or remotely.
- SQL Server TCP/IP enabled, commonly on port `1433`.
- Git.

Recommended local database name: `EmployeeDB`.

## Environment Variables

Create `employee-management-system/.env` manually and keep real secrets out of Git.

```env
DATABASE_URL="sqlserver://localhost:1433;database=EmployeeDB;integratedSecurity=true;trustServerCertificate=true;"
JWT_SECRET="replace-with-a-long-random-development-secret"
VITE_APP_URL="http://localhost:3000"
PORT="4000"
GEMINI_API_KEY="optional-if-you-use-AI-features"
```

Notes:

- `DATABASE_URL` is required by Prisma.
- `JWT_SECRET` is used to sign auth cookies. The app has a development fallback, but setting this value is safer.
- `VITE_APP_URL` must match the frontend origin allowed by backend CORS.
- The frontend tRPC client currently calls `http://localhost:4000/trpc`, so keep `PORT=4000` unless you also update the client.
- `trustServerCertificate=true` is convenient for local SQL Server development.

## Install

```powershell
cd D:\College\03_Year_3\DataSecurity\EmployeeApp\employee-management-system
npm install
```

If PowerShell blocks `npx.ps1`, run Prisma commands through `cmd /c npx ...`.

## Database Setup

Apply the database schema:

```powershell
cmd /c npx prisma migrate dev
```

Seed the database:

```powershell
npm run seed
```

After seeding, the demo database contains:

- 53 app users.
- 53 employee profiles.
- 4 departments.
- 6 system roles.
- 30 permissions.

To reset a local/demo database from scratch:

```powershell
cmd /c npx prisma migrate reset --force
```

This drops and reapplies migrations, regenerates Prisma Client, and runs `prisma/seed.ts`.

## Run the App

Start the backend in one terminal:

```powershell
npm run server
```

Start the frontend in another terminal:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## NPM Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite frontend on `0.0.0.0:3000`. |
| `npm run server` | Start Express/tRPC backend on `localhost:4000` by default. |
| `npm run build` | Build the frontend. |
| `npm run preview` | Preview the Vite production build. |
| `npm run lint` | Run TypeScript type-checking with `tsc --noEmit`. |
| `npm run seed` | Run Prisma seed through `npx prisma db seed`. |

## Application Routes

| Route | Purpose |
|---|---|
| `/login` | Sign in. |
| `/` | Employee dashboard/directory. |
| `/employee/$id` | Employee profile. `$id` can be an employee id or `new`. |
| `/audit` | Audit log screen. |
| `/audit-logs` | Alias for audit log screen. |
| `/admin/users` | User creation, status, role assignment, unlock, and delete/deactivate workflows. |
| `/admin/roles` | Custom role management and permission assignment. |
| `/admin/permissions` | Permission catalog management. |

## Seed Accounts

Sau khi seed database, có thể dùng các tài khoản sau để kiểm thử phân quyền:

| Email | Password | Role |
|---|---|---|
| `an.nguyen@company.vn` | `an` | `ADMIN` |
| `binh.tran@company.vn` | `binh` | `MANAGER` |
| `chau.le@company.vn` | `chau` | `REGULAR` |
| `dung.pham@company.vn` | `dung` | `HR_MANAGER` |
| `giang.vo@company.vn` | `giang` | `HR_EMPLOYEE` |
| `linh.bui@company.vn` | `linh` | `ACCOUNTING` |

Additional seeded accounts follow the convention that the password matches the email prefix before `@`:

- `nhanvien01@company.vn` to `nhanvien08@company.vn`.
- `quanly01@company.vn` to `quanly08@company.vn`.
- `nhansu01@company.vn` to `nhansu09@company.vn`.
- `quanlynhansu01@company.vn` to `quanlynhansu09@company.vn`.
- `ketoan01@company.vn` to `ketoan09@company.vn`.
- `admin02@company.vn` and `admin03@company.vn`.

Seed role counts:

```text
REGULAR=10
MANAGER=10
HR_EMPLOYEE=10
HR_MANAGER=10
ACCOUNTING=10
ADMIN=3
```

## Security Model

Hệ thống dùng mô hình bảo mật nhiều lớp:

1. UI layer: hide/show routes and actions based on the current user role.
2. API layer: protected tRPC procedures and permission checks.
3. SQL layer: SQL Server session context, stored procedures, views, RLS policies, grants/denies, and triggers.

### Application RBAC

The app has six system roles:

- `REGULAR`
- `MANAGER`
- `HR_EMPLOYEE`
- `HR_MANAGER`
- `ACCOUNTING`
- `ADMIN`

Dynamic RBAC is stored in:

```text
AppUser 1 -- 1 UserRole * -- 1 Role
Role    1 -- * RolePermission * -- 1 Permission
```

`sp_CheckPermission` handles both fixed system-role permissions and dynamic custom roles. `AppUser.roleName` is kept as a cached primary role so SQL Server RLS can read the current role through `SESSION_CONTEXT`.

### SQL Server Security Objects

Important database objects include:

- Procedures: `sp_Authenticate`, `sp_RecordLoginSuccess`, `sp_RecordLoginFailure`, `sp_CheckPermission`, `sp_UpdateEmployee`, `sp_SoftDeleteEmployee`.
- Views: `vw_EmployeeDirectory`, `vw_EmployeeWithSensitive`, `vw_PayrollSummary`, `vw_DepartmentRoster`, `vw_AuditLogDetail`.
- RLS functions/policies: `fn_EmployeeRowFilter`, `fn_SensitiveDataFilter`, `EmployeeFilterPolicy`, `SensitiveDataPolicy`.
- Native database roles: `ems_regular`, `ems_manager`, `ems_hr_employee`, `ems_hr_manager`, `ems_accounting`, `ems_admin`, `ems_app_runtime`.
- Audit triggers and update timestamp triggers on sensitive tables.

Direct human-facing SQL Server roles are denied base-table access to sensitive tables such as `AppUser`, `Employee`, `EmployeeSensitive`, and `AuditLog`. They read through curated views and execute approved procedures. The application runtime role keeps the permissions needed by the current Prisma/tRPC code paths.

### Authentication and Sessions

- Seeded and created passwords are stored as bcrypt hashes.
- Successful login issues a JWT in an HttpOnly cookie.
- The raw token is not stored in SQL Server; the database stores a SHA-256 token hash in `UserSession`.
- Failed and successful logins are written to `AuditLog`.
- Deactivating a user revokes active sessions.

### Employee Codes

Employees have a unique `employeeCode`, for example `NV-000001`.

- Existing employees are backfilled by migration `20260520000000_employee_code`.
- New employees receive the next value from SQL Server sequence `EmployeeCodeSequence`.
- The seed script resets the sequence after creating the 53 demo employees.

### What Is Not Implemented

The project does not currently implement:

- SQL Server Audit native objects such as `CREATE SERVER AUDIT`.
- TDE.
- Always Encrypted.
- Column encryption.
- SQL Server dynamic data masking.

## Admin Workflows

Log in as `an.nguyen@company.vn` / `an` for full admin access.

- `/admin/users`: create users, assign roles, unlock accounts, activate/deactivate users, and delete/deactivate accounts.
- `/admin/roles`: create and edit custom roles, delete unused custom roles, and assign/revoke permissions.
- `/admin/permissions`: create, edit, and delete unassigned permission catalog entries.

System roles are visible but protected from destructive admin edits.

## SQL Demo Scripts

The `database/` folder contains SQL Server demo helpers:

- `database/system_sql_objects.sql`: readable consolidated SQL object script for reference. It is not automatically executed by the app.
- `database/security-demo-users.sql`: creates SQL Server logins/database users for direct SQL permission demos.
- `database/security-demo-copy-run.sql`: copy-run demo sections for security proof during presentation.

Run these only against a local/demo database, not production.

## Troubleshooting

### PowerShell blocks `npx`

If you see:

```text
npx.ps1 cannot be loaded because running scripts is disabled on this system
```

Use:

```powershell
cmd /c npx prisma migrate status
cmd /c npx prisma migrate dev
cmd /c npx prisma migrate reset --force
```

### SQL Server connection fails

Check:

- SQL Server is running.
- TCP/IP is enabled in SQL Server Configuration Manager.
- Port `1433` is reachable.
- `DATABASE_URL` points to the correct server and database.
- Local development certificates may need `trustServerCertificate=true`.

### Reset fails because of RLS/security objects

SQL Server security policies and schemabound RLS functions can block table cleanup in stale local databases. For local/demo work:

- Stop the backend server so it releases database connections.
- Make sure the latest migrations are present.
- Retry `cmd /c npx prisma migrate reset --force`.
- If the database is still wedged, create a fresh local database and update `DATABASE_URL`, or manually clean only the local/demo database.

### Employee count is `0` after seed

RLS filters `Employee` and `EmployeeSensitive` rows based on SQL Server `SESSION_CONTEXT`. A raw query without role/user context can return no employee rows even when seed succeeded.

The backend uses `ctx.withSessionContext` to set:

```text
UserId
RoleName
DepartmentId
```

For verification, query through the app, use secure views with a proper context, or set an admin session context in a transaction before counting protected rows.

## Useful Verification Commands

```powershell
cmd /c npx prisma validate
cmd /c npx prisma migrate status
npm run lint
```

To verify seeded counts through an admin SQL context:

```powershell
@'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const counts = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe("EXEC sys.sp_set_session_context @key=N'RoleName', @value=N'ADMIN'");
  const [row] = await tx.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM dbo.AppUser) AS users,
      (SELECT COUNT(*) FROM dbo.Department) AS departments,
      (SELECT COUNT(*) FROM dbo.Employee) AS employees,
      (SELECT COUNT(*) FROM dbo.Role) AS roles,
      (SELECT COUNT(*) FROM dbo.Permission) AS permissions;
  `);
  return row;
});

console.log(JSON.stringify(counts));
await prisma.$disconnect();
'@ | cmd /c node --input-type=module
```
