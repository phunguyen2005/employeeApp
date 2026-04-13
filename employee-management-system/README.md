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
| alice@company.com     | alice    | `ADMIN`              |
| bob@company.com       | bob      | `MANAGER`            |
| charlie@company.com   | charlie  | `REGULAR`            |
| diana@company.com     | diana    | `HR_MANAGER`         |
| eve@company.com       | eve      | `HR_EMPLOYEE`        |
| frank@company.com     | frank    | `MANAGER`            |
| grace@company.com     | grace    | `ACCOUNTING`         |
| henry@company.com     | henry    | `REGULAR`            |

## Database Security Model

The project uses a compact database-enforced RBAC model:

- Fixed application role on `AppUser.roleName`, checked by `sp_CheckPermission`.
- Native SQL Server database roles: `ems_regular`, `ems_manager`, `ems_hr_employee`, `ems_hr_manager`, `ems_accounting`, `ems_admin`, and `ems_app_runtime`.

The separate `Role`, `Permission`, `UserRole`, and `RolePermission` tables were removed because this project uses a fixed role matrix instead of user-defined permissions.

Direct human-facing database roles are denied base-table access to sensitive tables such as `AppUser`, `Employee`, `EmployeeSensitive`, and `AuditLog`. They read through curated views such as `vw_EmployeeDirectory`, `vw_EmployeeWithSensitive`, `vw_PayrollSummary`, and `vw_AuditLogDetail`, with Row-Level Security filtering rows by `SESSION_CONTEXT`.

The `ems_app_runtime` role is intended for the application connection. It retains the permissions needed by the current Prisma/tRPC code paths while stored procedures and triggers enforce authentication lockout, soft deletes, session revocation, audit immutability, and permission checks.
