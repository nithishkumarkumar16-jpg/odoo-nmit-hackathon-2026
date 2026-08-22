import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../db';
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { generateLoginId } from '../../utils/loginId';

const router = Router();

const createEmployeeSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    departmentId: z.string().uuid().optional().nullable(),
    managerId: z.string().uuid().optional().nullable(),
    designation: z.string().optional(),
    location: z.string().optional(),
    dateOfJoining: z.string().optional(), // YYYY-MM-DD
  }),
});

router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  validate(createEmployeeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        departmentId,
        managerId,
        designation,
        location,
        dateOfJoining,
      } = req.body;

      const companyId = req.user!.companyId;

      // Check existing email
      const existing = await query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Fetch company name
      const compRes = await query('SELECT name FROM companies WHERE company_id = $1', [companyId]);
      if (compRes.rows.length === 0) return res.status(400).json({ error: 'Company not found' });
      const companyName = compRes.rows[0].name;

      const joiningDateObj = dateOfJoining ? new Date(dateOfJoining) : new Date();
      const joiningYear = joiningDateObj.getFullYear();

      // Atomic login ID + serial generation
      const { loginId, serialNo } = await generateLoginId(
        companyId,
        companyName,
        firstName,
        lastName,
        joiningYear
      );

      // Temporary password: LoginId + '!' (e.g. OIJODO20260001!)
      const tempPassword = `${loginId}!`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Create user
      const userRes = await query(
        `INSERT INTO users (company_id, login_id, email, phone, password_hash, role, must_change_password, is_email_verified)
         VALUES ($1, $2, $3, $4, $5, 'employee', TRUE, TRUE)
         RETURNING user_id, company_id, login_id, email, role, must_change_password`,
        [companyId, loginId, email, phone || null, passwordHash]
      );
      const newUser = userRes.rows[0];

      // Create profile
      const profRes = await query(
        `INSERT INTO employee_profiles
         (user_id, company_id, first_name, last_name, department_id, manager_id, designation, location, date_of_joining, joining_serial_no)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING profile_id`,
        [
          newUser.user_id,
          companyId,
          firstName,
          lastName,
          departmentId || null,
          managerId || null,
          designation || null,
          location || null,
          joiningDateObj.toISOString().split('T')[0],
          serialNo,
        ]
      );

      // Create empty resume & private info
      await query('INSERT INTO employee_resume (user_id) VALUES ($1)', [newUser.user_id]);
      await query('INSERT INTO employee_private_info (user_id, personal_email) VALUES ($1, $2)', [
        newUser.user_id,
        email,
      ]);

      // Initialize leave balances for company leave types
      const leaveTypes = await query('SELECT leave_type_id, max_days_per_year FROM leave_types WHERE company_id = $1', [
        companyId,
      ]);
      for (const lt of leaveTypes.rows) {
        await query(
          `INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
           VALUES ($1, $2, $3, $4, 0)
           ON CONFLICT (user_id, leave_type_id, year) DO NOTHING`,
          [newUser.user_id, lt.leave_type_id, joiningYear, lt.max_days_per_year]
        );
      }

      // Record audit log
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, 'CREATE_EMPLOYEE', 'users', $2, $3)`,
        [req.user!.userId, newUser.user_id, JSON.stringify({ loginId, email })]
      );

      return res.status(201).json({
        message: 'Employee created successfully',
        employee: {
          userId: newUser.user_id,
          loginId: newUser.login_id,
          email: newUser.email,
          firstName,
          lastName,
          tempPassword,
          mustChangePassword: true,
        },
      });
    } catch (err: any) {
      console.error('Error creating employee:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/employees - Card grid list with directory dots (present, on_leave, absent)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const search = (req.query.search as string) || '';

    const employees = await query(
      `SELECT 
        u.user_id,
        u.login_id,
        u.email,
        u.phone,
        u.role,
        u.is_active,
        p.first_name,
        p.last_name,
        p.profile_picture_url,
        p.designation,
        p.location,
        p.date_of_joining,
        d.name as department_name,
        m.first_name || ' ' || m.last_name as manager_name,
        COALESCE(
          (
            SELECT status FROM (
              SELECT 
                CASE
                  WHEN lr.leave_request_id IS NOT NULL THEN 'on_leave'
                  WHEN a.check_in_time IS NOT NULL THEN 'present'
                  ELSE 'absent'
                END AS status
              FROM users u2
              LEFT JOIN attendance a ON a.user_id = u2.user_id AND a.date = CURRENT_DATE
              LEFT JOIN leave_requests lr ON lr.user_id = u2.user_id AND lr.status = 'approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
              WHERE u2.user_id = u.user_id
            ) s
          ), 'absent'
        ) AS current_status
       FROM users u
       JOIN employee_profiles p ON p.user_id = u.user_id
       LEFT JOIN departments d ON d.department_id = p.department_id
       LEFT JOIN employee_profiles m ON m.user_id = p.manager_id
       WHERE u.company_id = $1
         AND (
           p.first_name ILIKE $2 OR
           p.last_name ILIKE $2 OR
           u.login_id ILIKE $2 OR
           u.email ILIKE $2 OR
           p.designation ILIKE $2
         )
       ORDER BY p.first_name ASC`,
      [companyId, `%${search}%`]
    );

    return res.json(employees.rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const targetUserId = req.params.id;

    const emp = await query(
      `SELECT 
        u.user_id, u.login_id, u.email, u.phone, u.role, u.is_active, u.must_change_password,
        p.first_name, p.last_name, p.profile_picture_url, p.designation, p.location, p.date_of_joining,
        p.department_id, p.manager_id, d.name as department_name, c.name as company_name
       FROM users u
       JOIN employee_profiles p ON p.user_id = u.user_id
       JOIN companies c ON c.company_id = u.company_id
       LEFT JOIN departments d ON d.department_id = p.department_id
       WHERE u.user_id = $1 AND u.company_id = $2`,
      [targetUserId, companyId]
    );

    if (emp.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    return res.json(emp.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
