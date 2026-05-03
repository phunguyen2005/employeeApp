# Employee Management System - Current System Flow Analysis

This document reflects the current implementation in the React frontend, tRPC/Express backend, Prisma schema, and SQL migration layer.

## 1. System Overview

### Business objective
The Employee Management System (EMS) is a secure HR platform for:
- Employee directory and profile management
- Department-based organization
- Payroll-sensitive data handling
- Governance through users, roles, and permissions
- Auditability of critical actions

### Core design principle
Security is enforced in multiple layers:
1. UI layer: route visibility and action visibility
2. API layer: protected procedures + permission checks
3. SQL layer: session context, stored procedures, row-level security (RLS), and immutable audit behavior

## 2. Architecture Snapshot

### Frontend (React + TanStack)
- Routing:
  - `/login`
  - `/`
  - `/employee/$id` (`$id` can be UUID or `new`)
  - `/audit`
  - `/audit-logs` (alias route)
  - `/admin/users`
  - `/admin/roles`
  - `/admin/permissions`
- App state:
  - `AppContext` holds `currentUser`
  - React Query caches server data
- API client:
  - tRPC + `httpBatchLink`
  - Cookie credentials are included for auth

### Backend (Express + tRPC)
- tRPC endpoint: `/trpc`
- Router modules:
  - `auth`
  - `employee`
  - `department`
  - `audit`
  - `user`
  - `role`
  - `permission`
- Request context:
  - Resolves authenticated user from JWT + `UserSession`
  - Exposes `withSessionContext` transaction helper

### Database (SQL Server + Prisma)
- Application tables include:
  - Identity/session: `AppUser`, `UserSession`
  - Core HR: `Employee`, `EmployeeSensitive`, `Department`
  - Governance: `Role`, `Permission`, `UserRole`, `RolePermission`
  - Compliance: `AuditLog`
- Security database objects include:
  - Procedures: `sp_Authenticate`, `sp_RecordLoginSuccess`, `sp_RecordLoginFailure`, `sp_CheckPermission`, `sp_UpdateEmployee`, `sp_SoftDeleteEmployee`
  - Views: `vw_EmployeeDirectory`, `vw_EmployeeWithSensitive`, `vw_PayrollSummary`, `vw_DepartmentRoster`, `vw_AuditLogDetail`
  - RLS/policies: `fn_EmployeeRowFilter`, `fn_SensitiveDataFilter`, `EmployeeFilterPolicy`, `SensitiveDataPolicy`

## 3. Current Access Model

### System roles
- `REGULAR`
- `MANAGER`
- `HR_EMPLOYEE`
- `HR_MANAGER`
- `ACCOUNTING`
- `ADMIN`

