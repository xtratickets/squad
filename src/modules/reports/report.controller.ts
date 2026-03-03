import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const getGlobalStats = async (req: Request, res: Response) => {
    try {
        const totalSessions = await prisma.session.count();
        const totalOrders = await prisma.order.count();
        const totalRevenueResult = await prisma.payment.aggregate({
            _sum: { amount: true },
        });

        // Revenue by mode
        const revenueByMode = await prisma.payment.groupBy({
            by: ['modeId'],
            _sum: { amount: true },
        });

        const activeRooms = await prisma.room.count({
            where: { status: 'occupied' },
        });

        res.json({
            totalSessions,
            totalOrders,
            totalRevenue: totalRevenueResult._sum.amount || 0,
            revenueByMode,
            activeRooms,
        });
    } catch (error) {
        logger.error(error, 'Error fetching global reports');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const exportReport = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, type } = req.query;
        const where: any = {};

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string),
            };
        }

        if (type === 'payments') {
            const payments = await prisma.payment.findMany({
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
    } catch (error) {
        logger.error(error, 'Error exporting report');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getProductSales = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, categoryId, page = 1, pageSize = 50 } = req.query;
        const pageNum = parseInt(page as string);
        const limit = parseInt(pageSize as string);
        const offset = (pageNum - 1) * limit;

        const whereConditions = [Prisma.sql`o.status = 'approved'`];
        if (startDate) {
            whereConditions.push(Prisma.sql`o."createdAt" >= ${new Date(startDate as string)}`);
        }
        if (endDate) {
            whereConditions.push(Prisma.sql`o."createdAt" <= ${new Date(endDate as string)}`);
        }
        if (categoryId) {
            whereConditions.push(Prisma.sql`p."categoryId" = ${categoryId}`);
        }

        const where = Prisma.join(whereConditions, ' AND ');

        const data = await prisma.$queryRaw<any[]>`
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

        const countQuery = await prisma.$queryRaw<any[]>`
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
    } catch (error) {
        logger.error(error, 'Error fetching product sales report');
        res.status(500).json({ error: 'Internal server error' });
    }
};
