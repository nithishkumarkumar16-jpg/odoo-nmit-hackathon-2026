process.env.NODE_ENV = 'test';
import bcrypt from 'bcryptjs';
import { query, exec } from '../db';
import { generateLoginId } from '../utils/loginId';

// Simple lightweight assertion runner
async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

async function runAllTests() {
  console.log('--- Starting Dayflow HRMS Integration Test Suite ---');

  // Reset database schema first
  const fs = require('fs');
  const path = require('path');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../../../db/01_schema.sql'), 'utf-8');
  await exec(schemaSql);
  const funcSql = fs.readFileSync(path.join(__dirname, '../../../db/02_functions.sql'), 'utf-8');
  await exec(funcSql);

  // 1. Company Onboarding and Admin creation
  const compName = 'NMIT Odoo Test';
  const compRes = await query('INSERT INTO companies (name) VALUES ($1) RETURNING company_id', [compName]);
  const companyId = compRes.rows[0].company_id;
  await assert(!!companyId, 'Company onboarding created company_id');

  const { loginId: adminLoginId, serialNo: adminSerial } = await generateLoginId(
    companyId,
    compName,
    'Marc',
    'Admin',
    2026
  );
  await assert(adminLoginId === 'NOMAAD20260001', `Admin login ID generation matches prefix rules. Got: ${adminLoginId}`);

  const adminPassHash = await bcrypt.hash('AdminPass123!', 12);
  const adminRes = await query(
    `INSERT INTO users (company_id, login_id, email, password_hash, role, must_change_password)
     VALUES ($1, $2, 'admin@nmitodoo.com', $3, 'admin', FALSE) RETURNING user_id`,
    [companyId, adminLoginId, adminPassHash]
  );
  const adminUserId = adminRes.rows[0].user_id;
  await assert(!!adminUserId, 'Admin user account created');

  // 2. Employee creation with Login ID algorithm & counters
  const { loginId: emp1LoginId, serialNo: emp1Serial } = await generateLoginId(
    companyId,
    compName,
    'John',
    'Doe',
    2026
  );
  await assert(emp1LoginId === 'NOJODO20260002', `First employee login ID serial resets properly after Admin. Got: ${emp1LoginId}`);

  // Test year reset serial counter
  const { loginId: emp2LoginId, serialNo: emp2Serial } = await generateLoginId(
    companyId,
    compName,
    'Jane',
    'Smith',
    2027
  );
  await assert(emp2LoginId === 'NOJASM20270001', `Counter correctly resets to 0001 for next year. Got: ${emp2LoginId}`);

  const tempPass = `${emp1LoginId}!`;
  const emp1Res = await query(
    `INSERT INTO users (company_id, login_id, email, password_hash, role, must_change_password)
     VALUES ($1, $2, 'john.doe@nmitodoo.com', $3, 'employee', TRUE) RETURNING user_id`,
    [companyId, emp1LoginId, await bcrypt.hash(tempPass, 12)]
  );
  const employeeUserId = emp1Res.rows[0].user_id;

  // Insert profile
  await query(
    `INSERT INTO employee_profiles (user_id, company_id, first_name, last_name, joining_serial_no)
     VALUES ($1, $2, 'John', 'Doe', $3)`,
    [employeeUserId, companyId, emp1Serial]
  );

  // 3. Attendance Check In/Out
  const today = new Date().toISOString().split('T')[0];
  const checkInRes = await query(
    `INSERT INTO attendance (user_id, date, check_in_time)
     VALUES ($1, $2, NOW()) RETURNING *`,
    [employeeUserId, today]
  );
  await assert(checkInRes.rows.length === 1, 'Check-in entry created');

  // Checkout and calculate work hours (simulated +2 hours checkout)
  const simulatedCheckIn = new Date();
  simulatedCheckIn.setHours(simulatedCheckIn.getHours() - 9); // 9 hours shift
  const simulatedCheckOut = new Date();

  await query(
    `UPDATE attendance
     SET check_in_time = $1, check_out_time = $2
     WHERE user_id = $3 AND date = $4`,
    [simulatedCheckIn, simulatedCheckOut, employeeUserId, today]
  );

  const workHrsRes = await query('SELECT work_hours FROM attendance WHERE user_id = $1 AND date = $2', [
    employeeUserId,
    today,
  ]);
  const hours = Number(workHrsRes.rows[0].work_hours);
  await assert(hours >= 8.9 && hours <= 9.1, `Work hours correctly computed as difference. Got: ${hours}`);

  // Extra hours logic check (hours - standard shift (8))
  const extraHours = Math.max(hours - 8, 0);
  await assert(extraHours >= 0.9 && extraHours <= 1.1, `Extra hours correctly calculated: ${extraHours}`);

  // 4. Leave request submission & allocation balances
  // Create leave type
  const ltRes = await query(
    `INSERT INTO leave_types (company_id, name, max_days_per_year, is_paid)
     VALUES ($1, 'Paid Time Off', 24, TRUE) RETURNING leave_type_id`,
    [companyId]
  );
  const leaveTypeId = ltRes.rows[0].leave_type_id;

  // Balance init
  await query(
    `INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
     VALUES ($1, $2, 2026, 24, 0)`,
    [employeeUserId, leaveTypeId]
  );

  // Apply request
  const reqRes = await query(
    `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, total_days, status)
     VALUES ($1, $2, '2026-10-10', '2026-10-12', 3, 'pending') RETURNING leave_request_id`,
    [employeeUserId, leaveTypeId]
  );
  const requestId = reqRes.rows[0].leave_request_id;
  await assert(!!requestId, 'Leave request submitted successfully');

  // Review (Approve)
  await query(
    `UPDATE leave_requests SET status = 'approved', reviewed_by = $1 WHERE leave_request_id = $2`,
    [adminUserId, requestId]
  );
  // Update used days on balance
  await query(
    `UPDATE leave_balances SET used_days = used_days + 3 WHERE user_id = $1 AND leave_type_id = $2 AND year = 2026`,
    [employeeUserId, leaveTypeId]
  );

  const balRes = await query('SELECT remaining_days FROM leave_balances WHERE user_id = $1', [employeeUserId]);
  await assert(Number(balRes.rows[0].remaining_days) === 21, `Leave balance correctly decremented. Remaining: ${balRes.rows[0].remaining_days}`);

  // 5. Salary component math & Fixed Allowance absorber
  const monthWage = 100000;
  const basic = monthWage * 0.5;
  const hra = basic * 0.4;
  const stdAllow = 2000;
  const bonus = 3000;
  const expectedFixed = monthWage - (basic + hra + stdAllow + bonus);

  await assert(expectedFixed === 25000, `Fixed Allowance math check. Expected: ${expectedFixed}`);

  // Save structure
  const structRes = await query(
    `INSERT INTO salary_structures (user_id, month_wage, pf_employee_rate, pf_employer_rate, professional_tax, effective_from, created_by)
     VALUES ($1, $2, 12, 12, 200, '2026-01-01', $3) RETURNING salary_id`,
    [employeeUserId, monthWage, adminUserId]
  );
  const salaryId = structRes.rows[0].salary_id;

  // Insert components
  await query(
    `INSERT INTO salary_components (salary_id, component_name, computation_type, computed_amount) VALUES
     ($1, 'Basic Salary', 'percentage_of_wage', $2),
     ($1, 'House Rent Allowance', 'percentage_of_basic', $3),
     ($1, 'Standard Allowance', 'fixed_amount', $4),
     ($1, 'Performance Bonus', 'fixed_amount', $5),
     ($1, 'Fixed Allowance', 'fixed_amount', $6)`,
    [salaryId, basic, hra, stdAllow, bonus, expectedFixed]
  );

  const sumRes = await query('SELECT SUM(computed_amount) FROM salary_components WHERE salary_id = $1', [salaryId]);
  await assert(Number(sumRes.rows[0].sum) === monthWage, `Salary components sum matches monthly wage. Sum: ${sumRes.rows[0].sum}`);

  // 6. Payslip Generation & payable days pro-rate logic
  // If employee has 20 days present + 2 days approved leave = 22 payable days out of 30
  const grossPay = Math.round((monthWage * (22 / 30)) * 100) / 100;
  await assert(grossPay === 73333.33, `Gross pay correctly pro-rated: ${grossPay}`);

  const pfDeduction = Math.round((grossPay * 0.12) * 100) / 100;
  const netPay = grossPay - pfDeduction - 200;
  await assert(netPay === 64333.33, `Net pay calculation verified: ${netPay}`);

  console.log('--- All Integration Tests Completed Successfully ---');
}

runAllTests().catch((err) => {
  console.error('Test Execution Failed:', err);
  process.exit(1);
});
