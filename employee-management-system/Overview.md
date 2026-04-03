# Employee Management System — Comprehensive System Flow Analysis

---

## 1. System Overview

### Main Goal
A **full-stack SaaS Employee Management System** designed to manage employee records with **enterprise-grade data security** through multi-level Role-Based Access Control (RBAC), complete audit trails, and department-based organizational structure.

### Target Users (6 Roles)
| Role | Description | Scope |
|------|-------------|-------|
| **ADMIN** | System administrator | Full access to all data and operations |
| **HR_MANAGER** | HR department lead | Company-wide employee management + audit logs |
| **HR_EMPLOYEE** | HR staff member | Company-wide management (restricted in own department) |
| **MANAGER** | Department manager | Read-only, own department only, full field visibility |
| **ACCOUNTING** | Finance/payroll staff | Company-wide but limited to financial fields (salary, taxCode) |
| **REGULAR** | Standard employee | Read-only, own department only, sensitive fields hidden |

### Core Functionalities
1. **Authentication** — JWT-based login/logout with HttpOnly cookies
2. **Employee CRUD** — Create, read, update, delete employee records (role-restricted)
3. **Row-Level Security** — Database query filtering by department membership
4. **Column-Level Masking** — Sensitive field hiding based on role + department relationship
5. **Audit Logging** — Immutable trail of all CREATE/UPDATE/DELETE operations
6. **Department Management** — Organizational grouping with manager assignments

### Tech Stack
- **Frontend**: React 19 + TanStack Router + TanStack React Query + Tailwind CSS 4
- **Backend**: Express.js + tRPC (type-safe RPC)
- **Database**: SQL Server via Prisma ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs + HttpOnly cookies
- **Validation**: Zod schemas
- **Build**: Vite (frontend on :3000, backend on :4000)

---

## 2. Project Structure Breakdown

### Directory Layout
```
employee-management-system/
├── prisma/
│   ├── schema.prisma                    # Database models (Employee, Department, AuditLog)
│   ├── seed.ts                          # 8 test users + 4 departments
│   └── migrations/
│       └── 20260331043015_add_password_field/
│           └── migration.sql            # SQL Server DDL
├── src/
│   ├── main.tsx                         # React entry point
│   ├── App.tsx                          # Provider hierarchy (tRPC > QueryClient > AppContext > Router)
│   ├── router.tsx                       # TanStack Router route tree
│   ├── types.ts                         # Shared TypeScript types (Role, Employee, Department, AuditLog)
│   ├── index.css                        # Tailwind imports
│   ├── components/
│   │   └── Layout.tsx                   # Auth guard + sidebar + header + logout
│   ├── pages/
│   │   ├── Login.tsx                    # Public login form
│   │   ├── Dashboard.tsx                # Employee list with search/filter
│   │   ├── EmployeeProfile.tsx          # Create/view/edit/delete employee
│   │   └── AuditLogs.tsx               # Audit trail viewer (ADMIN/HR_MANAGER only)
│   ├── context/
│   │   └── AppContext.tsx               # React Context: currentUser state
│   ├── lib/
│   │   ├── trpc.ts                      # tRPC client setup (httpBatchLink to :4000)
│   │   ├── rbac.ts                      # Frontend RBAC helper functions
│   │   └── utils.ts                     # cn() for Tailwind, formatCurrency()
│   └── server/
│       ├── index.ts                     # Express server: CORS, cookieParser, tRPC middleware
│       ├── context.ts                   # JWT extraction/verification → UserContext
│       ├── trpc.ts                      # tRPC init, isAuthed middleware, protectedProcedure
│       ├── routers/
│       │   ├── appRouter.ts             # Aggregates: auth, employee, department, audit
│       │   ├── authRouter.ts            # login (public), session, logout
│       │   ├── employeeRouter.ts        # getAll, getById, create, update, delete
│       │   ├── departmentRouter.ts      # getAll
│       │   └── auditRouter.ts           # getAll (ADMIN/HR_MANAGER only)
│       └── utils/
│           └── rbac.ts                  # Server RBAC: applyColumnMasking, getRowLevelFilter
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .env / .env.example
└── metadata.json
```

