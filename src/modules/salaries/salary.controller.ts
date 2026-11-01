import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { sendDbError } from '../../utils/db-errors';

export const recordSalary = async (req: any, res: Response) => {
    const { staffId, amount, period, shiftId } = req.body;

    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!staffId || !period) {
        return res.status(400).json({ error: 'Staff and period are required' });
    }

    try {
        const salary = await prisma.$transaction(async (tx) => {
            const s = await tx.salary.create({
                data: {
                    staffId,
                    amount: value,
                    period,
                    shiftId,
                },
            });

            if (shiftId) {
                // Update ShiftStats
                await tx.shiftStats.update({
                    where: { shiftId },
                    data: {
                        salariesTotal: { increment: value },
                        totalRevenue: { decrement: value },
                    },
                });
            }

            return s;
        });

        res.status(201).json(salary);
    } catch (error) {
        logger.error(error, 'Error recording salary');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getSalaries = async (req: Request, res: Response) => {
    const { staffId, page, pageSize, fromDate, toDate } = req.query;

    try {
        const pageNum = parseInt(page as string) || 1;
        const limit = parseInt(pageSize as string) || 50;

        const where: any = {};
        if (staffId) where.staffId = staffId as string;

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate as string);
            if (toDate) {
                const end = new Date(toDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [salaries, total] = await Promise.all([
            prisma.salary.findMany({
                where,
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: [{ createdAt: 'desc' }],
                include: { staff: { select: { id: true, username: true } } }, // never expose password hashes
            }),
            prisma.salary.count({ where })
        ]);

        res.json({
            data: salaries,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        logger.error(error, 'Error fetching salaries');
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteSalary = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        // Revert the shift totals that recordSalary applied, atomically with the delete.
        await prisma.$transaction(async (tx) => {
            const salary = await tx.salary.delete({ where: { id } });
            if (salary.shiftId) {
                await tx.shiftStats.updateMany({
                    where: { shiftId: salary.shiftId },
                    data: {
                        salariesTotal: { decrement: salary.amount },
                        totalRevenue: { increment: salary.amount },
                    },
                });
            }
        });
        res.status(204).send();
    } catch (error) {
        sendDbError(res, error, 'Error deleting salary', 'salary');
    }
};
