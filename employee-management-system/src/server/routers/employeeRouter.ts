import { protectedProcedure, router } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getRequestIp } from '../context';
import { assertPermission, getDepartmentScope } from '../utils/rbac';
import type { Role } from '../../types';

const roles: [Role, ...Role[]] = ['REGULAR', 'MANAGER', 'HR_EMPLOYEE', 'HR_MANAGER', 'ACCOUNTING', 'ADMIN'];

type EmployeeViewRow = {
  id: string;
  fullName: string;
  dob: Date | string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  status: string;
  hireDate: Date | string;
  salary: Prisma.Decimal | number | string | null;
  taxCode: string | null;
  bankAccount: string | null;
  role: string | null;
};

const formatDate = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const normalizeMoney = (value: EmployeeViewRow['salary']) => {
  if (value === null || value === undefined) return undefined;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? undefined : numericValue;
};

const toEmployeePayload = (row: EmployeeViewRow) => ({
  id: row.id,
  fullName: row.fullName,
  dob: formatDate(row.dob),
  email: row.email,
  departmentId: row.departmentId,
  departmentName: row.departmentName,
  salary: normalizeMoney(row.salary),
  taxCode: row.taxCode ?? undefined,
  bankAccount: row.bankAccount ?? undefined,
  role: roles.includes(row.role as Role) ? (row.role as Role) : 'REGULAR',
  status: row.status,
  hireDate: formatDate(row.hireDate),
});

const employeeViewQuery = async (tx: Prisma.TransactionClient, employeeId?: string) => {
  if (employeeId) {
    return tx.$queryRaw<EmployeeViewRow[]>`
      SELECT employeeId AS id, fullName, dob, email, departmentId, departmentName, status,
             hireDate, salary, taxCode, bankAccount, primaryRole AS role
      FROM [dbo].[vw_EmployeeWithSensitive]
      WHERE employeeId = ${employeeId}
    `;
  }

  return tx.$queryRaw<EmployeeViewRow[]>`
    SELECT employeeId AS id, fullName, dob, email, departmentId, departmentName, status,
           hireDate, salary, taxCode, bankAccount, primaryRole AS role
    FROM [dbo].[vw_EmployeeWithSensitive]
    ORDER BY fullName
  `;
};

const getTargetEmployee = (tx: Prisma.TransactionClient, employeeId: string) =>
  tx.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
      sensitive: true,
    },
  });

