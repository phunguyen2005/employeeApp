import React, { useDeferredValue, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { canViewAuditLogs } from '../lib/rbac';
import {
  Activity,
  Clock3,
  FileSearch,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { cn, formatCurrency, formatDateTimeVi, formatRelativeTimeVi } from '../lib/utils';
import type { AuditLog } from '../types';

type AuditLogInput = Partial<AuditLog> & {
  action?: string | null;
};

type AuditAction = AuditLog['action'];

const actionOptions: Array<{ value: 'ALL' | AuditAction; label: string }> = [
  { value: 'ALL', label: 'Tất cả thao tác' },
  { value: 'CREATE', label: 'Tạo mới' },
  { value: 'READ', label: 'Xem' },
  { value: 'UPDATE', label: 'Cập nhật' },
  { value: 'DELETE', label: 'Xóa' },
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'LOGOUT', label: 'Đăng xuất' },
  { value: 'LOGIN_FAILED', label: 'Đăng nhập thất bại' },
  { value: 'LOGIN_SUCCESS', label: 'Đăng nhập thành công' },
  { value: 'LOGIN_FAILURE', label: 'Đăng nhập thất bại' },
];

const actionBadgeStyles: Record<AuditAction, string> = {
  CREATE: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  READ: 'border-slate-200 bg-slate-100 text-slate-700',
  UPDATE: 'border-cyan-200 bg-cyan-100 text-cyan-800',
  DELETE: 'border-red-200 bg-red-100 text-red-800',
  LOGIN: 'border-blue-200 bg-blue-100 text-blue-800',
  LOGOUT: 'border-violet-200 bg-violet-100 text-violet-800',
  LOGIN_FAILED: 'border-amber-200 bg-amber-100 text-amber-800',
  LOGIN_SUCCESS: 'border-blue-200 bg-blue-100 text-blue-800',
  LOGIN_FAILURE: 'border-amber-200 bg-amber-100 text-amber-800',
};

const actionIconStyles: Record<AuditAction, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  READ: 'bg-slate-100 text-slate-700',
  UPDATE: 'bg-cyan-100 text-cyan-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-violet-100 text-violet-700',
  LOGIN_FAILED: 'bg-amber-100 text-amber-700',
  LOGIN_SUCCESS: 'bg-blue-100 text-blue-700',
  LOGIN_FAILURE: 'bg-amber-100 text-amber-700',
};

const actionCopy: Record<AuditAction, string> = {
  CREATE: 'Đã tạo',
  READ: 'Đã xem',
  UPDATE: 'Đã cập nhật',
  DELETE: 'Đã xóa',
  LOGIN: 'Đã đăng nhập',
  LOGOUT: 'Đã đăng xuất',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_FAILURE: 'Đăng nhập thất bại',
};

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
  employeeId: 'Mã nhân viên',
  permission: 'Quyền',
  permissionCount: 'Số quyền',
  resource: 'Tài nguyên',
  action: 'Thao tác',
  scope: 'Phạm vi',
};

const isAuditAction = (value: unknown): value is AuditAction =>
  value === 'CREATE' ||
  value === 'READ' ||
  value === 'UPDATE' ||
  value === 'DELETE' ||
  value === 'LOGIN' ||
  value === 'LOGOUT' ||
  value === 'LOGIN_FAILED' ||
  value === 'LOGIN_SUCCESS' ||
  value === 'LOGIN_FAILURE';

const normalizeAuditLog = (log: AuditLogInput | null | undefined): AuditLog | null => {
  if (!log?.id || !log?.timestamp) return null;

  return {
    id: log.id,
    timestamp: log.timestamp,
    actorId: log.actorId || 'Không xác định người thực hiện',
    actorName: log.actorName?.trim() === '[System]' ? 'Hệ thống' : log.actorName?.trim() || 'Không xác định người thực hiện',
    targetId: log.targetId || 'Không xác định đối tượng',
    targetName: log.targetName?.trim() || 'Không xác định hồ sơ',
    action: isAuditAction(log.action) ? log.action : 'UPDATE',
    changes: log.changes?.trim() || 'Không có chi tiết thay đổi cho hoạt động này.',
  };
};

