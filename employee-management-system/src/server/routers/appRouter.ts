import { router } from '../trpc';
import { employeeRouter } from './employeeRouter';
import { authRouter } from './authRouter';
import { departmentRouter } from './departmentRouter';
import { auditRouter } from './auditRouter';

export const appRouter = router({
  employee: employeeRouter,
  auth: authRouter,
  department: departmentRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;
