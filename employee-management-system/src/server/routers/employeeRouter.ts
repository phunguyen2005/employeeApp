import { protectedProcedure, router } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { applyColumnMasking, getRowLevelFilter } from '../utils/rbac';
import bcrypt from 'bcryptjs';

export const employeeRouter = router({
  // Read List
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const filter = getRowLevelFilter(ctx.user);
    const rawEmployees = await ctx.prisma.employee.findMany({
      where: filter,
    });
    return rawEmployees.map((e) => {
      const { password, ...rest } = e as any;
      return applyColumnMasking(ctx.user, rest);
    });
  }),

  // Read Singular
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const filter = getRowLevelFilter(ctx.user);
      const employee = await ctx.prisma.employee.findFirst({
        where: { id: input.id, ...filter },
      });

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employee not found or unauthorized to view',
        });
      }

      const { password, ...rest } = employee as any;
      return applyColumnMasking(ctx.user, rest);
    }),

  // Update
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          fullName: z.string().optional(),
          dob: z.string().optional(),
          email: z.string().optional(),
          departmentId: z.string().optional(),
          salary: z.number().optional(),
          taxCode: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Block self-editing universally
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot edit your own record.',
        });
      }

      // 2. Authorize based on roles
      if (['REGULAR', 'MANAGER', 'ACCOUNTING'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You lack write permissions.',
        });
      }

      const targetUser = await ctx.prisma.employee.findUnique({
        where: { id: input.id },
      });

      if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role === 'HR_EMPLOYEE') {
        if (targetUser.departmentId === ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'HR Employees cannot edit records in their own department.',
          });
        }
      }

      // 3. Peform the update
      const updated = await ctx.prisma.employee.update({
        where: { id: input.id },
        data: input.data,
      });

      // 4. Fire the Audit Log
      await ctx.prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          actorName: ctx.user.fullName,
          targetId: targetUser.id,
          targetName: targetUser.fullName,
          action: 'UPDATE',
          changes: JSON.stringify(input.data),
        },
      });

      const { password, ...rest } = updated as any;
      return applyColumnMasking(ctx.user, rest);
    }),

  // Create
  create: protectedProcedure
    .input(z.object({
      fullName: z.string(),
      dob: z.string(),
      email: z.string().email(),
      password: z.string().min(1),
      departmentId: z.string().optional(),
      salary: z.number(),
      taxCode: z.string(),
      role: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (['REGULAR', 'MANAGER', 'ACCOUNTING'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You lack create permissions.' });
      }

      if (ctx.user.role === 'HR_EMPLOYEE' && input.departmentId === ctx.user.departmentId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'HR Employees cannot create records in their own department.' });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      
      const newEmployee = await ctx.prisma.employee.create({
        data: {
          fullName: input.fullName,
          dob: new Date(input.dob),
          email: input.email,
          password: passwordHash,
          departmentId: input.departmentId,
          salary: input.salary,
          taxCode: input.taxCode,
          role: input.role,
        }
      });

      await ctx.prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          actorName: ctx.user.fullName,
          targetId: newEmployee.id,
          targetName: newEmployee.fullName,
          action: 'CREATE',
          changes: 'Created employee record',
        },
      });

      const { password, ...rest } = newEmployee as any;
      return applyColumnMasking(ctx.user, rest);
    }),

  // Delete
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete your own record.' });
      }

      if (['REGULAR', 'MANAGER', 'ACCOUNTING'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You lack delete permissions.' });
      }

      const targetUser = await ctx.prisma.employee.findUnique({ where: { id: input.id } });
      if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role === 'HR_EMPLOYEE' && targetUser.departmentId === ctx.user.departmentId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'HR Employees cannot delete records in their own department.' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.department.updateMany({
          where: { managerId: input.id },
          data: { managerId: null },
        });

        await tx.auditLog.deleteMany({
          where: {
            OR: [
              { actorId: input.id },
              { targetId: input.id }
            ]
          }
        });

        await tx.employee.delete({
          where: { id: input.id }
        });
      });

      return { success: true };
    }),
});
