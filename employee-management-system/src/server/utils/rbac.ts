import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { UserContext } from '../context';

export type PermissionResource =
  | 'employee'
  | 'employee_sensitive'
  | 'department'
  | 'audit_log'
  | 'user';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'manage';
export type PermissionScope = 'all' | 'own_department' | 'other_department';

type PermissionResult = {
  HasPermission: number | boolean;
};

export const getDepartmentScope = (
  currentDepartmentId: string | null,
  targetDepartmentId: string | null,
): PermissionScope =>
  currentDepartmentId && targetDepartmentId && currentDepartmentId === targetDepartmentId
    ? 'own_department'
    : 'other_department';

export const checkPermission = async (
  db: Prisma.TransactionClient,
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  scope: PermissionScope = 'all',
) => {
  const [result] = await db.$queryRaw<PermissionResult[]>`
    EXEC [dbo].[sp_CheckPermission]
      @UserId = ${userId},
      @Resource = ${resource},
      @Action = ${action},
      @Scope = ${scope}
  `;

  return result?.HasPermission === true || result?.HasPermission === 1;
};

export const assertPermission = async (
  db: Prisma.TransactionClient,
  user: UserContext,
  resource: PermissionResource,
  action: PermissionAction,
  scope: PermissionScope = 'all',
) => {
  if (await checkPermission(db, user.userId, resource, action, scope)) return;

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Insufficient permissions for this action.',
  });
};
