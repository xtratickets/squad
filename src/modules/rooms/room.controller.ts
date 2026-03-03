import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { BillingService } from '../../services/billing.service';
import { logger } from '../../utils/logger';

export const listRooms = async (req: Request, res: Response) => {
    try {
        const rooms = await prisma.room.findMany({
            include: {
                sessions: {
                    where: { status: 'active' },
                    select: {
                        id: true,
                        startTime: true,
                        isPaused: true,
                        lastPausedAt: true,
                        totalPausedMs: true
                    },
                    take: 1,
                },
            },
            orderBy: { name: 'asc' },
        });
        // Flatten activeSession for convenience
        const result = rooms.map(r => ({
            ...r,
            activeSession: r.sessions[0] ?? null,
            sessions: undefined,
        }));
        res.json(result);
    } catch (error) {
        logger.error(error, 'Error listing rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRooms = async (req: Request, res: Response) => {
    const { page, pageSize } = req.query;

    try {
        const pageNum = parseInt(page as string) || 1;
        const limit = parseInt(pageSize as string) || 50;

        const [rooms, total] = await Promise.all([
            prisma.room.findMany({
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.room.count(),
        ]);

        res.json({
            data: rooms,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        logger.error(error, 'Error fetching rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRoomById = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const room = await prisma.room.findUnique({
            where: { id },
        });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (error) {
        logger.error(error, 'Error fetching room');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createRoom = async (req: Request, res: Response) => {
    const { name, category, pricePerHour, minMinutes } = req.body;

    try {
        const room = await prisma.room.create({
            data: {
                name,
                category,
                pricePerHour,
                minMinutes,
                status: 'available',
            },
        });
        res.status(201).json(room);
    } catch (error) {
        logger.error(error, 'Error creating room');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateRoom = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = req.body;

    try {
        const room = await prisma.room.update({
            where: { id },
            data,
        });
        res.json(room);
    } catch (error) {
        logger.error(error, 'Error updating room');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRoomState = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        const room = await prisma.room.findUnique({
            where: { id },
            include: {
                sessions: {
                    where: { status: 'active' },
                    include: { orders: { where: { status: 'pending' } } },
                },
            },
        });

        if (!room) return res.status(404).json({ error: 'Room not found' });

        const activeSession = room.sessions[0];
        let runningTotal = 0;
        let unpaidTotal = 0;
        let ordersOpenCount = 0;

        if (activeSession) {
            const billing = await BillingService.computeSessionCharge(activeSession.id, new Date());
            runningTotal = billing.finalTotal;

            const payments = await prisma.payment.aggregate({
                where: { referenceType: 'session', referenceId: activeSession.id },
                _sum: { amount: true },
            });

            unpaidTotal = Math.max(0, runningTotal - (payments._sum.amount || 0));
            ordersOpenCount = activeSession.orders.length;
        }

        res.json({
            roomId: room.id,
            activeSessionId: activeSession?.id || null,
            startTime: activeSession?.startTime || null,
            runningTotal,
            unpaidTotal,
            ordersOpen: ordersOpenCount,
        });
    } catch (error) {
        logger.error(error, 'Error fetching room state');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteRoom = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        await prisma.room.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting room');
        res.status(500).json({ error: 'Internal server error' });
    }
};
