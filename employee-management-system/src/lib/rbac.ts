import { Employee } from '../types';

export const canEditEmployee = (currentUser: Employee, target: Employee): boolean => {
  if (currentUser.role === 'ADMIN') return true;
  if (currentUser.role === 'HR_MANAGER') return true;
  if (currentUser.role === 'HR_EMPLOYEE') {
    // HR employee: Can view and edit any employee outside their own department.
    // Policy 1 applies within their own department (no edit).
    return currentUser.departmentId !== target.departmentId;
  }
  return false;
};

export const canCreateDeleteEmployee = (currentUser: Employee): boolean => {
  return ['ADMIN', 'HR_MANAGER', 'HR_EMPLOYEE'].includes(currentUser.role);
};

export const canManageDepartments = (currentUser: Employee): boolean => {
  return currentUser.role === 'ADMIN';
};

export const canViewAuditLogs = (currentUser: Employee): boolean => {
  return currentUser.role === 'ADMIN' || currentUser.role === 'HR_MANAGER';
};

export const getVisibleFields = (currentUser: Employee, target: Employee): (keyof Employee)[] => {
  const allFields: (keyof Employee)[] = ['id', 'fullName', 'dob', 'email', 'departmentId', 'salary', 'taxCode', 'role'];
  const basicFields: (keyof Employee)[] = ['id', 'fullName', 'dob', 'email', 'departmentId', 'role', 'taxCode']; // all except salary

  if (currentUser.role === 'ADMIN' || currentUser.role === 'HR_MANAGER') {
    return allFields;
  }

  if (currentUser.role === 'HR_EMPLOYEE') {
    if (currentUser.departmentId === target.departmentId) {
      return basicFields; // Policy 1
    }
    return allFields;
  }

  if (currentUser.role === 'ACCOUNTING') {
    if (currentUser.departmentId === target.departmentId) {
      return basicFields; // Policy 1
    }
    return ['id', 'salary', 'taxCode']; // Company-wide payroll view
  }

  if (currentUser.role === 'MANAGER') {
    if (currentUser.departmentId === target.departmentId) {
      return allFields; // View all info including salary
    }
    return []; // Cannot view outside department
  }

  if (currentUser.role === 'REGULAR') {
    if (currentUser.departmentId === target.departmentId) {
      return basicFields; // Policy 1
    }
    return []; // Cannot view outside department
  }

  return [];
};

export const canViewEmployee = (currentUser: Employee, target: Employee): boolean => {
  return getVisibleFields(currentUser, target).length > 0;
};
