import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const employeesData = [
  { email: 'an.nguyen@company.vn', fullName: 'Nguyen Minh An', p: 'an', dob: new Date('1985-04-12'), salary: 120000, taxCode: 'MST-1001', role: 'ADMIN', dept: 'Administration' },
  { email: 'binh.tran@company.vn', fullName: 'Tran Quoc Binh', p: 'binh', dob: new Date('1982-11-05'), salary: 150000, taxCode: 'MST-1002', role: 'MANAGER', dept: 'Engineering' },
  { email: 'chau.le@company.vn', fullName: 'Le Minh Chau', p: 'chau', dob: new Date('1990-08-21'), salary: 95000, taxCode: 'MST-1003', role: 'REGULAR', dept: 'Engineering' },
  { email: 'dung.pham@company.vn', fullName: 'Pham Thuy Dung', p: 'dung', dob: new Date('1979-02-15'), salary: 110000, taxCode: 'MST-1004', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'giang.vo@company.vn', fullName: 'Vo Ha Giang', p: 'giang', dob: new Date('1993-06-30'), salary: 75000, taxCode: 'MST-1005', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'hai.do@company.vn', fullName: 'Do Thanh Hai', p: 'hai', dob: new Date('1988-09-10'), salary: 115000, taxCode: 'MST-1006', role: 'MANAGER', dept: 'Accounting' },
  { email: 'linh.bui@company.vn', fullName: 'Bui Ngoc Linh', p: 'linh', dob: new Date('1995-12-01'), salary: 80000, taxCode: 'MST-1007', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'nam.hoang@company.vn', fullName: 'Hoang Anh Nam', p: 'nam', dob: new Date('1992-03-18'), salary: 92000, taxCode: 'MST-1008', role: 'REGULAR', dept: 'Engineering' },
] as const;

const systemRoles = [
  { name: 'REGULAR', description: 'Standard employee with own-department directory access.' },
  { name: 'MANAGER', description: 'Department manager with own-department sensitive read access.' },
  { name: 'HR_EMPLOYEE', description: 'HR staff with cross-department employee management access.' },
  { name: 'HR_MANAGER', description: 'HR manager with broad employee, payroll, department, and audit access.' },
  { name: 'ACCOUNTING', description: 'Accounting user with payroll read access.' },
  { name: 'ADMIN', description: 'System administrator with full access.' },
] as const;

const permissionCatalog = [
  { resource: 'employee', action: 'read', scope: 'own_department', description: 'Read employees in the same department.' },
  { resource: 'employee', action: 'read', scope: 'all', description: 'Read employees in any department.' },
  { resource: 'employee', action: 'create', scope: 'other_department', description: 'Create employees outside own department.' },
  { resource: 'employee', action: 'create', scope: 'all', description: 'Create employees in any department.' },
  { resource: 'employee', action: 'update', scope: 'other_department', description: 'Update employees outside own department.' },
  { resource: 'employee', action: 'update', scope: 'all', description: 'Update employees in any department.' },
  { resource: 'employee', action: 'delete', scope: 'other_department', description: 'Soft delete employees outside own department.' },
  { resource: 'employee', action: 'delete', scope: 'all', description: 'Soft delete employees in any department.' },
  { resource: 'employee_sensitive', action: 'read', scope: 'own_department', description: 'Read sensitive data in the same department.' },
  { resource: 'employee_sensitive', action: 'read', scope: 'all', description: 'Read sensitive data in any department.' },
  { resource: 'employee_sensitive', action: 'update', scope: 'other_department', description: 'Update sensitive data outside own department.' },
  { resource: 'employee_sensitive', action: 'update', scope: 'all', description: 'Update sensitive data in any department.' },
  { resource: 'department', action: 'read', scope: 'all', description: 'Read department records.' },
  { resource: 'department', action: 'manage', scope: 'all', description: 'Manage department records.' },
  { resource: 'audit_log', action: 'read', scope: 'all', description: 'Read audit logs.' },
  { resource: 'user', action: 'read', scope: 'all', description: 'Read application users.' },
  { resource: 'user', action: 'create', scope: 'all', description: 'Create application users.' },
  { resource: 'user', action: 'update', scope: 'all', description: 'Update application users.' },
  { resource: 'user', action: 'delete', scope: 'all', description: 'Deactivate application users.' },
  { resource: 'user', action: 'manage', scope: 'all', description: 'Manage users and role assignments.' },
  { resource: 'role', action: 'read', scope: 'all', description: 'Read roles.' },
  { resource: 'role', action: 'create', scope: 'all', description: 'Create custom roles.' },
  { resource: 'role', action: 'update', scope: 'all', description: 'Update custom roles and role permissions.' },
  { resource: 'role', action: 'delete', scope: 'all', description: 'Delete custom roles.' },
  { resource: 'role', action: 'manage', scope: 'all', description: 'Manage roles.' },
  { resource: 'permission', action: 'read', scope: 'all', description: 'Read permission catalog entries.' },
  { resource: 'permission', action: 'create', scope: 'all', description: 'Create permission catalog entries.' },
  { resource: 'permission', action: 'update', scope: 'all', description: 'Update permission catalog entries.' },
  { resource: 'permission', action: 'delete', scope: 'all', description: 'Delete unused permission catalog entries.' },
  { resource: 'permission', action: 'manage', scope: 'all', description: 'Manage permission catalog entries.' },
] as const;

