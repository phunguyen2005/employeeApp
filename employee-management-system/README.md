# Employee Management System

A full-stack Human Resource Management (HRM) application built using React (Vite), Node.js, tRPC, Prisma, and SQL Server, with a focus on data security and role-based access control.

## Prerequisites

- **Node.js** (v18+ recommended)
- **SQL Server** (running locally or remotely)
- **Git**

## Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/phunguyen2005/employeeApp.git
   cd employeeApp/employee-management-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Copy the `.env.example` file and rename it to `.env`.
   - Open `.env` and configure your `DATABASE_URL` to point to your SQL Server instance, and customize `JWT_SECRET` if needed.
   - *Ensure your SQL Server has TCP/IP connections enabled (usually on port 1433).*

4. **Initialize the Database:**
   - Run the following command to apply the database schema via Prisma:
     ```bash
     npx prisma migrate dev
     ```
   - Seed the database with the initial departments and employee accounts:
     ```bash
     npm run seed
     ```

## Running the Application

This project requires both the frontend client and the backend server to be running simultaneously.

1. **Start the Backend Server** (in one terminal tab):
   ```bash
   npm run server
   ```

2. **Start the Frontend Development Server** (in a second terminal tab):
   ```bash
   npm run dev
   ```

Navigate to `http://localhost:3000` in your web browser to view the application!

---

## Default Login Credentials

After securely seeding the database, you can log in to test different access privileges using the following credentials:

| Email                 | Password | Role                 |
|-----------------------|----------|----------------------|
| an.nguyen@company.vn  | an       | `ADMIN`              |
| binh.tran@company.vn  | binh     | `MANAGER`            |
| chau.le@company.vn    | chau     | `REGULAR`            |
| dung.pham@company.vn  | dung     | `HR_MANAGER`         |
| giang.vo@company.vn   | giang    | `HR_EMPLOYEE`        |
| hai.do@company.vn     | hai      | `MANAGER`            |
| linh.bui@company.vn   | linh     | `ACCOUNTING`         |
| nam.hoang@company.vn  | nam      | `REGULAR`            |

## Database Security Model

The project uses a hybrid database-enforced RBAC model:

- Six immutable system roles remain in `AppUser.roleName` for SQL Server roles, RLS predicates, and the existing fixed permission fast path.
- Dynamic `Role`, `Permission`, `UserRole`, and `RolePermission` tables make roles and permission assignments visible and editable through the application.
- Native SQL Server database roles: `ems_regular`, `ems_manager`, `ems_hr_employee`, `ems_hr_manager`, `ems_accounting`, `ems_admin`, and `ems_app_runtime`.

`sp_CheckPermission` first keeps the system-role behavior stable. If a user has a custom non-system role, the procedure resolves access through `UserRole -> RolePermission -> Permission`. `AppUser.roleName` is retained as a denormalized cache so the native SQL Server security layer can still receive the current role through `SESSION_CONTEXT`.

Direct human-facing database roles are denied base-table access to sensitive tables such as `AppUser`, `Employee`, `EmployeeSensitive`, and `AuditLog`. They read through curated views such as `vw_EmployeeDirectory`, `vw_EmployeeWithSensitive`, `vw_PayrollSummary`, and `vw_AuditLogDetail`, with Row-Level Security filtering rows by `SESSION_CONTEXT`.

The `ems_app_runtime` role is intended for the application connection. It retains the permissions needed by the current Prisma/tRPC code paths while stored procedures and triggers enforce authentication lockout, soft deletes, session revocation, audit immutability, and permission checks.

### Admin Role Management

Log in as `an.nguyen@company.vn` / `an`, then open:

- `/admin/users` to create users, assign roles, unlock accounts, and deactivate access.
- `/admin/roles` to create custom roles and assign or revoke permissions. System roles are visible but locked.
- `/admin/permissions` to maintain the permission catalog.

The RBAC tables are:

```text
AppUser 1 -- 1 UserRole * -- 1 Role
Role    1 -- * RolePermission * -- 1 Permission
```

Login success and failed-login attempts are written to `AuditLog` as `LOGIN_SUCCESS` and `LOGIN_FAILURE`, so they appear in `/audit`.
