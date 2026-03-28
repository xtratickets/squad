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
    let isBroadcasting = false;
    if (!stateBroadcastInterval) {
        stateBroadcastInterval = setInterval(async () => {
            if (isBroadcasting)
                return;
            isBroadcasting = true;
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
                const roomsWithSessions = rooms.filter(room => room.sessions[0]);
                const stateEntries = await Promise.all(roomsWithSessions.map(async (room) => {
                    const activeSession = room.sessions[0];
                    const [billing, payments] = await Promise.all([
                        billing_service_1.BillingService.computeSessionCharge(activeSession.id, new Date()),
                        prisma_service_1.prisma.payment.aggregate({
                            where: { referenceType: 'session', referenceId: activeSession.id },
                            _sum: { amount: true },
                        }),
                    ]);
                    const runningTotal = billing.finalTotal;
                    const unpaidTotal = Math.max(0, runningTotal - (payments._sum.amount || 0));
                    return [room.id, {
                            roomId: room.id,
                            activeSessionId: activeSession.id,
                            startTime: activeSession.startTime,
                            runningTotal,
                            unpaidTotal,
                            ordersOpen: activeSession.orders.length,
                        }];
                }));
                const states = Object.fromEntries(stateEntries);
                if (Object.keys(states).length > 0) {
                    (0, exports.broadcast)('rooms.states_update', states);
                }
            }
            catch (error) {
                logger_1.logger.error(error, 'Error broadcasting room states');
            }
            finally {
                isBroadcasting = false;
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
        if (event !== 'rooms.states_update') {
            logger_1.logger.debug({ event }, 'Global event broadcasted');
        }
    }
};
exports.broadcast = broadcast;
