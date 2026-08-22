# Dayflow HRMS (v2)

Dayflow is a secure, multi-tenant Human Resource Management System (HRMS) built from scratch as a single standalone workspace. It features a complete PostgreSQL-backed database schema, a modular Express TypeScript API server, and a premium React (Vite + TypeScript + Tailwind CSS) client dashboard.

---

## 1. Setup & Running Instructions

### System Prerequisites
- **Node.js**: `v24.19.0` or higher
- **npm**: `v11.17.0` or higher
- **Database**: Runs out-of-the-box using `@electric-sql/pglite` (embedded WebAssembly PostgreSQL 16) with persistent disk storage under `./db/storage`. To swap for an external server, set `DATABASE_URL` in `.env`.

### Installation Steps

1. **Clone the repository** and navigate to the project root.
2. **Install dependencies** for both the server and client:
   ```bash
   # Build Server
   cd server
   npm install
   
   # Build Client
   cd ../client
   npm install
   ```

3. **Database Seeding**:
   Initialize schema migrations, triggers, views, and generate dummy records:
   ```bash
   cd ../server
   npm run seed
   ```
   *Note: This creates "Odoo India" workspace, 1 admin, 2 departments, 6+ employees across 2025/2026 years, leave requests, attendance logs, salary structures, and payslips.*

4. **Running Locally**:
   Start both backend and frontend servers:
   ```bash
   # Start Express API Server (runs on http://localhost:5000)
   cd server
   npm run dev

   # Start Vite React Client (runs on http://localhost:5173)
   cd ../client
   npm run dev
   ```

---

## 2. Entity Relationship Diagram (ERD)

Dayflow uses a highly normalized multi-tenant relational schema:

```mermaid
erDiagram
    COMPANIES ||--o{ DEPARTMENTS : has
    COMPANIES ||--o{ USERS : owns
    COMPANIES ||--|| LOGIN_ID_COUNTERS : tracks
    USERS ||--|| EMPLOYEE_PROFILES : has
    USERS ||--|| EMPLOYEE_RESUME : has
    USERS ||--|| EMPLOYEE_PRIVATE_INFO : has
    USERS ||--o{ REFRESH_TOKENS : generates
    USERS ||--o{ ATTENDANCE : logs
    USERS ||--o{ LEAVE_BALANCES : allocates
    USERS ||--o{ LEAVE_REQUESTS : applies
    USERS ||--o{ SALARY_STRUCTURES : has
    SALARY_STRUCTURES ||--o{ SALARY_COMPONENTS : contains
    USERS ||--o{ PAYSLIPS : receives
    USERS ||--o{ AUDIT_LOGS : performs
```

- **Encryption at rest**: PII fields (`bank_account_number_enc`, `pan_number_enc`, `aadhar_number_enc` in `employee_private_info` table) are encrypted using AES-256-GCM.

---

## 3. Email & Notification Mode
- **Active Mode**: **Dev Mode Console Fallback**. All notifications are intercepted and printed with full headers/body inside the backend server stdout console logs to allow verification without configuring SMTP transport credentials.

---

## 4. Login ID Algorithm worked example

Every employee joining the workspace receives a generated ID matching:
`[CompanyPrefix][NameInitials][JoiningYear][Serial]`

### Steps to compute ID:
1. **CompanyPrefix**:
   - First letter of first two words of company name.
   - Example: `"Odoo India"` → `O` + `I` = `OI`.
2. **NameInitials**:
   - First two letters of first name + first two letters of last name.
   - Example: `"John Doe"` → `JO` + `DO` = `JODO`.
3. **JoiningYear**:
   - 4-digit year.
   - Example: `2026`.
4. **Serial**:
   - Zeros-padded 4-digit atomic incrementing serial number per company per year.
   - Example: `0002` (resets to `0001` every calendar year).

**Generated Result**: `OIJODO20260002`
