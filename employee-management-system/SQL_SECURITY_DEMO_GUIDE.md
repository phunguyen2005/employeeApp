# Kịch bản demo bảo mật SQL Server - Employee Management System

Tài liệu này được viết dựa trên mã nguồn hiện tại, không thêm giả định và không mô tả chức năng chưa implement. File SQL copy-run đi kèm: `database/security-demo-copy-run.sql`.

## 1. Phạm vi kiểm tra mã nguồn

Các nguồn đã đối chiếu:

- `prisma/schema.prisma`: mô hình dữ liệu hiện tại.
- `prisma/migrations/*/migration.sql`: DDL, constraint, SQL object, RBAC/RLS migration.
- `prisma/seed.ts`: dữ liệu mẫu, role/permission seed, password hashing.
- `database/system_sql_objects.sql`: bản SQL object hợp nhất, dễ đọc; file này ghi rõ không tự chạy tự động bởi app.
- `database/security-demo-users.sql`: script tạo SQL Server login/database user để demo trực tiếp quyền SQL Server.
- `src/server/context.ts`: set `SESSION_CONTEXT` cho RLS và hash token phiên.
- `src/server/utils/rbac.ts`: gọi `sp_CheckPermission`.
- `src/server/routers/authRouter.ts`: login, bcrypt compare, record login success/failure.
- `src/server/routers/employeeRouter.ts`: đọc view, update bằng procedure, xóa mềm, audit.
- `src/server/routers/auditRouter.ts`: đọc audit qua view.
- `src/server/routers/userRouter.ts`, `roleRouter.ts`, `permissionRouter.ts`: quản trị user/role/permission và ghi audit.

## 2. Danh sách cơ chế bảo mật SQL hiện có

| Cơ chế | Trạng thái trong project | File/code liên quan | Bảng/object liên quan |
|---|---|---|---|
| Application user/role/permission | Có | `schema.prisma`, `seed.ts`, `src/server/utils/rbac.ts`, các router admin | `AppUser`, `Role`, `Permission`, `UserRole`, `RolePermission` |
| SQL Server database role/grant/deny | Có | migrations `20260413001000...`, `20260415000000...`, `database/system_sql_objects.sql` | `ems_regular`, `ems_manager`, `ems_hr_employee`, `ems_hr_manager`, `ems_accounting`, `ems_admin`, `ems_app_runtime` |
| SQL Server login/database user | Có script demo thủ công, chưa tự động trong Prisma migration | `database/security-demo-users.sql` | `ems_regular_login`, `ems_regular_user`, ... |
| Stored Procedure | Có | migrations, `database/system_sql_objects.sql`, `authRouter.ts`, `employeeRouter.ts`, `utils/rbac.ts` | `sp_CheckPermission`, `sp_Authenticate`, `sp_RecordLoginSuccess`, `sp_RecordLoginFailure`, `sp_UpdateEmployee`, `sp_SoftDeleteEmployee` |
| Trigger | Có | migrations, `database/system_sql_objects.sql`, `seed.ts` bật/tắt khi seed | `tr_*` trên `AppUser`, `Employee`, `EmployeeSensitive`, `Department`, `AuditLog`, `UserRole` |
| Audit Log ứng dụng | Có | `AuditLog` model, stored procedures, routers, trigger sensitive data | `AuditLog`, `vw_AuditLogDetail` |
| SQL Server Audit native | Chưa thấy trong hệ thống | Không thấy `CREATE SERVER AUDIT` hoặc `CREATE DATABASE AUDIT SPECIFICATION` | Chưa có |
| View | Có | migrations, `database/system_sql_objects.sql`, `employeeRouter.ts`, `auditRouter.ts` | `vw_EmployeeDirectory`, `vw_EmployeeWithSensitive`, `vw_PayrollSummary`, `vw_DepartmentRoster`, `vw_AuditLogDetail` |
| Function | Có | migrations, `database/system_sql_objects.sql` | `fn_EmployeeRowFilter`, `fn_SensitiveDataFilter` |
| Row-Level Security | Có | migrations, `database/system_sql_objects.sql`, `context.ts` | `EmployeeFilterPolicy`, `SensitiveDataPolicy`, `SESSION_CONTEXT` |
| Kiểm soát truy cập dữ liệu | Có | SQL role/grant/deny, views, RLS, `sp_CheckPermission`, router guards | Base tables, views, procedures |
| Ràng buộc toàn vẹn dữ liệu | Có | migrations, `schema.prisma` | PK, FK, unique, check constraints |
| Hashing password/token | Có ở tầng app, lưu hash trong DB | `seed.ts`, `authRouter.ts`, `context.ts` | `AppUser.passwordHash`, `UserSession.tokenHash` |
| Mã hóa SQL Server như TDE, Always Encrypted, column encryption | Chưa thấy trong hệ thống | Không thấy DDL cấu hình encryption | Chưa có |

