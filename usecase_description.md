# Mô tả Sơ đồ Use Case – Hệ thống Quản lý Nhân viên

> Căn cứ: Đề tài 6 – QUẢN LÝ NHÂN VIÊN

---

## 1. Actors và quan hệ kế thừa

| Actor | Vai trò | Căn cứ trong đề tài |
|-------|---------|---------------------|
| **REGULAR** | Nhân viên thông thường | "Nhân viên của một phòng ban" |
| **MANAGER** | Trưởng phòng ban thông thường | "Quản lý của phòng ban" |
| **HR_EMPLOYEE** | Nhân viên phòng Nhân sự | "Nhân viên phòng nhân sự" |
| **HR_MANAGER** | Trưởng phòng Nhân sự | "Trưởng phòng nhân sự" |
| **ACCOUNTING** | Nhân viên phòng Kế toán | "Nhân viên phòng kế toán" |
| **ADMIN** | Quản trị viên hệ thống | Từ source code – quản trị toàn bộ |

### Quan hệ Generalization (kế thừa) giữa Actors

```
REGULAR ───▷ MANAGER
              (MANAGER làm được mọi thứ REGULAR làm + thêm xem lương cùng phòng)

HR_EMPLOYEE ───▷ HR_MANAGER
              (HR_MANAGER làm được mọi thứ HR_EMPLOYEE làm + toàn quyền + giám sát)
```

> **Lưu ý:** ACCOUNTING và REGULAR độc lập nhau — không có quan hệ kế thừa.

---

## 2. Danh sách Use Cases theo nhóm

### Gói 1 – Xác thực (Authentication)

| Mã | Tên Use Case | Actor thực hiện |
|----|-------------|-----------------|
| UC01 | Đăng nhập hệ thống | Tất cả actors |
| UC02 | Đăng xuất hệ thống | Tất cả actors |

**Quan hệ:**
- `UC01` `<<include>>` → **Xác minh thông tin đăng nhập**
- `UC01` `<<include>>` → **Ghi Audit Log (LOGIN_SUCCESS / LOGIN_FAILURE)**
- `UC01` `<<extend>>` → **Khóa tài khoản tự động** *(khi đăng nhập sai quá số lần quy định)*

---

### Gói 2 – Xem thông tin nhân viên (Read)

| Mã | Tên Use Case | Actor được phép | Căn cứ đề tài |
|----|-------------|-----------------|---------------|
| UC03 | Xem danh sách NV cùng phòng (không có lương) | **Tất cả** | Chính sách 1 – áp dụng mọi role |
| UC04 | Xem thông tin chi tiết NV (không có lương) | **Tất cả** | Chính sách 1 – chỉ cùng phòng |
| UC05 | Xem lương NV trong phòng mình | **MANAGER** | "Xem mọi thông tin kể cả lương" |
| UC06 | Xem lương + mã số thuế của MỌI NV toàn công ty | **ACCOUNTING** | "Xem mã số, lương, mã số thuế của mọi NV" |
| UC07 | Xem mọi thông tin NV ngoài phòng HR | **HR_EMPLOYEE** | Chính sách 1 vẫn áp dụng với NV cùng phòng HR |
| UC08 | Xem mọi thông tin MỌI NV (kể cả phòng HR) | **HR_MANAGER** | "Xem và chỉnh sửa thông tin của mọi nhân viên" |

**Quan hệ:**
- `UC04` `<<include>>` → **Kiểm tra cùng phòng ban**
- `UC05` `<<extend>>` → `UC04` *(MANAGER xem thêm lương so với REGULAR)*
- `UC06` `<<extend>>` → `UC04` *(ACCOUNTING xem thêm lương + thuế toàn công ty)*
- `UC07` `<<extend>>` → `UC04` *(HR_EMPLOYEE xem thêm NV ngoài phòng HR)*

---

### Gói 3 – Chỉnh sửa thông tin nhân viên (Write)

| Mã | Tên Use Case | Actor được phép | Căn cứ đề tài |
|----|-------------|-----------------|---------------|
| UC09 | Thêm nhân viên mới | HR_EMPLOYEE, HR_MANAGER | "Có quyền xem, chỉnh sửa" |
| UC10 | Cập nhật thông tin nhân viên | HR_EMPLOYEE *(ngoài phòng HR)*, HR_MANAGER *(tất cả)* | Chính sách phòng HR |
| UC11 | Xóa nhân viên | HR_EMPLOYEE *(ngoài phòng HR)*, HR_MANAGER *(tất cả)* | Chính sách phòng HR |

**Quan hệ:**
- `UC10` `<<include>>` → **Kiểm tra phạm vi (không phải cùng phòng HR với HR_EMPLOYEE)**
- `UC09` `<<include>>` → **Ghi Audit Log (EMPLOYEE_CREATE)**
- `UC10` `<<include>>` → **Ghi Audit Log (EMPLOYEE_UPDATE)**
- `UC11` `<<include>>` → **Ghi Audit Log (EMPLOYEE_DELETE)**

> ⚠️ **Quan trọng:** REGULAR, MANAGER, ACCOUNTING **KHÔNG có quyền INSERT, UPDATE, DELETE** bất kỳ thông tin nào – ghi chú rõ trên diagram.

---

### Gói 4 – Giám sát & Audit Log

