"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const loginId_1 = require("./utils/loginId");
async function runSeed() {
    console.log('--- Starting Seed Script ---');
    // 1. Run migrations (Clean up tables first for clean re-runnable seed)
    console.log('Cleaning up existing database tables...');
    await (0, db_1.exec)(`
    DROP VIEW IF EXISTS employee_current_status CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS payslips CASCADE;
    DROP TABLE IF EXISTS salary_components CASCADE;
    DROP TABLE IF EXISTS salary_structures CASCADE;
    DROP TABLE IF EXISTS leave_requests CASCADE;
    DROP TABLE IF EXISTS leave_balances CASCADE;
    DROP TABLE IF EXISTS leave_types CASCADE;
    DROP TABLE IF EXISTS attendance CASCADE;
    DROP TABLE IF EXISTS documents CASCADE;
    DROP TABLE IF EXISTS employee_private_info CASCADE;
    DROP TABLE IF EXISTS employee_resume CASCADE;
    DROP TABLE IF EXISTS employee_profiles CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS email_verification_tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS login_id_counters CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;
    DROP TABLE IF EXISTS companies CASCADE;
  `);
    const schemaSql = fs_1.default.readFileSync(path_1.default.join(__dirname, '../../db/01_schema.sql'), 'utf-8');
    await (0, db_1.exec)(schemaSql);
    const funcSql = fs_1.default.readFileSync(path_1.default.join(__dirname, '../../db/02_functions.sql'), 'utf-8');
    await (0, db_1.exec)(funcSql);
    // 2. Create Company
    const compRes = await (0, db_1.query)(`INSERT INTO companies (name) VALUES ('Odoo India') RETURNING company_id, name`);
    const company = compRes.rows[0];
    const companyId = company.company_id;
    console.log(`Created Company: ${company.name} (${companyId})`);
    // 3. Create Departments
    const deptEng = await (0, db_1.query)(`INSERT INTO departments (company_id, name) VALUES ($1, 'Engineering') RETURNING department_id`, [companyId]);
    const deptHR = await (0, db_1.query)(`INSERT INTO departments (company_id, name) VALUES ($1, 'Human Resources') RETURNING department_id`, [companyId]);
    const engId = deptEng.rows[0].department_id;
    const hrId = deptHR.rows[0].department_id;
    // 4. Create Admin User
    const adminPasswordHash = await bcryptjs_1.default.hash('AdminPass123!', 12);
    const { loginId: adminLoginId, serialNo: adminSerial } = await (0, loginId_1.generateLoginId)(companyId, 'Odoo India', 'Marc', 'Admin', 2025);
    const adminUserRes = await (0, db_1.query)(`INSERT INTO users (company_id, login_id, email, phone, password_hash, role, must_change_password, is_email_verified)
     VALUES ($1, $2, 'admin@odooindia.com', '+91 9876543210', $3, 'admin', FALSE, TRUE)
     RETURNING user_id`, [companyId, adminLoginId, adminPasswordHash]);
    const adminUserId = adminUserRes.rows[0].user_id;
    await (0, db_1.query)(`INSERT INTO employee_profiles (user_id, company_id, first_name, last_name, department_id, designation, location, date_of_joining, joining_serial_no)
     VALUES ($1, $2, 'Marc', 'Admin', $3, 'HR Manager & Admin', 'Gandhinagar', '2025-01-01', $4)`, [adminUserId, companyId, hrId, adminSerial]);
    await (0, db_1.query)('INSERT INTO employee_resume (user_id, about) VALUES ($1, $2)', [
        adminUserId,
        'System Administrator & HR Director',
    ]);
    await (0, db_1.query)('INSERT INTO employee_private_info (user_id, personal_email) VALUES ($1, $2)', [
        adminUserId,
        'admin.personal@odooindia.com',
    ]);
    // 5. Create Leave Types
    const ptoRes = await (0, db_1.query)(`INSERT INTO leave_types (company_id, name, max_days_per_year, is_paid, requires_attachment)
     VALUES ($1, 'Paid Time Off', 24, TRUE, FALSE) RETURNING leave_type_id`, [companyId]);
    const sickRes = await (0, db_1.query)(`INSERT INTO leave_types (company_id, name, max_days_per_year, is_paid, requires_attachment)
     VALUES ($1, 'Sick Leave', 12, TRUE, TRUE) RETURNING leave_type_id`, [companyId]);
    const unpaidRes = await (0, db_1.query)(`INSERT INTO leave_types (company_id, name, max_days_per_year, is_paid, requires_attachment)
     VALUES ($1, 'Unpaid Leaves', 30, FALSE, FALSE) RETURNING leave_type_id`, [companyId]);
    const ptoId = ptoRes.rows[0].leave_type_id;
    const sickId = sickRes.rows[0].leave_type_id;
    const unpaidId = unpaidRes.rows[0].leave_type_id;
    // 6. Employees Data definition across 2 joining years (2025 & 2026) to demonstrate serial counter reset per year!
    const employeeDefs = [
        {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@odooindia.com',
            deptId: engId,
            designation: 'Senior Software Engineer',
            joiningDate: '2025-03-15',
            joiningYear: 2025,
            wage: 85000,
        },
        {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@odooindia.com',
            deptId: engId,
            designation: 'Frontend Lead',
            joiningDate: '2025-06-01',
            joiningYear: 2025,
            wage: 95000,
        },
        {
            firstName: 'Robert',
            lastName: 'Johnson',
            email: 'robert.johnson@odooindia.com',
            deptId: hrId,
            designation: 'HR Specialist',
            joiningDate: '2025-09-10',
            joiningYear: 2025,
            wage: 65000,
        },
        {
            firstName: 'Emily',
            lastName: 'Davis',
            email: 'emily.davis@odooindia.com',
            deptId: engId,
            designation: 'QA Automation Engineer',
            joiningDate: '2026-01-10',
            joiningYear: 2026,
            wage: 70000,
        },
        {
            firstName: 'Michael',
            lastName: 'Brown',
            email: 'michael.brown@odooindia.com',
            deptId: engId,
            designation: 'DevOps Engineer',
            joiningDate: '2026-02-01',
            joiningYear: 2026,
            wage: 90000,
        },
        {
            firstName: 'Sarah',
            lastName: 'Wilson',
            email: 'sarah.wilson@odooindia.com',
            deptId: hrId,
            designation: 'Talent Acquisition Executive',
            joiningDate: '2026-03-01',
            joiningYear: 2026,
            wage: 60000,
        },
    ];
    const createdEmployees = [];
    for (const empDef of employeeDefs) {
        const { loginId, serialNo } = await (0, loginId_1.generateLoginId)(companyId, 'Odoo India', empDef.firstName, empDef.lastName, empDef.joiningYear);
        const tempPassword = 'TempPass123!';
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 12);
        const userRes = await (0, db_1.query)(`INSERT INTO users (company_id, login_id, email, phone, password_hash, role, must_change_password, is_email_verified)
       VALUES ($1, $2, $3, '+91 9123456789', $4, 'employee', TRUE, TRUE)
       RETURNING user_id, login_id`, [companyId, loginId, empDef.email, passwordHash]);
        const userId = userRes.rows[0].user_id;
        await (0, db_1.query)(`INSERT INTO employee_profiles
       (user_id, company_id, first_name, last_name, department_id, manager_id, designation, location, date_of_joining, joining_serial_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Gandhinagar', $8, $9)`, [
            userId,
            companyId,
            empDef.firstName,
            empDef.lastName,
            empDef.deptId,
            adminUserId,
            empDef.designation,
            empDef.joiningDate,
            serialNo,
        ]);
        await (0, db_1.query)(`INSERT INTO employee_resume (user_id, about, job_highlights, skills, certifications, interests)
       VALUES ($1, 'Passionate team member at Odoo India', 'Delivered core HRMS portal modules', ARRAY['TypeScript', 'React', 'PostgreSQL'], ARRAY['AWS Certified'], ARRAY['Coding', 'Music'])`, [userId]);
        await (0, db_1.query)(`INSERT INTO employee_private_info
       (user_id, date_of_birth, residing_address, nationality, personal_email, gender, marital_status, bank_name, blood_group)
       VALUES ($1, '1995-05-20', '123 Tech Park, Gandhinagar', 'Indian', $2, 'Male', 'Single', 'HDFC Bank', 'O+')`, [userId, `personal.${empDef.email}`]);
        // Leave Balances for 2026
        await (0, db_1.query)(`INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days) VALUES
       ($1, $2, 2026, 24, 2),
       ($1, $3, 2026, 12, 1),
       ($1, $4, 2026, 30, 0)`, [userId, ptoId, sickId, unpaidId]);
        // Salary Structure
        const salRes = await (0, db_1.query)(`INSERT INTO salary_structures
       (user_id, month_wage, working_days_per_week, standard_shift_hours, break_time_hours, pf_employee_rate, pf_employer_rate, professional_tax, effective_from, created_by)
       VALUES ($1, $2, 5, 8.0, 1.0, 12.0, 12.0, 200.0, '2025-01-01', $3)
       RETURNING salary_id`, [userId, empDef.wage, adminUserId]);
        const salaryId = salRes.rows[0].salary_id;
        // Components with Fixed Allowance Absorber math
        const basic = empDef.wage * 0.5;
        const hra = basic * 0.4;
        const stdAllow = 2000;
        const bonus = 3000;
        const nonFixedTotal = basic + hra + stdAllow + bonus;
        const fixedAllowance = Math.max(empDef.wage - nonFixedTotal, 0);
        await (0, db_1.query)(`INSERT INTO salary_components (salary_id, component_name, computation_type, rate_value, computed_amount, display_order) VALUES
       ($1, 'Basic Salary', 'percentage_of_wage', 50, $2, 1),
       ($1, 'House Rent Allowance', 'percentage_of_basic', 40, $3, 2),
       ($1, 'Standard Allowance', 'fixed_amount', NULL, $4, 3),
       ($1, 'Performance Bonus', 'fixed_amount', NULL, $5, 4),
       ($1, 'Fixed Allowance', 'fixed_amount', NULL, $6, 5)`, [salaryId, basic, hra, stdAllow, bonus, fixedAllowance]);
        createdEmployees.push({ userId, loginId, email: empDef.email, wage: empDef.wage });
        console.log(`Created Employee: ${empDef.firstName} ${empDef.lastName} -> Login ID: ${loginId}`);
    }
    // 7. Seed ~30 days of attendance for each employee
    console.log('Seeding 30 days of attendance records...');
    const today = new Date();
    for (const emp of createdEmployees) {
        for (let i = 30; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            if (d.getDay() === 0 || d.getDay() === 6)
                continue;
            const dateStr = d.toISOString().split('T')[0];
            const rand = Math.random();
            if (rand < 0.85) {
                const checkIn = `${dateStr}T09:00:00.000Z`;
                const checkOut = `${dateStr}T17:30:00.000Z`;
                await (0, db_1.query)(`INSERT INTO attendance (user_id, date, check_in_time, check_out_time) VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, date) DO NOTHING`, [emp.userId, dateStr, checkIn, checkOut]);
            }
        }
    }
    // 8. Seed Leave Requests
    console.log('Seeding leave requests...');
    if (createdEmployees.length >= 2) {
        const emp1 = createdEmployees[0];
        const emp2 = createdEmployees[1];
        await (0, db_1.query)(`INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, total_days, remarks, status, reviewed_by)
       VALUES ($1, $2, '2026-07-10', '2026-07-12', 3, 'Family function', 'approved', $3)`, [emp1.userId, ptoId, adminUserId]);
        await (0, db_1.query)(`INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, total_days, remarks, status)
       VALUES ($1, $2, '2026-08-25', '2026-08-26', 2, 'Doctor appointment', 'pending')`, [emp2.userId, sickId]);
    }
    // 9. Seed Monthly Payslips for July 2026
    console.log('Generating July 2026 payslips...');
    for (const emp of createdEmployees) {
        const salRes = await (0, db_1.query)('SELECT salary_id FROM salary_structures WHERE user_id = $1 LIMIT 1', [
            emp.userId,
        ]);
        if (salRes.rows.length > 0) {
            const salaryId = salRes.rows[0].salary_id;
            const monthWage = emp.wage;
            const payableDays = 22;
            const grossPay = monthWage;
            const pfEmp = Math.round(grossPay * 0.12);
            const pfEmployer = Math.round(grossPay * 0.12);
            const profTax = 200;
            const netPay = grossPay - pfEmp - profTax;
            await (0, db_1.query)(`INSERT INTO payslips (user_id, salary_id, month, year, total_days_in_period, payable_days, gross_pay, pf_employee_amount, pf_employer_amount, professional_tax, net_pay)
         VALUES ($1, $2, 7, 2026, 22, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, month, year) DO NOTHING`, [emp.userId, salaryId, payableDays, grossPay, pfEmp, pfEmployer, profTax, netPay]);
        }
    }
    console.log('--- Seed Completed Successfully ---');
}
runSeed().catch((err) => {
    console.error('Seed Error:', err);
    process.exit(1);
});
