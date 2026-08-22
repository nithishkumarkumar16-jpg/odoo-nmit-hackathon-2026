import { PGlite } from '@electric-sql/pglite';
import pool from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let pgliteInstance: PGlite | null = null;
let pgPoolInstance: pool.Pool | null = null;

const dbDataDir = path.join(__dirname, '../../../db/storage');

export async function getDb() {
  if (process.env.DATABASE_URL) {
    if (!pgPoolInstance) {
      pgPoolInstance = new pool.Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
    return {
      query: async (text: string, params: any[] = []) => {
        const res = await pgPoolInstance!.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount };
      },
      exec: async (sql: string) => {
        await pgPoolInstance!.query(sql);
      }
    };
  }

  if (!pgliteInstance) {
    if (process.env.NODE_ENV === 'test') {
      pgliteInstance = new PGlite();
    } else {
      if (!fs.existsSync(dbDataDir)) {
        fs.mkdirSync(dbDataDir, { recursive: true });
      }
      pgliteInstance = new PGlite(dbDataDir);
    }
    await pgliteInstance.waitReady;
  }

  return {
    query: async (text: string, params: any[] = []) => {
      const res = await pgliteInstance!.query(text, params);
      return { rows: res.rows, rowCount: res.rows ? res.rows.length : 0 };
    },
    exec: async (sql: string) => {
      await pgliteInstance!.exec(sql);
    }
  };
}

export async function query(text: string, params: any[] = []) {
  const db = await getDb();
  return db.query(text, params);
}

export async function exec(sql: string) {
  const db = await getDb();
  return db.exec(sql);
}
