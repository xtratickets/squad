"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcast = exports.emitToRoom = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("../utils/logger");
const prisma_service_1 = require("../services/prisma.service");
const billing_service_1 = require("../services/billing.service");
let io;
let stateBroadcastInterval = null;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        logger_1.logger.info({ socketId: socket.id }, 'New client connected');
        socket.on('join', (room) => {
            socket.join(room);
            logger_1.logger.debug({ socketId: socket.id, room }, 'Client joined room');
        });
        socket.on('disconnect', () => {
            logger_1.logger.info({ socketId: socket.id }, 'Client disconnected');
        });
    });
    // Broadcast room states periodically to all clients to replace HTTP polling
    if (!stateBroadcastInterval) {
        stateBroadcastInterval = setInterval(async () => {
            try {
                const rooms = await prisma_service_1.prisma.room.findMany({
                    where: { status: 'occupied' },
                    include: {
                        sessions: {
                            where: { status: 'active' },
                            include: { orders: { where: { status: 'pending' } } },
                        },
                    },
                });
                const states = {};
                for (const room of rooms) {
                    const activeSession = room.sessions[0];
                    if (activeSession) {
                        const billing = await billing_service_1.BillingService.computeSessionCharge(activeSession.id, new Date());
                        const runningTotal = billing.finalTotal;
                        const payments = await prisma_service_1.prisma.payment.aggregate({
                            where: { referenceType: 'session', referenceId: activeSession.id },
                            _sum: { amount: true },
                        });
                        const unpaidTotal = Math.max(0, runningTotal - (payments._sum.amount || 0));
                        states[room.id] = {
                            roomId: room.id,
                            activeSessionId: activeSession.id,
                            startTime: activeSession.startTime,
                            runningTotal,
                            unpaidTotal,
                            ordersOpen: activeSession.orders.length,
                        };
                    }
                }
                if (Object.keys(states).length > 0) {
                    (0, exports.broadcast)('rooms.states_update', states);
                }
            }
            catch (error) {
                logger_1.logger.error(error, 'Error broadcasting room states');
            }
        }, 15000);
    }
    return io;
};
exports.initSocket = initSocket;
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
        logger_1.logger.debug({ room, event }, 'Event emitted to room');
    }
};
exports.emitToRoom = emitToRoom;
const broadcast = (event, data) => {
    if (io) {
        io.emit(event, data);
        // Reduce log noise for periodic state broadcasts
        if (event !== 'rooms.states_update') {
            logger_1.logger.debug({ event }, 'Global event broadcasted');
        }
    }
};
exports.broadcast = broadcast;
