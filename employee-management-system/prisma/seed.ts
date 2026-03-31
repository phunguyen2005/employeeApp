import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  await prisma.auditLog.deleteMany();
  await prisma.department.updateMany({ data: { managerId: null } });
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  // Helpers to hash
  const getHash = async (pw: string) => await bcrypt.hash(pw, 10);

  const employeesData = [
    { email: 'alice@company.com', fullName: 'Alice Admin', p: 'alice', dob: new Date('1985-04-12'), salary: 120000, taxCode: 'TX-1001', role: 'ADMIN', dept: 'Administration' },
    { email: 'bob@company.com', fullName: 'Bob Manager', p: 'bob', dob: new Date('1982-11-05'), salary: 150000, taxCode: 'TX-1002', role: 'MANAGER', dept: 'Engineering' },
    { email: 'charlie@company.com', fullName: 'Charlie Dev', p: 'charlie', dob: new Date('1990-08-21'), salary: 95000, taxCode: 'TX-1003', role: 'REGULAR', dept: 'Engineering' },
    { email: 'diana@company.com', fullName: 'Diana HR Mgr', p: 'diana', dob: new Date('1979-02-15'), salary: 110000, taxCode: 'TX-1004', role: 'HR_MANAGER', dept: 'Human Resources' },
    { email: 'eve@company.com', fullName: 'Eve HR', p: 'eve', dob: new Date('1993-06-30'), salary: 75000, taxCode: 'TX-1005', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
    { email: 'frank@company.com', fullName: 'Frank Acc Mgr', p: 'frank', dob: new Date('1988-09-10'), salary: 115000, taxCode: 'TX-1006', role: 'MANAGER', dept: 'Accounting' },
    { email: 'grace@company.com', fullName: 'Grace Acc', p: 'grace', dob: new Date('1995-12-01'), salary: 80000, taxCode: 'TX-1007', role: 'ACCOUNTING', dept: 'Accounting' },
    { email: 'henry@company.com', fullName: 'Henry Dev', p: 'henry', dob: new Date('1992-03-18'), salary: 92000, taxCode: 'TX-1008', role: 'REGULAR', dept: 'Engineering' },
  ];

  const createdEmployees: Record<string, any> = {};

  // Create all employees FIRST but unlinked from department
  for (const emp of employeesData) {
    const passwordHash = await getHash(emp.p);
    createdEmployees[emp.p] = await prisma.employee.create({
      data: {
        email: emp.email,
        fullName: emp.fullName,
        password: passwordHash,
        dob: emp.dob,
        salary: emp.salary,
        taxCode: emp.taxCode,
        role: emp.role,
      }
    });
  }

  // Create Departments with their unique managers directly to avoid multiple NULL constraint on managerId
  const eng = await prisma.department.create({ data: { name: 'Engineering', managerId: createdEmployees['bob'].id } });
  const hr = await prisma.department.create({ data: { name: 'Human Resources', managerId: createdEmployees['diana'].id } });
  const acc = await prisma.department.create({ data: { name: 'Accounting', managerId: createdEmployees['frank'].id } });
  const admin = await prisma.department.create({ data: { name: 'Administration', managerId: createdEmployees['alice'].id } });

  const deptMap: Record<string, string> = {
    'Engineering': eng.id,
    'Human Resources': hr.id,
    'Accounting': acc.id,
    'Administration': admin.id,
  };

  // Link employees back to their departments
  for (const emp of employeesData) {
    if (emp.dept && deptMap[emp.dept]) {
      await prisma.employee.update({
        where: { id: createdEmployees[emp.p].id },
        data: { departmentId: deptMap[emp.dept] }
      });
    }
  }

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
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
