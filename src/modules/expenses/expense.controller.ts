import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { sendDbError } from '../../utils/db-errors';

export const createExpense = async (req: any, res: Response) => {
    const { amount, category, shiftId } = req.body;
    const createdById = req.user.userId;

    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!category || !shiftId) {
        return res.status(400).json({ error: 'Category and shift are required' });
    }

    try {
        const expense = await prisma.$transaction(async (tx) => {
            const e = await tx.expense.create({
                data: {
                    amount: value,
                    category,
                    shiftId,
                    createdById,
                },
            });

            // Update ShiftStats
            await tx.shiftStats.update({
                where: { shiftId },
                data: {
                    expensesTotal: { increment: value },
                    totalRevenue: { decrement: value },
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
            orderBy: { createdAt: 'desc' },
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
        // Revert the shift totals that createExpense applied, atomically with the delete.
        await prisma.$transaction(async (tx) => {
            const expense = await tx.expense.delete({ where: { id } });
            await tx.shiftStats.updateMany({
                where: { shiftId: expense.shiftId },
                data: {
                    expensesTotal: { decrement: expense.amount },
                    totalRevenue: { increment: expense.amount },
                },
            });
        });
        res.status(204).send();
    } catch (error) {
        sendDbError(res, error, 'Error deleting expense', 'expense');
    }
};
