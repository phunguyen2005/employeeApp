import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { getRequestIp } from '../context';
import { assertPermission } from '../utils/rbac';
import { getNextEmployeeCode } from '../utils/employeeCode';

const getUserAgent = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(', ') : value ?? null;

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const assertUserManagement = async (tx: Parameters<typeof assertPermission>[0], user: Parameters<typeof assertPermission>[1]) => {
  await assertPermission(tx, user, 'user', 'manage', 'all');
};

const userInclude = {
  employee: {
    include: {
      department: true,
    },
  },
  userRoles: {
    include: {
      role: true,
    },
  },
} as const;

const toUserPayload = (user: any) => {
  const assignedRole = user.userRoles?.[0]?.role ?? null;

  return {
    id: user.id as string,
    email: user.email as string,
    roleName: (assignedRole?.name ?? user.roleName ?? 'REGULAR') as string,
    roleId: (assignedRole?.id ?? null) as string | null,
    isActive: Boolean(user.isActive),
    lastLoginAt: toIso(user.lastLoginAt),
    failedAttempts: Number(user.failedAttempts ?? 0),
    lockedUntil: toIso(user.lockedUntil),
    createdAt: toIso(user.createdAt),
    employeeId: (user.employee?.id ?? null) as string | null,
    employeeCode: (user.employee?.employeeCode ?? null) as string | null,
    fullName: (user.employee?.fullName ?? '[No employee profile]') as string,
    departmentId: (user.employee?.departmentId ?? null) as string | null,
    departmentName: (user.employee?.department?.name ?? null) as string | null,
    status: (user.employee?.status ?? null) as string | null,
  };
};

export const userRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.withSessionContext(async (tx) => {
      await assertPermission(tx, ctx.user, 'user', 'read', 'all');

      const users = await tx.appUser.findMany({
        orderBy: { email: 'asc' },
        include: userInclude,
      });

      return users.map(toUserPayload);
    })
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermission(tx, ctx.user, 'user', 'read', 'all');

        const user = await tx.appUser.findUnique({
          where: { id: input.id },
          include: userInclude,
        });

        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        return toUserPayload(user);
      })
    ),

  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
        fullName: z.string().trim().min(2),
        dob: z.string(),
        departmentId: z.string().uuid().optional().nullable(),
        roleId: z.string().uuid(),
        salary: z.number().nonnegative().optional(),
        taxCode: z.string().trim().min(3).optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertUserManagement(tx, ctx.user);

        const role = await tx.role.findUnique({ where: { id: input.roleId } });
        if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found.' });

        const passwordHash = await bcrypt.hash(input.password, 10);
        const employeeCode = await getNextEmployeeCode(tx);
        const appUser = await tx.appUser.create({
          data: {
            email: input.email.trim(),
            passwordHash,
            roleName: role.name,
          },
        });

        const employee = await tx.employee.create({
          data: {
            employeeCode,
            userId: appUser.id,
            fullName: input.fullName,
            dob: new Date(input.dob),
            departmentId: input.departmentId ?? null,
            sensitive: {
              create: {
                salary: input.salary ?? 0,
                taxCode: input.taxCode?.trim() || 'UNKNOWN',
              },
            },
          },
        });

        await tx.userRole.create({
          data: {
            userId: appUser.id,
            roleId: role.id,
            assignedBy: ctx.user.userId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'AppUser',
            targetId: appUser.id,
            action: 'CREATE',
            newValues: JSON.stringify({
              email: appUser.email,
              employeeCode: employee.employeeCode,
              fullName: employee.fullName,
              departmentId: employee.departmentId,
              roleName: role.name,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return toUserPayload({
          ...appUser,
          employee: { ...employee, department: null },
          userRoles: [{ role }],
        });
      })
    ),

  updateStatus: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        isActive: z.boolean().optional(),
        unlock: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertUserManagement(tx, ctx.user);

        if (input.userId === ctx.user.userId && input.isActive === false) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot deactivate your own account.' });
        }

        const existing = await tx.appUser.findUnique({ where: { id: input.userId } });
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });

        const data: { isActive?: boolean; failedAttempts?: number; lockedUntil?: null } = {};
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.unlock) {
          data.failedAttempts = 0;
          data.lockedUntil = null;
        }

        if (Object.keys(data).length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No status change was requested.' });
        }

        const updated = await tx.appUser.update({
          where: { id: input.userId },
          data,
        });

        if (input.isActive === false) {
          await tx.userSession.updateMany({
            where: { userId: input.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'AppUser',
            targetId: input.userId,
            action: 'UPDATE',
            oldValues: JSON.stringify({
              isActive: existing.isActive,
              failedAttempts: existing.failedAttempts,
              lockedUntil: existing.lockedUntil,
            }),
            newValues: JSON.stringify({
              isActive: updated.isActive,
              failedAttempts: updated.failedAttempts,
              lockedUntil: updated.lockedUntil,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),

  assignRole: protectedProcedure
    .input(z.object({ userId: z.string().uuid(), roleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertUserManagement(tx, ctx.user);

        const [target, role] = await Promise.all([
          tx.appUser.findUnique({
            where: { id: input.userId },
            include: {
              userRoles: {
                include: { role: true },
              },
            },
          }),
          tx.role.findUnique({ where: { id: input.roleId } }),
        ]);

        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found.' });

        if (input.userId === ctx.user.userId && role.name !== 'ADMIN') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot remove your own admin role.' });
        }

        const oldRoleName = target.userRoles[0]?.role.name ?? target.roleName;

        await tx.userRole.deleteMany({ where: { userId: input.userId } });
        await tx.userRole.create({
          data: {
            userId: input.userId,
            roleId: role.id,
            assignedBy: ctx.user.userId,
          },
        });
        await tx.appUser.update({
          where: { id: input.userId },
          data: { roleName: role.name },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'UserRole',
            targetId: input.userId,
            action: 'UPDATE',
            oldValues: JSON.stringify({ roleName: oldRoleName }),
            newValues: JSON.stringify({ roleName: role.name }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),

  delete: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertUserManagement(tx, ctx.user);

        if (input.userId === ctx.user.userId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete your own account.' });
        }

        const target = await tx.appUser.findUnique({
          where: { id: input.userId },
          include: { employee: true },
        });
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });

        if (target.employee) {
          await tx.$executeRaw`
            EXEC [dbo].[sp_SoftDeleteEmployee]
              @ActorUserId = ${ctx.user.userId},
              @EmployeeId = ${target.employee.id},
              @IPAddress = ${getRequestIp(ctx.req)}
          `;
        } else {
          await tx.appUser.update({
            where: { id: input.userId },
            data: { isActive: false },
          });
          await tx.userSession.updateMany({
            where: { userId: input.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'AppUser',
            targetId: input.userId,
            action: 'DELETE',
            oldValues: JSON.stringify({
              email: target.email,
              roleName: target.roleName,
              employeeCode: target.employee?.employeeCode ?? null,
            }),
            ipAddress: getRequestIp(ctx.req),
            userAgent: getUserAgent(ctx.req.headers['user-agent']),
          },
        });

        return { success: true };
      })
    ),
});