## 3. Kịch bản demo theo thứ tự hợp lý

### Bước 0 - Preflight

Mục đích bảo mật: chứng minh các object bảo mật đang tồn tại trước khi demo.

Cách chạy: mở `database/security-demo-copy-run.sql`, chạy section `0. Preflight`.

Kết quả mong đợi:

- Thấy các view, function, procedure, trigger.
- Thấy `EmployeeFilterPolicy` và `SensitiveDataPolicy` đang enabled.
- Thấy các database role `ems_*`.
- Nếu đã chạy `security-demo-users.sql`, thấy thêm các database user `ems_*_user`.

Lời thoại:

> Trước khi demo em kiểm tra object thật trong database. Project dùng mô hình bảo mật lai: app có RBAC riêng, SQL Server có role/grant/deny, view, stored procedure và RLS để chặn truy cập trực tiếp vào bảng nhạy cảm.

Nếu giảng viên hỏi sâu:

> `database/system_sql_objects.sql` là bản script hợp nhất dễ đọc, còn migrations mới là phần Prisma áp dụng vào database. Riêng login/user SQL Server nằm trong `security-demo-users.sql` vì login là cấp instance, không nên tự động tạo trong migration app.

### Bước 1 - Login, user, session và hashing

Mục đích bảo mật:

- Không lưu mật khẩu plaintext.
- Kiểm tra trạng thái tài khoản trước khi xác thực mật khẩu.
- Ghi nhận đăng nhập thành công/thất bại.
- Khóa tài khoản tạm thời sau nhiều lần sai.
- Session token không lưu thô trong DB mà lưu hash.

File/code liên quan:

- `AppUser.passwordHash`, `UserSession.tokenHash` trong `schema.prisma`.
- `prisma/seed.ts`: `bcrypt.hash(password, 10)`.
- `authRouter.ts`: `bcrypt.compare`, gọi `sp_Authenticate`, `sp_RecordLoginFailure`, `sp_RecordLoginSuccess`.
- `context.ts`: `hashToken` dùng SHA-256 cho token phiên.
- `system_sql_objects.sql`: các procedure login.

Bảng liên quan: `AppUser`, `UserSession`, `AuditLog`.

Cách chạy demo SQL:

- Section `2. Hashing proof`.
- Section `3. Login stored procedures`.

Kết quả mong đợi:

- `passwordHash` có prefix dạng `$2...`, độ dài kiểu bcrypt; không có password gốc.
- `sp_Authenticate` với user hợp lệ trả `PENDING_VERIFY` và hash để app tự `bcrypt.compare`.
- Email không tồn tại trả `USER_NOT_FOUND`.
- `sp_RecordLoginFailure` tăng `failedAttempts` và ghi `LOGIN_FAILURE` vào `AuditLog`, nhưng block demo rollback.
- `sp_RecordLoginSuccess` tạo `UserSession`, reset failed attempts và ghi `LOGIN_SUCCESS`, nhưng block demo rollback.

Lời thoại:

> SQL Server không so sánh mật khẩu plaintext. Stored procedure chỉ lấy trạng thái tài khoản và password hash. App dùng bcrypt để verify. Khi sai hoặc đúng, stored procedure cập nhật counters/session và ghi audit log.

Nếu giảng viên hỏi sâu:

> Vì sao không verify bcrypt trong SQL Server? Bcrypt là thuật toán hashing chuyên dụng ở tầng ứng dụng; SQL Server không có primitive bcrypt native. DB chỉ lưu hash, còn app kiểm tra bằng thư viện `bcryptjs`. Token phiên cũng không lưu token gốc, chỉ lưu SHA-256 hash để nếu DB lộ thì không lấy được cookie/token trực tiếp.

### Bước 2 - Role / Permission ở tầng ứng dụng

Mục đích bảo mật: kiểm soát ai được đọc, tạo, cập nhật, xóa theo resource/action/scope.

File/code liên quan:

