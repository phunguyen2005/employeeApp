import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const employeesData = [
  { email: 'alice@company.com', fullName: 'Alice Admin', p: 'alice', dob: new Date('1985-04-12'), salary: 120000, taxCode: 'TX-1001', role: 'ADMIN', dept: 'Administration' },
  { email: 'bob@company.com', fullName: 'Bob Manager', p: 'bob', dob: new Date('1982-11-05'), salary: 150000, taxCode: 'TX-1002', role: 'MANAGER', dept: 'Engineering' },
  { email: 'charlie@company.com', fullName: 'Charlie Dev', p: 'charlie', dob: new Date('1990-08-21'), salary: 95000, taxCode: 'TX-1003', role: 'REGULAR', dept: 'Engineering' },
  { email: 'diana@company.com', fullName: 'Diana HR Mgr', p: 'diana', dob: new Date('1979-02-15'), salary: 110000, taxCode: 'TX-1004', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'eve@company.com', fullName: 'Eve HR', p: 'eve', dob: new Date('1993-06-30'), salary: 75000, taxCode: 'TX-1005', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'frank@company.com', fullName: 'Frank Acc Mgr', p: 'frank', dob: new Date('1988-09-10'), salary: 115000, taxCode: 'TX-1006', role: 'MANAGER', dept: 'Accounting' },
  { email: 'grace@company.com', fullName: 'Grace Acc', p: 'grace', dob: new Date('1995-12-01'), salary: 80000, taxCode: 'TX-1007', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'henry@company.com', fullName: 'Henry Dev', p: 'henry', dob: new Date('1992-03-18'), salary: 92000, taxCode: 'TX-1008', role: 'REGULAR', dept: 'Engineering' },
] as const;

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

async function main() {
  console.log('Seeding database...');

  await disableSecurityForSeed();

  await prisma.auditLog.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.employeeSensitive.deleteMany();
  await prisma.department.updateMany({ data: { managerId: null } });
  await prisma.employee.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.department.deleteMany();

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
  }

  await prisma.department.update({
    where: { id: deptMap.Engineering },
    data: { managerId: createdEmployees.bob.id },
  });
  await prisma.department.update({
    where: { id: deptMap['Human Resources'] },
    data: { managerId: createdEmployees.diana.id },
  });
  await prisma.department.update({
    where: { id: deptMap.Accounting },
    data: { managerId: createdEmployees.frank.id },
  });
  await prisma.department.update({
    where: { id: deptMap.Administration },
    data: { managerId: createdEmployees.alice.id },
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
