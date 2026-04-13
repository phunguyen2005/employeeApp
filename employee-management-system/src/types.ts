export type Role = 'REGULAR' | 'MANAGER' | 'HR_EMPLOYEE' | 'HR_MANAGER' | 'ACCOUNTING' | 'ADMIN';
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED';

export interface Employee {
  id: string;
  fullName: string;
  dob: string;
  email: string;
  departmentId: string | null;
  departmentName?: string | null;
  salary?: number;
  taxCode?: string;
  bankAccount?: string;
  role: Role;
  status?: string;
  hireDate?: string;
}

export interface Department {
  id: string;
  name: string;
  managerId: string | null;
  isActive?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorName: string;
  targetTable?: string;
  targetId: string;
  targetName: string;
  action: AuditAction;
  changes: string;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
