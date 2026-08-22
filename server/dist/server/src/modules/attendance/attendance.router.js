"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../db");
const auth_1 = require("../../middleware/auth");
const socket_1 = require("../../services/socket");
const router = (0, express_1.Router)();
// GET /api/attendance/status - Get logged-in user's attendance status today
router.get('/status', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const today = new Date().toISOString().split('T')[0];
        const attRes = await (0, db_1.query)(`SELECT attendance_id, date, check_in_time, check_out_time, work_hours
       FROM attendance
       WHERE user_id = $1 AND date = $2`, [userId, today]);
        if (attRes.rows.length === 0) {
            return res.json({
                checkedIn: false,
                checkInTime: null,
                checkOutTime: null,
                workHours: null,
            });
        }
        const row = attRes.rows[0];
        return res.json({
            checkedIn: !!row.check_in_time && !row.check_out_time,
            checkInTime: row.check_in_time,
            checkOutTime: row.check_out_time,
            workHours: row.work_hours,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/attendance/check-in
router.post('/check-in', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const companyId = req.user.companyId;
        const today = new Date().toISOString().split('T')[0];
        const existing = await (0, db_1.query)('SELECT * FROM attendance WHERE user_id = $1 AND date = $2', [
            userId,
            today,
        ]);
        if (existing.rows.length > 0 && existing.rows[0].check_in_time) {
            return res.status(400).json({ error: 'Already checked in today' });
        }
        let attRecord;
        if (existing.rows.length > 0) {
            const updated = await (0, db_1.query)(`UPDATE attendance SET check_in_time = NOW() WHERE user_id = $1 AND date = $2 RETURNING *`, [userId, today]);
            attRecord = updated.rows[0];
        }
        else {
            const inserted = await (0, db_1.query)(`INSERT INTO attendance (user_id, date, check_in_time) VALUES ($1, $2, NOW()) RETURNING *`, [userId, today]);
            attRecord = inserted.rows[0];
        }
        // Broadcast WebSocket event to update directory dots in real time
        (0, socket_1.notifyCompany)(companyId, 'ATTENDANCE_CHANGED', {
            userId,
            status: 'present',
            checkInTime: attRecord.check_in_time,
        });
        return res.json({
            message: 'Check-in successful',
            attendance: attRecord,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/attendance/check-out
router.post('/check-out', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const companyId = req.user.companyId;
        const today = new Date().toISOString().split('T')[0];
        const existing = await (0, db_1.query)('SELECT * FROM attendance WHERE user_id = $1 AND date = $2', [
            userId,
            today,
        ]);
        if (existing.rows.length === 0 || !existing.rows[0].check_in_time) {
            return res.status(400).json({ error: 'Must check in before checking out' });
        }
        if (existing.rows[0].check_out_time) {
            return res.status(400).json({ error: 'Already checked out today' });
        }
        const updated = await (0, db_1.query)(`UPDATE attendance SET check_out_time = NOW() WHERE user_id = $1 AND date = $2 RETURNING *`, [userId, today]);
        (0, socket_1.notifyCompany)(companyId, 'ATTENDANCE_CHANGED', {
            userId,
            status: 'present',
            checkOutTime: updated.rows[0].check_out_time,
        });
        return res.json({
            message: 'Check-out successful',
            attendance: updated.rows[0],
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/me - Month-navigable employee attendance
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const year = Number(req.query.year) || new Date().getFullYear();
        const month = Number(req.query.month) || new Date().getMonth() + 1; // 1-12
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        // Get active salary structure for standard_shift_hours (default 8)
        const salRes = await (0, db_1.query)(`SELECT standard_shift_hours FROM salary_structures WHERE user_id = $1 ORDER BY effective_from DESC LIMIT 1`, [userId]);
        const standardShift = salRes.rows.length > 0 ? Number(salRes.rows[0].standard_shift_hours) : 8.0;
        const records = await (0, db_1.query)(`SELECT 
        a.attendance_id,
        a.date,
        a.check_in_time,
        a.check_out_time,
        a.work_hours,
        GREATEST(COALESCE(a.work_hours, 0) - $3, 0) as extra_hours
       FROM attendance a
       WHERE a.user_id = $1 AND a.date >= $2 AND a.date <= $4
       ORDER BY a.date ASC`, [userId, startDate, standardShift, endDate]);
        // Header summary stats
        const presentCount = records.rows.filter((r) => r.check_in_time).length;
        const leaveCountRes = await (0, db_1.query)(`SELECT COALESCE(SUM(total_days), 0) as leave_count
       FROM leave_requests
       WHERE user_id = $1 AND status = 'approved'
         AND start_date <= $2 AND end_date >= $3`, [userId, endDate, startDate]);
        const leaveCount = Number(leaveCountRes.rows[0]?.leave_count || 0);
        const totalWorkHours = records.rows.reduce((sum, r) => sum + (Number(r.work_hours) || 0), 0);
        return res.json({
            year,
            month,
            summary: {
                presentDays: presentCount,
                leaveDays: leaveCount,
                totalWorkHours: Math.round(totalWorkHours * 100) / 100,
            },
            records: records.rows,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/admin - Date-navigable admin view
router.get('/admin', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        const search = req.query.search || '';
        const list = await (0, db_1.query)(`SELECT 
        u.user_id,
        u.login_id,
        p.first_name,
        p.last_name,
        p.profile_picture_url,
        d.name as department_name,
        a.check_in_time,
        a.check_out_time,
        a.work_hours,
        GREATEST(COALESCE(a.work_hours, 0) - COALESCE(ss.standard_shift_hours, 8.0), 0) as extra_hours,
        CASE
          WHEN lr.leave_request_id IS NOT NULL THEN 'on_leave'
          WHEN a.check_in_time IS NOT NULL THEN 'present'
          ELSE 'absent'
        END AS status
       FROM users u
       JOIN employee_profiles p ON p.user_id = u.user_id
       LEFT JOIN departments d ON d.department_id = p.department_id
       LEFT JOIN attendance a ON a.user_id = u.user_id AND a.date = $2
       LEFT JOIN salary_structures ss ON ss.user_id = u.user_id
       LEFT JOIN leave_requests lr ON lr.user_id = u.user_id AND lr.status = 'approved' AND $2 BETWEEN lr.start_date AND lr.end_date
       WHERE u.company_id = $1 AND u.role = 'employee'
         AND (p.first_name ILIKE $3 OR p.last_name ILIKE $3 OR u.login_id ILIKE $3)
       ORDER BY p.first_name ASC`, [companyId, dateStr, `%${search}%`]);
        return res.json({
            date: dateStr,
            employees: list.rows,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
