"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topUpWallet = exports.getWallet = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getWallet = async (req, res) => {
    const userId = req.params.userId;
    if (!userId)
        return res.status(400).json({ error: 'User ID is required' });
    try {
        const user = await prisma_service_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, walletBalance: true },
        });
        if (!user)
            return res.status(404).json({ error: 'User found' });
        const transactions = await prisma_service_1.prisma.walletTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { order: { select: { id: true, type: true } } },
        });
        res.json({ user, transactions });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching wallet');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getWallet = getWallet;
const topUpWallet = async (req, res) => {
    const userId = req.params.userId;
    const { amount, note, shiftId } = req.body;
    if (!amount || amount <= 0)
        return res.status(400).json({ error: 'Amount must be positive' });
    try {
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: Math.round(amount) } },
                select: { id: true, username: true, walletBalance: true },
            });
            const txn = await tx.walletTransaction.create({
                data: {
                    userId,
                    amount: Math.round(amount),
                    note: note ?? `Top-up by ${req.user?.userId}`,
                    shiftId,
                },
            });
            return { user, transaction: txn };
        });
        res.status(201).json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error topping up wallet');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.topUpWallet = topUpWallet;
