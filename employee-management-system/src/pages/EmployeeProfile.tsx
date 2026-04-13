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
import { cn, formatCurrency } from '../lib/utils';
import type { Employee, Role } from '../types';
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

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'HR_EMPLOYEE', label: 'HR Employee' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'ADMIN', label: 'Admin' },
];

const roleLabels: Record<Role, string> = {
  REGULAR: 'Regular',
  MANAGER: 'Manager',
  HR_EMPLOYEE: 'HR Employee',
  HR_MANAGER: 'HR Manager',
  ACCOUNTING: 'Accounting',
  ADMIN: 'Admin',
};

const roleBadgeStyles: Record<Role, string> = {
  REGULAR: 'border-slate-200 bg-slate-100 text-slate-700',
  MANAGER: 'border-indigo-200 bg-indigo-100 text-indigo-700',
  HR_EMPLOYEE: 'border-cyan-200 bg-cyan-100 text-cyan-800',
  HR_MANAGER: 'border-sky-200 bg-sky-100 text-sky-800',
  ACCOUNTING: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  ADMIN: 'border-amber-200 bg-amber-100 text-amber-800',
};

const isRole = (value: unknown): value is Role =>
  roleOptions.some((option) => option.value === value);

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
    fullName: employee.fullName?.trim() || 'Restricted employee',
    dob: employee.dob || '',
    email: employee.email || '',
    departmentId: employee.departmentId || '',
    salary: typeof employee.salary === 'number' ? employee.salary : 0,
    taxCode: employee.taxCode || '',
    role: isRole(employee.role) ? employee.role : 'REGULAR',
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
    errors.fullName = 'Full name is required.';
  }

  if (options.visibleFields.includes('email')) {
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailPattern.test(formData.email.trim())) {
      errors.email = 'Use a valid email address.';
    }
  }

  if (options.visibleFields.includes('dob') && !formData.dob) {
    errors.dob = 'Date of birth is required.';
  }

  if (options.visibleFields.includes('departmentId') && !formData.departmentId) {
    errors.departmentId = 'Choose a department.';
  }

  if (options.visibleFields.includes('salary')) {
    if (formData.salary === '') {
      errors.salary = 'Salary is required.';
    } else if (Number.isNaN(Number(formData.salary)) || Number(formData.salary) < 0) {
      errors.salary = 'Salary must be a non-negative number.';
    }
  }

  if (options.isNew && !formData.password) {
    errors.password = 'A password is required for new employees.';
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
      setStatusMessage(error.message || 'Unable to create the employee right now.');
    },
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      utils.employee.getById.invalidate({ id });
      navigate({ to: '/' });
    },
    onError: (error) => {
      setStatusMessage(error.message || 'Unable to save your changes right now.');
    },
  });

  const deleteMutation = trpc.employee.delete.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      navigate({ to: '/' });
    },
    onError: (error) => {
      setStatusMessage(error.message || 'Unable to delete the employee right now.');
    },
  });

  const normalizedDepartments = useMemo(
    () =>
      (departments as DepartmentInput[])
        .map((department) => ({
          id: department.id ?? '',
          name: department.name?.trim() || 'Unnamed department',
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
        ? 'New employee'
        : 'Restricted employee';

  const displayRole = visibleFields.includes('role') ? roleLabels[formData.role] : 'Restricted';
  const displayDepartment =
    visibleFields.includes('departmentId') && formData.departmentId
      ? normalizedDepartments.find((department) => department.id === formData.departmentId)?.name || 'Unassigned'
      : 'Restricted';

  const showDeleteAction = !isNew && canCreateDeleteEmployee(currentUser);

  const isFieldVisible = (name: keyof EmployeeFormData) =>
    visibleFields.includes(name) || (isNew && name === 'password');

  const isFieldEditable = (name: keyof EmployeeFormData) => {
    if (!canEdit) return false;
    if (name === 'password') return isNew;
    if (name === 'role') return isNew;
    return true;
  };

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
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
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
              Read only
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
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>

        <p className={cn('text-sm', error ? 'text-red-600' : 'text-slate-500')}>
          {error ||
            helperText ||
            (isEditable ? 'This field can be updated here.' : 'This value is visible but not editable from this page.')}
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
              Loading employee details...
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
          Back to dashboard
        </button>

        <div className="rounded-[2rem] border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Employee not available</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This record could not be found, or your current access level does not allow you to open it.
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
          Back to dashboard
        </button>

        <div className="rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Profile access is restricted</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your role does not have permission to view fields on this employee profile.
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
        Back to dashboard
      </button>

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-white shadow-[0_24px_60px_-24px_rgba(8,47,73,0.75)]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-cyan-100 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4" />
              {canEdit ? 'Editable access' : 'View-only access'}
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-xl font-semibold text-white backdrop-blur-sm">
                {getInitials(displayName)}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-200">
                  {isNew ? 'Create Employee' : 'Employee Profile'}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                  {isNew
                    ? 'Set up the employee record with the required identity, department, and compensation details.'
                    : 'Review employee information with a clearer layout for personal data, work details, and compensation visibility.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-sm font-medium',
                  visibleFields.includes('role')
                    ? roleBadgeStyles[formData.role]
                    : 'border-white/15 bg-white/10 text-slate-200'
                )}
              >
                {displayRole}
              </span>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                {isNew ? 'New record' : `Employee ID: ${id}`}
              </span>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                {displayDepartment}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Visible fields</p>
              <p className="mt-3 text-3xl font-semibold text-white">{visibleFields.length}</p>
              <p className="mt-1 text-xs text-slate-300">Based on your current permissions.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Editable state</p>
              <p className="mt-3 text-3xl font-semibold text-white">{canEdit ? 'Yes' : 'No'}</p>
              <p className="mt-1 text-xs text-slate-300">
                Role and password controls are only editable during creation.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Salary preview</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {visibleFields.includes('salary') &&
                formData.salary !== '' &&
                !Number.isNaN(Number(formData.salary))
                  ? formatCurrency(Number(formData.salary))
                  : 'Restricted'}
              </p>
              <p className="mt-1 text-xs text-slate-300">Reflects the current form value.</p>
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
          This profile is currently view only. You can review the fields your role exposes, but edits are disabled
          on this screen.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form id="employee-profile-form" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-medium text-cyan-700">Identity</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Personal information</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Keep the employee's core identity details accurate and easy to review.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {renderField({
                name: 'fullName',
                label: 'Full name',
                icon: UserRound,
                helperText: "Use the employee's display name as it should appear in the system.",
              })}
              {renderField({
                name: 'email',
                label: 'Email address',
                icon: Mail,
                type: 'email',
                helperText: 'This email is used for identification and sign-in.',
              })}
              {renderField({
                name: 'dob',
                label: 'Date of birth',
                icon: CalendarDays,
                type: 'date',
              })}
              {renderField({
                name: 'taxCode',
                label: 'Tax code',
                icon: IdCard,
                helperText: 'Use the payroll tax identifier assigned to this employee.',
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-medium text-cyan-700">Work setup</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Department and role</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                These settings control where the employee belongs and how access is represented in the UI.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {renderField({
                name: 'departmentId',
                label: 'Department',
                icon: Building2,
                options: normalizedDepartments.map((department) => ({
                  value: department.id,
                  label: department.name,
                })),
              })}
              {renderField({
                name: 'role',
                label: 'Role',
                icon: ShieldCheck,
                options: roleOptions,
                helperText: isNew
                  ? 'Choose the role before creating the employee.'
                  : 'Role is shown for context and is not editable from this screen.',
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-medium text-cyan-700">Compensation</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Salary details</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Compensation values are surfaced with clearer formatting and permission-aware visibility.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {renderField({
                name: 'salary',
                label: 'Salary (USD)',
                icon: BriefcaseBusiness,
                type: 'number',
                inputMode: 'decimal',
                helperText: 'Enter the annual salary amount in USD.',
              })}
            </div>
          </section>

          {isNew && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <p className="text-sm font-medium text-cyan-700">Security</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Initial sign-in details</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Set the starting password used when the employee first signs in.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {renderField({
                  name: 'password',
                  label: 'Password',
                  icon: Lock,
                  type: showPassword ? 'text' : 'password',
                  helperText: 'This field is only available during employee creation.',
                })}
              </div>
            </section>
          )}
        </form>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-cyan-700">Profile summary</p>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Name</p>
                  <p>{displayName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Department</p>
                  <p>{displayDepartment}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Role</p>
                  <p>{displayRole}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <IdCard className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Employee ID</p>
                  <p>{isNew ? 'Assigned after creation' : id}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-cyan-700">Actions</p>
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
                  {isNew ? 'Create employee' : 'Save changes'}
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
                  {deleteMutation.isPending ? 'Deleting employee...' : 'Delete employee'}
                </button>
              )}

              {!canEdit && !showDeleteAction && (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No edit actions are available for this employee under your current permissions.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
