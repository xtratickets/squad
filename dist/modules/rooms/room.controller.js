"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoom = exports.getRoomState = exports.updateRoom = exports.createRoom = exports.getRooms = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const billing_service_1 = require("../../services/billing.service");
const logger_1 = require("../../utils/logger");
const getRooms = async (req, res) => {
    try {
        const rooms = await prisma_service_1.prisma.room.findMany();
        res.json(rooms);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getRooms = getRooms;
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
