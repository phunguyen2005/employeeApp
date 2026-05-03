import { router } from '../trpc';
import { employeeRouter } from './employeeRouter';
import { authRouter } from './authRouter';
import { departmentRouter } from './departmentRouter';
import { auditRouter } from './auditRouter';
import { userRouter } from './userRouter';
import { roleRouter } from './roleRouter';
import { permissionRouter } from './permissionRouter';

export const appRouter = router({
  employee: employeeRouter,
  auth: authRouter,
  department: departmentRouter,
  audit: auditRouter,
  user: userRouter,
  role: roleRouter,
  permission: permissionRouter,
});

export type AppRouter = typeof appRouter;
