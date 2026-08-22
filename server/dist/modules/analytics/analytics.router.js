"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/dashboard', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        // 1. Employee headcount
        const countRes = await (0, db_1.query)('SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active = TRUE', [
            companyId,
        ]);
        const totalEmployees = Number(countRes.rows[0].count || 0);
        // 2. Attendance today
        const attRes = await (0, db_1.query)(`SELECT COUNT(*) FROM attendance a
       JOIN users u ON u.user_id = a.user_id
       WHERE u.company_id = $1 AND a.date = $2 AND a.check_in_time IS NOT NULL`, [companyId, today]);
        const presentToday = Number(attRes.rows[0].count || 0);
        // 3. On leave today
        const leaveRes = await (0, db_1.query)(`SELECT COUNT(*) FROM leave_requests lr
       JOIN users u ON u.user_id = lr.user_id
       WHERE u.company_id = $1 AND lr.status = 'approved' AND $2 BETWEEN lr.start_date AND lr.end_date`, [companyId, today]);
        const onLeaveToday = Number(leaveRes.rows[0].count || 0);
        const absentToday = Math.max(totalEmployees - presentToday - onLeaveToday, 0);
        // 4. Payroll expenditure current month
        const payRes = await (0, db_1.query)(`SELECT COALESCE(SUM(net_pay), 0) as total_net_pay, COALESCE(SUM(gross_pay), 0) as total_gross_pay
       FROM payslips ps
       JOIN users u ON u.user_id = ps.user_id
       WHERE u.company_id = $1 AND ps.month = $2 AND ps.year = $3`, [companyId, currentMonth, currentYear]);
        return res.json({
            totalEmployees,
            presentToday,
            onLeaveToday,
            absentToday,
            attendancePercentage: totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0,
            currentMonthPayroll: {
                month: currentMonth,
                year: currentYear,
                totalNetPay: Number(payRes.rows[0].total_net_pay),
                totalGrossPay: Number(payRes.rows[0].total_gross_pay),
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