### Frontend Architecture
- **Routing**: TanStack Router with 4 routes:
  - `/login` — Public, no layout wrapper
  - `/` — Dashboard (protected, inside auth layout)
  - `/employee/$id` — Employee profile ($id = UUID or "new")
  - `/audit` — Audit logs (protected, ADMIN/HR_MANAGER only)
- **State**: React Context (currentUser) + React Query (server state cache)
- **API Layer**: tRPC React Query hooks (type-safe, auto-generated from server types)

### Backend Architecture
- **Server**: Express on port 4000 with CORS + cookie-parser
- **API**: tRPC mounted at `/trpc`, all procedures type-safe with Zod validation
- **Middleware Chain**: CORS → cookieParser → tRPC (context creation → auth check → procedure)
- **RBAC Engine**: Two-layer — row-level filter (Prisma WHERE clause) + column-level masking (field stripping)

### Database Design (3 tables)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Department   │       │   Employee   │       │   AuditLog   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK, UUID)│◄──┐   │ id (PK, UUID)│◄──┐   │ id (PK, UUID)│
│ name (unique)│   │   │ fullName     │   │   │ timestamp    │
│ managerId(FK)│───┘   │ dob          │   │   │ actorId (FK) │──► Employee
│ createdAt    │       │ email(unique)│   │   │ actorName    │
│ updatedAt    │       │ password     │   │   │ targetId(FK) │──► Employee
└──────────────┘       │ salary       │   │   │ targetName   │
       │               │ taxCode      │   │   │ action       │
       │ 1:N           │ role         │   │   │ changes(JSON)│
       └──────────────►│ departmentId │   │   │ createdAt    │
                       │ createdAt    │   │   └──────────────┘
                       │ updatedAt    │   │          │
                       └──────────────┘   │     actorId, targetId
                              │           └──── both FK to Employee
                              │
                       1 Employee : 1 managedDepartment (optional)
                       1 Department : N Employees
                       1 Employee : N AuditLogs (as actor or target)
```

**Relationships**:
- Department → Employee (managerId): One-to-one (each dept has at most 1 manager)
- Department ← Employee (departmentId): One-to-many (many employees per dept)
- Employee ← AuditLog (actorId): One-to-many (one user performs many actions)
- Employee ← AuditLog (targetId): One-to-many (one user can be target of many actions)
- All foreign keys use `onDelete: NoAction` to prevent cascading (manual cleanup in delete procedure)

---

## 3. Detailed Functional Flows

### 3.1 Authentication Flow

#### Login
```
User Action:     Enter email + password on /login page
     │
     ▼
Frontend:        trpc.auth.login.mutate({ email, password })
     │
     ▼
Express:         CORS check → cookieParser → tRPC createContext (no auth needed — public)
     │
     ▼
authRouter:      1. prisma.employee.findUnique({ where: { email } })
                 2. If not found → throw "Invalid email or password"
                 3. bcrypt.compare(password, employee.password)
                 4. If mismatch → throw "Invalid email or password"
                 5. jwt.sign({ id, role, departmentId, fullName }, secret, { expiresIn: '7d' })
                 6. res.cookie('token', jwt, { httpOnly, secure, sameSite: 'lax', maxAge: 7d })
     │
     ▼
Frontend:        1. setCurrentUser(response.user) in AppContext
                 2. navigate({ to: '/' })
```

#### Session Restore (Page Reload)
```
Layout mount:    trpc.auth.session.useQuery()
     │
     ▼
Context:         Extract JWT from cookie → verify → return { id, fullName, role, departmentId }
     │
     ▼
Layout:          If user exists → setCurrentUser, render children
                 If no user → navigate to /login
```

#### Logout
```
User Action:     Click "Sign Out" in header
     │
     ▼
