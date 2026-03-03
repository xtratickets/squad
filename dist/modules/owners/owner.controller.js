"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOwnerDashboard = exports.payOwner = exports.assignOwnerToSession = exports.getOwners = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getOwners = async (req, res) => {
    try {
        const owners = await prisma_service_1.prisma.user.findMany({
            where: { role: { name: 'OWNER' } },
            include: { role: true },
            orderBy: { username: 'asc' },
        });
        const sanitized = owners.map(({ password: _, ...u }) => u);
        res.json(sanitized);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching owners');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOwners = getOwners;
const assignOwnerToSession = async (req, res) => {
    const sessionId = req.params.id;
    const { ownerUserId, shiftId } = req.body;
    const createdById = req.user.userId;
    if (!ownerUserId)
        return res.status(400).json({ error: 'ownerUserId is required' });
    try {
        const session = await prisma_service_1.prisma.session.findUnique({ where: { id: sessionId } });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }
        const owner = await prisma_service_1.prisma.user.findFirst({
            where: { id: ownerUserId, role: { name: 'OWNER' } },
        });
        if (!owner)
            return res.status(404).json({ error: 'Owner user not found' });
        const existingOrder = await prisma_service_1.prisma.order.findFirst({
            where: { sessionId, type: 'owner' },
        });
        let order;
        if (existingOrder) {
            order = await prisma_service_1.prisma.order.update({
                where: { id: existingOrder.id },
                data: { ownerUserId },
            });
        }
        else {
            order = await prisma_service_1.prisma.order.create({
                data: {
                    type: 'owner',
                    sessionId,
                    roomId: session.roomId,
                    shiftId: shiftId || session.openedShiftId,
                    createdById,
                    ownerUserId,
                    status: 'pending',
                },
            });
        }
        res.json({ message: 'Owner assigned to session', order });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error assigning owner to session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.assignOwnerToSession = assignOwnerToSession;
const payOwner = async (req, res) => {
    const ownerId = req.params.id;
    const { amount, shiftId, note, modeId } = req.body;
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) === 0) {
        return res.status(400).json({ error: 'amount is required and must be a non-zero number (positive = settle, negative = post-pay debit)' });
    }
    const numAmount = Number(amount);
    try {
        const owner = await prisma_service_1.prisma.user.findFirst({
            where: { id: ownerId, role: { name: 'OWNER' } },
        });
        if (!owner)
            return res.status(404).json({ error: 'Owner user not found' });
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const updatedOwner = await tx.user.update({
                where: { id: ownerId },
                data: { walletBalance: { increment: numAmount } },
                select: { id: true, username: true, walletBalance: true },
            });
            const transaction = await tx.walletTransaction.create({
                data: {
                    userId: ownerId,
                    amount: numAmount,
                    note: note || (numAmount > 0 ? 'Owner balance settlement' : 'Post-pay debit / tab charge'),
                    ...(shiftId ? { shiftId } : {}),
                },
            });
            if (numAmount > 0 && shiftId) {
                let resolvedModeId = modeId;
                if (!resolvedModeId) {
                    const cashMode = await tx.paymentMode.findFirst({
                        where: { name: { equals: 'CASH', mode: 'insensitive' }, active: true },
                    });
                    resolvedModeId = cashMode?.id;
                }
                if (resolvedModeId) {
                    await tx.payment.create({
                        data: {
                            modeId: resolvedModeId,
                            amount: numAmount,
                            referenceType: 'owner',
                            referenceId: ownerId,
                            shiftId,
                        },
                    });
                }
                const modeName = (await tx.paymentMode.findUnique({ where: { id: resolvedModeId } }))?.name?.toUpperCase();
                const statsUpdate = {
                    totalRevenue: { increment: numAmount },
                    ...(modeName === 'CASH' ? { paymentsCash: { increment: numAmount } } :
                        modeName === 'WALLET' ? { paymentsWallet: { increment: numAmount } } :
                            { paymentsCard: { increment: numAmount } }),
                };
                await tx.shiftStats.update({
                    where: { shiftId },
                    data: statsUpdate,
                });
            }
            return { owner: updatedOwner, transaction };
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error paying owner');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.payOwner = payOwner;
const getOwnerDashboard = async (req, res) => {
    try {
        const targetUserId = (req.user.role === 'ADMIN' && req.query.ownerId) ? req.query.ownerId : req.user.userId;
        const user = await prisma_service_1.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { walletBalance: true, username: true, role: true }
        });
        if (!user || user.role.name !== 'OWNER') {
            return res.status(403).json({ error: 'Invalid owner user' });
        }
        const orders = await prisma_service_1.prisma.order.findMany({
            where: { ownerUserId: targetUserId, type: 'owner' },
            include: {
                items: { include: { product: { select: { name: true } } } },
                orderCharge: true,
                shift: { select: { startTime: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        const sessions = await prisma_service_1.prisma.session.findMany({
            where: { orders: { some: { ownerUserId: targetUserId, type: 'owner' } } },
            include: {
                room: { select: { name: true } },
                sessionCharge: true,
                orders: { where: { ownerUserId: targetUserId, type: 'owner' }, select: { id: true, orderCharge: true } }
            },
            orderBy: { startTime: 'desc' }
        });
        const transactions = await prisma_service_1.prisma.walletTransaction.findMany({
            where: { userId: targetUserId },
            include: {
                order: { select: { id: true, createdAt: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            balance: user.walletBalance,
            orders,
            sessions,
            transactions
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching owner dashboard');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOwnerDashboard = getOwnerDashboard;
