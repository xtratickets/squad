"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSalary = exports.getSalaries = exports.recordSalary = void 0;
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
    const { staffId, page, pageSize, fromDate, toDate } = req.query;
    try {
        const pageNum = parseInt(page) || 1;
        const limit = parseInt(pageSize) || 50;
        const where = {};
        if (staffId)
            where.staffId = staffId;
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate)
                where.createdAt.gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }
        const [salaries, total] = await Promise.all([
            prisma_service_1.prisma.salary.findMany({
                where,
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: [{ createdAt: 'desc' }],
                include: { staff: true },
            }),
            prisma_service_1.prisma.salary.count({ where })
        ]);
        res.json({
            data: salaries,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit)
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching salaries');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getSalaries = getSalaries;
const deleteSalary = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.salary.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting salary');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteSalary = deleteSalary;
