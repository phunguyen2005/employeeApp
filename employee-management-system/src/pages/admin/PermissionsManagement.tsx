import React from 'react';
import { AlertCircle, KeyRound, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { formatPermissionLabel, translateApiError, translateDisplayText } from '../../lib/utils';

type PermissionRow = {
  id: string;
  resource: string;
  action: string;
  scope: string;
  description: string | null;
  _count?: { rolePermissions: number };
};

type PermissionForm = {
  resource: string;
  action: string;
  scope: string;
  description: string;
};

const emptyForm: PermissionForm = {
  resource: '',
  action: '',
  scope: 'all',
  description: '',
};

const permissionName = (permission: PermissionRow) =>
  `${permission.resource}.${permission.action}.${permission.scope}`;

export const PermissionsManagement: React.FC = () => {
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<PermissionForm>(emptyForm);
  const [statusMessage, setStatusMessage] = React.useState('');

  const { data: permissions = [], isLoading } = trpc.permission.list.useQuery();

  const invalidatePermissions = () => {
    utils.permission.list.invalidate();
    utils.role.list.invalidate();
  };

  const createMutation = trpc.permission.create.useMutation({
    onSuccess: () => {
      setForm(emptyForm);
      setStatusMessage('');
      invalidatePermissions();
    },
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể tạo quyền. Vui lòng thử lại.')),
  });

  const updateMutation = trpc.permission.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setForm(emptyForm);
      setStatusMessage('');
      invalidatePermissions();
    },
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể cập nhật quyền. Vui lòng thử lại.')),
  });

  const deleteMutation = trpc.permission.delete.useMutation({
    onSuccess: invalidatePermissions,
    onError: (error) => setStatusMessage(translateApiError(error.message, 'Hiện chưa thể xóa quyền. Vui lòng thử lại.')),
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setStatusMessage('');
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setStatusMessage('');
  };

  const startEdit = (permission: PermissionRow) => {
    setEditingId(permission.id);
    setStatusMessage('');
    setForm({
      resource: permission.resource,
      action: permission.action,
      scope: permission.scope,
      description: permission.description ?? '',
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage('');

    const payload = {
      resource: form.resource.trim(),
      action: form.action.trim(),
      scope: form.scope.trim(),
      description: form.description.trim() || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleDelete = (permission: PermissionRow) => {
    if (!window.confirm(`Bạn có chắc muốn xóa quyền ${permissionName(permission)} không?`)) return;
    setStatusMessage('');
    deleteMutation.mutate({ id: permission.id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        Đang tải quyền truy cập...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cyan-700">Quản trị quyền truy cập</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Danh mục quyền</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Quản lý tài nguyên, thao tác và phạm vi được dùng cho các vai trò tùy chỉnh.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {permissions.length} quyền
          </div>
        </div>

        {statusMessage && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {statusMessage}
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Chỉnh sửa quyền' : 'Tạo quyền'}
              </h3>
              <p className="text-sm text-slate-500">Dùng mã chữ thường như employee, read và all.</p>
            </div>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Hủy
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            name="resource"
            value={form.resource}
            onChange={handleChange}
            placeholder="Tài nguyên"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <input
            name="action"
            value={form.action}
            onChange={handleChange}
            placeholder="Thao tác"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <input
            name="scope"
            value={form.scope}
            onChange={handleChange}
            placeholder="Phạm vi"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            required
          />
          <input
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Mô tả"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? 'Lưu quyền' : 'Tạo quyền'}
        </button>
      </form>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quyền</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mô tả</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Đang gán</th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(permissions as PermissionRow[]).map((permission) => {
                const assignmentCount = permission._count?.rolePermissions ?? 0;

                return (
                  <tr key={permission.id} className="transition hover:bg-cyan-50/40">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatPermissionLabel(permission.resource, permission.action, permission.scope)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-400">{permissionName(permission)}</p>
                      <p className="mt-1 text-xs text-slate-400">{permission.id}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{translateDisplayText(permission.description)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {assignmentCount} vai trò
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(permission)}
                          disabled={isPending}
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(permission)}
                          disabled={isPending || assignmentCount > 0}
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
