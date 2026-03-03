"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalStats = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getGlobalStats = async (req, res) => {
    try {
        const totalSessions = await prisma_service_1.prisma.session.count();
        const totalOrders = await prisma_service_1.prisma.order.count();
        const totalRevenueResult = await prisma_service_1.prisma.payment.aggregate({
            _sum: { amount: true },
        });
        // Revenue by mode
        const revenueByMode = await prisma_service_1.prisma.payment.groupBy({
            by: ['modeId'],
            _sum: { amount: true },
        });
        const activeRooms = await prisma_service_1.prisma.room.count({
            where: { status: 'occupied' },
        });
        res.json({
            totalSessions,
            totalOrders,
            totalRevenue: totalRevenueResult._sum.amount || 0,
            revenueByMode,
            activeRooms,
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching global reports');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getGlobalStats = getGlobalStats;