- `schema.prisma`: `Role`, `Permission`, `RolePermission`, `UserRole`, `AppUser.roleName`.
- `seed.ts`: seed system roles và permission catalog.
- `utils/rbac.ts`: `assertPermission`, `checkPermission`.
- `sp_CheckPermission`: procedure quyết định user có quyền hay không.

Bảng liên quan: `AppUser`, `Role`, `Permission`, `RolePermission`, `UserRole`.

Cách chạy demo SQL:

- Section `1. Initial data`.
- Section `4. Application RBAC via sp_CheckPermission`.

Kết quả mong đợi:

- `REGULAR` không có quyền `audit_log.read.all`.
- `HR_MANAGER` có quyền `audit_log.read.all`.
- `MANAGER` có quyền đọc dữ liệu nhạy cảm trong phòng ban mình.
- `REGULAR` không có quyền đọc `employee_sensitive`.

Lời thoại:

> RBAC của project không chỉ là text role trên UI. Khi server cần kiểm tra quyền, nó gọi `sp_CheckPermission` trong SQL Server. Procedure này xử lý role hệ thống và custom role qua bảng `UserRole -> RolePermission -> Permission`.

Nếu giảng viên hỏi sâu:

> `AppUser.roleName` là cache vai trò chính để SQL Server RLS đọc nhanh qua `SESSION_CONTEXT`. Bảng `Role/UserRole/Permission` vẫn tồn tại để admin quản lý role động và mapping permission.

### Bước 3 - SQL Server role / grant / deny

Mục đích bảo mật:

- User cuối không đọc hoặc sửa trực tiếp base table.
- Chỉ được đọc qua view đã lọc.
- App runtime có quyền cần thiết cho Prisma/tRPC hiện tại.

File/code liên quan:

- `20260413001000_native_database_rbac/migration.sql`.
- `20260415000000_dynamic_rbac_support/migration.sql`.
- `database/system_sql_objects.sql`.
- `database/security-demo-users.sql` cho login/user demo.

Bảng/object liên quan: base tables, views, stored procedures, roles `ems_*`.

Cách chạy demo SQL:

- Nếu chưa có SQL users: chạy `database/security-demo-users.sql` trên DB demo/local.
- Section `6. Native SQL Server permissions`.
- Section `7. Stored procedure grant/deny`.

Kết quả mong đợi:

- `ems_regular_user` bị từ chối `SELECT dbo.Employee`.
- `ems_regular_user` được đọc `vw_EmployeeDirectory` nếu set đúng `SESSION_CONTEXT`.
- `ems_regular_user` bị từ chối `vw_PayrollSummary`.
- `ems_hr_manager_user` được execute `sp_UpdateEmployee`.
- `ems_regular_user` bị từ chối execute `sp_UpdateEmployee`.

Lời thoại:

> Đây là lớp bảo vệ khi có người kết nối trực tiếp vào SQL Server. Base table như `EmployeeSensitive`, `AuditLog`, `AppUser` bị deny với role người dùng. Dữ liệu đi qua view/procedure để kiểm soát trường dữ liệu, dòng dữ liệu và audit.

Nếu giảng viên hỏi sâu:

> `ems_app_runtime` có base table permission vì code Prisma hiện tại vẫn cần thao tác ORM trực tiếp ở một số luồng. Người dùng trực tiếp không được cấp quyền đó. Đây là trade-off thực tế giữa app hiện tại và bảo mật DB-level.

### Bước 4 - View và Function / RLS

Mục đích bảo mật:

- View giới hạn bề mặt dữ liệu.
- RLS giới hạn dòng dữ liệu theo user, role, department.
- Function đọc `SESSION_CONTEXT` do backend set.

File/code liên quan:

- `context.ts`: `setDatabaseSessionContext`.
- `fn_EmployeeRowFilter`, `fn_SensitiveDataFilter`.
- `EmployeeFilterPolicy`, `SensitiveDataPolicy`.
- `employeeRouter.ts`: đọc từ `vw_EmployeeWithSensitive`.
- `auditRouter.ts`: đọc từ `vw_AuditLogDetail`.

Bảng/object liên quan: `Employee`, `EmployeeSensitive`, views, security policies.

Cách chạy demo SQL:

- Section `5. RLS functions and security policies`.
- Section `6. Native SQL Server permissions`.

Kết quả mong đợi:

