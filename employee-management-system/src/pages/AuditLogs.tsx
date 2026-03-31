import React from 'react';
import { useAppContext } from '../context/AppContext';
import { canViewAuditLogs } from '../lib/rbac';
import { Clock, User, Activity, Loader2 } from 'lucide-react';
import { trpc } from '../lib/trpc';

export const AuditLogs: React.FC = () => {
  const { currentUser } = useAppContext();

  const { data: auditLogs = [], isLoading } = trpc.audit.getAll.useQuery(undefined, {
    enabled: !!currentUser && canViewAuditLogs(currentUser),
  });

  if (!currentUser || !canViewAuditLogs(currentUser)) {
    return (
      <div className="p-8 text-center text-red-500">
        You do not have permission to view audit logs.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-blue-600">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">System Audit Logs</h2>
          <p className="text-sm text-gray-500">Monitoring all critical changes across the system.</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No audit logs available.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors flex items-start space-x-4">
                <div className={`p-2 rounded-full ${
                  log.action === 'CREATE' ? 'bg-green-100 text-green-600' :
                  log.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  <Activity className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      {log.action} on {log.targetName} ({log.targetId})
                    </span>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{log.changes}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <User className="w-3 h-3 mr-1" />
                    Performed by: {log.actorName} ({log.actorId})
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
