"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalaries = exports.recordSalary = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const recordSalary = async (req, res) => {
    const { staffId, amount, period, shiftId } = req.body;
    try {
        const salary = await prisma_service_1.prisma.$transaction(async (tx) => {
            const s = await tx.salary.create({
                data: {
                    staffId,
                    amount,
                    period,
                    shiftId,
                },
            });
            if (shiftId) {
                // Update ShiftStats
                await tx.shiftStats.update({
                    where: { shiftId },
                    data: {
                        salariesTotal: { increment: amount },
                        totalRevenue: { decrement: amount },
                    },
                });
            }
            return s;
        });
        res.status(201).json(salary);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error recording salary');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.recordSalary = recordSalary;
const getSalaries = async (req, res) => {
    const { staffId } = req.query;
    try {
        const salaries = await prisma_service_1.prisma.salary.findMany({
            where: staffId ? { staffId: staffId } : {},
        });
        res.json(salaries);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching salaries');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getSalaries = getSalaries;
