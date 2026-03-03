import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const getWallet = async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, walletBalance: true },
        });
        if (!user) return res.status(404).json({ error: 'User found' });

        const transactions = await prisma.walletTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { order: { select: { id: true, type: true } } },
        });

        res.json({ user, transactions });
    } catch (error) {
        logger.error(error, 'Error fetching wallet');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const topUpWallet = async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const { amount, note, shiftId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    try {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: amount } },
                select: { id: true, username: true, walletBalance: true },
            });
            const txn = await tx.walletTransaction.create({
                data: {
                    userId,
                    amount,
                    note: note ?? `Top-up by ${(req as any).user?.userId}`,
                    shiftId,
                },
            });
            return { user, transaction: txn };
        });
        res.status(201).json(result);
    } catch (error) {
        logger.error(error, 'Error topping up wallet');
        res.status(500).json({ error: 'Internal server error' });
    }
};