- Với context `REGULAR`, `Employee` chỉ hiện dòng thuộc bản thân/cùng phòng ban, `EmployeeSensitive` không hiện dòng.
- Với context `HR_MANAGER`, số dòng visible lớn hơn và có sensitive rows.
- `fn_EmployeeRowFilter` trả dòng khi điều kiện đúng.
- `fn_SensitiveDataFilter` không trả dòng với regular user.

Lời thoại:

> Điểm quan trọng là RLS không dựa vào UI. SQL Server tự áp filter predicate khi query bảng. Backend sau khi xác thực user sẽ set `UserId`, `RoleName`, `DepartmentId` vào session context. Predicate function đọc các key đó để quyết định dòng nào được thấy.

Nếu giảng viên hỏi sâu:

> Nếu quên set `SESSION_CONTEXT`, các predicate không match và kết quả có thể rỗng. Vì vậy project bọc các query protected trong `ctx.withSessionContext`.

### Bước 5 - Stored Procedure cho mutation nhạy cảm

Mục đích bảo mật:

- Gom logic cập nhật/xóa mềm vào procedure.
- Ghi audit atomically cùng thao tác.
- Tránh hard delete nhân viên.
- Thu hồi session khi xóa mềm.

Stored procedure hiện có:

- `sp_CheckPermission`: kiểm tra RBAC.
- `sp_Authenticate`: kiểm tra user tồn tại, active, locked.
- `sp_RecordLoginSuccess`: reset failed attempts, tạo session, audit login success.
- `sp_RecordLoginFailure`: tăng failed attempts, khóa sau ngưỡng, audit login failure.
- `sp_UpdateEmployee`: cập nhật hồ sơ cơ bản và ghi audit.
- `sp_SoftDeleteEmployee`: chuyển status `TERMINATED`, disable `AppUser`, clear manager, revoke sessions, ghi audit.

File/code liên quan:

- `system_sql_objects.sql`.
- `authRouter.ts`, `employeeRouter.ts`, `userRouter.ts`, `utils/rbac.ts`.

Bảng liên quan: `AppUser`, `Employee`, `EmployeeSensitive`, `Department`, `UserSession`, `AuditLog`.

Cách chạy demo SQL:

- Section `3`, `4`, `7`, `10`.

Kết quả mong đợi:

- Procedure thành công tạo audit row.
- User không có quyền execute bị SQL Server chặn.
- Soft delete không xóa vật lý mà đổi trạng thái và disable user.

Lời thoại:

> Các thao tác có rủi ro không update trực tiếp tùy tiện. Với update employee và soft delete, stored procedure ghi lại old/new values vào audit log trong cùng transaction.

Nếu giảng viên hỏi sâu:

> Hiện project chưa có stored procedure mutation cho Department; file SQL cũng ghi chú backend hiện chỉ đọc active departments.

### Bước 6 - Trigger

Mục đích bảo mật:

- Tự động cập nhật `updatedAt`.
- Chặn sửa/xóa audit log.
- Chặn hard delete nhân viên.
- Audit thay đổi dữ liệu nhạy cảm.
- Đồng bộ `AppUser.roleName` khi `UserRole` thay đổi.

Trigger hiện có:

- `tr_AppUser_UpdateTimestamp`.
- `tr_Employee_UpdateTimestamp`.
- `tr_EmployeeSensitive_UpdateTimestamp`.
- `tr_Department_UpdateTimestamp`.
- `tr_AuditLog_PreventModification`.
- `tr_Employee_PreventHardDelete`.
- `tr_EmployeeSensitive_AuditChanges`.
- `tr_UserRole_SyncRoleName`.

File/code liên quan:

- migrations.
- `database/system_sql_objects.sql`.
- `prisma/seed.ts` tạm disable/enable một số trigger khi reset seed.

Bảng liên quan: `AppUser`, `Employee`, `EmployeeSensitive`, `Department`, `AuditLog`, `UserRole`.

Cách chạy demo SQL:

- Section `8. Trigger demos`.

Kết quả mong đợi:

- Update Department làm `updatedAt` đổi trong transaction.
- Update salary ghi audit `EmployeeSensitive`.
- `DELETE FROM Employee` bị lỗi: `Hard deletion of employee records is not permitted. Use sp_SoftDeleteEmployee.`
- `UPDATE AuditLog` bị lỗi: `Audit log records cannot be modified or deleted.`
- Delete/insert `UserRole` làm `AppUser.roleName` đổi trong transaction rồi rollback.

