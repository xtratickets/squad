import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { prisma } from '../services/prisma.service';
import { BillingService } from '../services/billing.service';

let io: Server;
let stateBroadcastInterval: NodeJS.Timeout | null = null;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        logger.info({ socketId: socket.id }, 'New client connected');

        socket.on('join', (room: string) => {
            socket.join(room);
            logger.debug({ socketId: socket.id, room }, 'Client joined room');
        });

        socket.on('disconnect', () => {
            logger.info({ socketId: socket.id }, 'Client disconnected');
        });
    });

    // Broadcast room states periodically to all clients to replace HTTP polling
    if (!stateBroadcastInterval) {
        stateBroadcastInterval = setInterval(async () => {
            try {
                const rooms = await prisma.room.findMany({
                    where: { status: 'occupied' },
                    include: {
                        sessions: {
                            where: { status: 'active' },
                            include: { orders: { where: { status: 'pending' } } },
                        },
                    },
                });

                const states: Record<string, any> = {};

                for (const room of rooms) {
                    const activeSession = room.sessions[0];
                    if (activeSession) {
                        const billing = await BillingService.computeSessionCharge(activeSession.id, new Date());
                        const runningTotal = billing.finalTotal;

                        const payments = await prisma.payment.aggregate({
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
                    broadcast('rooms.states_update', states);
                }
            } catch (error) {
                logger.error(error, 'Error broadcasting room states');
            }
        }, 15000);
    }

    return io;
};

export const emitToRoom = (room: string, event: string, data: any) => {
    if (io) {
        io.to(room).emit(event, data);
        logger.debug({ room, event }, 'Event emitted to room');
    }
};

export const broadcast = (event: string, data: any) => {
    if (io) {
        io.emit(event, data);
        // Reduce log noise for periodic state broadcasts
        if (event !== 'rooms.states_update') {
            logger.debug({ event }, 'Global event broadcasted');
        }
    }
};