const formatAuditPrimitive = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'trống';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN').format(value);
  if (typeof value === 'string') return value;

  return JSON.stringify(value);
};

const formatAuditObject = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return formatAuditPrimitive(value);

  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => {
      const formattedValue =
        key === 'salary' && entry !== null && entry !== undefined && !Number.isNaN(Number(entry))
          ? formatCurrency(Number(entry))
          : formatAuditPrimitive(entry);

      return `${fieldLabels[key] ?? key}: ${formattedValue}`;
    })
    .join(', ');
};

const formatAuditChanges = (changes: string) => {
  try {
    const parsed = JSON.parse(changes);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const oldValues = formatAuditObject((parsed as Record<string, unknown>).oldValues);
      const newValues = formatAuditObject((parsed as Record<string, unknown>).newValues);
      return `${fieldLabels.oldValues}: ${oldValues}; ${fieldLabels.newValues}: ${newValues}`;
    }
  } catch {
    return changes;
  }

  return changes;
};

export const AuditLogs: React.FC = () => {
  const { currentUser } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditAction>('ALL');
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const hasStaticAuditAccess = !!currentUser && canViewAuditLogs(currentUser);

  const { data: dynamicAuditAccess, isLoading: isCheckingAuditAccess } = trpc.permission.check.useQuery(
    { resource: 'audit_log', action: 'read', scope: 'all' },
    {
      enabled: !!currentUser && !hasStaticAuditAccess,
    }
  );

  const canAccessAuditLogs = !!currentUser && (hasStaticAuditAccess || !!dynamicAuditAccess?.hasPermission);

  const { data: auditLogs = [], isLoading } = trpc.audit.getAll.useQuery(undefined, {
    enabled: canAccessAuditLogs,
  });

  const normalizedLogs = useMemo(
    () =>
      (auditLogs as AuditLogInput[])
        .map((log) => normalizeAuditLog(log))
        .filter((log): log is AuditLog => !!log)
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()),
    [auditLogs]
  );

  const filteredLogs = useMemo(
    () =>
      normalizedLogs.filter((log) => {
        const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

        const haystack = [
          log.actorName,
          log.actorId,
          log.targetName,
          log.targetId,
          log.changes,
          log.action,
        ]
          .join(' ')
          .toLowerCase();

        const matchesSearch = !deferredSearch || haystack.includes(deferredSearch);
        return matchesAction && matchesSearch;
      }),
    [actionFilter, deferredSearch, normalizedLogs]
  );

  const createCount = normalizedLogs.filter((log) => log.action === 'CREATE').length;
  const updateCount = normalizedLogs.filter((log) => log.action === 'UPDATE').length;
  const deleteCount = normalizedLogs.filter((log) => log.action === 'DELETE').length;
  const activeFilterCount = [searchTerm.trim(), actionFilter !== 'ALL'].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm('');
    setActionFilter('ALL');
  };

  if (!canAccessAuditLogs && !isCheckingAuditAccess) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Quyền xem nhật ký kiểm toán bị giới hạn</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Vai trò hiện tại của bạn không có quyền xem hoạt động kiểm toán của hệ thống.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || isCheckingAuditAccess) {
    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-8 py-9 text-white shadow-[0_24px_60px_-24px_rgba(8,47,73,0.75)]">
          <div className="h-5 w-40 animate-pulse rounded-full bg-white/20" />
          <div className="mt-4 h-11 w-2/3 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-3 h-5 w-1/2 animate-pulse rounded-full bg-white/10" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-9 w-16 animate-pulse rounded-2xl bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
            Đang tải hoạt động kiểm toán...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-white shadow-[0_24px_60px_-24px_rgba(8,47,73,0.75)]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-cyan-100 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4" />
              Nhật ký kiểm toán được bảo vệ
            </div>

            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Hoạt động hệ thống với dòng thời gian rõ ràng và bộ lọc nhanh hơn.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Theo dõi các sự kiện tạo mới, cập nhật và xóa trong hệ thống bằng luồng nhật ký dễ đọc,
                phù hợp cho việc rà soát.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Tổng sự kiện</p>
              <p className="mt-3 text-3xl font-semibold text-white">{normalizedLogs.length}</p>
              <p className="mt-1 text-xs text-slate-300">Tất cả mục nhật ký đã tải.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Kết quả sau lọc</p>
              <p className="mt-3 text-3xl font-semibold text-white">{filteredLogs.length}</p>
              <p className="mt-1 text-xs text-slate-300">Cập nhật ngay khi bạn tìm kiếm và lọc.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Sự kiện xóa</p>
              <p className="mt-3 text-3xl font-semibold text-white">{deleteCount}</p>
              <p className="mt-1 text-xs text-slate-300">Những thao tác có rủi ro cao trong dữ liệu hiện tại.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Filter className="h-4 w-4 text-cyan-600" />
              Tìm kiếm và lọc
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr),minmax(220px,0.6fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo người thực hiện, đối tượng, mã, thao tác hoặc chi tiết thay đổi"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
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
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value as 'ALL' | AuditAction)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                aria-label="Lọc theo thao tác kiểm toán"
              >
                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Đặt lại bộ lọc
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Đang hiển thị <span className="font-semibold text-slate-900">{filteredLogs.length}</span> sự kiện
            {activeFilterCount > 0 && (
              <>
                {' '}
                với <span className="font-semibold text-slate-900">{activeFilterCount}</span> bộ lọc đang áp dụng
              </>
            )}
            .
          </p>
          <p>{deferredSearch ? `Đã đồng bộ tìm kiếm cho "${searchTerm.trim()}".` : 'Xem hoạt động mới nhất bên dưới.'}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Sự kiện tạo mới</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{createCount}</p>
          <p className="mt-1 text-sm text-slate-500">Hồ sơ mới được thêm vào hệ thống.</p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Sự kiện cập nhật</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{updateCount}</p>
          <p className="mt-1 text-sm text-slate-500">Các hồ sơ hiện có đã được chỉnh sửa.</p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Sự kiện xóa</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{deleteCount}</p>
          <p className="mt-1 text-sm text-slate-500">Các mục đã bị loại khỏi hồ sơ đang hoạt động.</p>
        </div>
      </section>

      <section className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileSearch className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-slate-900">Không có sự kiện kiểm toán phù hợp</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Hãy xóa bộ lọc hiện tại hoặc mở rộng từ khóa để xem thêm hoạt động.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-6 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <article
              key={log.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                      actionIconStyles[log.action]
                    )}
                  >
                    {log.action === 'DELETE' ? (
                      <Trash2 className="h-5 w-5" />
                    ) : (
                      <Activity className="h-5 w-5" />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                          actionBadgeStyles[log.action]
                        )}
                      >
                        {actionCopy[log.action]}
                      </span>
                      <span className="text-sm font-medium text-slate-500">Mã sự kiện: {log.id}</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {actionCopy[log.action]} {log.targetName}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{formatAuditChanges(log.changes)}</p>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Người thực hiện</p>
                        <p className="mt-1 font-medium text-slate-900">{log.actorName}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.actorId}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Đối tượng</p>
                        <p className="mt-1 font-medium text-slate-900">{log.targetName}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.targetId}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ghi nhận lúc</p>
                        <p className="mt-1 font-medium text-slate-900">{formatDateTimeVi(log.timestamp)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatRelativeTimeVi(log.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {formatDateTimeVi(log.timestamp)}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};