Lời thoại:

> Trigger ở đây dùng cho kiểm soát bất biến và ghi nhận thay đổi quan trọng, không thay thế toàn bộ business logic. Ví dụ audit log không cho sửa/xóa, employee không cho hard delete, còn dữ liệu nhạy cảm thì tự sinh audit khi update.

Nếu giảng viên hỏi sâu:

> `tr_UserRole_AuditChanges` từng có ở migration cũ nhưng migration sau đã bỏ. Hiện audit role/permission được ghi trong router; trigger còn lại là `tr_UserRole_SyncRoleName` để đồng bộ cache `roleName`.

### Bước 7 - Audit Log

Mục đích bảo mật:

- Lưu dấu vết ai làm gì, với target nào, old/new values, IP, user agent.
- Cho phép truy vấn audit qua view thân thiện.
- Chống sửa/xóa audit row bằng trigger.

File/code liên quan:

- `AuditLog` model.
- `vw_AuditLogDetail`.
- `sp_RecordLoginSuccess`, `sp_RecordLoginFailure`, `sp_UpdateEmployee`, `sp_SoftDeleteEmployee`.
- `employeeRouter.ts`, `userRouter.ts`, `roleRouter.ts`, `permissionRouter.ts`.
- `auditRouter.ts`.

Bảng liên quan: `AuditLog`, `AppUser`, `Employee`, `Department`, `Role`, `Permission`.

Cách chạy demo SQL:

- Sau các section login/update/soft delete, chạy các query `SELECT TOP (5) ... FROM dbo.AuditLog`.
- Section `8` demo chặn sửa audit.

Kết quả mong đợi:

- Có row `LOGIN_FAILURE`, `LOGIN_SUCCESS`, `UPDATE`, `DELETE`, `CREATE` tùy thao tác.
- `vw_AuditLogDetail` join ra `actorName`, `targetName`.
- Update/delete audit log bị trigger từ chối.

Lời thoại:

> Audit log của project là audit ứng dụng lưu trong bảng, không phải SQL Server Audit native. Ưu điểm là đọc được ngay trong app và gắn được old/new values theo nghiệp vụ. Nhược điểm là chưa audit mọi câu lệnh cấp server như SQL Server Audit.

Nếu giảng viên hỏi sâu:

> Nếu yêu cầu audit cấp compliance mạnh hơn, có thể bổ sung SQL Server Audit. Nhưng trong project hiện tại chưa thấy cấu hình đó, nên em chỉ demo audit table đã implement.

### Bước 8 - Kiểm thử dữ liệu sai hoặc thao tác bị chặn

Mục đích bảo mật:

- Check constraints chặn dữ liệu sai.
- Permission/trigger chặn thao tác trái phép.

File/code liên quan:

- Migration `20260413000000_security_redesign` và `20260415000000_dynamic_rbac_support`.
- `schema.prisma` thể hiện PK/FK/unique.

Bảng liên quan: `Employee`, `EmployeeSensitive`, `AuditLog`, `AppUser`, `Department`.

Cách chạy demo SQL:

- Section `9. Data integrity`.
- Section `6` và `7` cho trường hợp không có quyền.
- Section `8` cho hard delete/audit immutability.

Kết quả mong đợi:

- Salary âm bị `CK_EmployeeSensitive_salary` chặn.
- Status không hợp lệ bị `CK_Employee_status` chặn.
- Audit action lạ bị `CK_AuditLog_action` chặn.
- User thường bị deny base table/procedure.
- Hard delete bị trigger chặn.

Lời thoại:

> Bảo mật không chỉ là đăng nhập. Constraint bảo vệ database khỏi dữ liệu sai ngay cả khi lỗi xảy ra ở app hoặc có người thao tác trực tiếp trên SQL Server.

Nếu giảng viên hỏi sâu:

> Constraint là lớp cuối cùng ở DB. Validation ở UI/API giúp trải nghiệm tốt hơn, nhưng DB constraint mới là chốt chặn bắt buộc.

## 4. Checklist chuẩn bị trước khi demo SQL

