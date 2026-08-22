"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../db");
const auth_1 = require("../../middleware/auth");
const storage_1 = require("../../services/storage");
const socket_1 = require("../../services/socket");
const router = (0, express_1.Router)();
// GET /api/leave/types
router.get('/types', auth_1.authenticate, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const types = await (0, db_1.query)('SELECT * FROM leave_types WHERE company_id = $1 ORDER BY name', [
            companyId,
        ]);
        return res.json(types.rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/leave/balances
router.get('/balances', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.query.userId ? req.query.userId : req.user.userId;
        if (userId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const userRes = await (0, db_1.query)('SELECT user_id FROM users WHERE user_id = $1 AND company_id = $2', [userId, req.user.companyId]);
        if (userRes.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        const year = Number(req.query.year) || new Date().getFullYear();
        const balances = await (0, db_1.query)(`SELECT lb.balance_id, lb.user_id, lb.leave_type_id, lb.year, lb.total_days, lb.used_days, lb.remaining_days,
              lt.name as leave_type_name, lt.is_paid, lt.requires_attachment
       FROM leave_balances lb
       JOIN leave_types lt ON lt.leave_type_id = lb.leave_type_id
       WHERE lb.user_id = $1 AND lb.year = $2`, [userId, year]);
        return res.json(balances.rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/leave/request - Apply for leave
router.post('/request', auth_1.authenticate, storage_1.upload.single('attachment'), async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const role = req.user.role;
        const targetUserId = req.body.userId || currentUserId;
        if (targetUserId !== currentUserId && role !== 'admin') {
            return res.status(403).json({ error: 'Cannot request leave for another user' });
        }
        const targetUser = await (0, db_1.query)('SELECT user_id FROM users WHERE user_id = $1 AND company_id = $2', [targetUserId, req.user.companyId]);
        if (targetUser.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        const { leaveTypeId, startDate, endDate, totalDays, remarks } = req.body;
        if (!leaveTypeId || !startDate || !endDate || !totalDays) {
            return res.status(400).json({ error: 'Missing required leave request fields' });
        }
        const daysNum = Number(totalDays);
        if (daysNum <= 0)
            return res.status(400).json({ error: 'Total days must be positive' });
        // Fetch leave type info
        const ltRes = await (0, db_1.query)('SELECT * FROM leave_types WHERE leave_type_id = $1 AND company_id = $2', [leaveTypeId, req.user.companyId]);
        if (ltRes.rows.length === 0)
            return res.status(400).json({ error: 'Invalid leave type' });
        const leaveType = ltRes.rows[0];
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = (0, storage_1.getFileUrl)(req.file.filename);
        }
        if (leaveType.requires_attachment && !attachmentUrl) {
            return res.status(400).json({ error: `${leaveType.name} requires a document attachment` });
        }
        // Check balance if paid
        const year = new Date(startDate).getFullYear();
        const balRes = await (0, db_1.query)('SELECT * FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3', [targetUserId, leaveTypeId, year]);
        if (leaveType.is_paid && balRes.rows.length > 0) {
            const bal = balRes.rows[0];
            if (Number(bal.remaining_days) < daysNum) {
                return res.status(400).json({
                    error: `Insufficient leave balance. Available: ${bal.remaining_days} days, Requested: ${daysNum} days`,
                });
            }
        }
        const reqRes = await (0, db_1.query)(`INSERT INTO leave_requests
         (user_id, leave_type_id, start_date, end_date, total_days, remarks, attachment_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`, [targetUserId, leaveTypeId, startDate, endDate, daysNum, remarks || null, attachmentUrl]);
        // Create notification for admins
        (0, socket_1.notifyCompany)(req.user.companyId, 'NEW_LEAVE_REQUEST', {
            requestId: reqRes.rows[0].leave_request_id,
            userId: targetUserId,
            startDate,
            endDate,
        });
        return res.status(201).json({
            message: 'Leave request submitted successfully',
            request: reqRes.rows[0],
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/leave/heatmap - Heatmap data for year calendar
router.get('/heatmap', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.query.userId || req.user.userId;
        const year = Number(req.query.year) || new Date().getFullYear();
        const requests = await (0, db_1.query)(`SELECT lr.leave_request_id, lr.start_date, lr.end_date, lr.total_days, lr.status, lt.name as leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
       WHERE lr.user_id = $1
         AND EXTRACT(YEAR FROM lr.start_date) = $2`, [userId, year]);
        return res.json(requests.rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/leave/admin/requests - Admin requests view
router.get('/admin/requests', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const statusFilter = req.query.status || 'all';
        let sql = `
        SELECT lr.leave_request_id, lr.user_id, lr.start_date, lr.end_date, lr.total_days,
               lr.remarks, lr.attachment_url, lr.status, lr.created_at, lr.reviewer_comments,
               p.first_name, p.last_name, u.login_id, lt.name as leave_type_name, lt.requires_attachment
        FROM leave_requests lr
        JOIN users u ON u.user_id = lr.user_id
        JOIN employee_profiles p ON p.user_id = u.user_id
        JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
        WHERE u.company_id = $1
      `;
        const params = [companyId];
        if (statusFilter !== 'all') {
            sql += ` AND lr.status = $2`;
            params.push(statusFilter);
        }
        sql += ` ORDER BY lr.created_at DESC`;
        const list = await (0, db_1.query)(sql, params);
        return res.json(list.rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PUT /api/leave/admin/requests/:id/review - Approve / Reject
router.put('/admin/requests/:id/review', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const requestId = req.params.id;
        const { status, comments } = req.body; // status: 'approved' | 'rejected'
        const adminUserId = req.user.userId;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' });
        }
        const reqRes = await (0, db_1.query)(`SELECT lr.* FROM leave_requests lr JOIN users u ON u.user_id = lr.user_id
         WHERE lr.leave_request_id = $1 AND u.company_id = $2`, [requestId, req.user.companyId]);
        if (reqRes.rows.length === 0)
            return res.status(404).json({ error: 'Leave request not found' });
        const request = reqRes.rows[0];
        if (request.status === status) {
            return res.status(400).json({ error: `Request already ${status}` });
        }
        const previousStatus = request.status;
        // Update request status
        const updated = await (0, db_1.query)(`UPDATE leave_requests
         SET status = $1, reviewed_by = $2, reviewer_comments = $3, updated_at = NOW()
         WHERE leave_request_id = $4
         RETURNING *`, [status, adminUserId, comments || null, requestId]);
        // If transition to approved, update used_days
        const year = new Date(request.start_date).getFullYear();
        if (status === 'approved' && previousStatus !== 'approved') {
            await (0, db_1.query)(`UPDATE leave_balances
           SET used_days = used_days + $1
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`, [request.total_days, request.user_id, request.leave_type_id, year]);
        }
        else if (previousStatus === 'approved' && status === 'rejected') {
            // Revert balance
            await (0, db_1.query)(`UPDATE leave_balances
           SET used_days = GREATEST(used_days - $1, 0)
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`, [request.total_days, request.user_id, request.leave_type_id, year]);
        }
        // Real-time notification push to employee via Socket.io!
        (0, socket_1.notifyUser)(request.user_id, 'LEAVE_UPDATED', {
            requestId,
            status,
            comments,
        });
        return res.json({
            message: `Leave request ${status}`,
            request: updated.rows[0],
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/leave/admin/allocations - Manage allocations
router.get('/admin/allocations', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const year = Number(req.query.year) || new Date().getFullYear();
        const allocs = await (0, db_1.query)(`SELECT lb.balance_id, lb.user_id, lb.leave_type_id, lb.year, lb.total_days, lb.used_days, lb.remaining_days,
                p.first_name, p.last_name, u.login_id, lt.name as leave_type_name
         FROM leave_balances lb
         JOIN users u ON u.user_id = lb.user_id
         JOIN employee_profiles p ON p.user_id = u.user_id
         JOIN leave_types lt ON lt.leave_type_id = lb.leave_type_id
         WHERE u.company_id = $1 AND lb.year = $2
         ORDER BY p.first_name ASC, lt.name ASC`, [companyId, year]);
        return res.json(allocs.rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PUT /api/leave/admin/allocations - Set total days allocation
router.put('/admin/allocations', auth_1.authenticate, (0, auth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const { userId, leaveTypeId, year, totalDays } = req.body;
        const ownership = await (0, db_1.query)(`SELECT u.user_id FROM users u JOIN leave_types lt ON lt.leave_type_id = $2
         WHERE u.user_id = $1 AND u.company_id = $3 AND lt.company_id = $3`, [userId, leaveTypeId, req.user.companyId]);
        if (ownership.rows.length === 0)
            return res.status(400).json({ error: 'User or leave type is not in this company' });
        const updated = await (0, db_1.query)(`INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
         VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (user_id, leave_type_id, year)
         DO UPDATE SET total_days = EXCLUDED.total_days
         RETURNING *`, [userId, leaveTypeId, year, totalDays]);
        return res.json({ message: 'Allocation updated', allocation: updated.rows[0] });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
