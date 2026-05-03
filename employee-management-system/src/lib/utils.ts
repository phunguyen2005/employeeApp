import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Role, SystemRole } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const roleLabels: Record<SystemRole, string> = {
  REGULAR: "Nhân viên",
  MANAGER: "Quản lý",
  HR_EMPLOYEE: "Nhân sự",
  HR_MANAGER: "Quản lý nhân sự",
  ACCOUNTING: "Kế toán",
  ADMIN: "Quản trị viên",
};

const departmentLabels: Record<string, string> = {
  Administration: "Hành chính",
  Engineering: "Kỹ thuật",
  "Human Resources": "Nhân sự",
  Accounting: "Kế toán",
};

const permissionResourceLabels: Record<string, string> = {
  employee: "Nhân viên",
  employee_sensitive: "Dữ liệu nhạy cảm của nhân viên",
  department: "Phòng ban",
  audit_log: "Nhật ký kiểm toán",
  user: "Người dùng",
  role: "Vai trò",
  permission: "Quyền truy cập",
};

const permissionActionLabels: Record<string, string> = {
  read: "Xem",
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  manage: "Quản lý",
};

const permissionScopeLabels: Record<string, string> = {
  all: "Tất cả",
  own_department: "Cùng phòng ban",
  other_department: "Ngoài phòng ban",
};

const apiErrorTranslations: Record<string, string> = {
  "Not logged in": "Bạn chưa đăng nhập.",
  "Insufficient permissions for this action.": "Bạn không có quyền thực hiện thao tác này.",
  "This account has been disabled.": "Tài khoản này đã bị vô hiệu hóa.",
  "This account is temporarily locked.": "Tài khoản này đang tạm thời bị khóa.",
  "Unable to establish a user session.": "Không thể tạo phiên đăng nhập.",
  "User not found.": "Không tìm thấy người dùng.",
  "Role not found.": "Không tìm thấy vai trò.",
  "Permission not found.": "Không tìm thấy quyền.",
  "System roles are immutable.": "Không thể chỉnh sửa vai trò hệ thống.",
  "Assign users to another role before deleting this role.": "Hãy chuyển người dùng sang vai trò khác trước khi xóa vai trò này.",
  "You cannot deactivate your own account.": "Bạn không thể vô hiệu hóa chính tài khoản của mình.",
  "No status change was requested.": "Chưa có thay đổi trạng thái nào được yêu cầu.",
  "You cannot remove your own admin role.": "Bạn không thể gỡ vai trò quản trị viên của chính mình.",
  "You cannot delete your own account.": "Bạn không thể xóa chính tài khoản của mình.",
  "You cannot delete your own record.": "Bạn không thể xóa hồ sơ của chính mình.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  UNAUTHORIZED: "Bạn cần đăng nhập để tiếp tục.",
  CONFLICT: "Dữ liệu đang xung đột với trạng thái hiện tại.",
};