- Backup hoặc dùng database demo/local, không dùng production.
- Chạy `npx prisma migrate dev` nếu database chưa có schema/object.
- Chạy `npm run seed` nếu cần dữ liệu mẫu.
- Nếu muốn demo SQL Server user/role trực tiếp, chạy `database/security-demo-users.sql` bằng account có quyền `CREATE LOGIN`, `CREATE USER`, `ALTER ROLE`.
- Mở `database/security-demo-copy-run.sql`.
- Chạy từng section, không cần chạy toàn bộ một lần.
- Kiểm tra `EmployeeFilterPolicy` và `SensitiveDataPolicy` đang enabled.
- Kiểm tra trigger không bị disable sau seed.
- Dùng SSMS/Azure Data Studio, chọn đúng database EMS trước khi chạy.
- Với phần mutation, giữ nguyên transaction/rollback trong script để tránh thay đổi dữ liệu thật.
- Sau demo, chạy lại preflight nếu muốn xác nhận object vẫn enabled.

## 5. Kịch bản demo nhanh 5 phút

1. Preflight object:
   - Chạy section `0`.
   - Nói: hệ thống có roles, grants, views, procs, triggers, RLS policies.

2. Hashing/login:
   - Chạy section `2` và phần đầu section `3`.
   - Nói: DB lưu bcrypt hash, login procedure trả trạng thái, app verify bcrypt.

3. RBAC:
   - Chạy section `4`.
   - Nói: `REGULAR` không đọc audit, `HR_MANAGER` đọc audit, manager đọc sensitive trong scope.

4. RLS/view:
   - Chạy section `5`.
   - Nói: đổi `SESSION_CONTEXT` làm số dòng visible khác nhau.

5. Trigger/audit:
   - Chạy section `8` phần hard delete và audit immutability.
   - Nói: hard delete và sửa audit đều bị SQL Server chặn.

6. Constraint:
   - Chạy section `9`.
   - Nói: salary âm/status sai/action sai bị check constraint chặn.

## 6. Kịch bản demo đầy đủ 10-15 phút

1. Giới thiệu mô hình:
   - App RBAC: `AppUser`, `Role`, `Permission`, `UserRole`, `RolePermission`.
   - DB security: role/grant/deny, view, stored procedure, trigger, RLS.

2. Preflight:
   - Chạy section `0`.
   - Chỉ ra `EmployeeFilterPolicy`, `SensitiveDataPolicy`, `ems_*`.

3. Dữ liệu nền:
   - Chạy section `1`.
   - Chỉ ra 6 role hệ thống và permission mapping.

4. Login/session/hash:
   - Chạy section `2`, `3`.
   - Giải thích bcrypt, SHA-256 token hash, failed attempts, account lockout, audit login.

5. Application RBAC:
   - Chạy section `4`.
   - So sánh `REGULAR`, `MANAGER`, `HR_MANAGER`.

6. RLS:
   - Chạy section `5`.
   - Nhấn mạnh backend set `SESSION_CONTEXT`; SQL Server tự lọc dòng.

7. SQL Server permission:
   - Nếu đã chạy `security-demo-users.sql`, chạy section `6`.
   - Demo user thường bị deny base table, chỉ đọc view được cấp quyền.

8. Stored procedure grant/deny:
   - Chạy section `7`.
   - HR manager execute được update procedure, regular bị deny.

9. Audit log:
   - Xem audit row sinh từ update/login trong các section.
   - Chạy `SELECT TOP (10) * FROM dbo.vw_AuditLogDetail ORDER BY [timestamp] DESC;` bằng role có quyền.

10. Trigger:
   - Chạy section `8`.
   - Demo timestamp, sensitive audit, hard delete block, audit immutability, roleName sync.

11. Integrity constraints:
   - Chạy section `9`.
   - Demo dữ liệu sai bị DB chặn.

12. Soft delete:
   - Chạy section `10`.
   - Nói: xóa nhân viên là xóa mềm, disable user, revoke session, audit, rồi rollback trong demo.

## 7. Câu hỏi giảng viên có thể hỏi và trả lời mẫu

**Hỏi:** Project có SQL Server Audit native không?

**Trả lời:** Chưa thấy. Project có audit log ở tầng ứng dụng bằng bảng `AuditLog`, view `vw_AuditLogDetail`, stored procedure và trigger chống sửa/xóa log. Không thấy `CREATE SERVER AUDIT` hoặc `CREATE DATABASE AUDIT SPECIFICATION`.

**Hỏi:** Vì sao dùng cả RBAC app và SQL Server role?

**Trả lời:** RBAC app kiểm soát nghiệp vụ theo resource/action/scope. SQL Server role/grant/deny bảo vệ khi có kết nối trực tiếp vào DB, hạn chế base table và buộc đọc qua view/procedure.

