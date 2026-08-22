import { query } from '../db';

export function getCompanyPrefix(companyName: string): string {
  const words = companyName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const word = words[0] || 'CO';
  return word.slice(0, 2).padEnd(2, 'X').toUpperCase();
}

export function getNameInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().slice(0, 2).padEnd(2, 'X').toUpperCase();
  const l = lastName.trim().slice(0, 2).padEnd(2, 'X').toUpperCase();
  return `${f}${l}`;
}

export async function generateLoginId(
  companyId: string,
  companyName: string,
  firstName: string,
  lastName: string,
  joiningYear: number
): Promise<{ loginId: string; serialNo: number }> {
  const companyPrefix = getCompanyPrefix(companyName);
  const initials = getNameInitials(firstName, lastName);

  // Login IDs are also accepted as a global sign-in identifier. Company prefixes
  // are intentionally short, so two tenants can legitimately produce the same
  // candidate (for example, "Flow Test" + "Flow Admin"). Keep allocating the
  // company/year counter until the globally unique candidate is available.
  for (let attempts = 0; attempts < 10000; attempts += 1) {
    const res = await query(
      `INSERT INTO login_id_counters (company_id, joining_year, last_serial)
       VALUES ($1, $2, 1)
       ON CONFLICT (company_id, joining_year)
       DO UPDATE SET last_serial = login_id_counters.last_serial + 1
       RETURNING last_serial;`,
      [companyId, joiningYear]
    );

    const serialNo = Number(res.rows[0].last_serial);
    const loginId = `${companyPrefix}${initials}${joiningYear}${String(serialNo).padStart(4, '0')}`;
    const existing = await query('SELECT 1 FROM users WHERE login_id = $1 LIMIT 1', [loginId]);

    if (existing.rows.length === 0) {
      return { loginId, serialNo };
    }
  }

  throw new Error('Unable to allocate a unique login ID');
}
