import React from 'react';
import { AlertCircle, Loader2, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { cn, formatPermissionLabel, formatRoleLabel, translateApiError, translateDisplayText } from '../../lib/utils';

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  _count?: { userRoles: number };
};

type PermissionRow = {
  id: string;
  resource: string;
  action: string;
  scope: string;
  description: string | null;
  granted: boolean;
};

const permissionLabel = (permission: PermissionRow) =>
  `${permission.resource}.${permission.action}.${permission.scope}`;

export const RolesManagement: React.FC = () => {
  const utils = trpc.useUtils();
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [newRole, setNewRole] = React.useState({ name: '', description: '' });
  const [editRole, setEditRole] = React.useState({ name: '', description: '' });
  const [statusMessage, setStatusMessage] = React.useState('');

  const { data: roles = [], isLoading: loadingRoles } = trpc.role.list.useQuery();
  const selectedRole = (roles as RoleRow[]).find((role) => role.id === selectedRoleId) ?? null;
  const { data: rolePermissions = [], isLoading: loadingPermissions } = trpc.role.listPermissions.useQuery(
    { roleId: selectedRoleId },
    { enabled: !!selectedRoleId }
  );

  React.useEffect(() => {
    if (!selectedRoleId && roles[0]?.id) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  React.useEffect(() => {
    if (!selectedRole) return;
    setEditRole({
      name: selectedRole.name,
      description: selectedRole.description ?? '',
    });
  }, [selectedRole]);

  const invalidateRoles = () => {
    utils.role.list.invalidate();
    if (selectedRoleId) utils.role.listPermissions.invalidate({ roleId: selectedRoleId });
    utils.user.list.invalidate();
  };

  const createMutation = trpc.role.create.useMutation({
    onSuccess: (role) => {
      setNewRole({ name: '', description: '' });
      setSelectedRoleId(role.id);
      setStatusMessage('');
      invalidateRoles();
    },
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể tạo vai trò. Vui lòng thử lại.')),
  });

  const updateMutation = trpc.role.update.useMutation({
    onSuccess: () => {
      setStatusMessage('');
      invalidateRoles();
    },
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể cập nhật vai trò. Vui lòng thử lại.')),
  });

  const deleteMutation = trpc.role.delete.useMutation({
    onSuccess: () => {
      setSelectedRoleId('');
      setStatusMessage('');
      invalidateRoles();
    },
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể xóa vai trò. Vui lòng thử lại.')),
  });

  const assignMutation = trpc.role.assignPermission.useMutation({
    onSuccess: invalidateRoles,
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể cấp quyền. Vui lòng thử lại.')),
  });

  const revokeMutation = trpc.role.revokePermission.useMutation({
    onSuccess: invalidateRoles,
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể thu hồi quyền. Vui lòng thử lại.')),
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    assignMutation.isPending ||
    revokeMutation.isPending;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage('');
    createMutation.mutate({
      name: newRole.name.trim(),
      description: newRole.description.trim() || null,
    });
  };

  const handleUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRole) return;
    setStatusMessage('');
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        name: editRole.name.trim(),
        description: editRole.description.trim() || null,
      },
    });
  };

  const handleDelete = () => {
    if (!selectedRole || !window.confirm(`Bạn có chắc muốn xóa vai trò ${formatRoleLabel(selectedRole.name)} không?`)) return;
    setStatusMessage('');
    deleteMutation.mutate({ id: selectedRole.id });
  };

  const handlePermissionToggle = (permission: PermissionRow) => {
    if (!selectedRole) return;
    setStatusMessage('');

    if (permission.granted) {
      revokeMutation.mutate({ roleId: selectedRole.id, permissionId: permission.id });
      return;
    }

    assignMutation.mutate({ roleId: selectedRole.id, permissionId: permission.id });
  };

  if (loadingRoles) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        Đang tải vai trò...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cyan-700">Quản trị vai trò</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Vai trò hệ thống và tùy chỉnh</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Vai trò hệ thống được khóa, còn vai trò tùy chỉnh có thể cấu hình bằng các quyền cụ thể.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {roles.length} vai trò
          </div>
        </div>

        {statusMessage && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {statusMessage}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-6">
          <form onSubmit={handleCreate} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Tạo vai trò</h3>
                <p className="text-sm text-slate-500">Vai trò tùy chỉnh ban đầu chưa có quyền.</p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                value={newRole.name}
                onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))}
                placeholder="Tên vai trò"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                required
              />
              <input
                value={newRole.description}
                onChange={(event) => setNewRole((current) => ({ ...current, description: event.target.value }))}
                placeholder="Mô tả"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Tạo vai trò
            </button>
          </form>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {(roles as RoleRow[]).map((role) => {
                const isSelected = role.id === selectedRoleId;

                return (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition',
                      isSelected ? 'bg-cyan-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{formatRoleLabel(role.name)}</p>
                        {role.isSystem && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Hệ thống
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{translateDisplayText(role.description)}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {role._count?.userRoles ?? 0} người dùng
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {selectedRole ? (
            <>
              <form onSubmit={handleUpdate} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Chi tiết vai trò</h3>
                      <p className="text-sm text-slate-500">
                        {selectedRole.isSystem ? 'Thiết lập vai trò hệ thống đang bị khóa.' : 'Cập nhật tên và mô tả vai trò tùy chỉnh.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending || selectedRole.isSystem}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={selectedRole.isSystem ? formatRoleLabel(editRole.name) : editRole.name}
                    onChange={(event) => setEditRole((current) => ({ ...current, name: event.target.value }))}
                    disabled={selectedRole.isSystem}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    required
                  />
                  <input
                    value={selectedRole.isSystem ? translateDisplayText(editRole.description) : editRole.description}
                    onChange={(event) => setEditRole((current) => ({ ...current, description: event.target.value }))}
                    disabled={selectedRole.isSystem}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="Mô tả"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || selectedRole.isSystem}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu vai trò
                </button>
              </form>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-slate-900">Quyền truy cập</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedRole.isSystem
                      ? 'Quyền của vai trò hệ thống được hiển thị để kiểm tra.'
                      : 'Bật hoặc tắt quyền cho vai trò tùy chỉnh này.'}
                  </p>
                </div>

                {loadingPermissions ? (
                  <div className="flex items-center gap-3 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                    Đang tải quyền truy cập...
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(rolePermissions as PermissionRow[]).map((permission) => (
                      <label
                        key={permission.id}
                        className={cn(
                          'flex min-h-24 items-start gap-3 rounded-2xl border p-4 transition',
                          permission.granted ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 bg-slate-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={permission.granted}
                          onChange={() => handlePermissionToggle(permission)}
                          disabled={isPending || selectedRole.isSystem}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
                        />
                        <span>
                          <span className="block font-mono text-sm font-semibold text-slate-900">
                            {formatPermissionLabel(permission.resource, permission.action, permission.scope)}
                          </span>
                          <span className="mt-1 block font-mono text-xs text-slate-400">
                            {permissionLabel(permission)}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-500">
                            {translateDisplayText(permission.description)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Chọn một vai trò để quản lý.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
