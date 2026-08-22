"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanyPrefix = getCompanyPrefix;
exports.getNameInitials = getNameInitials;
exports.generateLoginId = generateLoginId;
const db_1 = require("../db");
function getCompanyPrefix(companyName) {
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    const word = words[0] || 'CO';
    return word.slice(0, 2).padEnd(2, 'X').toUpperCase();
}
function getNameInitials(firstName, lastName) {
    const f = firstName.trim().slice(0, 2).padEnd(2, 'X').toUpperCase();
    const l = lastName.trim().slice(0, 2).padEnd(2, 'X').toUpperCase();
    return `${f}${l}`;
}
async function generateLoginId(companyId, companyName, firstName, lastName, joiningYear) {
    // Atomic counter update
    const res = await (0, db_1.query)(`INSERT INTO login_id_counters (company_id, joining_year, last_serial)
     VALUES ($1, $2, 1)
     ON CONFLICT (company_id, joining_year)
     DO UPDATE SET last_serial = login_id_counters.last_serial + 1
     RETURNING last_serial;`, [companyId, joiningYear]);
    const serialNo = res.rows[0].last_serial;
    const companyPrefix = getCompanyPrefix(companyName);
    const initials = getNameInitials(firstName, lastName);
    const serialStr = String(serialNo).padStart(4, '0');
    const loginId = `${companyPrefix}${initials}${joiningYear}${serialStr}`;
    return { loginId, serialNo };
}
