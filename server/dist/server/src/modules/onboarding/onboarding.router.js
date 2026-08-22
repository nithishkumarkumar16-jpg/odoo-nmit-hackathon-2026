"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const db_1 = require("../../db");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const loginId_1 = require("../../utils/loginId");
const router = (0, express_1.Router)();
const signUpSchema = zod_1.z.object({
    body: zod_1.z.object({
        companyName: zod_1.z.string().min(2),
        name: zod_1.z.string().min(2),
        email: zod_1.z.string().email(),
        phone: zod_1.z.string().optional(),
        password: zod_1.z.string().min(6),
        confirmPassword: zod_1.z.string().min(6),
    }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    }),
});
router.post('/signup', (0, validate_1.validate)(signUpSchema), async (req, res) => {
    try {
        const { companyName, name, email, phone, password } = req.body;
        // Check existing email
        const existingUser = await (0, db_1.query)('SELECT user_id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // 1. Create company
        const compRes = await (0, db_1.query)('INSERT INTO companies (name) VALUES ($1) RETURNING company_id, name', [companyName]);
        const company = compRes.rows[0];
        // 2. Create Admin user
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'Admin';
        const companyPrefix = (0, loginId_1.getCompanyPrefix)(companyName);
        const initials = (0, loginId_1.getNameInitials)(firstName, lastName);
        const year = new Date().getFullYear();
        const loginId = `${companyPrefix}${initials}${year}0001`;
        const userRes = await (0, db_1.query)(`INSERT INTO users (company_id, login_id, email, phone, password_hash, role, must_change_password, is_email_verified)
       VALUES ($1, $2, $3, $4, $5, 'admin', FALSE, TRUE)
       RETURNING user_id, company_id, login_id, email, role, must_change_password`, [company.company_id, loginId, email, phone || null, passwordHash]);
        const adminUser = userRes.rows[0];
        // 3. Create Admin profile & resume & private info
        await (0, db_1.query)(`INSERT INTO employee_profiles (user_id, company_id, first_name, last_name, joining_serial_no, designation)
       VALUES ($1, $2, $3, $4, 1, 'Administrator')`, [adminUser.user_id, company.company_id, firstName, lastName]);
        await (0, db_1.query)('INSERT INTO employee_resume (user_id) VALUES ($1)', [adminUser.user_id]);
        await (0, db_1.query)('INSERT INTO employee_private_info (user_id, personal_email) VALUES ($1, $2)', [adminUser.user_id, email]);
        // 4. Default Leave types for company
        await (0, db_1.query)(`INSERT INTO leave_types (company_id, name, max_days_per_year, is_paid, requires_attachment) VALUES
       ($1, 'Paid Time Off', 24, TRUE, FALSE),
       ($1, 'Sick Leave', 12, TRUE, TRUE),
       ($1, 'Unpaid Leaves', 30, FALSE, FALSE)`, [company.company_id]);
        const tokens = (0, auth_1.generateTokens)({
            userId: adminUser.user_id,
            companyId: adminUser.company_id,
            loginId: adminUser.login_id,
            role: adminUser.role,
            mustChangePassword: adminUser.must_change_password,
        });
        return res.status(201).json({
            message: 'Company and Admin created successfully',
            company,
            user: {
                userId: adminUser.user_id,
                loginId: adminUser.login_id,
                email: adminUser.email,
                role: adminUser.role,
                mustChangePassword: adminUser.must_change_password,
            },
            tokens,
        });
    }
    catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
const signInSchema = zod_1.z.object({
    body: zod_1.z.object({
        loginIdentifier: zod_1.z.string().min(1), // loginId or email
        password: zod_1.z.string().min(1),
    }),
});
router.post('/signin', (0, validate_1.validate)(signInSchema), async (req, res) => {
    try {
        const { loginIdentifier, password } = req.body;
        const userRes = await (0, db_1.query)(`SELECT u.user_id, u.company_id, u.login_id, u.email, u.password_hash, u.role, u.must_change_password, u.is_active, c.name as company_name
       FROM users u
       JOIN companies c ON c.company_id = u.company_id
       WHERE u.login_id = $1 OR u.email = $1`, [loginIdentifier]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }
        const user = userRes.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }
        const valid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }
        const tokens = (0, auth_1.generateTokens)({
            userId: user.user_id,
            companyId: user.company_id,
            loginId: user.login_id,
            role: user.role,
            mustChangePassword: user.must_change_password,
        });
        // Store refresh token
        const tokenHash = await bcryptjs_1.default.hash(tokens.refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await (0, db_1.query)('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.user_id, tokenHash, expiresAt]);
        return res.json({
            message: 'Sign in successful',
            user: {
                userId: user.user_id,
                companyId: user.company_id,
                companyName: user.company_name,
                loginId: user.login_id,
                email: user.email,
                role: user.role,
                mustChangePassword: user.must_change_password,
            },
            tokens,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: 'Refresh token required' });
    const payload = (0, auth_1.verifyRefreshToken)(refreshToken);
    if (!payload)
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    const tokens = (0, auth_1.generateTokens)({
        userId: payload.userId,
        companyId: payload.companyId,
        loginId: payload.loginId,
        role: payload.role,
        mustChangePassword: payload.mustChangePassword,
    });
    return res.json({ tokens });
});
const changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1),
        newPassword: zod_1.z.string().min(6),
    }),
});
router.post('/change-password', (0, validate_1.validate)(changePasswordSchema), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ error: 'Unauthorized' });
        const { currentPassword, newPassword } = req.body;
        const token = authHeader.split(' ')[1];
        const payload = jwt.decode(token);
        if (!payload || !payload.userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const userRes = await (0, db_1.query)('SELECT password_hash FROM users WHERE user_id = $1', [payload.userId]);
        if (userRes.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        const user = userRes.rows[0];
        const valid = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!valid)
            return res.status(400).json({ error: 'Current password incorrect' });
        const newHash = await bcryptjs_1.default.hash(newPassword, 12);
        await (0, db_1.query)('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE user_id = $2', [
            newHash,
            payload.userId,
        ]);
        return res.json({ message: 'Password updated successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
