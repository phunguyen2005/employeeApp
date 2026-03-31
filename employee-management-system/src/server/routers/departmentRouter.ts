import { protectedProcedure, router } from '../trpc';

export const departmentRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.department.findMany();
  }),
});
