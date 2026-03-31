# Employee Management System

A full-stack Human Resource Management (HRM) application built using React (Vite), Node.js, tRPC, Prisma, and SQL Server, with a focus on data security and role-based access control.

## Prerequisites

- **Node.js** (v18+ recommended)
- **SQL Server** (running locally or remotely)
- **Git**

## Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/phunguyen2005/employeeApp.git
   cd employeeApp/employee-management-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Copy the `.env.example` file and rename it to `.env`.
   - Open `.env` and configure your `DATABASE_URL` to point to your SQL Server instance, and customize `JWT_SECRET` if needed.
   - *Ensure your SQL Server has TCP/IP connections enabled (usually on port 1433).*

4. **Initialize the Database:**
   - Run the following command to apply the database schema via Prisma:
     ```bash
     npx prisma migrate dev
     ```
   - Seed the database with the initial departments and employee accounts:
     ```bash
     npm run seed
     ```

## Running the Application

This project requires both the frontend client and the backend server to be running simultaneously.

1. **Start the Backend Server** (in one terminal tab):
   ```bash
   npm run server
   ```

2. **Start the Frontend Development Server** (in a second terminal tab):
   ```bash
   npm run dev
   ```

Navigate to `http://localhost:3000` in your web browser to view the application!

---

## Default Login Credentials

After securely seeding the database, you can log in to test different access privileges using the following credentials:

| Email                 | Password | Role                 |
|-----------------------|----------|----------------------|
| alice@company.com     | alice    | `ADMIN`              |
| bob@company.com       | bob      | `MANAGER`            |
| charlie@company.com   | charlie  | `REGULAR`            |
| diana@company.com     | diana    | `HR_MANAGER`         |
| eve@company.com       | eve      | `HR_EMPLOYEE`        |
| frank@company.com     | frank    | `MANAGER`            |
| grace@company.com     | grace    | `ACCOUNTING`         |
| henry@company.com     | henry    | `REGULAR`            |
