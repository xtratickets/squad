"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoom = exports.getRoomState = exports.updateRoom = exports.createRoom = exports.getRoomById = exports.getRooms = exports.listRooms = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const billing_service_1 = require("../../services/billing.service");
const logger_1 = require("../../utils/logger");
const listRooms = async (req, res) => {
    try {
        const rooms = await prisma_service_1.prisma.room.findMany({
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
        const result = rooms.map((r) => {
            const { sessions, ...rest } = r;
            return {
                ...rest,
                activeSession: sessions[0] ?? null,
            };
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error listing rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listRooms = listRooms;
const getRooms = async (req, res) => {
    const { page, pageSize } = req.query;
    try {
        const pageNum = parseInt(page) || 1;
        const limit = parseInt(pageSize) || 50;
        const [rooms, total] = await Promise.all([
            prisma_service_1.prisma.room.findMany({
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma_service_1.prisma.room.count(),
        ]);
        res.json({
            data: rooms,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getRooms = getRooms;
const getRoomById = async (req, res) => {
    const id = req.params.id;
    try {
        const room = await prisma_service_1.prisma.room.findUnique({
            where: { id },
        });
        if (!room)
            return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching room');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getRoomById = getRoomById;
const createRoom = async (req, res) => {
    const { name, category, pricePerHour, minMinutes } = req.body;
    try {
        const room = await prisma_service_1.prisma.room.create({
            data: {
                name,
                category,
                pricePerHour,
                minMinutes,
                status: 'available',
            },
        });
        res.status(201).json(room);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating room');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createRoom = createRoom;
const updateRoom = async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    try {
        const room = await prisma_service_1.prisma.room.update({
            where: { id },
            data,
        });
        res.json(room);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating room');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateRoom = updateRoom;
const getRoomState = async (req, res) => {
    const id = req.params.id;
    try {
        const room = await prisma_service_1.prisma.room.findUnique({
            where: { id },
            include: {
                sessions: {
                    where: { status: 'active' },
                    include: { orders: { where: { status: 'pending' } } },
                },
            },
        });
        if (!room)
            return res.status(404).json({ error: 'Room not found' });
        const activeSession = room.sessions[0];
        let runningTotal = 0;
        let unpaidTotal = 0;
        let ordersOpenCount = 0;
        if (activeSession) {
            const billing = await billing_service_1.BillingService.computeSessionCharge(activeSession.id, new Date());
            runningTotal = billing.finalTotal;
            const payments = await prisma_service_1.prisma.payment.aggregate({
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
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching room state');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getRoomState = getRoomState;
const deleteRoom = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.room.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting room');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteRoom = deleteRoom;
