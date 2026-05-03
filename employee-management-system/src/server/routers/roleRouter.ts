import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { getRequestIp } from '../context';
import { assertPermission } from '../utils/rbac';

const roleInput = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(255).optional().nullable(),
});

const getUserAgent = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(', ') : value ?? null;

const assertRoleManagement = async (tx: Parameters<typeof assertPermission>[0], ctx: { user: any }) => {
  await assertPermission(tx, ctx.user, 'role', 'manage', 'all');
};

const getRoleOrThrow = async (tx: Parameters<typeof assertPermission>[0], id: string) => {
  const role = await tx.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
        orderBy: { permission: { resource: 'asc' } },
      },
      _count: { select: { userRoles: true } },
    },
  });

  if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found.' });
  return role;
};

const assertCustomRole = (role: { isSystem: boolean }) => {
  if (role.isSystem) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'System roles are immutable.',
    });
  }
};

export const roleRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.withSessionContext(async (tx) => {
      await assertPermission(tx, ctx.user, 'role', 'read', 'all');

      return tx.role.findMany({
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        include: {
          rolePermissions: {
            include: { permission: true },
            orderBy: [{ permission: { resource: 'asc' } }, { permission: { action: 'asc' } }],
          },
          _count: { select: { userRoles: true } },
        },
      });
    })
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermission(tx, ctx.user, 'role', 'read', 'all');
        return getRoleOrThrow(tx, input.id);
      })
    ),

  create: protectedProcedure
    .input(roleInput)
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertRoleManagement(tx, ctx);
        const ipAddress = getRequestIp(ctx.req);

        const role = await tx.role.create({
          data: {
            name: input.name,
            description: input.description || null,
            isSystem: false,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Role',
            targetId: role.id,
            action: 'CREATE',
            newValues: JSON.stringify({
              name: role.name,
              description: role.description,
              isSystem: role.isSystem,
            }),
            ipAddress,
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return role;
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: roleInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertRoleManagement(tx, ctx);
        const existing = await getRoleOrThrow(tx, input.id);
        assertCustomRole(existing);

        const assignedUsers = await tx.userRole.findMany({
          where: { roleId: input.id },
          select: { userId: true },
        });

        const role = await tx.role.update({
          where: { id: input.id },
          data: {
            name: input.data.name,
            description: input.data.description === undefined ? undefined : input.data.description || null,
          },
        });

        if (input.data.name && assignedUsers.length > 0) {
          await tx.appUser.updateMany({
            where: { id: { in: assignedUsers.map((userRole) => userRole.userId) } },
            data: { roleName: role.name },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Role',
            targetId: role.id,
            action: 'UPDATE',
            oldValues: JSON.stringify({
              name: existing.name,
              description: existing.description,
            }),
            newValues: JSON.stringify({
              name: role.name,
              description: role.description,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return role;
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertRoleManagement(tx, ctx);
        const role = await getRoleOrThrow(tx, input.id);
        assertCustomRole(role);

        if (role._count.userRoles > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Assign users to another role before deleting this role.',
          });
        }

        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await tx.role.delete({ where: { id: role.id } });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Role',
            targetId: role.id,
            action: 'DELETE',
            oldValues: JSON.stringify({
              name: role.name,
              description: role.description,
              permissionCount: role.rolePermissions.length,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),

  listPermissions: protectedProcedure
    .input(z.object({ roleId: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermission(tx, ctx.user, 'role', 'read', 'all');
        const role = await getRoleOrThrow(tx, input.roleId);
        const grantedIds = new Set(role.rolePermissions.map((rolePermission) => rolePermission.permissionId));
        const permissions = await tx.permission.findMany({
          orderBy: [{ resource: 'asc' }, { action: 'asc' }, { scope: 'asc' }],
        });

        return permissions.map((permission) => ({
          ...permission,
          granted: grantedIds.has(permission.id),
        }));
      })
    ),

  assignPermission: protectedProcedure
    .input(z.object({ roleId: z.string().uuid(), permissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertRoleManagement(tx, ctx);
        const role = await getRoleOrThrow(tx, input.roleId);
        assertCustomRole(role);

        const permission = await tx.permission.findUnique({ where: { id: input.permissionId } });
        if (!permission) throw new TRPCError({ code: 'NOT_FOUND', message: 'Permission not found.' });

        await tx.rolePermission.upsert({
          where: { roleId_permissionId: input },
          update: {},
          create: input,
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'RolePermission',
            targetId: role.id,
            action: 'CREATE',
            newValues: JSON.stringify({
              roleName: role.name,
              permission: `${permission.resource}.${permission.action}.${permission.scope}`,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),

  revokePermission: protectedProcedure
    .input(z.object({ roleId: z.string().uuid(), permissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertRoleManagement(tx, ctx);
        const role = await getRoleOrThrow(tx, input.roleId);
        assertCustomRole(role);

        const rolePermission = await tx.rolePermission.findUnique({
          where: { roleId_permissionId: input },
          include: { permission: true },
        });
        if (!rolePermission) return { success: true };

        await tx.rolePermission.delete({ where: { roleId_permissionId: input } });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'RolePermission',
            targetId: role.id,
            action: 'DELETE',
            oldValues: JSON.stringify({
              roleName: role.name,
              permission: `${rolePermission.permission.resource}.${rolePermission.permission.action}.${rolePermission.permission.scope}`,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),
});
