import { Employee, SystemRole, isSystemRole } from '../types';

const staticRolePermissions: Record<SystemRole, string[]> = {
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
  ADMIN: ['*'],
};

const permissionMatches = (granted: string, requested: string) => {
  if (granted === '*' || granted === requested) return true;

  const [grantedResource, grantedAction, grantedScope] = granted.split('.');
  const [requestedResource, requestedAction] = requested.split('.');
  return grantedResource === requestedResource && grantedAction === requestedAction && grantedScope === 'all';
};

export const hasPermission = (currentUser: Employee, permission: string): boolean => {
  if (!isSystemRole(currentUser.role)) return false;
  return staticRolePermissions[currentUser.role].some((granted) => permissionMatches(granted, permission));
};

export const canEditEmployee = (currentUser: Employee, target: Employee): boolean => {
  if (currentUser.role === 'ADMIN') return true;
  if (currentUser.role === 'HR_MANAGER') return true;
  if (currentUser.role === 'HR_EMPLOYEE') {
    return currentUser.departmentId !== target.departmentId;
  }
  return false;
};

export const canCreateDeleteEmployee = (currentUser: Employee): boolean => {
  return ['ADMIN', 'HR_MANAGER', 'HR_EMPLOYEE'].includes(currentUser.role);
};

export const canManageDepartments = (currentUser: Employee): boolean => {
  return currentUser.role === 'ADMIN' || currentUser.role === 'HR_MANAGER';
};

export const canViewAuditLogs = (currentUser: Employee): boolean => {
  return hasPermission(currentUser, 'audit_log.read.all');
};

export const canManageUsersRolesPermissions = (currentUser: Employee): boolean => {
  return currentUser.role === 'ADMIN';
};

export const getVisibleFields = (currentUser: Employee, target: Employee): (keyof Employee)[] => {
  const allFields: (keyof Employee)[] = ['id', 'employeeCode', 'fullName', 'dob', 'email', 'departmentId', 'salary', 'taxCode', 'role'];
  const directoryFields: (keyof Employee)[] = ['id', 'employeeCode', 'fullName', 'dob', 'email', 'departmentId', 'role'];

  if (['ADMIN', 'HR_MANAGER', 'HR_EMPLOYEE', 'ACCOUNTING'].includes(currentUser.role)) {
    return allFields;
  }

  if (currentUser.role === 'MANAGER') {
    if (currentUser.departmentId === target.departmentId) {
      return allFields;
    }
    return [];
  }

  if (currentUser.role === 'REGULAR') {
    if (currentUser.departmentId === target.departmentId) {
      return directoryFields;
    }
    return [];
  }

  return [];
};

export const canViewEmployee = (currentUser: Employee, target: Employee): boolean => {
  return getVisibleFields(currentUser, target).length > 0;
};