Frontend:        trpc.auth.logout.mutate()
     │
     ▼
authRouter:      res.clearCookie('token')
     │
     ▼
Frontend:        1. setCurrentUser(null)
                 2. queryClient.clear() (wipe React Query cache)
                 3. navigate({ to: '/login' })
```

---

### 3.2 Employee Management Flow (CRUD)

#### READ — List All Employees (Dashboard)
```
User Action:     Navigate to / (Dashboard)
     │
     ▼
Frontend:        trpc.employee.getAll.useQuery() + trpc.department.getAll.useQuery()
     │
     ▼
employeeRouter:  1. getRowLevelFilter(ctx.user)
                    - REGULAR/MANAGER → { departmentId: user.departmentId }
                    - HR/ACCOUNTING/ADMIN → {} (no filter)
                 2. prisma.employee.findMany({ where: filter, include: { department } })
                 3. For each employee:
                    - Strip password field
                    - applyColumnMasking(ctx.user, employee)
     │
     ▼
Column Masking:  Based on role + same/different department:
                 ┌──────────────┬─────────────────┬──────────────────────┐
                 │ Role         │ Same Department  │ Different Department │
                 ├──────────────┼─────────────────┼──────────────────────┤
                 │ REGULAR      │ Hide salary,tax │ N/A (row-filtered)   │
                 │ MANAGER      │ Show all        │ N/A (row-filtered)   │
                 │ HR_EMPLOYEE  │ Hide salary,tax │ Show all             │
                 │ HR_MANAGER   │ Show all        │ Show all             │
                 │ ACCOUNTING   │ Hide salary,tax │ Show ONLY id,salary, │
                 │              │                 │ taxCode              │
                 │ ADMIN        │ Show all        │ Show all             │
                 └──────────────┴─────────────────┴──────────────────────┘
     │
     ▼
Frontend:        1. Client-side filters: searchTerm, deptFilter, roleFilter
                 2. canViewEmployee() check per row
                 3. getVisibleFields() determines which columns render
                 4. Render table with masked data
```

#### READ — Single Employee (Profile)
```
User Action:     Click employee row → /employee/{id}
     │
     ▼
Frontend:        trpc.employee.getById.useQuery({ id })
     │
     ▼
employeeRouter:  1. getRowLevelFilter(ctx.user) + { id }
                 2. prisma.employee.findFirst({ where: combined_filter })
                 3. If not found → throw NOT_FOUND
                 4. applyColumnMasking(ctx.user, employee)
     │
     ▼
Frontend:        1. Display form fields based on getVisibleFields()
                 2. Show Edit button if canEditEmployee(currentUser, target)
                 3. Show Delete button if canCreateDeleteEmployee(currentUser)
```

#### CREATE — New Employee
```
User Action:     Click "New Employee" (visible if canCreateDeleteEmployee) → /employee/new
     │
     ▼
Frontend:        Fill form → submit → trpc.employee.create.mutate(formData)
     │
     ▼
employeeRouter:  1. Permission check:
                    - REGULAR, MANAGER, ACCOUNTING → throw FORBIDDEN
                    - HR_EMPLOYEE + target in own dept → throw FORBIDDEN
                    - HR_EMPLOYEE (other dept), HR_MANAGER, ADMIN → allowed
                 2. bcrypt.hash(password, 10)
                 3. prisma.employee.create({ data: { ...input, password: hashed } })
                 4. prisma.auditLog.create({
                      actorId, actorName, targetId: new.id, targetName: new.fullName,
                      action: 'CREATE', changes: 'Created employee record'
                    })
                 5. Return masked employee
     │
     ▼
Frontend:        1. Invalidate employee.getAll cache
                 2. Navigate to /employee/{newId}
```

#### UPDATE — Edit Employee
```
User Action:     Click Edit → modify fields → Save
     │
     ▼
Frontend:        trpc.employee.update.mutate({ id, data: changedFields })
     │
     ▼
