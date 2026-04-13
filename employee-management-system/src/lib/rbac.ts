import { Employee } from '../types';

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
  return currentUser.role === 'ADMIN' || currentUser.role === 'HR_MANAGER';
};

export const getVisibleFields = (currentUser: Employee, target: Employee): (keyof Employee)[] => {
  const allFields: (keyof Employee)[] = ['id', 'fullName', 'dob', 'email', 'departmentId', 'salary', 'taxCode', 'role'];
  const directoryFields: (keyof Employee)[] = ['id', 'fullName', 'dob', 'email', 'departmentId', 'role'];

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
