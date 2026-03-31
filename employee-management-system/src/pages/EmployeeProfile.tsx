import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Save, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { canEditEmployee, getVisibleFields, canCreateDeleteEmployee } from '../lib/rbac';
import { Employee } from '../types';
import { trpc } from '../lib/trpc';

export const EmployeeProfile: React.FC = () => {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  
  const isNew = id === 'new';
  const utils = trpc.useUtils();
  
  const { data: targetEmployee, isLoading: loadingEmp } = trpc.employee.getById.useQuery({ id }, {
    enabled: !isNew && !!id,
    retry: false
  });
  
  const { data: departments = [], isLoading: loadingDepts } = trpc.department.getAll.useQuery();

  const createMut = trpc.employee.create.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      navigate({ to: '/' });
    },
    onError: (err) => alert(err.message)
  });

  const updateMut = trpc.employee.update.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      utils.employee.getById.invalidate({ id });
      navigate({ to: '/' });
    },
    onError: (err) => alert(err.message)
  });

  const deleteMut = trpc.employee.delete.useMutation({
    onSuccess: () => {
      utils.employee.getAll.invalidate();
      navigate({ to: '/' });
    },
    onError: (err) => alert(err.message)
  });

  const [formData, setFormData] = useState<any>({
    fullName: '', dob: '', email: '', password: '', departmentId: '', salary: 0, taxCode: '', role: 'REGULAR'
  });

  useEffect(() => {
    if (targetEmployee) {
      setFormData({
        ...targetEmployee,
        dob: targetEmployee.dob ? new Date(targetEmployee.dob).toISOString().split('T')[0] : ''
      });
    } else if (departments.length > 0 && !formData.departmentId) {
       setFormData((prev: any) => ({ ...prev, departmentId: departments[0].id }));
    }
  }, [targetEmployee, departments]);

  if (!currentUser) return null;

  if (loadingDepts || (loadingEmp && !isNew)) {
    return (
      <div className="flex items-center justify-center p-8 text-blue-600">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isNew && !targetEmployee) {
    return <div className="p-8 text-center text-red-500">Employee not found or unauthorized.</div>;
  }

  const visibleFields = isNew ? ['fullName', 'dob', 'email', 'departmentId', 'salary', 'taxCode', 'role'] : getVisibleFields(currentUser, targetEmployee as any);
  const canEdit = isNew ? canCreateDeleteEmployee(currentUser) : canEditEmployee(currentUser, targetEmployee as any);

  if (!isNew && visibleFields.length === 0) {
    return <div className="p-8 text-center text-red-500">You do not have permission to view this profile.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: name === 'salary' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNew) {
      createMut.mutate({
        ...formData,
        dob: new Date(formData.dob).toISOString(),
        salary: Number(formData.salary)
      });
    } else {
      updateMut.mutate({ 
        id, 
        data: {
          fullName: formData.fullName,
          dob: new Date(formData.dob).toISOString(),
          email: formData.email,
          departmentId: formData.departmentId,
          salary: Number(formData.salary),
          taxCode: formData.taxCode
        } 
      });
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      deleteMut.mutate({ id });
    }
  };

  const renderField = (name: string, label: string, type: string = 'text', options?: { value: string, label: string }[]) => {
    const isVisible = visibleFields.includes(name as any) || (isNew && name === 'password');
    if (!isVisible) return null;

    return (
      <div className="col-span-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {options ? (
          <select
            name={name}
            value={formData[name] as string | number}
            onChange={handleChange}
            disabled={!canEdit}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            type={type}
            name={name}
            value={formData[name] as string | number}
            onChange={handleChange}
            disabled={!canEdit}
            required={name === 'password' && isNew}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button 
        onClick={() => navigate({ to: '/' })}
        className="flex items-center text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Create New Employee' : `Employee Profile: ${targetEmployee?.id}`}
          </h2>
          {!isNew && canCreateDeleteEmployee(currentUser) && (
            <button
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="text-red-600 hover:text-red-800 flex items-center text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-1" /> {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {renderField('fullName', 'Full Name')}
            {renderField('email', 'Email Address', 'email')}
            {isNew && renderField('password', 'Password', 'password')}
            {renderField('dob', 'Date of Birth', 'date')}
            {renderField('departmentId', 'Department', 'text', departments.map((d: any) => ({ value: d.id, label: d.name })))}
            {renderField('role', 'Role', 'text', [
              { value: 'REGULAR', label: 'Regular' },
              { value: 'MANAGER', label: 'Manager' },
              { value: 'HR_EMPLOYEE', label: 'HR Employee' },
              { value: 'HR_MANAGER', label: 'HR Manager' },
              { value: 'ACCOUNTING', label: 'Accounting' },
              { value: 'ADMIN', label: 'Admin' },
            ])}
            {renderField('salary', 'Salary (USD)', 'number')}
            {renderField('taxCode', 'Tax Code')}
          </div>

          {canEdit && (
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {isNew ? 'Create Employee' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