employeeRouter:  1. Self-edit check: ctx.user.id === id → throw FORBIDDEN
                 2. Permission check (same as create):
                    - REGULAR, MANAGER, ACCOUNTING → FORBIDDEN
                    - HR_EMPLOYEE + same dept → FORBIDDEN
                 3. Fetch original employee for diff
                 4. Compute changes: JSON diff of old vs new values
                 5. prisma.employee.update({ where: { id }, data })
                 6. prisma.auditLog.create({
                      actorId, actorName, targetId, targetName,
                      action: 'UPDATE', changes: JSON.stringify(diff)
                    })
                 7. Return masked updated employee
     │
     ▼
Frontend:        1. Invalidate employee.getAll + employee.getById caches
                 2. Show updated data
```

#### DELETE — Remove Employee
```
User Action:     Click Delete → confirm
     │
     ▼
Frontend:        trpc.employee.delete.mutate({ id })
     │
     ▼
employeeRouter:  1. Self-delete check: ctx.user.id === id → FORBIDDEN
                 2. Permission check (same as create/update)
                 3. Prisma transaction:
                    a. UPDATE departments SET managerId=null WHERE managerId=targetId
                    b. DELETE auditLogs WHERE actorId=targetId OR targetId=targetId
                    c. DELETE employee WHERE id=targetId
                 4. Return { success: true }
     │
     ▼
Frontend:        1. Invalidate employee.getAll cache
                 2. Navigate to / (Dashboard)
```

---

### 3.3 Audit Log Module

```
User Action:     Navigate to /audit (link visible only if canViewAuditLogs)
     │
     ▼
Frontend:        1. canViewAuditLogs(currentUser) check
                 2. If false → "You do not have permission" message
                 3. If true → trpc.audit.getAll.useQuery()
     │
     ▼
auditRouter:     1. Role check: only ADMIN, HR_MANAGER → others get FORBIDDEN
                 2. prisma.auditLog.findMany({
                      orderBy: { timestamp: 'desc' },
                      include: { actor, target }
                    })
     │
     ▼
Frontend:        Render table with:
                 - Color-coded action badges (CREATE=green, UPDATE=blue, DELETE=red)
                 - Actor name/ID (who did it)
                 - Target name/ID (who was affected)
                 - Changes JSON
                 - Timestamp (locale-formatted)
```

---

### 3.4 Department Module

```
Frontend:        trpc.department.getAll.useQuery()
     │
     ▼
departmentRouter: prisma.department.findMany() — no filtering, all users see all departments
     │
     ▼
Usage:           - Dashboard: department filter dropdown
                 - EmployeeProfile: department selector in create/edit form
```

---

## 4. End-to-End System Flow (Full Picture)

### Complete User Journey

```
                         ┌─────────────────┐
                         │   User Opens App │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Layout Mount    │
                         │  Check Session   │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              No valid JWT                Valid JWT found
                    │                           │
           ┌────────▼────────┐         ┌────────▼────────┐
           │  Redirect to    │         │  Set currentUser │
           │  /login         │         │  Show Dashboard  │
           └────────┬────────┘         └────────┬────────┘
                    │                           │
           ┌────────▼────────┐                  │
           │  Enter Email &  │                  │
           │  Password       │                  │
           └────────┬────────┘                  │
                    │                           │
           ┌────────▼────────┐                  │
           │  Server: Verify │                  │
           │  bcrypt + JWT   │                  │
           └────────┬────────┘                  │
                    │                           │
              Set HttpOnly Cookie               │
                    │                           │
           ┌────────▼──────────────────────────▼┐
           │            DASHBOARD                │
           │  ┌─────────────────────────────┐   │
           │  │ Row-Level Filter (DB query)  │   │
           │  │ Column-Level Masking         │   │
           │  │ Client-side Search/Filter    │   │
           │  └─────────────────────────────┘   │
           └───────────┬───────────┬────────────┘
                       │           │
          ┌────────────▼──┐   ┌───▼─────────────┐
          │ View Employee │   │ Create Employee  │
          │ /employee/:id │   │ /employee/new    │
          └───────┬───────┘   │ (HR/ADMIN only)  │
                  │           └───────┬──────────┘
         ┌────────┴────────┐          │
         │                 │          │
    ┌────▼─────┐    ┌──────▼───┐  ┌───▼───────────┐
    │  Edit    │    │  Delete  │  │  Fill Form +  │
    │  (if     │    │  (if     │  │  Submit       │
    │  allowed)│    │  allowed)│  └───────┬───────┘
    └────┬─────┘    └────┬─────┘          │
         │               │               │
         ▼               ▼               ▼
    ┌─────────────────────────────────────────┐
    │         AUDIT LOG CREATED               │
    │  { actor, target, action, changes }     │
    └─────────────────────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────┐
    │      AUDIT LOGS PAGE (/audit)           │
    │      (ADMIN + HR_MANAGER only)          │
    │      View all system changes            │
    └─────────────────────────────────────────┘
