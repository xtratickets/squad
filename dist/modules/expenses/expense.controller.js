"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpenses = exports.createExpense = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const createExpense = async (req, res) => {
    const { amount, category, shiftId } = req.body;
    const createdById = req.user.userId;
    try {
        const expense = await prisma_service_1.prisma.$transaction(async (tx) => {
            const e = await tx.expense.create({
                data: {
                    amount,
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
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating expense');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createExpense = createExpense;
const getExpenses = async (req, res) => {
    const { shiftId } = req.query;
    try {
        const expenses = await prisma_service_1.prisma.expense.findMany({
            where: shiftId ? { shiftId: shiftId } : {},
            include: { createdBy: { select: { username: true } } },
        });
        res.json(expenses);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching expenses');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getExpenses = getExpenses;
