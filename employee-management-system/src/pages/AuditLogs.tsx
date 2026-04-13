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
import { cn } from '../lib/utils';
import type { AuditLog } from '../types';

type AuditLogInput = Partial<AuditLog> & {
  action?: string | null;
};

type AuditAction = AuditLog['action'];

const actionOptions: Array<{ value: 'ALL' | AuditAction; label: string }> = [
  { value: 'ALL', label: 'All actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'READ', label: 'Read' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'LOGIN_FAILED', label: 'Login failed' },
];

const actionBadgeStyles: Record<AuditAction, string> = {
  CREATE: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  READ: 'border-slate-200 bg-slate-100 text-slate-700',
  UPDATE: 'border-cyan-200 bg-cyan-100 text-cyan-800',
  DELETE: 'border-red-200 bg-red-100 text-red-800',
  LOGIN: 'border-blue-200 bg-blue-100 text-blue-800',
  LOGOUT: 'border-violet-200 bg-violet-100 text-violet-800',
  LOGIN_FAILED: 'border-amber-200 bg-amber-100 text-amber-800',
};

const actionIconStyles: Record<AuditAction, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  READ: 'bg-slate-100 text-slate-700',
  UPDATE: 'bg-cyan-100 text-cyan-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-violet-100 text-violet-700',
  LOGIN_FAILED: 'bg-amber-100 text-amber-700',
};

const actionCopy: Record<AuditAction, string> = {
  CREATE: 'Created',
  READ: 'Read',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  LOGIN_FAILED: 'Failed sign in',
};

const isAuditAction = (value: unknown): value is AuditAction =>
  value === 'CREATE' ||
  value === 'READ' ||
  value === 'UPDATE' ||
  value === 'DELETE' ||
  value === 'LOGIN' ||
  value === 'LOGOUT' ||
  value === 'LOGIN_FAILED';

const normalizeAuditLog = (log: AuditLogInput | null | undefined): AuditLog | null => {
  if (!log?.id || !log?.timestamp) return null;

  return {
    id: log.id,
    timestamp: log.timestamp,
    actorId: log.actorId || 'Unknown actor',
    actorName: log.actorName?.trim() || 'Unknown actor',
    targetId: log.targetId || 'Unknown target',
    targetName: log.targetName?.trim() || 'Unknown record',
    action: isAuditAction(log.action) ? log.action : 'UPDATE',
    changes: log.changes?.trim() || 'No change details were recorded for this activity.',
  };
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const diffInMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffInMinutes) < 60) return formatter.format(diffInMinutes, 'minute');

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) return formatter.format(diffInHours, 'hour');

  const diffInDays = Math.round(diffInHours / 24);
  return formatter.format(diffInDays, 'day');
};

export const AuditLogs: React.FC = () => {
  const { currentUser } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditAction>('ALL');
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const canAccessAuditLogs = !!currentUser && canViewAuditLogs(currentUser);

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

  if (!canAccessAuditLogs) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Audit log access is restricted</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your current role does not have permission to view system audit activity.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
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
            Loading audit activity...
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
              Protected audit visibility
            </div>

            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                System activity with clearer timelines and faster filtering.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Review create, update, and delete events across the system with a more readable audit stream
                built for investigation.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Total events</p>
              <p className="mt-3 text-3xl font-semibold text-white">{normalizedLogs.length}</p>
              <p className="mt-1 text-xs text-slate-300">All currently loaded audit entries.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Filtered results</p>
              <p className="mt-3 text-3xl font-semibold text-white">{filteredLogs.length}</p>
              <p className="mt-1 text-xs text-slate-300">Updates live as you search and filter.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-slate-200">Delete events</p>
              <p className="mt-3 text-3xl font-semibold text-white">{deleteCount}</p>
              <p className="mt-1 text-xs text-slate-300">Highest-risk actions in the current dataset.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Filter className="h-4 w-4 text-cyan-600" />
              Search and filter
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr),minmax(220px,0.6fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by actor, target, ID, action, or change details"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value as 'ALL' | AuditAction)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                aria-label="Filter by audit action"
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
            Reset filters
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-slate-900">{filteredLogs.length}</span> event
            {filteredLogs.length === 1 ? '' : 's'}
            {activeFilterCount > 0 && (
              <>
                {' '}
                with <span className="font-semibold text-slate-900">{activeFilterCount}</span> active filter
                {activeFilterCount === 1 ? '' : 's'}
              </>
            )}
            .
          </p>
          <p>{deferredSearch ? `Search synced for "${searchTerm.trim()}".` : 'Review the latest activity below.'}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Create events</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{createCount}</p>
          <p className="mt-1 text-sm text-slate-500">New records introduced into the system.</p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Update events</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{updateCount}</p>
          <p className="mt-1 text-sm text-slate-500">Existing records that were modified.</p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Delete events</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{deleteCount}</p>
          <p className="mt-1 text-sm text-slate-500">Entries removed from active system records.</p>
        </div>
      </section>

      <section className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileSearch className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-slate-900">No audit events match this view</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Try clearing the current filters or broadening your search terms to inspect more activity.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-6 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
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
                      <span className="text-sm font-medium text-slate-500">Event ID: {log.id}</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {actionCopy[log.action]} {log.targetName}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{log.changes}</p>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Actor</p>
                        <p className="mt-1 font-medium text-slate-900">{log.actorName}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.actorId}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Target</p>
                        <p className="mt-1 font-medium text-slate-900">{log.targetName}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.targetId}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recorded</p>
                        <p className="mt-1 font-medium text-slate-900">{formatTimestamp(log.timestamp)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(log.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {formatTimestamp(log.timestamp)}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};
