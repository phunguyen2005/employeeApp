import React from 'react';
import { Outlet, Link, useRouterState, Navigate, useNavigate } from '@tanstack/react-router';
import { Users, Shield, LayoutDashboard, UserCircle, LogOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { canViewAuditLogs } from '../lib/rbac';
import { cn } from '../lib/utils';
import { trpc } from '../lib/trpc';
import { queryClient } from '../lib/trpc';

export const Layout: React.FC = () => {
  const { currentUser, setCurrentUser } = useAppContext();
  const location = useRouterState({ select: (s) => s.location });
  const navigate = useNavigate();
  const logoutMutation = trpc.auth.logout.useMutation();

  const { data: sessionUser, isLoading } = trpc.auth.session.useQuery(undefined, {
    retry: false
  });

  React.useEffect(() => {
    if (sessionUser && !currentUser) {
      setCurrentUser(sessionUser as any);
    }
  }, [sessionUser, currentUser, setCurrentUser]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setCurrentUser(null);
        queryClient.clear();
        window.location.replace('/login');
      }
    });
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center text-gray-500 text-lg">Authenticating...</div>;

  const userToUse = currentUser || sessionUser;
  if (!userToUse) return <Navigate to="/login" replace />;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    { name: 'Audit Logs', path: '/audit', icon: Shield, show: canViewAuditLogs(userToUse as any) },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Users className="w-6 h-6 text-blue-600 mr-2" />
          <span className="text-lg font-bold text-gray-900">EMS Portal</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className={cn("w-5 h-5 mr-3", isActive ? "text-blue-700" : "text-gray-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-800">
            {navItems.find(i => i.path === location.pathname)?.name || 'Employee Profile'}
          </h1>
          
            <div className="flex flex-row items-center space-x-4">
              <button 
                onClick={handleLogout}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                disabled={logoutMutation.isPending}
               >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            <div className="flex items-center space-x-2 border-l pl-4 border-gray-200">
              <UserCircle className="w-8 h-8 text-gray-400" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">{(userToUse as any).fullName}</span>
                <span className="text-xs text-gray-500">{(userToUse as any).role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
