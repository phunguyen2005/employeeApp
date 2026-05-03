import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { canCreateDeleteEmployee, canEditEmployee, getVisibleFields } from '../lib/rbac';
import { cn, formatCurrency, formatDepartmentName, formatRoleLabel, translateApiError } from '../lib/utils';
import { isSystemRole } from '../types';
import type { Employee, Role, SystemRole } from '../types';
import { trpc } from '../lib/trpc';

type EmployeeProfileInput = {
  id?: string | null;
  fullName?: string | null;
  dob?: string | null;
  email?: string | null;
  departmentId?: string | null;
  salary?: number | null;
  taxCode?: string | null;
  role?: string | null;
};

type DepartmentInput = {
  id?: string | null;
  name?: string | null;
};

type EmployeeFormData = {
  fullName: string;
  dob: string;
  email: string;
  password: string;
  departmentId: string;
  salary: string;
  taxCode: string;
  role: Role;
};

type NormalizedEmployee = Employee & {
  dobInput: string;
};

type FormErrors = Partial<Record<keyof EmployeeFormData, string>>;

const roleOptions: Array<{ value: SystemRole; label: string }> = [
  { value: 'REGULAR', label: 'Nhân viên' },
  { value: 'MANAGER', label: 'Quản lý' },
  { value: 'HR_EMPLOYEE', label: 'Nhân sự' },
  { value: 'HR_MANAGER', label: 'Quản lý nhân sự' },
  { value: 'ACCOUNTING', label: 'Kế toán' },
  { value: 'ADMIN', label: 'Quản trị viên' },
];

const roleLabels: Record<SystemRole, string> = {
  REGULAR: 'Nhân viên',
  MANAGER: 'Quản lý',
  HR_EMPLOYEE: 'Nhân sự',
  HR_MANAGER: 'Quản lý nhân sự',
  ACCOUNTING: 'Kế toán',
  ADMIN: 'Quản trị viên',
};

const roleBadgeStyles: Record<SystemRole, string> = {
  REGULAR: 'border-slate-200 bg-slate-100 text-slate-700',
  MANAGER: 'border-indigo-200 bg-indigo-100 text-indigo-700',
  HR_EMPLOYEE: 'border-cyan-200 bg-cyan-100 text-cyan-800',
  HR_MANAGER: 'border-sky-200 bg-sky-100 text-sky-800',
  ACCOUNTING: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  ADMIN: 'border-amber-200 bg-amber-100 text-amber-800',
};

const normalizeRole = (value: unknown): Role =>
  typeof value === 'string' && value.trim() ? (value.trim() as Role) : 'REGULAR';

const getRoleLabel = (role: Role) => (isSystemRole(role) ? roleLabels[role] : role);

const getRoleBadgeStyle = (role: Role) =>
  isSystemRole(role) ? roleBadgeStyles[role] : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800';

const createEmptyFormData = (departmentId = ''): EmployeeFormData => ({
  fullName: '',
  dob: '',
  email: '',
  password: '',
  departmentId,
  salary: '',
  taxCode: '',
  role: 'REGULAR',
});

const formatDateForInput = (value?: string | null) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString().slice(0, 10);
};

const normalizeEmployee = (
  employee: EmployeeProfileInput | null | undefined
): NormalizedEmployee | null => {
  if (!employee?.id) return null;

  return {
    id: employee.id,
    fullName: employee.fullName?.trim() || 'Nhân viên bị giới hạn',
    dob: employee.dob || '',
    email: employee.email || '',
    departmentId: employee.departmentId || '',
    salary: typeof employee.salary === 'number' ? employee.salary : 0,
    taxCode: employee.taxCode || '',
    role: normalizeRole(employee.role),
    dobInput: formatDateForInput(employee.dob),
  };
};

const getInitials = (fullName: string) => {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || '?';
};

const getValidationErrors = (
  formData: EmployeeFormData,
  options: {
    isNew: boolean;
    visibleFields: string[];
    canEdit: boolean;
  }
): FormErrors => {
  if (!options.canEdit) return {};

  const errors: FormErrors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (options.visibleFields.includes('fullName') && !formData.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ và tên.';
  }

  if (options.visibleFields.includes('email')) {
    if (!formData.email.trim()) {
      errors.email = 'Vui lòng nhập địa chỉ email.';
    } else if (!emailPattern.test(formData.email.trim())) {
      errors.email = 'Vui lòng nhập email đúng định dạng.';
    }
  }

  if (options.visibleFields.includes('dob') && !formData.dob) {
    errors.dob = 'Vui lòng nhập ngày sinh.';
  }

  if (options.visibleFields.includes('departmentId') && !formData.departmentId) {
    errors.departmentId = 'Vui lòng chọn phòng ban.';
  }

  if (options.visibleFields.includes('salary')) {
    if (formData.salary === '') {
      errors.salary = 'Vui lòng nhập lương.';
    } else if (Number.isNaN(Number(formData.salary)) || Number(formData.salary) < 0) {
      errors.salary = 'Lương phải là số không âm.';
    }
  }

  if (options.isNew && !formData.password) {
    errors.password = 'Vui lòng nhập mật khẩu cho nhân viên mới.';
  }

  return errors;
};

