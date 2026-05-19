import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const employeesData = [
  { email: 'an.nguyen@company.vn', fullName: 'Nguyễn Minh An', p: 'an', dob: new Date('1985-04-12'), phone: '0901000001', salary: 65000000, taxCode: 'MST-010001', bankAccount: '970400000001', role: 'ADMIN', dept: 'Administration' },
  { email: 'binh.tran@company.vn', fullName: 'Trần Quốc Bình', p: 'binh', dob: new Date('1982-11-05'), phone: '0901000002', salary: 52000000, taxCode: 'MST-010002', bankAccount: '970400000002', role: 'MANAGER', dept: 'Engineering' },
  { email: 'chau.le@company.vn', fullName: 'Lê Minh Châu', p: 'chau', dob: new Date('1990-08-21'), phone: '0901000003', salary: 22000000, taxCode: 'MST-010003', bankAccount: '970400000003', role: 'REGULAR', dept: 'Engineering' },
  { email: 'dung.pham@company.vn', fullName: 'Phạm Thùy Dung', p: 'dung', dob: new Date('1979-02-15'), phone: '0901000004', salary: 50000000, taxCode: 'MST-010004', bankAccount: '970400000004', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'giang.vo@company.vn', fullName: 'Võ Hà Giang', p: 'giang', dob: new Date('1993-06-30'), phone: '0901000005', salary: 24000000, taxCode: 'MST-010005', bankAccount: '970400000005', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'hai.do@company.vn', fullName: 'Đỗ Thanh Hải', p: 'hai', dob: new Date('1988-09-10'), phone: '0901000006', salary: 48000000, taxCode: 'MST-010006', bankAccount: '970400000006', role: 'MANAGER', dept: 'Accounting' },
  { email: 'linh.bui@company.vn', fullName: 'Bùi Ngọc Linh', p: 'linh', dob: new Date('1995-12-01'), phone: '0901000007', salary: 26000000, taxCode: 'MST-010007', bankAccount: '970400000007', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'nam.hoang@company.vn', fullName: 'Hoàng Anh Nam', p: 'nam', dob: new Date('1992-03-18'), phone: '0901000008', salary: 23000000, taxCode: 'MST-010008', bankAccount: '970400000008', role: 'REGULAR', dept: 'Engineering' },
  { email: 'nhanvien01@company.vn', fullName: 'Nguyễn Hoàng Phúc', p: 'nhanvien01', dob: new Date('1994-01-14'), phone: '0901000009', salary: 21000000, taxCode: 'MST-010009', bankAccount: '970400000009', role: 'REGULAR', dept: 'Engineering' },
  { email: 'nhanvien02@company.vn', fullName: 'Trần Thị Mai Anh', p: 'nhanvien02', dob: new Date('1996-05-22'), phone: '0901000010', salary: 20500000, taxCode: 'MST-010010', bankAccount: '970400000010', role: 'REGULAR', dept: 'Human Resources' },
  { email: 'nhanvien03@company.vn', fullName: 'Lê Quốc Huy', p: 'nhanvien03', dob: new Date('1991-07-09'), phone: '0901000011', salary: 23500000, taxCode: 'MST-010011', bankAccount: '970400000011', role: 'REGULAR', dept: 'Accounting' },
  { email: 'nhanvien04@company.vn', fullName: 'Phạm Ngọc Hân', p: 'nhanvien04', dob: new Date('1997-11-03'), phone: '0901000012', salary: 19800000, taxCode: 'MST-010012', bankAccount: '970400000012', role: 'REGULAR', dept: 'Engineering' },
  { email: 'nhanvien05@company.vn', fullName: 'Vũ Đức Minh', p: 'nhanvien05', dob: new Date('1990-02-27'), phone: '0901000013', salary: 24500000, taxCode: 'MST-010013', bankAccount: '970400000013', role: 'REGULAR', dept: 'Human Resources' },
  { email: 'nhanvien06@company.vn', fullName: 'Đặng Thu Trang', p: 'nhanvien06', dob: new Date('1998-09-16'), phone: '0901000014', salary: 20000000, taxCode: 'MST-010014', bankAccount: '970400000014', role: 'REGULAR', dept: 'Accounting' },
  { email: 'nhanvien07@company.vn', fullName: 'Đỗ Gia Bảo', p: 'nhanvien07', dob: new Date('1993-12-08'), phone: '0901000015', salary: 22500000, taxCode: 'MST-010015', bankAccount: '970400000015', role: 'REGULAR', dept: 'Engineering' },
  { email: 'nhanvien08@company.vn', fullName: 'Bùi Khánh Linh', p: 'nhanvien08', dob: new Date('1999-04-19'), phone: '0901000016', salary: 21500000, taxCode: 'MST-010016', bankAccount: '970400000016', role: 'REGULAR', dept: 'Accounting' },
  { email: 'quanly01@company.vn', fullName: 'Nguyễn Tuấn Kiệt', p: 'quanly01', dob: new Date('1984-03-11'), phone: '0901000017', salary: 45000000, taxCode: 'MST-010017', bankAccount: '970400000017', role: 'MANAGER', dept: 'Engineering' },
  { email: 'quanly02@company.vn', fullName: 'Trần Hải Đăng', p: 'quanly02', dob: new Date('1986-06-25'), phone: '0901000018', salary: 43000000, taxCode: 'MST-010018', bankAccount: '970400000018', role: 'MANAGER', dept: 'Accounting' },
  { email: 'quanly03@company.vn', fullName: 'Lê Thanh Tùng', p: 'quanly03', dob: new Date('1981-10-07'), phone: '0901000019', salary: 47000000, taxCode: 'MST-010019', bankAccount: '970400000019', role: 'MANAGER', dept: 'Engineering' },
  { email: 'quanly04@company.vn', fullName: 'Phạm Minh Khang', p: 'quanly04', dob: new Date('1987-08-30'), phone: '0901000020', salary: 44000000, taxCode: 'MST-010020', bankAccount: '970400000020', role: 'MANAGER', dept: 'Human Resources' },
  { email: 'quanly05@company.vn', fullName: 'Võ Quang Huy', p: 'quanly05', dob: new Date('1983-12-18'), phone: '0901000021', salary: 46000000, taxCode: 'MST-010021', bankAccount: '970400000021', role: 'MANAGER', dept: 'Accounting' },
  { email: 'quanly06@company.vn', fullName: 'Đặng Hoàng Long', p: 'quanly06', dob: new Date('1989-01-26'), phone: '0901000022', salary: 42000000, taxCode: 'MST-010022', bankAccount: '970400000022', role: 'MANAGER', dept: 'Engineering' },
  { email: 'quanly07@company.vn', fullName: 'Bùi Việt Anh', p: 'quanly07', dob: new Date('1985-09-04'), phone: '0901000023', salary: 43500000, taxCode: 'MST-010023', bankAccount: '970400000023', role: 'MANAGER', dept: 'Human Resources' },
  { email: 'quanly08@company.vn', fullName: 'Đỗ Anh Tuấn', p: 'quanly08', dob: new Date('1980-05-13'), phone: '0901000024', salary: 45500000, taxCode: 'MST-010024', bankAccount: '970400000024', role: 'MANAGER', dept: 'Accounting' },
  { email: 'nhansu01@company.vn', fullName: 'Nguyễn Thị Lan Anh', p: 'nhansu01', dob: new Date('1994-06-01'), phone: '0901000025', salary: 27000000, taxCode: 'MST-010025', bankAccount: '970400000025', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu02@company.vn', fullName: 'Trần Thu Hà', p: 'nhansu02', dob: new Date('1992-02-20'), phone: '0901000026', salary: 25500000, taxCode: 'MST-010026', bankAccount: '970400000026', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu03@company.vn', fullName: 'Lê Bảo Ngọc', p: 'nhansu03', dob: new Date('1997-07-17'), phone: '0901000027', salary: 24500000, taxCode: 'MST-010027', bankAccount: '970400000027', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu04@company.vn', fullName: 'Phạm Mỹ Duyên', p: 'nhansu04', dob: new Date('1995-03-29'), phone: '0901000028', salary: 26000000, taxCode: 'MST-010028', bankAccount: '970400000028', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu05@company.vn', fullName: 'Vũ Thị Kim Chi', p: 'nhansu05', dob: new Date('1991-12-12'), phone: '0901000029', salary: 28000000, taxCode: 'MST-010029', bankAccount: '970400000029', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu06@company.vn', fullName: 'Đặng Hoài Thương', p: 'nhansu06', dob: new Date('1998-04-06'), phone: '0901000030', salary: 23500000, taxCode: 'MST-010030', bankAccount: '970400000030', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu07@company.vn', fullName: 'Đỗ Phương Uyên', p: 'nhansu07', dob: new Date('1996-10-23'), phone: '0901000031', salary: 25000000, taxCode: 'MST-010031', bankAccount: '970400000031', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu08@company.vn', fullName: 'Bùi Thanh Nhàn', p: 'nhansu08', dob: new Date('1993-08-15'), phone: '0901000032', salary: 26500000, taxCode: 'MST-010032', bankAccount: '970400000032', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'nhansu09@company.vn', fullName: 'Hoàng Minh Thư', p: 'nhansu09', dob: new Date('1999-01-31'), phone: '0901000033', salary: 22500000, taxCode: 'MST-010033', bankAccount: '970400000033', role: 'HR_EMPLOYEE', dept: 'Human Resources' },
  { email: 'quanlynhansu01@company.vn', fullName: 'Nguyễn Khánh Vy', p: 'quanlynhansu01', dob: new Date('1984-07-02'), phone: '0901000034', salary: 47000000, taxCode: 'MST-010034', bankAccount: '970400000034', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu02@company.vn', fullName: 'Trần Minh Châu', p: 'quanlynhansu02', dob: new Date('1986-11-21'), phone: '0901000035', salary: 45500000, taxCode: 'MST-010035', bankAccount: '970400000035', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu03@company.vn', fullName: 'Lê Thùy Dương', p: 'quanlynhansu03', dob: new Date('1982-04-09'), phone: '0901000036', salary: 49000000, taxCode: 'MST-010036', bankAccount: '970400000036', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu04@company.vn', fullName: 'Phạm Gia Hân', p: 'quanlynhansu04', dob: new Date('1988-12-05'), phone: '0901000037', salary: 44000000, taxCode: 'MST-010037', bankAccount: '970400000037', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu05@company.vn', fullName: 'Võ Nhật Linh', p: 'quanlynhansu05', dob: new Date('1985-05-28'), phone: '0901000038', salary: 46500000, taxCode: 'MST-010038', bankAccount: '970400000038', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu06@company.vn', fullName: 'Đặng Bảo Trâm', p: 'quanlynhansu06', dob: new Date('1987-09-19'), phone: '0901000039', salary: 45000000, taxCode: 'MST-010039', bankAccount: '970400000039', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu07@company.vn', fullName: 'Đỗ Hải Yến', p: 'quanlynhansu07', dob: new Date('1983-03-24'), phone: '0901000040', salary: 48000000, taxCode: 'MST-010040', bankAccount: '970400000040', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu08@company.vn', fullName: 'Bùi Ngọc Mai', p: 'quanlynhansu08', dob: new Date('1989-06-14'), phone: '0901000041', salary: 43000000, taxCode: 'MST-010041', bankAccount: '970400000041', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'quanlynhansu09@company.vn', fullName: 'Hoàng Anh Thư', p: 'quanlynhansu09', dob: new Date('1981-01-08'), phone: '0901000042', salary: 48500000, taxCode: 'MST-010042', bankAccount: '970400000042', role: 'HR_MANAGER', dept: 'Human Resources' },
  { email: 'ketoan01@company.vn', fullName: 'Nguyễn Kim Ngân', p: 'ketoan01', dob: new Date('1991-02-11'), phone: '0901000043', salary: 29500000, taxCode: 'MST-010043', bankAccount: '970400000043', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan02@company.vn', fullName: 'Trần Quốc Việt', p: 'ketoan02', dob: new Date('1989-08-27'), phone: '0901000044', salary: 31000000, taxCode: 'MST-010044', bankAccount: '970400000044', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan03@company.vn', fullName: 'Lê Thanh Tâm', p: 'ketoan03', dob: new Date('1994-10-04'), phone: '0901000045', salary: 27000000, taxCode: 'MST-010045', bankAccount: '970400000045', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan04@company.vn', fullName: 'Phạm Đức Tài', p: 'ketoan04', dob: new Date('1988-06-18'), phone: '0901000046', salary: 30500000, taxCode: 'MST-010046', bankAccount: '970400000046', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan05@company.vn', fullName: 'Vũ Minh Nhật', p: 'ketoan05', dob: new Date('1990-12-22'), phone: '0901000047', salary: 28500000, taxCode: 'MST-010047', bankAccount: '970400000047', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan06@company.vn', fullName: 'Đặng Thảo My', p: 'ketoan06', dob: new Date('1996-04-13'), phone: '0901000048', salary: 25500000, taxCode: 'MST-010048', bankAccount: '970400000048', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan07@company.vn', fullName: 'Đỗ Xuân Trường', p: 'ketoan07', dob: new Date('1987-09-01'), phone: '0901000049', salary: 30000000, taxCode: 'MST-010049', bankAccount: '970400000049', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan08@company.vn', fullName: 'Bùi Hà My', p: 'ketoan08', dob: new Date('1995-07-07'), phone: '0901000050', salary: 26500000, taxCode: 'MST-010050', bankAccount: '970400000050', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'ketoan09@company.vn', fullName: 'Hoàng Tuấn Anh', p: 'ketoan09', dob: new Date('1992-11-16'), phone: '0901000051', salary: 29000000, taxCode: 'MST-010051', bankAccount: '970400000051', role: 'ACCOUNTING', dept: 'Accounting' },
  { email: 'admin02@company.vn', fullName: 'Nguyễn Phương Nam', p: 'admin02', dob: new Date('1983-05-20'), phone: '0901000052', salary: 60000000, taxCode: 'MST-010052', bankAccount: '970400000052', role: 'ADMIN', dept: 'Administration' },
  { email: 'admin03@company.vn', fullName: 'Trần Bảo Châu', p: 'admin03', dob: new Date('1986-10-10'), phone: '0901000053', salary: 58000000, taxCode: 'MST-010053', bankAccount: '970400000053', role: 'ADMIN', dept: 'Administration' },
] as const;

const systemRoles = [
  { name: 'REGULAR', description: 'Nhân viên tiêu chuẩn, được xem danh bạ trong cùng phòng ban.' },
  { name: 'MANAGER', description: 'Quản lý phòng ban, được xem dữ liệu nhạy cảm trong cùng phòng ban.' },
  { name: 'HR_EMPLOYEE', description: 'Nhân sự, được quản lý nhân viên ở nhiều phòng ban.' },
  { name: 'HR_MANAGER', description: 'Quản lý nhân sự với quyền rộng trên nhân viên, lương, phòng ban và nhật ký kiểm toán.' },
  { name: 'ACCOUNTING', description: 'Nhân viên kế toán, được xem dữ liệu lương.' },
  { name: 'ADMIN', description: 'Quản trị viên hệ thống với toàn quyền truy cập.' },
] as const;

const permissionCatalog = [
  { resource: 'employee', action: 'read', scope: 'own_department', description: 'Xem nhân viên trong cùng phòng ban.' },
  { resource: 'employee', action: 'read', scope: 'all', description: 'Xem nhân viên ở mọi phòng ban.' },
  { resource: 'employee', action: 'create', scope: 'other_department', description: 'Tạo nhân viên ngoài phòng ban của mình.' },
  { resource: 'employee', action: 'create', scope: 'all', description: 'Tạo nhân viên ở mọi phòng ban.' },
  { resource: 'employee', action: 'update', scope: 'other_department', description: 'Cập nhật nhân viên ngoài phòng ban của mình.' },
  { resource: 'employee', action: 'update', scope: 'all', description: 'Cập nhật nhân viên ở mọi phòng ban.' },
  { resource: 'employee', action: 'delete', scope: 'other_department', description: 'Xóa mềm nhân viên ngoài phòng ban của mình.' },
  { resource: 'employee', action: 'delete', scope: 'all', description: 'Xóa mềm nhân viên ở mọi phòng ban.' },
  { resource: 'employee_sensitive', action: 'read', scope: 'own_department', description: 'Xem dữ liệu nhạy cảm trong cùng phòng ban.' },
  { resource: 'employee_sensitive', action: 'read', scope: 'all', description: 'Xem dữ liệu nhạy cảm ở mọi phòng ban.' },
  { resource: 'employee_sensitive', action: 'update', scope: 'other_department', description: 'Cập nhật dữ liệu nhạy cảm ngoài phòng ban của mình.' },
  { resource: 'employee_sensitive', action: 'update', scope: 'all', description: 'Cập nhật dữ liệu nhạy cảm ở mọi phòng ban.' },
  { resource: 'department', action: 'read', scope: 'all', description: 'Xem hồ sơ phòng ban.' },
  { resource: 'department', action: 'manage', scope: 'all', description: 'Quản lý hồ sơ phòng ban.' },
  { resource: 'audit_log', action: 'read', scope: 'all', description: 'Xem nhật ký kiểm toán.' },
  { resource: 'user', action: 'read', scope: 'all', description: 'Xem người dùng ứng dụng.' },
  { resource: 'user', action: 'create', scope: 'all', description: 'Tạo người dùng ứng dụng.' },
  { resource: 'user', action: 'update', scope: 'all', description: 'Cập nhật người dùng ứng dụng.' },
  { resource: 'user', action: 'delete', scope: 'all', description: 'Vô hiệu hóa người dùng ứng dụng.' },
  { resource: 'user', action: 'manage', scope: 'all', description: 'Quản lý người dùng và phân vai trò.' },
  { resource: 'role', action: 'read', scope: 'all', description: 'Xem vai trò.' },
  { resource: 'role', action: 'create', scope: 'all', description: 'Tạo vai trò tùy chỉnh.' },
  { resource: 'role', action: 'update', scope: 'all', description: 'Cập nhật vai trò tùy chỉnh và quyền của vai trò.' },
  { resource: 'role', action: 'delete', scope: 'all', description: 'Xóa vai trò tùy chỉnh.' },
  { resource: 'role', action: 'manage', scope: 'all', description: 'Quản lý vai trò.' },
  { resource: 'permission', action: 'read', scope: 'all', description: 'Xem danh mục quyền.' },
  { resource: 'permission', action: 'create', scope: 'all', description: 'Tạo mục quyền trong danh mục.' },
  { resource: 'permission', action: 'update', scope: 'all', description: 'Cập nhật mục quyền trong danh mục.' },
  { resource: 'permission', action: 'delete', scope: 'all', description: 'Xóa mục quyền chưa được sử dụng.' },
  { resource: 'permission', action: 'manage', scope: 'all', description: 'Quản lý danh mục quyền.' },
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
            phone: employee.phone,
            departmentId: deptMap[employee.dept],
            sensitive: {
              create: {
                salary: employee.salary,
                taxCode: employee.taxCode,
                bankAccount: employee.bankAccount,
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
  const emailWidth = Math.max('Email'.length, ...employeesData.map((employee) => employee.email.length));
  const passwordWidth = Math.max('Password'.length, ...employeesData.map((employee) => employee.p.length));
  const roleWidth = Math.max('Role'.length, ...employeesData.map((employee) => employee.role.length));
  const separator = `|-${'-'.repeat(emailWidth)}-|-${'-'.repeat(passwordWidth)}-|-${'-'.repeat(roleWidth)}-|`;

  console.log(separator);
  console.log(`| ${'Email'.padEnd(emailWidth)} | ${'Password'.padEnd(passwordWidth)} | ${'Role'.padEnd(roleWidth)} |`);
  console.log(separator);
  for (const emp of employeesData) {
    console.log(`| ${emp.email.padEnd(emailWidth)} | ${emp.p.padEnd(passwordWidth)} | ${emp.role.padEnd(roleWidth)} |`);
  }
  console.log(separator);
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
