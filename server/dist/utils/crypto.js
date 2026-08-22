"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPII = encryptPII;
exports.decryptPII = decryptPII;
exports.maskSensitive = maskSensitive;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.PII_ENCRYPTION_KEY || 'default_secret_key_32_bytes_len!!'; // 32 chars
const KEY = crypto_1.default.scryptSync(SECRET_KEY, 'salt_dayflow_hrms', 32);
function encryptPII(text) {
    if (!text)
        return null;
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}
function decryptPII(encryptedText) {
    if (!encryptedText)
        return null;
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3)
            return encryptedText; // Fallback if plain text
        const [ivHex, authTagHex, encryptedData] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (err) {
        return null;
    }
}
function maskSensitive(text) {
    if (!text)
        return null;
    const raw = decryptPII(text) || text;
    if (raw.length <= 4)
        return raw;
    return '*'.repeat(raw.length - 4) + raw.slice(-4);
}
