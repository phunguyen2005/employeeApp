import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Search, Plus, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { canViewEmployee, getVisibleFields, canCreateDeleteEmployee } from '../lib/rbac';
import { formatCurrency } from '../lib/utils';
import { trpc } from '../lib/trpc';
import { Loader2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const { data: employees = [], isLoading: isLoadingEmployees } = trpc.employee.getAll.useQuery(undefined, {
    enabled: !!currentUser
  });
  
  const { data: departments = [], isLoading: isLoadingDepartments } = trpc.department.getAll.useQuery(undefined, {
    enabled: !!currentUser
  });

  if (!currentUser) return null;

  if (isLoadingEmployees || isLoadingDepartments) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const filteredEmployees = employees.filter(emp => {
    // 1. Check RBAC visibility
    if (!canViewEmployee(currentUser, emp)) return false;

    // 2. Apply search
    const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 3. Apply filters
    const matchesDept = deptFilter === 'ALL' || emp.departmentId === deptFilter;
    const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;

    return matchesSearch && matchesDept && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex space-x-4 flex-1 max-w-3xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            <option value="REGULAR">Regular</option>
            <option value="MANAGER">Manager</option>
            <option value="HR_EMPLOYEE">HR Employee</option>
            <option value="HR_MANAGER">HR Manager</option>
            <option value="ACCOUNTING">Accounting</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        
        {canCreateDeleteEmployee(currentUser) && (
          <Link
            to="/employee/$id"
            params={{ id: 'new' }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Employee
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmployees.map((emp) => {
              const visibleFields = getVisibleFields(currentUser, emp);
              const dept = departments.find(d => d.id === emp.departmentId);
              
              return (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {visibleFields.includes('fullName') ? emp.fullName.charAt(0) : '?'}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {visibleFields.includes('fullName') ? emp.fullName : 'Hidden'}
                        </div>
                        <div className="text-sm text-gray-500">ID: {emp.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{visibleFields.includes('departmentId') ? dept?.name : 'Hidden'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {visibleFields.includes('role') ? emp.role.replace('_', ' ') : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {visibleFields.includes('salary') ? formatCurrency(emp.salary) : '***'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to="/employee/$id" params={{ id: emp.id }} className="text-blue-600 hover:text-blue-900 flex items-center justify-end">
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No employees found or you don't have permission to view them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
