import React, { useDeferredValue, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Eye,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { canCreateDeleteEmployee, canViewEmployee, getVisibleFields } from '../lib/rbac';
import { cn, formatCurrency, formatDepartmentName } from '../lib/utils';
import { trpc } from '../lib/trpc';
import { isSystemRole } from '../types';
import type { Employee, Role, SystemRole } from '../types';

const roleOptions: Array<{ value: 'ALL' | SystemRole; label: string }> = [
  { value: 'ALL', label: 'Tất cả vai trò' },
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
  REGULAR: 'bg-slate-100 text-slate-700 border-slate-200',
  MANAGER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  HR_EMPLOYEE: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  HR_MANAGER: 'bg-sky-100 text-sky-800 border-sky-200',
  ACCOUNTING: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ADMIN: 'bg-amber-100 text-amber-800 border-amber-200',
};

type DashboardEmployeeInput = {
  id?: string;
  fullName?: string | null;
  dob?: string | null;
  email?: string | null;
  departmentId?: string | null;
  salary?: number | null;
  taxCode?: string | null;
  role?: string | null;
};

const normalizeRole = (value: unknown): Role =>
  typeof value === 'string' && value.trim() ? (value.trim() as Role) : 'REGULAR';

const getRoleLabel = (role: Role) => (isSystemRole(role) ? roleLabels[role] : role);

const getRoleBadgeStyle = (role: Role) =>
  isSystemRole(role) ? roleBadgeStyles[role] : 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200';

const buildSafeEmployee = (rawEmployee: DashboardEmployeeInput | null | undefined): Employee | null => {
  if (!rawEmployee?.id) return null;

  return {
    id: rawEmployee.id,
    fullName: rawEmployee.fullName?.trim() || 'Nhân viên chưa có tên',
    dob: rawEmployee.dob || '',
    email: rawEmployee.email || '',
    departmentId: rawEmployee.departmentId || '',
    salary: typeof rawEmployee.salary === 'number' ? rawEmployee.salary : 0,
    taxCode: rawEmployee.taxCode || '',
    role: normalizeRole(rawEmployee.role),
  };
};

const getEmployeeInitials = (fullName: string) => {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || '?';
};

export const Dashboard: React.FC = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | SystemRole>('ALL');
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const { data: employees = [], isLoading: isLoadingEmployees } = trpc.employee.getAll.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: departments = [], isLoading: isLoadingDepartments } = trpc.department.getAll.useQuery(undefined, {
    enabled: !!currentUser,
  });

  if (!currentUser) return null;

  const canCreateEmployee = canCreateDeleteEmployee(currentUser);
  const normalizedDepartments = departments
    .map((department) => ({
      id: department.id ?? '',
      name: formatDepartmentName(department.name, 'Phòng ban chưa có tên'),
    }))
    .filter((department) => department.id);

  const filteredEmployees = employees.reduce<
    Array<{
      employee: Employee;
      departmentName: string;
      visibleFields: Array<keyof Employee>;
      initials: string;
    }>
  >((result, rawEmployee) => {
    const employee = buildSafeEmployee(rawEmployee);
    if (!employee) return result;
    if (!canViewEmployee(currentUser, employee)) return result;

    const visibleFields = getVisibleFields(currentUser, employee);
    const departmentName =
      normalizedDepartments.find((department) => department.id === employee.departmentId)?.name || 'Chưa phân phòng ban';

    const matchesSearch =
      !deferredSearchTerm ||
      [employee.fullName, employee.id, employee.email, departmentName, getRoleLabel(employee.role)]
        .join(' ')
        .toLowerCase()
        .includes(deferredSearchTerm);

    const matchesDepartment = deptFilter === 'ALL' || employee.departmentId === deptFilter;
    const matchesRole = roleFilter === 'ALL' || employee.role === roleFilter;

    if (!matchesSearch || !matchesDepartment || !matchesRole) return result;

    result.push({
      employee,
      departmentName,
      visibleFields,
      initials: getEmployeeInitials(employee.fullName),
    });

    return result;
  }, []);

  const visibleDepartmentCount = new Set(filteredEmployees.map(({ departmentName }) => departmentName)).size;
  const visibleSalaryCount = filteredEmployees.filter(({ visibleFields }) => visibleFields.includes('salary')).length;
  const activeFilterCount = [searchTerm.trim(), deptFilter !== 'ALL', roleFilter !== 'ALL'].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm('');
    setDeptFilter('ALL');
    setRoleFilter('ALL');
  };

  const handleEmployeeNavigation = (id: string) => {
    navigate({ to: '/employee/$id', params: { id } } as any);
  };

  if (isLoadingEmployees || isLoadingDepartments) {
    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-lg">
          <div className="h-5 w-32 animate-pulse rounded-full bg-white/20" />
          <div className="mt-4 h-10 w-2/3 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-3 h-5 w-1/2 animate-pulse rounded-full bg-white/10" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-9 w-20 animate-pulse rounded-2xl bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="flex h-56 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            Đang tải dữ liệu tổng quan...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-white shadow-[0_24px_60px_-24px_rgba(8,47,73,0.75)]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.3fr_0.7fr] lg:px-8 lg:py-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-cyan-100 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4" />
              Quyền truy cập: {getRoleLabel(currentUser.role)}
            </div>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Hồ sơ nhân viên được trình bày để dễ rà soát và phân quyền rõ ràng hơn.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Tìm kiếm, lọc và xem danh sách nhân viên trong bố cục gọn gàng, giúp thông tin quan trọng
                luôn dễ theo dõi.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Nhân viên hiển thị</span>
                <Users className="h-4 w-4" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{filteredEmployees.length}</p>
              <p className="mt-1 text-xs text-slate-300">Dựa trên vai trò và bộ lọc hiện tại.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Phòng ban</span>
                <Building2 className="h-4 w-4" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{visibleDepartmentCount}</p>
              <p className="mt-1 text-xs text-slate-300">Số phòng ban trong kết quả hiện tại.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Lương được hiển thị</span>
                <BriefcaseBusiness className="h-4 w-4" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{visibleSalaryCount}</p>
              <p className="mt-1 text-xs text-slate-300">Số hồ sơ bạn được phép xem lương.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <SlidersHorizontal className="h-4 w-4 text-cyan-600" />
              Bộ lọc và tìm kiếm
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr),minmax(220px,0.8fr),minmax(220px,0.8fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, mã nhân viên, email, phòng ban hoặc vai trò"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Xóa nội dung tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                value={deptFilter}
                onChange={(event) => setDeptFilter(event.target.value)}
                aria-label="Lọc theo phòng ban"
              >
                <option value="ALL">Tất cả phòng ban</option>
                {normalizedDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'ALL' | SystemRole)}
                aria-label="Lọc theo vai trò"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              Đặt lại bộ lọc
            </button>

            {canCreateEmployee && (
              <button
                type="button"
                onClick={() => handleEmployeeNavigation('new')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                <Plus className="h-4 w-4" />
                Thêm nhân viên
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Đang hiển thị <span className="font-semibold text-slate-900">{filteredEmployees.length}</span> nhân viên
            {activeFilterCount > 0 && (
              <>
                {' '}
                với <span className="font-semibold text-slate-900">{activeFilterCount}</span> bộ lọc đang áp dụng
              </>
            )}
            .
          </p>
          <p>{deferredSearchTerm ? `Đã đồng bộ tìm kiếm cho "${searchTerm.trim()}".` : 'Kết quả cập nhật khi bạn nhập.'}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="hidden overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Nhân viên
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Phòng ban
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Vai trò
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Lương
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(({ employee, departmentName, visibleFields, initials }) => {
                  const canSeeFullName = visibleFields.includes('fullName');
                  const canSeeDepartment = visibleFields.includes('departmentId');
                  const canSeeRole = visibleFields.includes('role');
                  const canSeeSalary = visibleFields.includes('salary');

                  return (
                    <tr key={employee.id} className="transition hover:bg-cyan-50/40">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 font-semibold text-cyan-700">
                            {canSeeFullName ? initials : '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {canSeeFullName ? employee.fullName : 'Ẩn theo chính sách truy cập'}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">Mã nhân viên: {employee.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {canSeeDepartment ? departmentName : 'Đã ẩn'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                            canSeeRole ? getRoleBadgeStyle(employee.role) : 'border-slate-200 bg-slate-100 text-slate-500'
                          )}
                        >
                          {canSeeRole ? getRoleLabel(employee.role) : 'Đã ẩn'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {canSeeSalary ? formatCurrency(employee.salary ?? 0) : 'Bị giới hạn'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleEmployeeNavigation(employee.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                          >
                            <Eye className="h-4 w-4" />
                            Xem hồ sơ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:hidden">
          {filteredEmployees.map(({ employee, departmentName, visibleFields, initials }) => {
            const canSeeFullName = visibleFields.includes('fullName');
            const canSeeDepartment = visibleFields.includes('departmentId');
            const canSeeRole = visibleFields.includes('role');
            const canSeeSalary = visibleFields.includes('salary');

            return (
              <article
                key={employee.id}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 font-semibold text-cyan-700">
                      {canSeeFullName ? initials : '?'}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {canSeeFullName ? employee.fullName : 'Ẩn theo chính sách truy cập'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Mã nhân viên: {employee.id}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                      canSeeRole ? getRoleBadgeStyle(employee.role) : 'border-slate-200 bg-slate-100 text-slate-500'
                    )}
                  >
                    {canSeeRole ? getRoleLabel(employee.role) : 'Đã ẩn'}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Phòng ban</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {canSeeDepartment ? departmentName : 'Đã ẩn'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Lương</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {canSeeSalary ? formatCurrency(employee.salary ?? 0) : 'Bị giới hạn'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleEmployeeNavigation(employee.id)}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 transition hover:text-cyan-800"
                >
                  Mở hồ sơ
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-slate-900">Không có nhân viên phù hợp</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Hãy điều chỉnh từ khóa hoặc bộ lọc. Nếu danh sách vẫn trống, vai trò hiện tại của bạn có thể
              không được phép xem thêm hồ sơ nhân viên.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-6 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
