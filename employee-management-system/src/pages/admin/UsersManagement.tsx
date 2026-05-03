import React from 'react';
import { AlertCircle, Loader2, LockOpen, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { cn, formatDateTimeVi, formatDepartmentName, formatRoleLabel, translateApiError } from '../../lib/utils';

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  roleId: string | null;
  roleName: string;
  isActive: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  departmentName: string | null;
};

type CreateUserForm = {
  fullName: string;
  email: string;
  password: string;
  dob: string;
  departmentId: string;
  roleId: string;
  salary: string;
  taxCode: string;
};

const initialForm: CreateUserForm = {
  fullName: '',
  email: '',
  password: '',
  dob: '',
  departmentId: '',
  roleId: '',
  salary: '0',
  taxCode: 'UNKNOWN',
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Chưa từng đăng nhập';
  return formatDateTimeVi(value);
};

export const UsersManagement: React.FC = () => {
  const utils = trpc.useUtils();
  const [form, setForm] = React.useState<CreateUserForm>(initialForm);
  const [statusMessage, setStatusMessage] = React.useState('');

  const { data: users = [], isLoading: loadingUsers } = trpc.user.list.useQuery();
  const { data: roles = [], isLoading: loadingRoles } = trpc.role.list.useQuery();
  const { data: departments = [] } = trpc.department.getAll.useQuery();

  React.useEffect(() => {
    setForm((current) => {
      const nextRoleId = current.roleId || roles[0]?.id || '';
      const nextDepartmentId = current.departmentId || departments[0]?.id || '';
      if (nextRoleId === current.roleId && nextDepartmentId === current.departmentId) return current;
      return { ...current, roleId: nextRoleId, departmentId: nextDepartmentId };
    });
  }, [departments, roles]);

  const invalidateUsers = () => {
    utils.user.list.invalidate();
    utils.employee.getAll.invalidate();
  };

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      setForm((current) => ({
        ...initialForm,
        roleId: current.roleId,
        departmentId: current.departmentId,
      }));
      setStatusMessage('');
      invalidateUsers();
    },
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể tạo người dùng. Vui lòng thử lại.')),
  });

  const assignRoleMutation = trpc.user.assignRole.useMutation({
    onSuccess: invalidateUsers,
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể gán vai trò. Vui lòng thử lại.')),
  });

  const updateStatusMutation = trpc.user.updateStatus.useMutation({
    onSuccess: invalidateUsers,
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể cập nhật trạng thái. Vui lòng thử lại.')),
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: invalidateUsers,
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể xóa người dùng. Vui lòng thử lại.')),
  });

  const isPending =
    createMutation.isPending ||
    assignRoleMutation.isPending ||
    updateStatusMutation.isPending ||
    deleteMutation.isPending;

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setStatusMessage('');
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage('');

    createMutation.mutate({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
      dob: new Date(form.dob).toISOString(),
      departmentId: form.departmentId || null,
      roleId: form.roleId,
      salary: Number(form.salary || 0),
      taxCode: form.taxCode.trim() || 'UNKNOWN',
    });
  };

  const handleDelete = (user: UserRow) => {
    if (!window.confirm(`Bạn có chắc muốn vô hiệu hóa ${user.email} không?`)) return;
    setStatusMessage('');
    deleteMutation.mutate({ userId: user.id });
  };

  if (loadingUsers || loadingRoles) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        Đang tải danh sách người dùng...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cyan-700">Quản trị người dùng</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Tài khoản và phân vai trò</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tạo tài khoản, đổi vai trò, mở khóa đăng nhập và vô hiệu hóa quyền truy cập tại một nơi.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {users.length} tài khoản
          </div>
        </div>

        {statusMessage && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {statusMessage}
          </div>
        )}
      </section>

      <form onSubmit={handleCreate} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Tạo người dùng</h3>
            <p className="text-sm text-slate-500">Người dùng mới sẽ có hồ sơ nhân viên và một vai trò được gán.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            name="fullName"
            value={form.fullName}
            onChange={handleFormChange}
            placeholder="Họ và tên"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleFormChange}
            placeholder="Email"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleFormChange}
            placeholder="Mật khẩu"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <input
            name="dob"
            type="date"
            value={form.dob}
            onChange={handleFormChange}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <select
            name="departmentId"
            value={form.departmentId}
            onChange={handleFormChange}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {formatDepartmentName(department.name)}
              </option>
            ))}
          </select>
          <select
            name="roleId"
            value={form.roleId}
            onChange={handleFormChange}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {formatRoleLabel(role.name)}
              </option>
            ))}
          </select>
          <input
            name="salary"
            type="number"
            min="0"
            value={form.salary}
            onChange={handleFormChange}
            placeholder="Lương (VNĐ)"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
          <input
            name="taxCode"
            value={form.taxCode}
            onChange={handleFormChange}
            placeholder="Mã số thuế"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !form.roleId}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Tạo người dùng
        </button>
      </form>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Người dùng</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vai trò</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trạng thái</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Đăng nhập</th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users as UserRow[]).map((user) => {
                const isLocked = !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now();

                return (
                  <tr key={user.id} className="transition hover:bg-cyan-50/40">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{user.fullName}</p>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDepartmentName(user.departmentName)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={user.roleId ?? ''}
                        onChange={(event) => assignRoleMutation.mutate({ userId: user.id, roleId: event.target.value })}
                        disabled={isPending}
                        className="min-w-44 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {formatRoleLabel(role.name)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                          user.isActive
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        )}
                      >
                        {user.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                      </span>
                      {isLocked && <p className="mt-2 text-xs text-amber-700">Bị khóa đến {formatDateTime(user.lockedUntil)}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <p>{formatDateTime(user.lastLoginAt)}</p>
                      <p className="mt-1 text-xs text-slate-400">{user.failedAttempts} lần đăng nhập thất bại</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ userId: user.id, unlock: true })}
                          disabled={isPending || (!isLocked && user.failedAttempts === 0)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <LockOpen className="h-4 w-4" />
                          Mở khóa
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                          {user.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
