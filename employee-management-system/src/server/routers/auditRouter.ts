import { protectedProcedure, router } from '../trpc';
import { assertPermission } from '../utils/rbac';
import { buildReadableAuditChanges, formatAuditEventCode } from '../../lib/auditLogPresentation';

type AuditLogRow = {
  id: string;
  timestamp: Date | string;
  actorId: string | null;
  actorName: string | null;
  targetTable: string;
  targetId: string;
  targetName: string | null;
  action: string;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

const parseJson = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const buildDepartmentMap = (departments: Array<{ id: string; name: string }>) =>
  Object.fromEntries(departments.map((department) => [department.id.toLowerCase(), department.name]));

export const auditRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) =>
    ctx.withSessionContext(async (tx) => {
      await assertPermission(tx, ctx.user, 'audit_log', 'read', 'all');

      const rows = await tx.$queryRaw<AuditLogRow[]>`
        SELECT id, [timestamp], actorId, actorName, targetTable, targetId, targetName,
               [action], oldValues, newValues, ipAddress, userAgent
        FROM [dbo].[vw_AuditLogDetail]
        ORDER BY [timestamp] DESC
      `;
      const departments = await tx.department.findMany({
        select: { id: true, name: true },
      });
      const departmentNamesById = buildDepartmentMap(departments);

      return rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : new Date(row.timestamp).toISOString(),
        eventCode: formatAuditEventCode(row.id, row.timestamp),
        actorId: row.actorId,
        actorName: row.actorName ?? '[System]',
        targetTable: row.targetTable,
        targetId: row.targetId,
        targetName: row.targetName ?? row.targetId,
        action: row.action,
        changes: buildReadableAuditChanges(parseJson(row.oldValues), parseJson(row.newValues), departmentNamesById),
        oldValues: row.oldValues,
        newValues: row.newValues,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
      }));
    })
  ),
});