### Dynamic RBAC support
The system also supports custom roles through:
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`

`sp_CheckPermission` uses:
1. Fast path for system roles
2. Dynamic lookup path for non-system roles

`AppUser.roleName` is kept as a synced role cache (trigger-assisted) so SQL session context and native role-based behavior remain consistent.

## 4. End-to-End Workflows

### 4.1 Login workflow
1. User submits email and password from `/login`.
2. `auth.login` calls `sp_Authenticate` to retrieve auth status and password hash metadata.
3. Backend verifies password with `bcrypt.compare`.
4. On failure:
   - `sp_RecordLoginFailure` increments failure counters
   - account may be temporarily locked
   - audit event is written
5. On success:
   - JWT is signed with payload `{ userId }` and 7-day expiry
   - token hash is persisted by `sp_RecordLoginSuccess`
   - response sets HttpOnly `token` cookie

### 4.2 Session restore and logout
Session restore:
1. Layout requests `auth.session`.
2. Context verifies JWT and checks active, non-revoked `UserSession`.
3. If valid, user profile is loaded and rendered.

Logout:
1. Frontend calls `auth.logout`.
2. Backend revokes current token hash in `UserSession`.
3. Cookie is cleared.
4. Frontend clears query cache and returns to login.

### 4.3 Protected request flow with SQL session context
1. Protected tRPC procedure receives request.
2. `withSessionContext` starts a DB transaction.
3. Session values are pushed into SQL `SESSION_CONTEXT` (`UserId`, `RoleName`, `DepartmentId`).
4. Permission checks call `sp_CheckPermission` via `assertPermission`.
5. SQL views/procedures/RLS execute with that context.

### 4.4 Employee read workflow (list and profile)
1. Frontend calls `employee.getAll` or `employee.getById`.
2. Backend requires `employee.read` permission.
3. Data is read from `vw_EmployeeWithSensitive`.
4. SQL-level policies and grants determine row/field visibility by role/context.
5. Backend normalizes payload (dates, numeric salary, role fallback).
6. Frontend applies UI-level display helpers and filters.

### 4.5 Employee create workflow
1. User submits create form from `/employee/new`.
2. Backend computes department scope (`own_department` or `other_department`).
3. Backend checks `employee.create` permission for that scope.
4. Backend creates:
   - `AppUser` (with `passwordHash`)
   - `Employee`
   - `EmployeeSensitive`
5. Audit record is inserted.
6. Created record is returned through secure employee view.

### 4.6 Employee update workflow
1. User submits update from profile page.
2. Self-edit is blocked.
3. Backend checks:
   - `employee.update` for profile-level fields
   - `employee_sensitive.update` for salary/tax updates
4. `sp_UpdateEmployee` handles employee core-field updates and audit payload generation.
5. Email changes are handled on `AppUser` and separately audited.
6. Sensitive updates are persisted in `EmployeeSensitive`.
7. Updated employee data is returned from secure view.

### 4.7 Employee delete workflow (soft delete)
1. User requests delete from profile page.
2. Self-delete is blocked.
3. Backend checks `employee.delete` permission for scope.
4. Backend executes `sp_SoftDeleteEmployee`.
5. Procedure performs a transactional soft-delete sequence:
   - marks employee as terminated
   - deactivates app account
   - clears department manager references where needed
   - revokes active sessions
   - writes delete audit log

### 4.8 Audit workflow
1. UI checks if current user can access audit logs.
2. Backend endpoint `audit.getAll` requires `audit_log.read.all`.
3. Data is loaded from `vw_AuditLogDetail` (enriched actor/target names).
4. Logs are returned in descending timestamp order.

### 4.9 User administration workflow (`/admin/users`)
1. List users and account status.
2. Create user:
   - create `AppUser`
   - create `Employee` + `EmployeeSensitive`
   - assign one role in `UserRole`
   - audit create event
3. Assign role:
   - replace `UserRole` assignment
   - update cached `AppUser.roleName`
   - audit update event
4. Activate/deactivate and unlock account:
   - updates lock/failure counters
   - revokes active sessions when deactivating
5. Delete user:
   - soft-deletes employee if linked
   - otherwise deactivates account
   - writes audit event

### 4.10 Role administration workflow (`/admin/roles`)
1. List roles with permission counts and user counts.
2. Create custom role.
3. Update custom role metadata.
4. Delete custom role (blocked if still assigned to users).
5. Assign/revoke permissions on custom role.
6. System roles are immutable.

### 4.11 Permission administration workflow (`/admin/permissions`)
1. List permission catalog entries.
2. Create permission keys (`resource.action.scope`).
3. Update permission metadata/key.
4. Delete permission (blocked if assigned to any role).
5. Key edits are blocked when permission is attached to system roles.

## 5. Step-by-Step User Role Behavior

### REGULAR
1. Sign in.
2. View permitted directory data.
3. Open employee profile in read-only mode.
4. No create/update/delete operations.
5. No admin module access.

### MANAGER
1. Sign in.
2. View employee data under manager-access rules.
3. Read-only behavior for employee operations.
4. No admin module access.

### HR_EMPLOYEE
1. Sign in.
2. View cross-department employee data by granted scope.
3. Create/update/delete permitted targets based on department scope rules.
4. No default admin module access.

### HR_MANAGER
1. Sign in.
2. Full employee lifecycle access.
3. Access audit logs.
4. No default admin module access in UI navigation.

### ACCOUNTING
1. Sign in.
2. View payroll-relevant records under granted permissions.
3. Read-only for employee lifecycle actions.
4. No admin module access.

### ADMIN
1. Sign in.
2. Full employee lifecycle access.
3. Access audit logs.
4. Full access to user, role, and permission administration screens.

## 6. Interaction Between Components

### UI to API
- User clicks on page action -> tRPC query/mutation -> Express/tRPC router

### API to DB
- Protected procedure -> `withSessionContext` -> permission check -> SQL view/procedure/table operations

### DB back to UI
- Response payload -> React Query cache -> page render updates

### Governance interactions
- `user.assignRole` updates `UserRole` and `AppUser.roleName`
- Role/permission changes affect subsequent `sp_CheckPermission` results
- Audit log captures identity and change metadata for sensitive operations

## 7. Data Flow and Key Operations

### Authentication data flow
- Inputs: email/password
- Security operations: account status check, hash compare, token issue, session insert/revoke
- Outputs: user session state + cookie

### Employee data flow
- Inputs: profile/sensitive fields
- Security operations: scoped permission checks + stored procedure enforcement
- Outputs: normalized employee payload from secure views

### Audit data flow
- Inputs: actor + action + target + before/after values
- Security operations: append-only intent (trigger blocks updates/deletes)
- Outputs: compliance timeline through `vw_AuditLogDetail`

### RBAC data flow
- Inputs: user role assignment + permission catalog + role-permission links
- Security operations: `sp_CheckPermission` resolution (system or dynamic)
- Outputs: allow/deny decisions used by every protected operation

## 8. Current Implementation Notes

1. Backend authorization is dynamic-capable; frontend admin navigation is still statically shown for `ADMIN`.
2. The final enforcement source of truth is the backend + SQL layer, not frontend visibility helpers.
3. Employee reads are currently SQL-view-driven, not Prisma row-filter and column-mask utility functions.
4. User and role governance are fully integrated into the current route tree and API surface.