**Hỏi:** RLS hoạt động như thế nào?

**Trả lời:** Backend set `SESSION_CONTEXT` gồm `UserId`, `RoleName`, `DepartmentId`. Function `fn_EmployeeRowFilter` và `fn_SensitiveDataFilter` đọc context đó, rồi security policy áp filter predicate lên `Employee` và `EmployeeSensitive`.

**Hỏi:** Nếu attacker gọi thẳng `SELECT * FROM EmployeeSensitive` thì sao?

**Trả lời:** Với role người dùng như `ems_regular`, SQL Server `DENY SELECT` base table. Nếu dùng account runtime thì vẫn bị RLS theo `SESSION_CONTEXT`. Vì vậy tài khoản kết nối cần được tách đúng: runtime cho app, user direct chỉ demo/least privilege.

**Hỏi:** Password có mã hóa không?

**Trả lời:** Project chưa thấy mã hóa SQL Server kiểu TDE/Always Encrypted. Password được hash bằng bcrypt ở app và chỉ lưu hash trong `AppUser.passwordHash`. Đây là hashing một chiều, không phải encryption hai chiều.

**Hỏi:** Token session có bị lưu plaintext không?

**Trả lời:** Không. `context.ts` hash token bằng SHA-256 trước khi lưu vào `UserSession.tokenHash`. Khi request tới, app hash token từ cookie rồi so với DB.

**Hỏi:** Vì sao `sp_Authenticate` trả password hash về app?

**Trả lời:** Vì app cần dùng bcrypt compare. Procedure chỉ kiểm tra trạng thái user: tồn tại, active, locked. Nó không trả plaintext password và không tự verify bcrypt trong SQL Server.

**Hỏi:** Audit log có chống sửa không?

**Trả lời:** Có. Trigger `tr_AuditLog_PreventModification` là `INSTEAD OF UPDATE, DELETE`, raiserror và rollback. Demo update audit log sẽ bị chặn.

**Hỏi:** Có xóa cứng nhân viên được không?

**Trả lời:** Không theo thiết kế. Trigger `tr_Employee_PreventHardDelete` chặn `DELETE`. Luồng hợp lệ là `sp_SoftDeleteEmployee`, chuyển status `TERMINATED`, disable user, revoke sessions và ghi audit.

**Hỏi:** Có audit mọi thay đổi sensitive không?

**Trả lời:** Với `EmployeeSensitive`, trigger audit update salary/taxCode/bankAccount. Ngoài ra các router/procedure ghi audit cho employee, user, role, permission. Chưa thấy SQL Server Audit native cho mọi statement.

**Hỏi:** Vì sao seed lại disable trigger/policy?

**Trả lời:** Seed reset toàn bộ dữ liệu mẫu, nên tạm tắt policy/trigger bảo vệ để xóa và tạo dữ liệu nhất quán. Sau seed, script bật lại trigger và security policy.

**Hỏi:** Custom role có hoạt động không?

**Trả lời:** Có. Migration `20260415000000_dynamic_rbac_support` reintroduce `Role`, `Permission`, `RolePermission`, `UserRole`. `sp_CheckPermission` có nhánh xử lý role không phải system role bằng mapping `UserRole -> RolePermission -> Permission`.

**Hỏi:** Cơ chế nào đề tài yêu cầu nhưng chưa có?

**Trả lời:** Chưa thấy SQL Server Audit native, TDE/Always Encrypted/column encryption, dynamic data masking, và stored procedure mutation cho Department. SQL login/user có script demo thủ công nhưng không tự tạo qua Prisma migration.

## 8. Ghi chú khi trình bày để không bị bắt bẻ

- Không nói "mã hóa mật khẩu"; nói chính xác là "hash mật khẩu bằng bcrypt".
- Không nói "SQL Server Audit"; nói "audit log ứng dụng trong bảng `AuditLog`".
- Không nói "mọi bảng đều chỉ truy cập qua procedure"; app runtime vẫn có base-table permission cho Prisma code path hiện tại.
- Không nói "security-demo-users.sql là migration"; đó là script demo tạo login/user thủ công.
- Khi demo SQL có update/delete, nhấn mạnh block đang rollback.
- Nếu kết quả view rỗng, kiểm tra `SESSION_CONTEXT`; RLS có thể lọc hết khi context chưa set.

