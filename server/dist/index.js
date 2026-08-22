"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
const socket_1 = require("./services/socket");
const onboarding_router_1 = __importDefault(require("./modules/onboarding/onboarding.router"));
const employees_router_1 = __importDefault(require("./modules/employees/employees.router"));
const profile_router_1 = __importDefault(require("./modules/profile/profile.router"));
const attendance_router_1 = __importDefault(require("./modules/attendance/attendance.router"));
const leave_router_1 = __importDefault(require("./modules/leave/leave.router"));
const payroll_router_1 = __importDefault(require("./modules/payroll/payroll.router"));
const analytics_router_1 = __importDefault(require("./modules/analytics/analytics.router"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static uploads
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadsDir));
// Register API Module Routes
app.use('/api/auth', onboarding_router_1.default);
app.use('/api/employees', employees_router_1.default);
app.use('/api/profile', profile_router_1.default);
app.use('/api/attendance', attendance_router_1.default);
app.use('/api/leave', leave_router_1.default);
app.use('/api/payroll', payroll_router_1.default);
app.use('/api/analytics', analytics_router_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// Initialize Socket.io
(0, socket_1.initSocket)(server);
const PORT = Number(process.env.PORT) || 5000;
async function bootstrap() {
    try {
        console.log('Initializing PostgreSQL database schema...');
        const schemaSql = fs_1.default.readFileSync(path_1.default.join(__dirname, '../../db/01_schema.sql'), 'utf-8');
        await (0, db_1.exec)(schemaSql);
        const functionsSql = fs_1.default.readFileSync(path_1.default.join(__dirname, '../../db/02_functions.sql'), 'utf-8');
        await (0, db_1.exec)(functionsSql);
        console.log('Database schema & functions initialized successfully.');
        server.listen(PORT, () => {
            console.log(`Dayflow HRMS Server listening on http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error('Failed to start server:', err);
    }
}
if (process.env.NODE_ENV !== 'test') {
    bootstrap();
}
