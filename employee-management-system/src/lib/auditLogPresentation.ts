type AuditChangeRecord = Record<string, unknown>;
export type DepartmentNameLookup = Record<string, string>;

const DEPARTMENT_VI_NAMES: Record<string, string> = {
  Administration: 'Hành chính',
  Engineering: 'Kỹ thuật',
  'Human Resources': 'Nhân sự',
  Accounting: 'Kế toán',
};

const UNKNOWN_DEPARTMENT_NAME = 'Phòng ban không xác định';

const fieldLabels: Record<string, string> = {
  oldValues: 'Trước khi thay đổi',
  newValues: 'Sau khi thay đổi',
  fullName: 'Họ và tên',
  email: 'Email',
  dob: 'Ngày sinh',
  departmentId: 'Phòng ban',
  salary: 'Lương',
  taxCode: 'Mã số thuế',
  roleName: 'Vai trò',
  description: 'Mô tả',
  isSystem: 'Vai trò hệ thống',
  isActive: 'Đang hoạt động',
  failedAttempts: 'Số lần đăng nhập thất bại',
  lockedUntil: 'Khóa đến',
  employeeId: 'ID nội bộ',
  employeeCode: 'Mã nhân viên',
  permission: 'Quyền',
  permissionCount: 'Số quyền',
  resource: 'Tài nguyên',
  action: 'Thao tác',
  scope: 'Phạm vi',
};

const formatDatePart = (timestamp: Date | string) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '00000000';

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
};

const formatStableSuffix = (auditId: string) => {
  const compactId = auditId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (compactId || '000000').slice(0, 6).padEnd(6, '0');
};

export const formatAuditEventCode = (auditId: string, timestamp: Date | string) =>
  `AUD-${formatDatePart(timestamp)}-${formatStableSuffix(auditId)}`;

const replaceDepartmentIds = (value: unknown, departments: DepartmentNameLookup): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  return Object.fromEntries(
    Object.entries(value as AuditChangeRecord).map(([key, entry]) => {
      if (key === 'departmentId') {
        const lookupKey = typeof entry === 'string' ? entry.toLowerCase() : '';
        const rawName = lookupKey ? departments[lookupKey] ?? UNKNOWN_DEPARTMENT_NAME : UNKNOWN_DEPARTMENT_NAME;
        return [key, DEPARTMENT_VI_NAMES[rawName] ?? rawName];
      }

      return [key, entry];
    })
  );
};

export const buildReadableAuditChanges = (
  oldValues: unknown,
  newValues: unknown,
  departments: DepartmentNameLookup
) =>
  JSON.stringify({
    oldValues: replaceDepartmentIds(oldValues, departments),
    newValues: replaceDepartmentIds(newValues, departments),
  });

const formatAuditPrimitive = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'trống';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN').format(value);
  if (typeof value === 'string') return value;

  return JSON.stringify(value);
};

const formatAuditObject = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return formatAuditPrimitive(value);

  return Object.entries(value as AuditChangeRecord)
    .map(([key, entry]) => {
      const formattedValue =
        key === 'salary' && entry !== null && entry !== undefined && !Number.isNaN(Number(entry))
          ? new Intl.NumberFormat('vi-VN').format(Number(entry))
          : formatAuditPrimitive(entry);

      return `${fieldLabels[key] ?? key}: ${formattedValue}`;
    })
    .join(', ');
};

export const formatAuditChanges = (changes: string) => {
  try {
    const parsed = JSON.parse(changes);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const oldValues = formatAuditObject((parsed as AuditChangeRecord).oldValues);
      const newValues = formatAuditObject((parsed as AuditChangeRecord).newValues);
      return `${fieldLabels.oldValues}: ${oldValues}; ${fieldLabels.newValues}: ${newValues}`;
    }
  } catch {
    return changes;
  }

  return changes;
};
