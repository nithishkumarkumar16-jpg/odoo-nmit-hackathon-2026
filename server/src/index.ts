import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { exec, query } from './db';
import { initSocket } from './services/socket';

import onboardingRouter from './modules/onboarding/onboarding.router';
import employeesRouter from './modules/employees/employees.router';
import profileRouter from './modules/profile/profile.router';
import attendanceRouter from './modules/attendance/attendance.router';
import leaveRouter from './modules/leave/leave.router';
import payrollRouter from './modules/payroll/payroll.router';
import analyticsRouter from './modules/analytics/analytics.router';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Register API Module Routes
app.use('/api/auth', onboardingRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/profile', profileRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Initialize Socket.io
initSocket(server);

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  try {
    console.log('Initializing PostgreSQL database schema...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../db/01_schema.sql'), 'utf-8');
    await exec(schemaSql);

    const functionsSql = fs.readFileSync(path.join(__dirname, '../../db/02_functions.sql'), 'utf-8');
    await exec(functionsSql);

    console.log('Database schema & functions initialized successfully.');

    server.listen(PORT, () => {
      console.log(`Dayflow HRMS Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { app, server };