export const EmployeeProfile: React.FC = () => {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id ?? '';
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const [showPassword, setShowPassword] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [formData, setFormData] = useState<EmployeeFormData>(createEmptyFormData());

  const isNew = id === 'new';
  const utils = trpc.useUtils();

  const { data: targetEmployee, isLoading: loadingEmployee } = trpc.employee.getById.useQuery(
    { id },
    {
      enabled: !isNew && !!id,
      retry: false,
    }
  );

  const { data: departments = [], isLoading: loadingDepartments } = trpc.department.getAll.useQuery();

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      navigate({ to: '/' });
    },
    onError: (error) => {
      setStatusMessage(translateApiError(error.message, 'Hiện chưa thể tạo nhân viên. Vui lòng thử lại.'));
    },
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      utils.employee.getById.invalidate({ id });
      navigate({ to: '/' });
    },
    onError: (error) => {
      setStatusMessage(translateApiError(error.message, 'Hiện chưa thể lưu thay đổi. Vui lòng thử lại.'));
    },
  });

  const deleteMutation = trpc.employee.delete.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      navigate({ to: '/' });
    },
    onError: (error) => {
      setStatusMessage(translateApiError(error.message, 'Hiện chưa thể xóa nhân viên. Vui lòng thử lại.'));
    },
  });

  const normalizedDepartments = useMemo(
    () =>
      (departments as DepartmentInput[])
        .map((department) => ({
          id: department.id ?? '',
          name: formatDepartmentName(department.name, 'Phòng ban chưa có tên'),
        }))
        .filter((department) => department.id),
    [departments]
  );

  const normalizedEmployee = useMemo(
    () => normalizeEmployee(targetEmployee as EmployeeProfileInput | null | undefined),
    [targetEmployee]
  );

  useEffect(() => {
    if (normalizedEmployee) {
      setFormData({
        fullName: normalizedEmployee.fullName,
        dob: normalizedEmployee.dobInput,
        email: normalizedEmployee.email,
        password: '',
        departmentId: normalizedEmployee.departmentId ?? '',
        salary: String(normalizedEmployee.salary),
        taxCode: normalizedEmployee.taxCode ?? '',
        role: normalizedEmployee.role,
      });
      return;
    }

    if (isNew) {
      setFormData((prev) => {
        if (prev.departmentId || normalizedDepartments.length === 0) return prev;
        return { ...prev, departmentId: normalizedDepartments[0].id };
      });
    }
  }, [isNew, normalizedDepartments, normalizedEmployee]);

  useEffect(() => {
    setStatusMessage('');
  }, [id]);

  if (!currentUser) return null;

  const visibleFields = isNew
    ? ['fullName', 'dob', 'email', 'departmentId', 'salary', 'taxCode', 'role', 'password']
    : normalizedEmployee
      ? getVisibleFields(currentUser, normalizedEmployee as Employee)
      : [];

  const canEdit = isNew
    ? canCreateDeleteEmployee(currentUser)
    : normalizedEmployee
      ? canEditEmployee(currentUser, normalizedEmployee as Employee)
      : false;

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const formErrors = hasSubmitted
    ? getValidationErrors(formData, { isNew, visibleFields, canEdit })
    : {};

  const displayName =
    visibleFields.includes('fullName') && formData.fullName
      ? formData.fullName
      : isNew
        ? 'Nhân viên mới'
        : 'Nhân viên bị giới hạn';

  const displayRole = visibleFields.includes('role') ? getRoleLabel(formData.role) : 'Bị giới hạn';
  const displayDepartment =
    visibleFields.includes('departmentId') && formData.departmentId
      ? normalizedDepartments.find((department) => department.id === formData.departmentId)?.name || 'Chưa phân phòng ban'
      : 'Bị giới hạn';

  const showDeleteAction = !isNew && canCreateDeleteEmployee(currentUser);

  const isFieldVisible = (name: keyof EmployeeFormData) =>
    visibleFields.includes(name) || (isNew && name === 'password');

  const isFieldEditable = (name: keyof EmployeeFormData) => {
    if (!canEdit) return false;
    if (name === 'password') return isNew;
    if (name === 'role') return isNew;
    return true;
  };

  const visibleRoleOptions = isSystemRole(formData.role)
    ? roleOptions
    : [...roleOptions, { value: formData.role, label: formatRoleLabel(formData.role) }];

  const handleBack = () => {
    navigate({ to: '/' });
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setStatusMessage('');
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    setStatusMessage('');

    const nextErrors = getValidationErrors(formData, { isNew, visibleFields, canEdit });
    if (Object.keys(nextErrors).length > 0) return;

    if (isNew) {
      createMutation.mutate({
        ...formData,
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        dob: new Date(formData.dob).toISOString(),
        salary: Number(formData.salary),
        taxCode: formData.taxCode.trim(),
        role: isSystemRole(formData.role) ? formData.role : 'REGULAR',
      });
      return;
    }

    updateMutation.mutate({
      id,
      data: {
        fullName: formData.fullName.trim(),
        dob: new Date(formData.dob).toISOString(),
        email: formData.email.trim(),
        departmentId: formData.departmentId,
        salary: Number(formData.salary),
        taxCode: formData.taxCode.trim(),
      },
    });
  };

  const handleDelete = () => {
    if (!window.confirm('Bạn có chắc muốn xóa nhân viên này không?')) return;
    setStatusMessage('');
    deleteMutation.mutate({ id });
  };

  const renderField = ({
    name,
    label,
    icon: Icon,
    type = 'text',
    helperText,
    options,
    inputMode,
  }: {
    name: keyof EmployeeFormData;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    type?: string;
    helperText?: string;
    options?: Array<{ value: string; label: string }>;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  }) => {
    if (!isFieldVisible(name)) return null;

    const isEditable = isFieldEditable(name);
    const error = formErrors[name];
    const value = formData[name];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={name} className="text-sm font-medium text-slate-700">
            {label}
          </label>
          {!isEditable && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              Chỉ xem
            </span>
          )}
        </div>

        <div
          className={cn(
            'flex items-center rounded-2xl border bg-slate-50 px-4 transition-all',
            error
              ? 'border-red-300 ring-4 ring-red-100'
              : 'border-slate-200 focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100',
            !isEditable && 'bg-slate-100'
          )}
        >
          <Icon className="h-5 w-5 shrink-0 text-slate-400" />

          {options ? (
            <select
              id={name}
              name={name}
              value={value}
              onChange={handleChange}
              disabled={!isEditable}
              aria-invalid={!!error}
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={name}
              name={name}
              type={type}
              value={value}
              onChange={handleChange}
              disabled={!isEditable}
              aria-invalid={!!error}
              required={isNew && name === 'password'}
              inputMode={inputMode}
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          )}

          {name === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>

        <p className={cn('text-sm', error ? 'text-red-600' : 'text-slate-500')}>
          {error ||
            helperText ||
            (isEditable ? 'Bạn có thể cập nhật trường này tại đây.' : 'Giá trị này chỉ được hiển thị và không thể sửa tại màn hình này.')}
        </p>
      </div>
    );
  };

  if (loadingDepartments || (loadingEmployee && !isNew)) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-8 py-10 text-white">
          <div className="h-6 w-40 animate-pulse rounded-full bg-white/20" />
          <div className="mt-4 h-12 w-2/3 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-3">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
              Đang tải thông tin nhân viên...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isNew && !normalizedEmployee) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại tổng quan
        </button>

        <div className="rounded-[2rem] border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Không thể mở hồ sơ nhân viên</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Không tìm thấy hồ sơ này, hoặc quyền hiện tại của bạn không cho phép mở hồ sơ.
          </p>
        </div>
      </div>
    );
  }

  if (!isNew && visibleFields.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại tổng quan
        </button>

        <div className="rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Quyền xem hồ sơ bị giới hạn</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Vai trò hiện tại của bạn không có quyền xem các trường trong hồ sơ nhân viên này.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại tổng quan
      </button>

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-white shadow-[0_24px_60px_-24px_rgba(8,47,73,0.75)]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-cyan-100 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4" />
              {canEdit ? 'Có quyền chỉnh sửa' : 'Chỉ được xem'}
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-xl font-semibold text-white backdrop-blur-sm">
                {getInitials(displayName)}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-200">
                  {isNew ? 'Tạo nhân viên' : 'Hồ sơ nhân viên'}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                  {isNew
                    ? 'Thiết lập hồ sơ nhân viên với thông tin định danh, phòng ban và lương cần thiết.'
                    : 'Xem thông tin nhân viên trong bố cục rõ ràng cho dữ liệu cá nhân, công việc và quyền xem lương.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-sm font-medium',
                  visibleFields.includes('role')
                    ? getRoleBadgeStyle(formData.role)
                    : 'border-white/15 bg-white/10 text-slate-200'
                )}
              >
                {displayRole}
              </span>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                {isNew ? 'Hồ sơ mới' : `Mã nhân viên: ${id}`}
              </span>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                {displayDepartment}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Trường được hiển thị</p>
              <p className="mt-3 text-3xl font-semibold text-white">{visibleFields.length}</p>
              <p className="mt-1 text-xs text-slate-300">Dựa trên quyền hiện tại của bạn.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Trạng thái chỉnh sửa</p>
              <p className="mt-3 text-3xl font-semibold text-white">{canEdit ? 'Có' : 'Không'}</p>
              <p className="mt-1 text-xs text-slate-300">
                Vai trò và mật khẩu chỉ có thể chỉnh sửa khi tạo mới.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Xem trước lương</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {visibleFields.includes('salary') &&
                formData.salary !== '' &&
                !Number.isNaN(Number(formData.salary))
                  ? formatCurrency(Number(formData.salary))
                  : 'Bị giới hạn'}
              </p>
              <p className="mt-1 text-xs text-slate-300">Phản ánh giá trị hiện có trong biểu mẫu.</p>
            </div>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className="flex items-start gap-3 rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {!canEdit && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Hồ sơ này hiện chỉ cho phép xem. Bạn có thể xem các trường mà vai trò của bạn được phép truy cập,
          nhưng không thể chỉnh sửa tại màn hình này.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form id="employee-profile-form" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-medium text-cyan-700">Định danh</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Thông tin cá nhân</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Đảm bảo thông tin định danh cốt lõi của nhân viên chính xác và dễ kiểm tra.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {renderField({
                name: 'fullName',
                label: 'Họ và tên',
                icon: UserRound,
                helperText: 'Nhập tên hiển thị của nhân viên trong hệ thống.',
              })}
              {renderField({
                name: 'email',
                label: 'Địa chỉ email',
                icon: Mail,
                type: 'email',
                helperText: 'Email này được dùng để định danh và đăng nhập.',
              })}
              {renderField({
                name: 'dob',
                label: 'Ngày sinh',
                icon: CalendarDays,
                type: 'date',
              })}
              {renderField({
                name: 'taxCode',
                label: 'Mã số thuế',
                icon: IdCard,
                helperText: 'Nhập mã số thuế được gán cho nhân viên này.',
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-medium text-cyan-700">Thiết lập công việc</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Phòng ban và vai trò</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Các thiết lập này xác định nhân viên thuộc phòng ban nào và quyền truy cập được thể hiện ra sao.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {renderField({
                name: 'departmentId',
                label: 'Phòng ban',
                icon: Building2,
                options: normalizedDepartments.map((department) => ({
                  value: department.id,
                  label: department.name,
                })),
              })}
              {renderField({
                name: 'role',
                label: 'Vai trò',
                icon: ShieldCheck,
                options: visibleRoleOptions,
                helperText: isNew
                  ? 'Chọn vai trò trước khi tạo nhân viên.'
                  : 'Vai trò chỉ hiển thị để tham khảo và không thể sửa tại màn hình này.',
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-medium text-cyan-700">Thu nhập</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Thông tin lương</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Lương được hiển thị theo định dạng VNĐ và tuân theo quyền truy cập hiện tại.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {renderField({
                name: 'salary',
                label: 'Lương (VNĐ)',
                icon: BriefcaseBusiness,
                type: 'number',
                inputMode: 'decimal',
                helperText: 'Nhập số tiền lương bằng VNĐ.',
              })}
            </div>
          </section>

          {isNew && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <p className="text-sm font-medium text-cyan-700">Bảo mật</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Thông tin đăng nhập ban đầu</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Thiết lập mật khẩu ban đầu để nhân viên đăng nhập lần đầu.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {renderField({
                  name: 'password',
                  label: 'Mật khẩu',
                  icon: Lock,
                  type: showPassword ? 'text' : 'password',
                  helperText: 'Trường này chỉ khả dụng khi tạo nhân viên mới.',
                })}
              </div>
            </section>
          )}
        </form>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-cyan-700">Tóm tắt hồ sơ</p>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Họ và tên</p>
                  <p>{displayName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Phòng ban</p>
                  <p>{displayDepartment}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Vai trò</p>
                  <p>{displayRole}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <IdCard className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Mã nhân viên</p>
                  <p>{isNew ? 'Sẽ được cấp sau khi tạo' : id}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-cyan-700">Thao tác</p>
            <div className="mt-5 space-y-3">
              {canEdit && (
                <button
                  type="submit"
                  form="employee-profile-form"
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {!(createMutation.isPending || updateMutation.isPending) && (
                    <Save className="h-4 w-4" />
                  )}
                  {isNew ? 'Tạo nhân viên' : 'Lưu thay đổi'}
                </button>
              )}

              {showDeleteAction && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deleteMutation.isPending ? 'Đang xóa nhân viên...' : 'Xóa nhân viên'}
                </button>
              )}

              {!canEdit && !showDeleteAction && (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Quyền hiện tại của bạn không có thao tác chỉnh sửa nào cho nhân viên này.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
