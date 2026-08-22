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
  // Atomic counter update
  const res = await query(
    `INSERT INTO login_id_counters (company_id, joining_year, last_serial)
     VALUES ($1, $2, 1)
     ON CONFLICT (company_id, joining_year)
     DO UPDATE SET last_serial = login_id_counters.last_serial + 1
     RETURNING last_serial;`,
    [companyId, joiningYear]
  );

  const serialNo = res.rows[0].last_serial;
  const companyPrefix = getCompanyPrefix(companyName);
  const initials = getNameInitials(firstName, lastName);
  const serialStr = String(serialNo).padStart(4, '0');

  const loginId = `${companyPrefix}${initials}${joiningYear}${serialStr}`;
  return { loginId, serialNo };
}
