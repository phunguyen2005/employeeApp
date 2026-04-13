import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import type { Role } from '../types';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// 1. Base Auth Middleware
export const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not logged in' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// 2. Role Middleware Factory
export const roleProcedure = (allowedRoles: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role as Role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions for this action.',
      });
    }
    return next({ ctx });
  });