```

### Cross-Module Interactions

```
Authentication ──► provides UserContext (id, role, departmentId) to ALL modules
       │
       ├──► Employee Module uses UserContext for:
       │         ├── Row-level filtering (which employees to query)
       │         ├── Column-level masking (which fields to show)
       │         ├── Write permission checks (can create/edit/delete?)
       │         └── Self-edit prevention (cannot modify own record)
       │
       ├──► Department Module uses UserContext for:
       │         └── No filtering (all departments visible to all)
       │
       ├──► Audit Module uses UserContext for:
       │         └── Access restriction (ADMIN/HR_MANAGER only)
       │
       └──► Layout uses UserContext for:
                 ├── Navigation items (show/hide Audit Logs link)
                 ├── User info display in header
                 └── Auth guard (redirect to login if missing)

Employee Module ──► writes to ──► Audit Log (on every CREATE/UPDATE/DELETE)
Department Module ──► read by ──► Employee Module (filter dropdown, dept assignment)
Employee Module ──► referenced by ──► Department Module (managerId FK)
```

### Security Layers (Request Pipeline)

```
HTTP Request
  │
  ▼
[1] CORS Check ─── Only allows configured origin + credentials
  │
  ▼
[2] Cookie Parser ─── Extracts 'token' cookie
  │
  ▼
[3] tRPC Context ─── JWT verification → UserContext { id, role, departmentId, fullName }
  │
  ▼
[4] isAuthed Middleware ─── Rejects if no valid user (public procedures skip this)
  │
  ▼
[5] Procedure Logic ─── Role-based permission checks (inline in each procedure)
  │
  ▼
[6] Row-Level Filter ─── Prisma WHERE clause restricts visible data
  │
  ▼
[7] Column Masking ─── Strips sensitive fields before response
  │
  ▼
[8] Audit Logging ─── Records mutation details (write operations only)
  │
  ▼
HTTP Response (masked data only)
```

### Seed Data Summary (Test Users)

| Login | Role | Department | Can See | Can Edit/Create/Delete |
|-------|------|------------|---------|------------------------|
| alice@company.com / alice | ADMIN | Administration | All employees, all fields | Yes — anyone |
| diana@company.com / diana | HR_MANAGER | Human Resources | All employees, all fields | Yes — anyone + audit logs |
| eve@company.com / eve | HR_EMPLOYEE | Human Resources | All employees (masked in own dept) | Yes — outside own dept only |
| bob@company.com / bob | MANAGER | Engineering | Own dept only, all fields | No |
| frank@company.com / frank | MANAGER | Accounting | Own dept only, all fields | No |
| grace@company.com / grace | ACCOUNTING | Accounting | All employees (only financial fields cross-dept) | No |
| charlie@company.com / charlie | REGULAR | Engineering | Own dept only, salary/tax hidden | No |
| henry@company.com / henry | REGULAR | Engineering | Own dept only, salary/tax hidden | No |