const knownDisplayTranslations: Record<string, string> = {
  "Standard employee with own-department directory access.": "Nhân viên tiêu chuẩn, được xem danh bạ trong cùng phòng ban.",
  "Department manager with own-department sensitive read access.": "Quản lý phòng ban, được xem dữ liệu nhạy cảm trong cùng phòng ban.",
  "HR staff with cross-department employee management access.": "Nhân sự, được quản lý nhân viên ở nhiều phòng ban.",
  "HR manager with broad employee, payroll, department, and audit access.": "Quản lý nhân sự, có quyền rộng với nhân viên, lương, phòng ban và nhật ký kiểm toán.",
  "Accounting user with payroll read access.": "Người dùng kế toán, được xem dữ liệu lương.",
  "System administrator with full access.": "Quản trị viên hệ thống, có toàn quyền truy cập.",
  "Read employees in the same department.": "Xem nhân viên trong cùng phòng ban.",
  "Read employees in any department.": "Xem nhân viên ở mọi phòng ban.",
  "Create employees outside own department.": "Tạo nhân viên ngoài phòng ban của mình.",
  "Create employees in any department.": "Tạo nhân viên ở mọi phòng ban.",
  "Update employees outside own department.": "Cập nhật nhân viên ngoài phòng ban của mình.",
  "Update employees in any department.": "Cập nhật nhân viên ở mọi phòng ban.",
  "Soft delete employees outside own department.": "Xóa mềm nhân viên ngoài phòng ban của mình.",
  "Soft delete employees in any department.": "Xóa mềm nhân viên ở mọi phòng ban.",
  "Read sensitive data in the same department.": "Xem dữ liệu nhạy cảm trong cùng phòng ban.",
  "Read sensitive data in any department.": "Xem dữ liệu nhạy cảm ở mọi phòng ban.",
  "Update sensitive data outside own department.": "Cập nhật dữ liệu nhạy cảm ngoài phòng ban của mình.",
  "Update sensitive data in any department.": "Cập nhật dữ liệu nhạy cảm ở mọi phòng ban.",
  "Read department records.": "Xem hồ sơ phòng ban.",
  "Manage department records.": "Quản lý hồ sơ phòng ban.",
  "Read audit logs.": "Xem nhật ký kiểm toán.",
  "Read application users.": "Xem người dùng ứng dụng.",
  "Create application users.": "Tạo người dùng ứng dụng.",
  "Update application users.": "Cập nhật người dùng ứng dụng.",
  "Deactivate application users.": "Vô hiệu hóa người dùng ứng dụng.",
  "Manage users and role assignments.": "Quản lý người dùng và phân vai trò.",
  "Read roles.": "Xem vai trò.",
  "Create custom roles.": "Tạo vai trò tùy chỉnh.",
  "Update custom roles and role permissions.": "Cập nhật vai trò tùy chỉnh và quyền của vai trò.",
  "Delete custom roles.": "Xóa vai trò tùy chỉnh.",
  "Manage roles.": "Quản lý vai trò.",
  "Read permission catalog entries.": "Xem danh mục quyền.",
  "Create permission catalog entries.": "Tạo mục quyền trong danh mục.",
  "Update permission catalog entries.": "Cập nhật mục quyền trong danh mục.",
  "Delete unused permission catalog entries.": "Xóa mục quyền chưa được sử dụng.",
  "Manage permission catalog entries.": "Quản lý danh mục quyền.",
};

export function formatCurrency(amount: number | null | undefined) {
  const numericAmount = Number(amount ?? 0);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(safeAmount)} VNĐ`;
}

export function formatRoleLabel(role: Role | string | null | undefined) {
  const normalizedRole = role?.trim();
  if (!normalizedRole) return "Chưa phân quyền";

  return roleLabels[normalizedRole as SystemRole] ?? normalizedRole;
}

export function formatDepartmentName(name: string | null | undefined, fallback = "Chưa phân phòng ban") {
  const normalizedName = name?.trim();
  if (!normalizedName) return fallback;

  return departmentLabels[normalizedName] ?? normalizedName;
}

export function formatPermissionLabel(resource: string, action: string, scope: string) {
  const resourceLabel = permissionResourceLabels[resource] ?? resource;
  const actionLabel = permissionActionLabels[action] ?? action;
  const scopeLabel = permissionScopeLabels[scope] ?? scope;

  return `${resourceLabel} - ${actionLabel} - ${scopeLabel}`;
}

export function formatDateTimeVi(value: string | Date | null | undefined, fallback = "Không xác định") {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeTimeVi(value: string | Date | null | undefined) {
  if (!value) return "Không xác định";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";

  const diffInMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });

  if (Math.abs(diffInMinutes) < 60) return formatter.format(diffInMinutes, "minute");

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) return formatter.format(diffInHours, "hour");

  const diffInDays = Math.round(diffInHours / 24);
  return formatter.format(diffInDays, "day");
}

export function translateApiError(message: string | null | undefined, fallback = "Đã xảy ra lỗi. Vui lòng thử lại.") {
  if (!message) return fallback;

  return apiErrorTranslations[message] ?? fallback;
}

export function translateDisplayText(value: string | null | undefined, fallback = "Chưa có mô tả") {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return fallback;

  return knownDisplayTranslations[normalizedValue] ?? normalizedValue;
}