export const employeeRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) =>
    ctx.withSessionContext(async (tx) => {
      await assertPermission(tx, ctx.user, 'employee', 'read', 'own_department');
      const rows = await employeeViewQuery(tx);
      return rows.map(toEmployeePayload);
    })
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        await assertPermission(tx, ctx.user, 'employee', 'read', 'own_department');
        const [employee] = await employeeViewQuery(tx, input.id);

        if (!employee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employee not found or unauthorized to view',
          });
        }

        return toEmployeePayload(employee);
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          fullName: z.string().min(2).optional(),
          dob: z.string().optional(),
          email: z.string().email().optional(),
          departmentId: z.string().uuid().optional(),
          salary: z.number().nonnegative().optional(),
          taxCode: z.string().min(3).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        if (input.id === ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You cannot edit your own record.',
          });
        }

        const targetEmployee = await getTargetEmployee(tx, input.id);
        if (!targetEmployee) throw new TRPCError({ code: 'NOT_FOUND' });

        const scope = getDepartmentScope(ctx.user.departmentId, targetEmployee.departmentId);
        const ipAddress = getRequestIp(ctx.req);
        const hasEmployeeChanges =
          input.data.fullName !== undefined || input.data.dob !== undefined || input.data.departmentId !== undefined;
        const hasSensitiveChanges = input.data.salary !== undefined || input.data.taxCode !== undefined;

        if (hasEmployeeChanges || input.data.email !== undefined) {
          await assertPermission(tx, ctx.user, 'employee', 'update', scope);
        }

        if (hasEmployeeChanges) {
          await tx.$executeRaw`
            EXEC [dbo].[sp_UpdateEmployee]
              @ActorUserId = ${ctx.user.userId},
              @EmployeeId = ${input.id},
              @FullName = ${input.data.fullName ?? null},
              @Dob = ${input.data.dob ? new Date(input.data.dob) : null},
              @DepartmentId = ${input.data.departmentId ?? null},
              @Status = ${null},
              @IPAddress = ${ipAddress}
          `;
        }

        if (input.data.email !== undefined && input.data.email !== targetEmployee.user.email) {
          await tx.appUser.update({
            where: { id: targetEmployee.userId },
            data: { email: input.data.email },
          });

          await tx.auditLog.create({
            data: {
              actorId: ctx.user.userId,
              targetTable: 'AppUser',
              targetId: targetEmployee.userId,
              action: 'UPDATE',
              oldValues: JSON.stringify({ email: targetEmployee.user.email }),
              newValues: JSON.stringify({ email: input.data.email }),
              ipAddress,
              userAgent: ctx.req.headers['user-agent'],
            },
          });
        }

        if (hasSensitiveChanges) {
          await assertPermission(tx, ctx.user, 'employee_sensitive', 'update', scope);

          if (targetEmployee.sensitive) {
            await tx.employeeSensitive.update({
              where: { employeeId: input.id },
              data: {
                salary: input.data.salary,
                taxCode: input.data.taxCode,
              },
            });
          } else {
            await tx.employeeSensitive.create({
              data: {
                employeeId: input.id,
                salary: input.data.salary ?? 0,
                taxCode: input.data.taxCode ?? 'UNKNOWN',
              },
            });
          }
        }

        const [updatedEmployee] = await employeeViewQuery(tx, input.id);
        if (!updatedEmployee) throw new TRPCError({ code: 'NOT_FOUND' });

        return toEmployeePayload(updatedEmployee);
      })
    ),

  create: protectedProcedure
    .input(z.object({
      fullName: z.string().min(2),
      dob: z.string(),
      email: z.string().email(),
      password: z.string().min(1),
      departmentId: z.string().uuid().optional(),
      salary: z.number().nonnegative(),
      taxCode: z.string().min(3),
      role: z.enum(roles),
    }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        const scope = getDepartmentScope(ctx.user.departmentId, input.departmentId ?? null);
        await assertPermission(tx, ctx.user, 'employee', 'create', scope);

        const passwordHash = await bcrypt.hash(input.password, 10);
        const ipAddress = getRequestIp(ctx.req);

        const appUser = await tx.appUser.create({
          data: {
            email: input.email,
            passwordHash,
            roleName: input.role,
          },
        });

        const employee = await tx.employee.create({
          data: {
            userId: appUser.id,
            fullName: input.fullName,
            dob: new Date(input.dob),
            departmentId: input.departmentId ?? null,
            sensitive: {
              create: {
                salary: input.salary,
                taxCode: input.taxCode,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.user.userId,
            targetTable: 'Employee',
            targetId: employee.id,
            action: 'CREATE',
            newValues: JSON.stringify({
              fullName: input.fullName,
              email: input.email,
              departmentId: input.departmentId ?? null,
              role: input.role,
              salary: input.salary,
              taxCode: input.taxCode,
            }),
            ipAddress,
            userAgent: ctx.req.headers['user-agent'],
          },
        });

        const [createdEmployee] = await employeeViewQuery(tx, employee.id);
        if (!createdEmployee) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        return toEmployeePayload(createdEmployee);
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.withSessionContext(async (tx) => {
        if (input.id === ctx.user.employeeId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete your own record.' });
        }

        const targetEmployee = await getTargetEmployee(tx, input.id);
        if (!targetEmployee) throw new TRPCError({ code: 'NOT_FOUND' });

        const scope = getDepartmentScope(ctx.user.departmentId, targetEmployee.departmentId);
        await assertPermission(tx, ctx.user, 'employee', 'delete', scope);

        await tx.$executeRaw`
          EXEC [dbo].[sp_SoftDeleteEmployee]
            @ActorUserId = ${ctx.user.userId},
            @EmployeeId = ${input.id},
            @IPAddress = ${getRequestIp(ctx.req)}
        `;

        return { success: true };
      })
    ),
});
