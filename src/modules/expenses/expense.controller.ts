import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const createExpense = async (req: any, res: Response) => {
    const { amount, category, shiftId } = req.body;
    const createdById = req.user.userId;

    try {
        const expense = await prisma.$transaction(async (tx) => {
            const e = await tx.expense.create({
                data: {
                    amount: Math.round(amount),
                    category,
                    shiftId,
                    createdById,
                },
            });

            // Update ShiftStats
            await tx.shiftStats.update({
                where: { shiftId },
                data: {
                    expensesTotal: { increment: amount },
                    totalRevenue: { decrement: amount },
                },
            });

            return e;
        });

        res.status(201).json(expense);
    } catch (error) {
        logger.error(error, 'Error creating expense');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getExpenses = async (req: Request, res: Response) => {
    const { shiftId } = req.query;
    try {
        const expenses = await prisma.expense.findMany({
            where: shiftId ? { shiftId: shiftId as string } : {},
            include: { createdBy: { select: { username: true } } },
        });
        res.json(expenses);
    } catch (error) {
        logger.error(error, 'Error fetching expenses');
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteExpense = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.expense.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting expense');
        res.status(500).json({ error: 'Internal server error' });
    }
};
