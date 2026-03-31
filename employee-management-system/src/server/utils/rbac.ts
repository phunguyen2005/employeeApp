import { Employee } from '@prisma/client';
import { UserContext } from '../context';

/**
 * Strips sensitive fields from the employee record based on the current user's role 
 * and relationship to the target employee (same department vs different).
 */
export const applyColumnMasking = (currentUser: UserContext, targetEmployee: Employee) => {
  const isSameDepartment = currentUser.departmentId === targetEmployee.departmentId;

  // Clone to avoid mutating original
  const maskedEmployee: Partial<Employee> = { ...targetEmployee };

  switch (currentUser.role) {
    case 'REGULAR':
      // Policy 1: Regular employee sees own department, minus salary/tax.
      // Note: Row-level filter already ensures they only fetch same department.
      delete maskedEmployee.salary;
      delete maskedEmployee.taxCode;
      break;

    case 'MANAGER':
      // Policy 2: Dept manager sees all within their department. No masking needed.
      break;

    case 'HR_EMPLOYEE':
      // Policy 3: HR employee sees everyone. 
      // If same department, Policy 1 applies (hide salary/tax code).
      if (isSameDepartment) {
        delete maskedEmployee.salary;
        delete maskedEmployee.taxCode;
      }
      break;

    case 'HR_MANAGER':
    case 'ADMIN':
      // Policy 4: HR Manager sees everything.
      break;

    case 'ACCOUNTING':
      // Policy 5: Accounting can see EVERYONE'S salary and tax code.
      // But for cross-department, they specifically only need id, salary, taxCode (for payroll)
      // For their own department, they see full basic info PLUS salary/taxCode.
      if (!isSameDepartment) {
        return {
          id: maskedEmployee.id,
          salary: maskedEmployee.salary,
          taxCode: maskedEmployee.taxCode,
        } as Partial<Employee>; // Strictly return only these fields
      }
      break;
  }

  return maskedEmployee;
};

/**
 * Returns the dynamic Prisma `where` clause used for list operations.
 */
export const getRowLevelFilter = (currentUser: UserContext) => {
  switch (currentUser.role) {
    case 'REGULAR':
    case 'MANAGER':
      // Policy 1 & 2: Restricted to own department
      return { departmentId: currentUser.departmentId };
    
    case 'HR_EMPLOYEE':
    case 'HR_MANAGER':
    case 'ACCOUNTING':
    case 'ADMIN':
      // Policy 3, 4, 5: Can see everyone (company-wide)
      return {}; 
  }
};