| Mã | Tên Use Case | Actor được phép | Căn cứ đề tài |
|----|-------------|-----------------|---------------|
| UC12 | Giám sát lịch sử chỉnh sửa của NV phòng HR | **HR_MANAGER** | "Giám sát việc chỉnh sửa thông tin cá nhân của NV trong phòng nhân sự" |

**Quan hệ:**
- `UC12` `<<include>>` → **Kiểm tra quyền audit_log.read**

---

### Gói 5 – Quản trị hệ thống

| Mã | Tên Use Case | Actor được phép |
|----|-------------|-----------------|
| UC13 | Quản lý tài khoản người dùng (thêm, sửa, khóa, phân quyền) | **ADMIN** |
| UC14 | Quản lý Roles & Permissions | **ADMIN** |

---

## 3. Ma trận quyền tổng hợp

| Use Case | REGULAR | MANAGER | HR_EMPLOYEE | HR_MANAGER | ACCOUNTING | ADMIN |
|----------|:-------:|:-------:|:-----------:|:----------:|:----------:|:-----:|
| UC01: Đăng nhập | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| UC02: Đăng xuất | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| UC03: Xem DS NV cùng phòng | ✓ | ✓ | ✓* | ✓ | ✓* | ✓ |
| UC04: Xem chi tiết NV (không lương) | ✓ | ✓ | ✓* | ✓ | ✓* | ✓ |
| UC05: Xem lương NV cùng phòng | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ |
| UC06: Xem lương + thuế MỌI NV | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| UC07: Xem MỌI thông tin NV ngoài phòng HR | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| UC09: Thêm nhân viên | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| UC10: Cập nhật thông tin NV | ✗ | ✗ | ✓* | ✓ | ✗ | ✓ |
| UC11: Xóa nhân viên | ✗ | ✗ | ✓* | ✓ | ✗ | ✓ |
| UC12: Giám sát Audit Log phòng HR | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| UC13: Quản trị Users | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| UC14: Quản trị Roles/Permissions | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

> `✓*` = Có quyền nhưng **bị giới hạn phạm vi** (ngoài phòng HR hoặc ngoài phòng mình)

---

## 4. Hướng dẫn vẽ từng bước

### Bước 1 – Vẽ System Boundary
Một hình chữ nhật lớn, tiêu đề: `«system» Hệ thống Quản lý Nhân viên`

### Bước 2 – Đặt Actors bên ngoài boundary

```
Bên trái:   REGULAR    MANAGER    ACCOUNTING
Bên phải:   HR_EMPLOYEE    HR_MANAGER    ADMIN
```

### Bước 3 – Vẽ Generalization giữa Actors (mũi tên tam giác rỗng)

```
REGULAR     ───▷ MANAGER
HR_EMPLOYEE ───▷ HR_MANAGER
```

### Bước 4 – Chia 5 gói (package) bên trong boundary

```
┌────────────────────────────────────────────────────────┐
│              Hệ thống Quản lý Nhân viên                │
│  ┌─────────────┐  ┌──────────────────────────────┐    │
│  │ Gói 1       │  │ Gói 2                        │    │
│  │ Xác thực    │  │ Xem thông tin nhân viên      │    │
│  │ UC01, UC02  │  │ UC03–UC08                    │    │
│  └─────────────┘  └──────────────────────────────┘    │
│  ┌──────────────────┐  ┌────────────────────────┐     │
│  │ Gói 3            │  │ Gói 4                  │     │
│  │ Chỉnh sửa NV     │  │ Audit Log              │     │
│  │ UC09, UC10, UC11 │  │ UC12                   │     │
│  └──────────────────┘  └────────────────────────┘     │
│  ┌──────────────────────┐                              │
│  │ Gói 5                │                              │
│  │ Quản trị hệ thống    │                              │
│  │ UC13, UC14           │                              │
│  └──────────────────────┘                              │
└────────────────────────────────────────────────────────┘
```

### Bước 5 – Nối Actor → Use Case (đường thẳng)

| Actor | Nối tới |
|-------|---------|
| Tất cả actors | UC01, UC02, UC03, UC04 |
| MANAGER | UC05 |
| ACCOUNTING | UC06 |
| HR_EMPLOYEE | UC07, UC09, UC10, UC11 |
| HR_MANAGER | UC08, UC09, UC10, UC11, UC12 |
| ADMIN | UC13, UC14 |

### Bước 6 – Vẽ quan hệ <<include>> và <<extend>> (đường đứt nét)

```
UC01  ---<<include>>--→  Xác minh thông tin đăng nhập
UC01  ---<<include>>--→  Ghi Audit Log
UC01  ---<<extend>>---→  Khóa tài khoản tự động

UC04  ---<<include>>--→  Kiểm tra cùng phòng ban
UC05  ---<<extend>>---→  UC04
UC06  ---<<extend>>---→  UC04
UC07  ---<<extend>>---→  UC04

UC09  ---<<include>>--→  Ghi Audit Log
UC10  ---<<include>>--→  Ghi Audit Log
UC10  ---<<include>>--→  Kiểm tra phạm vi phòng ban
UC11  ---<<include>>--→  Ghi Audit Log

UC12  ---<<include>>--→  Kiểm tra quyền audit_log.read
```