const permissionKey = (permission: { resource: string; action: string; scope: string }) =>
  `${permission.resource}.${permission.action}.${permission.scope}`;

const systemRolePermissionKeys: Record<string, string[]> = {
  REGULAR: ['employee.read.own_department', 'department.read.all'],
  MANAGER: ['employee.read.own_department', 'employee_sensitive.read.own_department', 'department.read.all'],
  HR_EMPLOYEE: [
    'employee.read.all',
    'employee.create.other_department',
    'employee.update.other_department',
    'employee.delete.other_department',
    'employee_sensitive.read.all',
    'employee_sensitive.update.other_department',
    'department.read.all',
  ],
  HR_MANAGER: [
    'employee.read.all',
    'employee.create.all',
    'employee.update.all',
    'employee.delete.all',
    'employee_sensitive.read.all',
    'employee_sensitive.update.all',
    'department.read.all',
    'department.manage.all',
    'audit_log.read.all',
  ],
  ACCOUNTING: ['employee.read.all', 'employee_sensitive.read.all', 'department.read.all'],
  ADMIN: permissionCatalog.map(permissionKey),
};

const disableSecurityForSeed = async () => {
  await prisma.$executeRawUnsafe("IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'EmployeeFilterPolicy') ALTER SECURITY POLICY [dbo].[EmployeeFilterPolicy] WITH (STATE = OFF)");
  await prisma.$executeRawUnsafe("IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SensitiveDataPolicy') ALTER SECURITY POLICY [dbo].[SensitiveDataPolicy] WITH (STATE = OFF)");
  await prisma.$executeRawUnsafe("IF OBJECT_ID(N'[dbo].[tr_AuditLog_PreventModification]', N'TR') IS NOT NULL DISABLE TRIGGER [dbo].[tr_AuditLog_PreventModification] ON [dbo].[AuditLog]");
  await prisma.$executeRawUnsafe("IF OBJECT_ID(N'[dbo].[tr_Employee_PreventHardDelete]', N'TR') IS NOT NULL DISABLE TRIGGER [dbo].[tr_Employee_PreventHardDelete] ON [dbo].[Employee]");
  await prisma.$executeRawUnsafe("IF OBJECT_ID(N'[dbo].[tr_EmployeeSensitive_AuditChanges]', N'TR') IS NOT NULL DISABLE TRIGGER [dbo].[tr_EmployeeSensitive_AuditChanges] ON [dbo].[EmployeeSensitive]");
};

const enableSecurityAfterSeed = async () => {
  await prisma.$executeRawUnsafe("IF OBJECT_ID(N'[dbo].[tr_AuditLog_PreventModification]', N'TR') IS NOT NULL ENABLE TRIGGER [dbo].[tr_AuditLog_PreventModification] ON [dbo].[AuditLog]");
  await prisma.$executeRawUnsafe("IF OBJECT_ID(N'[dbo].[tr_Employee_PreventHardDelete]', N'TR') IS NOT NULL ENABLE TRIGGER [dbo].[tr_Employee_PreventHardDelete] ON [dbo].[Employee]");
  await prisma.$executeRawUnsafe("IF OBJECT_ID(N'[dbo].[tr_EmployeeSensitive_AuditChanges]', N'TR') IS NOT NULL ENABLE TRIGGER [dbo].[tr_EmployeeSensitive_AuditChanges] ON [dbo].[EmployeeSensitive]");
  await prisma.$executeRawUnsafe("IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'EmployeeFilterPolicy') ALTER SECURITY POLICY [dbo].[EmployeeFilterPolicy] WITH (STATE = ON)");
  await prisma.$executeRawUnsafe("IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SensitiveDataPolicy') ALTER SECURITY POLICY [dbo].[SensitiveDataPolicy] WITH (STATE = ON)");
};

