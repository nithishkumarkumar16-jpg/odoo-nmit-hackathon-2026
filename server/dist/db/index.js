"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.query = query;
exports.exec = exec;
const pglite_1 = require("@electric-sql/pglite");
const pg_1 = __importDefault(require("pg"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let pgliteInstance = null;
let pgPoolInstance = null;
const dbDataDir = process.env.PGLITE_DATA_DIR
    ? path_1.default.resolve(process.env.PGLITE_DATA_DIR)
    : path_1.default.join(__dirname, '../../../db/pglite');
async function getDb() {
    if (process.env.DATABASE_URL) {
        if (!pgPoolInstance) {
            pgPoolInstance = new pg_1.default.Pool({
                connectionString: process.env.DATABASE_URL,
            });
        }
        return {
            query: async (text, params = []) => {
                const res = await pgPoolInstance.query(text, params);
                return { rows: res.rows, rowCount: res.rowCount };
            },
            exec: async (sql) => {
                await pgPoolInstance.query(sql);
            }
        };
    }
    if (!pgliteInstance) {
        if (process.env.NODE_ENV === 'test') {
            pgliteInstance = new pglite_1.PGlite();
        }
        else {
            if (!fs_1.default.existsSync(dbDataDir)) {
                fs_1.default.mkdirSync(dbDataDir, { recursive: true });
            }
            pgliteInstance = new pglite_1.PGlite(dbDataDir);
        }
        await pgliteInstance.waitReady;
    }
    return {
        query: async (text, params = []) => {
            const res = await pgliteInstance.query(text, params);
            return { rows: res.rows, rowCount: res.rows ? res.rows.length : 0 };
        },
        exec: async (sql) => {
            await pgliteInstance.exec(sql);
        }
    };
}
async function query(text, params = []) {
    const db = await getDb();
    return db.query(text, params);
}
async function exec(sql) {
    const db = await getDb();
    return db.exec(sql);
}
