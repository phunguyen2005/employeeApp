import {
  createRouter,
  createRoute,
  createRootRouteWithContext,
  Outlet
} from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { AuditLogs } from './pages/AuditLogs';
import { Login } from './pages/Login'; // Add the Login export

interface MyRouterContext {}

// Now rootRoute is just a top-level outlet
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
});

// The standard app layout applies to authenticated core pages
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authLayout',
  component: Layout,
});

// Dashboard child
const indexRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/',
  component: Dashboard,
});

// Profile child
const profileRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/employee/$id',
  component: EmployeeProfile,
});

// Audit child
const auditRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/audit',
  component: AuditLogs,
});

// The standalone login page
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

// Construct the tree
authLayoutRoute.addChildren([indexRoute, profileRoute, auditRoute]);
const routeTree = rootRoute.addChildren([authLayoutRoute, loginRoute]);

export const router = createRouter({
  routeTree,
  context: {}, 
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
