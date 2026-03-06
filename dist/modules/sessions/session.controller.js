"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSessionDiscount = exports.cancelSession = exports.checkoutSession = exports.updateSession = exports.resumeSession = exports.pauseSession = exports.endSession = exports.startSession = exports.getSession = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const billing_service_1 = require("../../services/billing.service");
const logger_1 = require("../../utils/logger");
const socket_1 = require("../../websocket/socket");
const audit_service_1 = require("../../services/audit.service");
const receipt_service_1 = require("../../services/receipt.service");
const getSession = async (req, res) => {
    const id = req.params.id;
    try {
        const session = await prisma_service_1.prisma.session.findUnique({
            where: { id },
            include: {
                room: true,
                orders: {
                    include: {
                        items: { include: { product: { select: { id: true, name: true, price: true } } } },
                        orderCharge: true,
                    },
                },
            },
        });
        if (!session)
            return res.status(404).json({ error: 'Session not found' });
        const billing = await billing_service_1.BillingService.computeSessionCharge(id, new Date());
        res.json({ session, billing });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getSession = getSession;
const startSession = async (req, res) => {
    const { roomId, openedShiftId } = req.body;
    const openedById = req.user.userId;
    try {
        const activeSession = await prisma_service_1.prisma.session.findFirst({
            where: { roomId, status: 'active' },
        });
        if (activeSession) {
            return res.status(400).json({ error: 'Room is already occupied' });
        }
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
            if (promo && promo.active && (promo.usageLimit === null || promo.usageLimit > 0) && (!promo.expiry || promo.expiry > new Date())) {
                const durationMs = endTime.getTime() - session.startTime.getTime();
                let totalPausedMs = session.totalPausedMs || 0;
                if (session.isPaused && session.lastPausedAt) {
                    totalPausedMs += endTime.getTime() - new Date(session.lastPausedAt).getTime();
                }
                const billableMs = Math.max(0, durationMs - totalPausedMs);
                const billableMinutes = Math.max(Math.ceil(billableMs / 60000), session.room.minMinutes);
                const roomAmount = (billableMinutes / 60) * session.room.pricePerHour;
                const ordersAmount = session.orders.reduce((sum, order) => {
                    const oc = order.orderCharge;
                    return sum + ((oc?.itemsTotal || 0) - (oc?.discount || 0));
                }, 0);
                const applyTo = promo.applyTo ?? 'both';
                const base = applyTo === 'room' ? roomAmount :
                    applyTo === 'orders' ? ordersAmount :
                        roomAmount + ordersAmount;
                if (promo.type === 'percent') {
                    discountAmount = (base * promo.value) / 100;
                }
                else {
                    discountAmount = Math.min(promo.value, base);
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
                data: { sessionId: id, shiftId: closedShiftId, ...charges, promoCode: promoCode || null },
            });
            await tx.room.update({
                where: { id: session.roomId },
                data: { status: 'available' },
            });
            await tx.shiftStats.update({
                where: { shiftId: closedShiftId },
                data: {
                    sessionsRevenue: { increment: charges.roomAmount },
                    ordersRevenue: { increment: charges.ordersAmount },
                    totalRevenue: { increment: (charges.finalTotal - charges.tip) },
                    tipsTotal: { increment: charges.tip },
                },
            });
            const ownerOrder = session.orders.find(o => o.type === 'owner' && o.ownerUserId);
            if (ownerOrder?.ownerUserId) {
                const deductAmount = charges.finalTotal;
                if (deductAmount > 0) {
                    await tx.user.update({
                        where: { id: ownerOrder.ownerUserId },
                        data: { walletBalance: { decrement: deductAmount } },
                    });
                    await tx.walletTransaction.create({
                        data: {
                            userId: ownerOrder.ownerUserId,
                            amount: -deductAmount,
                            note: `Room charge: ${session.room.name} (session ${id.slice(0, 8)})`,
                            shiftId: closedShiftId,
                        },
                    });
                    await tx.payment.create({
                        data: {
                            modeId: 'WALLET',
                            amount: deductAmount,
                            referenceType: 'session',
                            referenceId: id,
                            shiftId: closedShiftId,
                        }
                    });
                    await tx.shiftStats.update({
                        where: { shiftId: closedShiftId },
                        data: { paymentsWallet: { increment: deductAmount } },
                    });
                    await tx.order.update({
                        where: { id: ownerOrder.id },
                        data: { status: 'approved' },
                    });
                }
            }
            if (promoCode) {
                const p = await tx.promoCode.findUnique({ where: { code: promoCode } });
                if (p && p.usageLimit !== null) {
                    await tx.promoCode.update({
                        where: { code: promoCode },
                        data: { usageLimit: { decrement: 1 } },
                    });
                }
            }
            return s;
        });
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
const pauseSession = async (req, res) => {
    const id = req.params.id;
    const userId = req.user.userId;
    try {
        const session = await prisma_service_1.prisma.session.findUnique({ where: { id } });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }
        if (session.isPaused) {
            return res.status(400).json({ error: 'Session is already paused' });
        }
        const updated = await prisma_service_1.prisma.session.update({
            where: { id },
            data: {
                isPaused: true,
                lastPausedAt: new Date(),
            },
        });
        await audit_service_1.AuditService.log('Session', id, 'PAUSE', userId, session, updated);
        (0, socket_1.broadcast)('session.updated', updated);
        (0, socket_1.broadcast)('room.state_updated', { roomId: session.roomId, status: 'paused', isPaused: true });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error pausing session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.pauseSession = pauseSession;
const resumeSession = async (req, res) => {
    const id = req.params.id;
    const userId = req.user.userId;
    try {
        const session = await prisma_service_1.prisma.session.findUnique({ where: { id } });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }
        if (!session.isPaused || !session.lastPausedAt) {
            return res.status(400).json({ error: 'Session is not paused' });
        }
        const pausedDurationMs = new Date().getTime() - session.lastPausedAt.getTime();
        const updated = await prisma_service_1.prisma.session.update({
            where: { id },
            data: {
                isPaused: false,
                lastPausedAt: null,
                totalPausedMs: { increment: pausedDurationMs },
            },
        });
        await audit_service_1.AuditService.log('Session', id, 'RESUME', userId, session, updated);
        (0, socket_1.broadcast)('session.updated', updated);
        (0, socket_1.broadcast)('room.state_updated', { roomId: session.roomId, status: 'occupied', isPaused: false });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error resuming session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.resumeSession = resumeSession;
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
                isPaused: req.body.isPaused !== undefined ? req.body.isPaused : undefined,
                totalPausedMinutes: req.body.totalPausedMinutes !== undefined ? req.body.totalPausedMinutes : undefined,
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
const checkoutSession = async (req, res) => {
    const id = req.params.id;
    const { payments, shiftId } = req.body;
    if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'payments must be a non-empty array of { modeId, amount }' });
    }
    try {
        const session = await prisma_service_1.prisma.session.findUnique({
            where: { id },
            include: { sessionCharge: true },
        });
        if (!session)
            return res.status(404).json({ error: 'Session not found' });
        if (!session.sessionCharge)
            return res.status(400).json({ error: 'Session has not been charged yet – end the session first' });
        const resolvedShiftId = shiftId || session.closedShiftId || session.openedShiftId;
        const createdPayments = await prisma_service_1.prisma.$transaction(async (tx) => {
            const result = [];
            for (const p of payments) {
                const { modeId, amount } = p;
                const created = await tx.payment.create({
                    data: {
                        modeId,
                        amount,
                        referenceType: 'session',
                        referenceId: id,
                        shiftId: resolvedShiftId,
                    },
                });
                result.push(created);
                const mode = await tx.paymentMode.findUnique({ where: { id: modeId } });
                if (!mode)
                    throw new Error(`Payment mode ${modeId} not found`);
                const modeName = mode.name.toUpperCase();
                const updateData = {};
                if (modeName === 'CASH')
                    updateData.paymentsCash = { increment: amount };
                else if (modeName === 'WALLET')
                    updateData.paymentsWallet = { increment: amount };
                else
                    updateData.paymentsCard = { increment: amount };
                if (Object.keys(updateData).length > 0) {
                    await tx.shiftStats.update({
                        where: { shiftId: resolvedShiftId },
                        data: updateData,
                    });
                }
            }
            return result;
        });
        res.status(201).json(createdPayments);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error processing session checkout');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.checkoutSession = checkoutSession;
const cancelSession = async (req, res) => {
    const id = req.params.id;
    const userId = req.user.userId;
    try {
        const session = await prisma_service_1.prisma.session.findUnique({
            where: { id },
            include: {
                sessionCharge: true,
                orders: { include: { orderCharge: true } }
            }
        });
        if (!session)
            return res.status(404).json({ error: 'Session not found' });
        if (session.status === 'cancelled')
            return res.status(400).json({ error: 'Session already cancelled' });
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            if (session.status === 'closed' && session.sessionCharge) {
                const charge = session.sessionCharge;
                const shiftId = session.closedShiftId;
                await tx.shiftStats.update({
                    where: { shiftId },
                    data: {
                        sessionsRevenue: { decrement: charge.roomAmount },
                        ordersRevenue: { decrement: charge.ordersAmount },
                        totalRevenue: { decrement: (charge.finalTotal - charge.tip) },
                        tipsTotal: { decrement: charge.tip },
                    },
                });
                const ownerOrder = session.orders.find(o => o.type === 'owner' && o.ownerUserId);
                if (ownerOrder?.ownerUserId) {
                    await tx.user.update({
                        where: { id: ownerOrder.ownerUserId },
                        data: { walletBalance: { increment: charge.finalTotal } },
                    });
                    await tx.walletTransaction.create({
                        data: {
                            userId: ownerOrder.ownerUserId,
                            amount: charge.finalTotal,
                            note: `CANCELLATION Reversal: #${session.id.slice(0, 8)}`,
                            shiftId: shiftId,
                        },
                    });
                }
                const payments = await tx.payment.findMany({
                    where: { referenceType: 'session', referenceId: id },
                    include: { mode: true }
                });
                for (const p of payments) {
                    const modeName = p.mode.name.toUpperCase();
                    const updateData = {};
                    if (modeName === 'CASH')
                        updateData.paymentsCash = { decrement: p.amount };
                    else if (modeName === 'WALLET')
                        updateData.paymentsWallet = { decrement: p.amount };
                    else
                        updateData.paymentsCard = { decrement: p.amount };
                    if (Object.keys(updateData).length > 0) {
                        await tx.shiftStats.update({
                            where: { shiftId },
                            data: updateData,
                        });
                    }
                    await tx.payment.delete({ where: { id: p.id } });
                }
                await tx.sessionCharge.delete({ where: { sessionId: id } });
            }
            await tx.room.update({
                where: { id: session.roomId },
                data: { status: 'available' },
            });
            return await tx.session.update({
                where: { id },
                data: { status: 'cancelled' },
            });
        });
        await audit_service_1.AuditService.log('Session', id, 'CANCEL', userId, session, result);
        (0, socket_1.broadcast)('session.cancelled', result);
        (0, socket_1.broadcast)('room.state_updated', { roomId: session.roomId, status: 'available' });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error cancelling session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.cancelSession = cancelSession;
const updateSessionDiscount = async (req, res) => {
    const id = req.params.id;
    const { discount } = req.body;
    const userId = req.user.userId;
    try {
        const session = await prisma_service_1.prisma.session.findUnique({
            where: { id },
            include: { sessionCharge: true, orders: { include: { orderCharge: true } } }
        });
        if (!session || session.status !== 'closed' || !session.sessionCharge) {
            return res.status(404).json({ error: 'Charged session not found' });
        }
        const oldCharge = session.sessionCharge;
        const shiftId = session.closedShiftId;
        const endTime = session.endTime;
        const newCharges = await billing_service_1.BillingService.computeSessionCharge(id, endTime, discount, oldCharge.tip);
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            await tx.sessionCharge.update({
                where: { sessionId: id },
                data: {
                    discount: newCharges.discount,
                    serviceFee: newCharges.serviceFee,
                    tax: newCharges.tax,
                    finalTotal: newCharges.finalTotal,
                },
            });
            const diffRevenue = (newCharges.finalTotal - newCharges.tip) - (oldCharge.finalTotal - oldCharge.tip);
            if (diffRevenue !== 0) {
                await tx.shiftStats.update({
                    where: { shiftId },
                    data: { totalRevenue: { increment: diffRevenue } },
                });
            }
            const ownerOrder = session.orders.find(o => o.type === 'owner' && o.ownerUserId);
            if (ownerOrder?.ownerUserId) {
                const diffFinal = newCharges.finalTotal - oldCharge.finalTotal;
                if (diffFinal !== 0) {
                    await tx.user.update({
                        where: { id: ownerOrder.ownerUserId },
                        data: { walletBalance: { decrement: diffFinal } },
                    });
                    await tx.walletTransaction.create({
                        data: {
                            userId: ownerOrder.ownerUserId,
                            amount: -diffFinal,
                            note: `DISCOUNT Adjustment: #${session.id.slice(0, 8)}`,
                            shiftId: shiftId,
                        },
                    });
                    const walletMode = await tx.paymentMode.findFirst({
                        where: { name: { equals: 'Wallet', mode: 'insensitive' } }
                    });
                    const payment = await tx.payment.findFirst({
                        where: { referenceType: 'session', referenceId: id, modeId: walletMode?.id || 'none' }
                    });
                    if (payment) {
                        await tx.payment.update({
                            where: { id: payment.id },
                            data: { amount: newCharges.finalTotal }
                        });
                        await tx.shiftStats.update({
                            where: { shiftId },
                            data: { paymentsWallet: { increment: diffFinal } }
                        });
                    }
                }
            }
            return newCharges;
        });
        await audit_service_1.AuditService.log('Session', id, 'UPDATE_DISCOUNT', userId, oldCharge, result);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating session discount');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSessionDiscount = updateSessionDiscount;
