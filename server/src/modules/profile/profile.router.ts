import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { encryptPII, decryptPII, maskSensitive } from '../../utils/crypto';
import { upload, getFileUrl } from '../../services/storage';

const router = Router();

// GET /api/profile/:userId
router.get('/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.userId;
    const companyId = req.user!.companyId;
    const role = req.user!.role;

    // Security check: only profile owner or admin can view
    const isOwner = currentUserId === userId;

    const userRes = await query(
      `SELECT u.user_id, u.company_id, u.login_id, u.email, u.phone, u.role,
              p.first_name, p.last_name, p.profile_picture_url, p.designation, p.location, p.date_of_joining,
              p.department_id, p.manager_id, d.name as department_name, c.name as company_name,
              m.first_name || ' ' || m.last_name as manager_name
       FROM users u
       JOIN employee_profiles p ON p.user_id = u.user_id
       JOIN companies c ON c.company_id = u.company_id
       LEFT JOIN departments d ON d.department_id = p.department_id
       LEFT JOIN employee_profiles m ON m.user_id = p.manager_id
       WHERE u.user_id = $1 AND u.company_id = $2`,
      [userId, companyId]
    );

    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const profile = userRes.rows[0];

    // Resume tab
    const resumeRes = await query('SELECT * FROM employee_resume WHERE user_id = $1', [userId]);
    const resume = resumeRes.rows[0] || {
      about: '',
      job_highlights: '',
      skills: [],
      certifications: [],
      interests: [],
    };

    // Private Info tab
    const privRes = await query('SELECT * FROM employee_private_info WHERE user_id = $1', [userId]);
    const privRaw = privRes.rows[0] || {};

    const privateInfo = {
      date_of_birth: privRaw.date_of_birth || null,
      residing_address: privRaw.residing_address || '',
      nationality: privRaw.nationality || '',
      personal_email: privRaw.personal_email || profile.email,
      gender: privRaw.gender || '',
      marital_status: privRaw.marital_status || '',
      emergency_contact_name: privRaw.emergency_contact_name || '',
      emergency_contact_phone: privRaw.emergency_contact_phone || '',
      bank_name: privRaw.bank_name || '',
      bank_account_number: isOwner || role === 'admin' ? maskSensitive(privRaw.bank_account_number_enc) : '****',
      bank_ifsc: privRaw.bank_ifsc || '',
      pan_number: isOwner || role === 'admin' ? maskSensitive(privRaw.pan_number_enc) : '****',
      aadhar_number: isOwner || role === 'admin' ? maskSensitive(privRaw.aadhar_number_enc) : '****',
      blood_group: privRaw.blood_group || '',
    };

    return res.json({
      header: profile,
      resume,
      privateInfo,
      isOwner,
      canEdit: isOwner || role === 'admin',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile/:userId/resume
router.put('/:userId/resume', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.userId;
    const role = req.user!.role;

    if (currentUserId !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Cannot edit another employee resume' });
    }

    const { about, jobHighlights, skills, certifications, interests } = req.body;

    await query(
      `INSERT INTO employee_resume (user_id, about, job_highlights, skills, certifications, interests, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         about = EXCLUDED.about,
         job_highlights = EXCLUDED.job_highlights,
         skills = EXCLUDED.skills,
         certifications = EXCLUDED.certifications,
         interests = EXCLUDED.interests,
         updated_at = NOW()`,
      [
        userId,
        about || '',
        jobHighlights || '',
        skills || [],
        certifications || [],
        interests || [],
      ]
    );

    return res.json({ message: 'Resume updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile/:userId/private-info
router.put('/:userId/private-info', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.userId;
    const role = req.user!.role;

    if (currentUserId !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Cannot edit another employee private info' });
    }

    const {
      dateOfBirth,
      residingAddress,
      nationality,
      personalEmail,
      gender,
      maritalStatus,
      emergencyContactName,
      emergencyContactPhone,
      bankName,
      bankAccountNumber,
      bankIfsc,
      panNumber,
      aadharNumber,
      bloodGroup,
    } = req.body;

    // Encrypt sensitive national IDs & financial info at rest
    const bankEnc = bankAccountNumber ? encryptPII(bankAccountNumber) : undefined;
    const panEnc = panNumber ? encryptPII(panNumber) : undefined;
    const aadharEnc = aadharNumber ? encryptPII(aadharNumber) : undefined;

    const existing = await query('SELECT * FROM employee_private_info WHERE user_id = $1', [userId]);

    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO employee_private_info
         (user_id, date_of_birth, residing_address, nationality, personal_email, gender, marital_status,
          emergency_contact_name, emergency_contact_phone, bank_name, bank_account_number_enc, bank_ifsc,
          pan_number_enc, aadhar_number_enc, blood_group)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          userId,
          dateOfBirth || null,
          residingAddress || null,
          nationality || null,
          personalEmail || null,
          gender || null,
          maritalStatus || null,
          emergencyContactName || null,
          emergencyContactPhone || null,
          bankName || null,
          bankEnc || null,
          bankIfsc || null,
          panEnc || null,
          aadharEnc || null,
          bloodGroup || null,
        ]
      );
    } else {
      const row = existing.rows[0];
      await query(
        `UPDATE employee_private_info
         SET date_of_birth = $1,
             residing_address = $2,
             nationality = $3,
             personal_email = $4,
             gender = $5,
             marital_status = $6,
             emergency_contact_name = $7,
             emergency_contact_phone = $8,
             bank_name = $9,
             bank_account_number_enc = $10,
             bank_ifsc = $11,
             pan_number_enc = $12,
             aadhar_number_enc = $13,
             blood_group = $14,
             updated_at = NOW()
         WHERE user_id = $15`,
        [
          dateOfBirth || row.date_of_birth,
          residingAddress || row.residing_address,
          nationality || row.nationality,
          personalEmail || row.personal_email,
          gender || row.gender,
          maritalStatus || row.marital_status,
          emergencyContactName || row.emergency_contact_name,
          emergencyContactPhone || row.emergency_contact_phone,
          bankName || row.bank_name,
          bankEnc !== undefined ? bankEnc : row.bank_account_number_enc,
          bankIfsc || row.bank_ifsc,
          panEnc !== undefined ? panEnc : row.pan_number_enc,
          aadharEnc !== undefined ? aadharEnc : row.aadhar_number_enc,
          bloodGroup || row.blood_group,
          userId,
        ]
      );
    }

    return res.json({ message: 'Private info updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/picture - Upload profile picture
router.post('/picture', authenticate, upload.single('picture'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

    const fileUrl = getFileUrl(req.file.filename);
    const userId = req.user!.userId;

    await query('UPDATE employee_profiles SET profile_picture_url = $1 WHERE user_id = $2', [
      fileUrl,
      userId,
    ]);

    return res.json({ message: 'Profile picture uploaded', url: fileUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
