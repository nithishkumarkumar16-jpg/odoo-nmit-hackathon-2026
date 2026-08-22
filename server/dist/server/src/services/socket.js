"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getIO = getIO;
exports.notifyCompany = notifyCompany;
exports.notifyUser = notifyUser;
const socket_io_1 = require("socket.io");
let io = null;
function initSocket(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        socket.on('join_company', (companyId) => {
            socket.join(`company_${companyId}`);
        });
        socket.on('join_user', (userId) => {
            socket.join(`user_${userId}`);
        });
        socket.on('disconnect', () => {
            // Clean disconnect
        });
    });
    return io;
}
function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
}
function notifyCompany(companyId, event, data) {
    if (io) {
        io.to(`company_${companyId}`).emit(event, data);
    }
}
function notifyUser(userId, event, data) {
    if (io) {
        io.to(`user_${userId}`).emit(event, data);
    }
}
