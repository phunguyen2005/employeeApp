import * as trpcExpress from '@trpc/server/adapters/express';
import { Prisma, PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '../types';

export const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

type DbClient = Prisma.TransactionClient | PrismaClient;

export const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const getRequestIp = (req: trpcExpress.CreateExpressContextOptions['req']) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0] ?? null;
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0]?.trim() || null;
  return req.ip || req.socket.remoteAddress || null;
};

export interface UserContext {
  id: string;
  employeeCode: string;
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  dob: string;
  role: Role;
  departmentId: string | null;
  salary?: number;
  taxCode?: string;
}

type SessionContextInput = {
  userId: string;
  role: Role;
  departmentId: string | null;
};

export const setDatabaseSessionContext = async (db: DbClient, user: SessionContextInput) => {
  await db.$executeRaw`EXEC sp_set_session_context @key = N'UserId', @value = ${user.userId}`;
  await db.$executeRaw`EXEC sp_set_session_context @key = N'RoleName', @value = ${user.role}`;
  await db.$executeRaw`EXEC sp_set_session_context @key = N'DepartmentId', @value = ${user.departmentId}`;
};

const getEmployeeContext = async (
  userId: string,
): Promise<UserContext | null> =>
  prisma.$transaction(async (tx) => {
    const appUser = await tx.appUser.findUnique({ where: { id: userId } });
    if (!appUser?.isActive) return null;

    const role: Role = appUser.roleName?.trim() || 'REGULAR';
    await setDatabaseSessionContext(tx, { userId, role, departmentId: null });

    const employee = await tx.employee.findUnique({
      where: { userId },
      include: {
        user: true,
        sensitive: true,
      },
    });

    if (!employee || employee.status !== 'ACTIVE') return null;

    const userContext: UserContext = {
      id: employee.id,
      employeeCode: employee.employeeCode,
      userId: employee.userId,
      employeeId: employee.id,
      fullName: employee.fullName,
      email: employee.user.email,
      dob: employee.dob.toISOString(),
      role,
      departmentId: employee.departmentId,
      salary: employee.sensitive?.salary == null ? undefined : Number(employee.sensitive.salary),
      taxCode: employee.sensitive?.taxCode,
    };

    await setDatabaseSessionContext(tx, userContext);
    return userContext;
  });

export const getUserContextById = async (userId: string): Promise<UserContext | null> => {
  return getEmployeeContext(userId);
};

type JwtSessionPayload = {
  userId?: string;
};

const readToken = (req: trpcExpress.CreateExpressContextOptions['req']) =>
  req.cookies?.token || req.headers.authorization?.split(' ')[1] || null;

export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  let user: UserContext | null = null;
  const token = readToken(req);
  const tokenHash = token ? hashToken(token) : null;

  if (token && tokenHash) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtSessionPayload;

      if (decoded.userId) {
        const session = await prisma.userSession.findFirst({
          where: {
            userId: decoded.userId,
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            user: { isActive: true },
          },
        });

        if (session) {
          user = await getUserContextById(session.userId);
        }
      }
    } catch (err) {
      console.error('Invalid token', err);
    }
  }

  return {
    req,
    res,
    user,
    prisma,
    tokenHash,
    withSessionContext: async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => {
      return prisma.$transaction(async (tx) => {
        if (user) await setDatabaseSessionContext(tx, user);
        return operation(tx);
      });
    },
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
