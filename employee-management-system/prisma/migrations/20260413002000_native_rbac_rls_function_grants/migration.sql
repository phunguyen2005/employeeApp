-- RLS predicate functions are invoked under the caller context, so native
-- database roles need permission to evaluate them.

GRANT SELECT ON [dbo].[fn_EmployeeRowFilter] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
GRANT SELECT ON [dbo].[fn_SensitiveDataFilter] TO [ems_regular], [ems_manager], [ems_hr_employee], [ems_hr_manager], [ems_accounting], [ems_admin], [ems_app_runtime];
