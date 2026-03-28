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
    let isBroadcasting = false;
    if (!stateBroadcastInterval) {
        stateBroadcastInterval = setInterval(async () => {
            // Guard against concurrent executions if DB queries take longer than the interval
            if (isBroadcasting) return;
            isBroadcasting = true;
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

                const roomsWithSessions = rooms.filter(room => room.sessions[0]);

                // Compute billing for all occupied rooms in parallel instead of sequentially
                const stateEntries = await Promise.all(
                    roomsWithSessions.map(async room => {
                        const activeSession = room.sessions[0];
                        const [billing, payments] = await Promise.all([
                            BillingService.computeSessionCharge(activeSession.id, new Date()),
                            prisma.payment.aggregate({
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
                        }] as const;
                    })
                );

                const states = Object.fromEntries(stateEntries);
                if (Object.keys(states).length > 0) {
                    broadcast('rooms.states_update', states);
                }
            } catch (error) {
                logger.error(error, 'Error broadcasting room states');
            } finally {
                isBroadcasting = false;
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
