export type Role = 'REGULAR' | 'MANAGER' | 'HR_EMPLOYEE' | 'HR_MANAGER' | 'ACCOUNTING' | 'ADMIN';

export interface Employee {
  id: string;
  fullName: string;
  dob: string;
  email: string;
  departmentId: string;
  salary: number;
  taxCode: string;
  role: Role;
}

export interface Department {
  id: string;
  name: string;
  managerId: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes: string;
}
