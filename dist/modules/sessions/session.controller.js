"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSession = exports.endSession = exports.startSession = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const billing_service_1 = require("../../services/billing.service");
const logger_1 = require("../../utils/logger");
const socket_1 = require("../../websocket/socket");
const audit_service_1 = require("../../services/audit.service");
const receipt_service_1 = require("../../services/receipt.service");
const startSession = async (req, res) => {
    const { roomId, openedShiftId } = req.body;
    const openedById = req.user.userId;
    try {
        // Check if room is already occupied
        const activeSession = await prisma_service_1.prisma.session.findFirst({
            where: { roomId, status: 'active' },
        });
        if (activeSession) {
            return res.status(400).json({ error: 'Room is already occupied' });
        }
        // Start session and update room status in a transaction
        const session = await prisma_service_1.prisma.$transaction(async (tx) => {
            const s = await tx.session.create({
                data: {
                    roomId,
                    openedShiftId,
                    openedById,
                    status: 'active',
                },
            });
            await tx.room.update({
                where: { id: roomId },
                data: { status: 'occupied' },
            });
            return s;
        });
        // Realtime & Audit
        (0, socket_1.broadcast)('room.state_updated', { roomId, status: 'occupied' });
        (0, socket_1.broadcast)('session.started', session);
        await audit_service_1.AuditService.log('Session', session.id, 'START', openedById, null, session);
        res.status(201).json(session);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error starting session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.startSession = startSession;
const endSession = async (req, res) => {
    const id = req.params.id;
    const { closedShiftId, promoCode, tip } = req.body;
    const closedById = req.user.userId;
    const endTime = new Date();
    try {
        const session = await prisma_service_1.prisma.session.findUnique({
            where: { id },
            include: {
                room: true,
                orders: {
                    where: { status: 'approved' },
                    include: { orderCharge: true },
                },
            },
        });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }
        let discountAmount = 0;
        if (promoCode) {
            const promo = await prisma_service_1.prisma.promoCode.findUnique({ where: { code: promoCode } });
            if (promo && promo.active && (promo.usageLimit ?? 0) > 0 && (!promo.expiry || promo.expiry > new Date())) {
                const durationMs = endTime.getTime() - session.startTime.getTime();
                const durationMinutes = Math.ceil(durationMs / 60000);
                const billableMinutes = Math.max(durationMinutes, session.room.minMinutes);
                const roomAmount = (billableMinutes / 60) * session.room.pricePerHour;
                const ordersAmount = session.orders.reduce((sum, order) => sum + (order.orderCharge?.finalTotal || 0), 0);
                const subtotal = roomAmount + ordersAmount;
                if (promo.type === 'percent') {
                    discountAmount = (subtotal * promo.value) / 100;
                }
                else {
                    discountAmount = promo.value;
                }
            }
        }
        const charges = await billing_service_1.BillingService.computeSessionCharge(id, endTime, discountAmount, tip || 0);
        const closedSession = await prisma_service_1.prisma.$transaction(async (tx) => {
            const s = await tx.session.update({
                where: { id },
                data: { endTime, closedShiftId, closedById, status: 'closed' },
            });
            await tx.sessionCharge.create({
                data: { sessionId: id, shiftId: closedShiftId, ...charges },
            });
            await tx.room.update({
                where: { id: session.roomId },
                data: { status: 'available' },
            });
            await tx.shiftStats.update({
                where: { shiftId: closedShiftId },
                data: {
                    sessionsRevenue: { increment: charges.roomAmount },
                    totalRevenue: { increment: charges.roomAmount - charges.discount },
                    tipsTotal: { increment: charges.tip },
                },
            });
            if (promoCode) {
                await tx.promoCode.update({
                    where: { code: promoCode },
                    data: { usageLimit: { decrement: 1 } },
                });
            }
            return s;
        });
        // Realtime, Audit & Receipt
        (0, socket_1.broadcast)('room.state_updated', { roomId: session.roomId, status: 'available' });
        (0, socket_1.broadcast)('session.ended', { sessionId: id, charges });
        await audit_service_1.AuditService.log('Session', id, 'END', closedById, session, closedSession);
        await receipt_service_1.ReceiptService.createSnapshot('session', id);
        res.json(closedSession);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error ending session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.endSession = endSession;
const updateSession = async (req, res) => {
    const id = req.params.id;
    const { startTime, endTime, status } = req.body;
    const userId = req.user.userId;
    try {
        const session = await prisma_service_1.prisma.session.findUnique({ where: { id } });
        if (!session)
            return res.status(404).json({ error: 'Session not found' });
        const updated = await prisma_service_1.prisma.session.update({
            where: { id },
            data: {
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                status: status || undefined,
            },
        });
        await audit_service_1.AuditService.log('Session', id, 'UPDATE', userId, session, updated);
        (0, socket_1.broadcast)('session.updated', updated);
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSession = updateSession;
