import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const auditRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (!['ADMIN', 'HR_MANAGER'].includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You lack permissions to view audit logs.',
      });
    }

    return ctx.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }),
});
