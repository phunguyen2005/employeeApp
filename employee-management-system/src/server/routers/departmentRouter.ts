import { protectedProcedure, router } from '../trpc';
import { assertPermission } from '../utils/rbac';

export const departmentRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.withSessionContext(async (tx) => {
      await assertPermission(tx, ctx.user, 'department', 'read', 'all');

      return tx.department.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  }),
});
