"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductSales = exports.exportReport = exports.getGlobalStats = void 0;
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getGlobalStats = async (req, res) => {
    try {
        const totalSessions = await prisma_service_1.prisma.session.count();
        const totalOrders = await prisma_service_1.prisma.order.count();
        const totalRevenueResult = await prisma_service_1.prisma.payment.aggregate({
            _sum: { amount: true },
        });
        const revenueByMode = await prisma_service_1.prisma.payment.groupBy({
            by: ['modeId'],
            _sum: { amount: true },
        });
        const revenueBySource = await prisma_service_1.prisma.payment.groupBy({
            by: ['referenceType'],
            _sum: { amount: true },
        });
        const activeRooms = await prisma_service_1.prisma.room.count({
            where: { status: 'occupied' },
        });
        const [totalSessionCharges, totalOrderCharges] = await Promise.all([
            prisma_service_1.prisma.sessionCharge.aggregate({
                _sum: { serviceFee: true, tax: true, discount: true }
            }),
            prisma_service_1.prisma.orderCharge.aggregate({
                _sum: { serviceFee: true, tax: true, discount: true }
            })
        ]);
        const totalServiceFees = (totalSessionCharges._sum.serviceFee || 0) + (totalOrderCharges._sum.serviceFee || 0);
        const totalTax = (totalSessionCharges._sum.tax || 0) + (totalOrderCharges._sum.tax || 0);
        const totalDiscounts = (totalSessionCharges._sum.discount || 0) + (totalOrderCharges._sum.discount || 0);
        res.json({
            totalSessions,
            totalOrders,
            totalRevenue: totalRevenueResult._sum.amount || 0,
            revenueByMode,
            revenueBySource,
            activeRooms,
            totalServiceFees,
            totalTax,
            totalDiscounts,
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching global reports');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getGlobalStats = getGlobalStats;
const exportReport = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;
        const where = {};
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        if (type === 'payments') {
            const payments = await prisma_service_1.prisma.payment.findMany({
                where,
                include: { mode: true, shift: { include: { staff: true } } },
                orderBy: { createdAt: 'desc' },
            });
            const csvRows = ['ID,Date,Mode,Amount,ReferenceType,ReferenceID,Staff'];
            payments.forEach(p => {
                csvRows.push(`${p.id},${p.createdAt.toISOString()},${p.mode.name},${p.amount},${p.referenceType},${p.referenceId},${p.shift?.staff?.username || 'System'}`);
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=payments_export_${new Date().getTime()}.csv`);
            return res.send(csvRows.join('\n'));
        }
        res.status(400).json({ error: 'Unsupported export type' });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error exporting report');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.exportReport = exportReport;
const getProductSales = async (req, res) => {
    try {
        const { startDate, endDate, categoryId, page = 1, pageSize = 50 } = req.query;
        const pageNum = parseInt(page);
        const limit = parseInt(pageSize);
        const offset = (pageNum - 1) * limit;
        const whereConditions = [client_1.Prisma.sql `o.status = 'approved'`];
        if (startDate) {
            whereConditions.push(client_1.Prisma.sql `o."createdAt" >= ${new Date(startDate)}`);
        }
        if (endDate) {
            whereConditions.push(client_1.Prisma.sql `o."createdAt" <= ${new Date(endDate)}`);
        }
        if (categoryId) {
            whereConditions.push(client_1.Prisma.sql `p."categoryId" = ${categoryId}`);
        }
        const where = client_1.Prisma.join(whereConditions, ' AND ');
        const data = await prisma_service_1.prisma.$queryRaw `
            SELECT 
                p.id,
                p.name,
                c.name as "categoryName",
                SUM(oi.qty)::int as "totalQty",
                SUM(oi.total)::float as "totalRevenue"
            FROM "OrderItem" oi
            JOIN "Order" o ON oi."orderId" = o.id
            JOIN "Product" p ON oi."productId" = p.id
            JOIN "Category" c ON p."categoryId" = c.id
            WHERE ${where}
            GROUP BY p.id, p.name, c.name
            ORDER BY "totalRevenue" DESC
            LIMIT ${limit} OFFSET ${offset}
        `;
        const countQuery = await prisma_service_1.prisma.$queryRaw `
            SELECT COUNT(DISTINCT p.id)::int as count
            FROM "OrderItem" oi
            JOIN "Order" o ON oi."orderId" = o.id
            JOIN "Product" p ON oi."productId" = p.id
            WHERE ${where}
        `;
        const total = countQuery[0]?.count || 0;
        res.json({
            data,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit)
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching product sales report');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getProductSales = getProductSales;
