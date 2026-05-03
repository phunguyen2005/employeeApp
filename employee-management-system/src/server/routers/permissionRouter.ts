import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { getRequestIp } from '../context';
import { assertPermission, checkPermission } from '../utils/rbac';

const permissionInput = z.object({
  resource: z.string().trim().min(2).max(50),
  action: z.string().trim().min(2).max(20),
  scope: z.string().trim().min(2).max(30),
  description: z.string().trim().max(255).optional().nullable(),
});

const getUserAgent = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(', ') : value ?? null;

const normalizePermissionInput = (input: z.infer<typeof permissionInput>) => ({
  resource: input.resource.toLowerCase(),
  action: input.action.toLowerCase(),
  scope: input.scope.toLowerCase(),
  description: input.description || null,
});

const assertPermissionManagement = async (
  tx: Parameters<typeof assertPermission>[0],
  user: Parameters<typeof assertPermission>[1],
) => {
  await assertPermission(tx, user, 'permission', 'manage', 'all');
};

export const permissionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.withSessionContext(async (tx) => {
      await assertPermission(tx, ctx.user, 'permission', 'read', 'all');

      return tx.permission.findMany({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }, { scope: 'asc' }],
        include: {
          _count: { select: { rolePermissions: true } },
        },
      });
    })
  ),

  check: protectedProcedure
    .input(
      z.object({
        resource: z.string().min(1),
        action: z.string().min(1),
        scope: z.string().min(1).default('all'),
      })
    )
    .query(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => ({
        hasPermission: await checkPermission(tx, ctx.user.userId, input.resource, input.action, input.scope),
      }))
    ),

  create: protectedProcedure
    .input(permissionInput)
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermissionManagement(tx, ctx.user);
        const data = normalizePermissionInput(input);

        const permission = await tx.permission.create({ data });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Permission',
            targetId: permission.id,
            action: 'CREATE',
            newValues: JSON.stringify(data),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return permission;
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: permissionInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermissionManagement(tx, ctx.user);

        const existing = await tx.permission.findUnique({
          where: { id: input.id },
          include: {
            rolePermissions: {
              include: { role: true },
            },
          },
        });
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Permission not found.' });

        const keyChangesRequested =
          input.data.resource !== undefined || input.data.action !== undefined || input.data.scope !== undefined;
        const isBoundToSystemRole = existing.rolePermissions.some((rolePermission) => rolePermission.role.isSystem);

        if (keyChangesRequested && isBoundToSystemRole) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Permission keys assigned to system roles cannot be changed.',
          });
        }

        const permission = await tx.permission.update({
          where: { id: input.id },
          data: {
            resource: input.data.resource?.trim().toLowerCase(),
            action: input.data.action?.trim().toLowerCase(),
            scope: input.data.scope?.trim().toLowerCase(),
            description: input.data.description === undefined ? undefined : input.data.description || null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Permission',
            targetId: permission.id,
            action: 'UPDATE',
            oldValues: JSON.stringify({
              resource: existing.resource,
              action: existing.action,
              scope: existing.scope,
              description: existing.description,
            }),
            newValues: JSON.stringify({
              resource: permission.resource,
              action: permission.action,
              scope: permission.scope,
              description: permission.description,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return permission;
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermissionManagement(tx, ctx.user);

        const permission = await tx.permission.findUnique({
          where: { id: input.id },
          include: { _count: { select: { rolePermissions: true } } },
        });
        if (!permission) throw new TRPCError({ code: 'NOT_FOUND', message: 'Permission not found.' });

        if (permission._count.rolePermissions > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Revoke this permission from all roles before deleting it.',
          });
        }

        await tx.permission.delete({ where: { id: input.id } });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Permission',
            targetId: permission.id,
            action: 'DELETE',
            oldValues: JSON.stringify({
              resource: permission.resource,
              action: permission.action,
              scope: permission.scope,
              description: permission.description,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),
});
