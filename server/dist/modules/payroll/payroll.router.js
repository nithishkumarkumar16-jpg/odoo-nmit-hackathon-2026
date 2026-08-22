"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/payroll/structure/:userId
router.get('/structure/:userId', auth_1.authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.userId;
        const role = req.user.role;
        if (role !== 'admin' && currentUserId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const salRes = await (0, db_1.query)(`SELECT ss.* FROM salary_structures ss JOIN users u ON u.user_id = ss.user_id
       WHERE ss.user_id = $1 AND u.company_id = $2 ORDER BY ss.effective_from DESC LIMIT 1`, [userId, req.user.companyId]);
        if (salRes.rows.length === 0) {
            return res.json({ structure: null, components: [] });
        }
        const structure = salRes.rows[0];
        const compRes = await (0, db_1.query)(`SELECT * FROM salary_components WHERE salary_id = $1 ORDER BY display_order ASC`, [structure.salary_id]);
        return res.json({
            structure,
            components: compRes.rows,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/payroll/structure - Save/update structure + recalculate components with Fixed Allowance remainder absorber
router.post('/structure', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const { userId, monthWage, workingDaysPerWeek, standardShiftHours, breakTimeHours, pfEmployeeRate, pfEmployerRate, professionalTax, components, // Array of { componentName, computationType, rateValue, fixedAmount }
         } = req.body;
        const wage = Number(monthWage);
        if (!wage || wage <= 0)
            return res.status(400).json({ error: 'Valid month wage is required' });
        const targetUser = await (0, db_1.query)('SELECT user_id FROM users WHERE user_id = $1 AND company_id = $2', [userId, req.user.companyId]);
        if (targetUser.rows.length === 0)
            return res.status(404).json({ error: 'Employee not found' });
        const effectiveFrom = new Date().toISOString().split('T')[0];
        // Create salary structure row
        const structRes = await (0, db_1.query)(`INSERT INTO salary_structures
       (user_id, month_wage, working_days_per_week, standard_shift_hours, break_time_hours,
        pf_employee_rate, pf_employer_rate, professional_tax, effective_from, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`, [
            userId,
            wage,
            workingDaysPerWeek || 5,
            standardShiftHours || 8.0,
            breakTimeHours || 1.0,
            pfEmployeeRate || 12.0,
            pfEmployerRate || 12.0,
            professionalTax || 200.0,
            effectiveFrom,
            req.user.userId,
        ]);
        const salaryId = structRes.rows[0].salary_id;
        // Component recalculation with Fixed Allowance absorber logic
        let basicAmount = 0;
        const inputComponents = components || [
            { componentName: 'Basic Salary', computationType: 'percentage_of_wage', rateValue: 50, displayOrder: 1 },
            { componentName: 'House Rent Allowance', computationType: 'percentage_of_basic', rateValue: 40, displayOrder: 2 },
            { componentName: 'Standard Allowance', computationType: 'fixed_amount', fixedAmount: 2000, displayOrder: 3 },
            { componentName: 'Performance Bonus', computationType: 'fixed_amount', fixedAmount: 3000, displayOrder: 4 },
            { componentName: 'Fixed Allowance', computationType: 'fixed_amount', fixedAmount: 0, displayOrder: 5 },
        ];
        // 1. Calculate Basic Salary first if specified
        const basicComp = inputComponents.find((c) => c.componentName === 'Basic Salary');
        if (basicComp) {
            if (basicComp.computationType === 'percentage_of_wage') {
                basicAmount = (wage * (Number(basicComp.rateValue) || 50)) / 100;
            }
            else {
                basicAmount = Number(basicComp.fixedAmount) || wage * 0.5;
            }
        }
        else {
            basicAmount = wage * 0.5;
        }
        let nonFixedTotal = 0;
        const computedList = [];
        for (const comp of inputComponents) {
            if (comp.componentName === 'Fixed Allowance')
                continue; // Calculate remainder later
            let amount = 0;
            if (comp.computationType === 'percentage_of_wage') {
                amount = (wage * (Number(comp.rateValue) || 0)) / 100;
            }
            else if (comp.computationType === 'percentage_of_basic') {
                amount = (basicAmount * (Number(comp.rateValue) || 0)) / 100;
            }
            else {
                amount = Number(comp.fixedAmount) || 0;
            }
            amount = Math.round(amount * 100) / 100;
            nonFixedTotal += amount;
            computedList.push({
                componentName: comp.componentName,
                computationType: comp.computationType,
                rateValue: comp.rateValue || null,
                computedAmount: amount,
                displayOrder: comp.displayOrder || 1,
            });
        }
        // Fixed Allowance absorbs whatever remainder is left (wage - nonFixedTotal)
        const remainder = Math.max(wage - nonFixedTotal, 0);
        computedList.push({
            componentName: 'Fixed Allowance',
            computationType: 'fixed_amount',
            rateValue: null,
            computedAmount: Math.round(remainder * 100) / 100,
            displayOrder: 99,
        });
        // Save components to database
        for (const c of computedList) {
            await (0, db_1.query)(`INSERT INTO salary_components
         (salary_id, component_name, computation_type, rate_value, computed_amount, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)`, [salaryId, c.componentName, c.computationType, c.rateValue, c.computedAmount, c.displayOrder]);
        }
        return res.status(201).json({
            message: 'Salary structure saved',
            structure: structRes.rows[0],
            components: computedList,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/payroll/generate - Generate payslips for all active employees for period
router.post('/generate', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { month, year } = req.body; // e.g. month: 8, year: 2026
        const m = Number(month);
        const y = Number(year);
        if (!m || !y || m < 1 || m > 12) {
            return res.status(400).json({ error: 'Valid month (1-12) and year required' });
        }
        const totalDaysInMonth = new Date(y, m, 0).getDate();
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const endDate = `${y}-${String(m).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;
        // Get all employees for company
        const employees = await (0, db_1.query)('SELECT user_id FROM users WHERE company_id = $1 AND is_active = TRUE', [
            companyId,
        ]);
        const generatedPayslips = [];
        for (const emp of employees.rows) {
            const userId = emp.user_id;
            // 1. Pull active salary structure
            const salRes = await (0, db_1.query)(`SELECT * FROM salary_structures WHERE user_id = $1 AND effective_from <= $2 ORDER BY effective_from DESC LIMIT 1`, [userId, endDate]);
            if (salRes.rows.length === 0)
                continue; // Skip if no salary structure set
            const sal = salRes.rows[0];
            // 2. Compute attendance present days
            const attRes = await (0, db_1.query)(`SELECT COUNT(DISTINCT date) as present_days FROM attendance WHERE user_id = $1 AND date >= $2 AND date <= $3 AND check_in_time IS NOT NULL`, [userId, startDate, endDate]);
            const presentDays = Number(attRes.rows[0].present_days || 0);
            // 3. Compute approved leave days
            const leaveRes = await (0, db_1.query)(`SELECT lr.total_days, lt.is_paid
         FROM leave_requests lr
         JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
         WHERE lr.user_id = $1 AND lr.status = 'approved'
           AND lr.start_date <= $2 AND lr.end_date >= $3`, [userId, endDate, startDate]);
            let paidLeaveDays = 0;
            let unpaidLeaveDays = 0;
            for (const l of leaveRes.rows) {
                if (l.is_paid)
                    paidLeaveDays += Number(l.total_days);
                else
                    unpaidLeaveDays += Number(l.total_days);
            }
            // Payable days formula per business rule 2.4 & 2.6:
            // payable_days = presentDays + paidLeaveDays
            // If employee was hired mid-month, cap by days since joining
            const payableDays = Math.min(presentDays + paidLeaveDays, totalDaysInMonth);
            // 4. Pro-rate gross pay
            const monthWage = Number(sal.month_wage);
            const grossPay = Math.round((monthWage * (payableDays / totalDaysInMonth)) * 100) / 100;
            // Deductions
            const pfEmployeeRate = Number(sal.pf_employee_rate || 12.0);
            const pfEmployeeAmount = Math.round(((grossPay * pfEmployeeRate) / 100) * 100) / 100;
            const pfEmployerAmount = Math.round(((grossPay * Number(sal.pf_employer_rate || 12.0)) / 100) * 100) / 100;
            const professionalTax = Number(sal.professional_tax || 200.0);
            const netPay = Math.max(Math.round((grossPay - pfEmployeeAmount - professionalTax) * 100) / 100, 0);
            // Insert or update payslip snapshot
            const payslipRes = await (0, db_1.query)(`INSERT INTO payslips
         (user_id, salary_id, month, year, total_days_in_period, payable_days, gross_pay, pf_employee_amount, pf_employer_amount, professional_tax, net_pay)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id, month, year)
         DO UPDATE SET
           salary_id = EXCLUDED.salary_id,
           total_days_in_period = EXCLUDED.total_days_in_period,
           payable_days = EXCLUDED.payable_days,
           gross_pay = EXCLUDED.gross_pay,
           pf_employee_amount = EXCLUDED.pf_employee_amount,
           pf_employer_amount = EXCLUDED.pf_employer_amount,
           professional_tax = EXCLUDED.professional_tax,
           net_pay = EXCLUDED.net_pay,
           generated_at = NOW()
         RETURNING *`, [
                userId,
                sal.salary_id,
                m,
                y,
                totalDaysInMonth,
                payableDays,
                grossPay,
                pfEmployeeAmount,
                pfEmployerAmount,
                professionalTax,
                netPay,
            ]);
            generatedPayslips.push(payslipRes.rows[0]);
        }
        return res.json({
            message: `Generated ${generatedPayslips.length} payslips for ${m}/${y}`,
            payslips: generatedPayslips,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/payroll/payslips - View payslips
router.get('/payslips', auth_1.authenticate, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const role = req.user.role;
        const companyId = req.user.companyId;
        const targetUserId = req.query.userId ? req.query.userId : currentUserId;
        if (role !== 'admin' && targetUserId !== currentUserId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const slips = await (0, db_1.query)(`SELECT ps.*, p.first_name, p.last_name, u.login_id
       FROM payslips ps
       JOIN users u ON u.user_id = ps.user_id
       JOIN employee_profiles p ON p.user_id = u.user_id
       WHERE u.company_id = $1 ${role !== 'admin' || req.query.userId ? 'AND ps.user_id = $2' : ''}
       ORDER BY ps.year DESC, ps.month DESC`, role !== 'admin' || req.query.userId ? [companyId, targetUserId] : [companyId]);
        return res.json(slips.rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