const seedRolesAndPermissions = async () => {
  const roles = await Promise.all(
    systemRoles.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description, isSystem: true },
        create: { name: role.name, description: role.description, isSystem: true },
      })
    )
  );

  const permissions = await Promise.all(
    permissionCatalog.map((permission) =>
      prisma.permission.upsert({
        where: {
          resource_action_scope: {
            resource: permission.resource,
            action: permission.action,
            scope: permission.scope,
          },
        },
        update: { description: permission.description },
        create: permission,
      })
    )
  );

  const roleMap = Object.fromEntries(roles.map((role) => [role.name, role.id]));
  const permissionMap = Object.fromEntries(permissions.map((permission) => [permissionKey(permission), permission.id]));

  for (const [roleName, permissionKeys] of Object.entries(systemRolePermissionKeys)) {
    const roleId = roleMap[roleName];
    if (!roleId) throw new Error(`Missing seeded role ${roleName}`);

    for (const key of permissionKeys) {
      const permissionId = permissionMap[key];
      if (!permissionId) throw new Error(`Missing seeded permission ${key}`);

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  return roleMap;
};

async function main() {
  console.log('Seeding database...');

  await disableSecurityForSeed();

  await prisma.auditLog.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.employeeSensitive.deleteMany();
  await prisma.department.updateMany({ data: { managerId: null } });
  await prisma.employee.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.department.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  const roleMap = await seedRolesAndPermissions();

  const departments = await Promise.all(
    ['Engineering', 'Human Resources', 'Accounting', 'Administration'].map((name) =>
      prisma.department.create({ data: { name } })
    )
  );

  const deptMap = Object.fromEntries(departments.map((department) => [department.name, department.id]));
  const createdEmployees: Record<string, { id: string; userId: string }> = {};

  for (const employee of employeesData) {
    const passwordHash = await bcrypt.hash(employee.p, 10);
    const appUser = await prisma.appUser.create({
      data: {
        email: employee.email,
        passwordHash,
        roleName: employee.role,
        employee: {
          create: {
            fullName: employee.fullName,
            dob: employee.dob,
            departmentId: deptMap[employee.dept],
            sensitive: {
              create: {
                salary: employee.salary,
                taxCode: employee.taxCode,
              },
            },
          },
        },
      },
      include: {
        employee: true,
      },
    });

    if (!appUser.employee) throw new Error(`Failed to create employee for ${employee.email}`);
    createdEmployees[employee.p] = { id: appUser.employee.id, userId: appUser.id };

    await prisma.userRole.create({
      data: {
        userId: appUser.id,
        roleId: roleMap[employee.role],
      },
    });
  }

  await prisma.department.update({
    where: { id: deptMap.Engineering },
    data: { managerId: createdEmployees.binh.id },
  });
  await prisma.department.update({
    where: { id: deptMap['Human Resources'] },
    data: { managerId: createdEmployees.dung.id },
  });
  await prisma.department.update({
    where: { id: deptMap.Accounting },
    data: { managerId: createdEmployees.hai.id },
  });
  await prisma.department.update({
    where: { id: deptMap.Administration },
    data: { managerId: createdEmployees.an.id },
  });

  await enableSecurityAfterSeed();

  console.log('Database seeded successfully!\n');
  console.log('Login Credentials:');
  console.log('-----------------------------------------------------------');
  console.log('| Email                 | Password | Role                 |');
  console.log('-----------------------------------------------------------');
  for (const emp of employeesData) {
    console.log(`| ${emp.email.padEnd(21)} | ${emp.p.padEnd(8)} | ${emp.role.padEnd(20)} |`);
  }
  console.log('-----------------------------------------------------------');
}

main()
  .catch(async (e) => {
    console.error(e);
    await enableSecurityAfterSeed().catch(() => undefined);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
