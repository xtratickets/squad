import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { buildDateRange, safeTimeZone } from '../../utils/date-range';

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

        const revenueBySource = await prisma.payment.groupBy({
            by: ['referenceType'],
            _sum: { amount: true },
        });

        const activeRooms = await prisma.room.count({
            where: { status: 'occupied' },
        });

        const [totalSessionCharges, totalOrderCharges] = await Promise.all([
            prisma.sessionCharge.aggregate({
                _sum: { serviceFee: true, tax: true, discount: true }
            }),
            // Exclude session-linked orders — their fees are already included in sessionCharge.
            prisma.orderCharge.aggregate({
                where: { order: { sessionId: null } },
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
    } catch (error) {
        logger.error(error, 'Error fetching global reports');
        res.status(500).json({ error: 'Internal server error' });
    }
};

const csvCell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportReport = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, type } = req.query;
        const where: any = {};

        const range = buildDateRange(startDate, endDate);
        if (range) where.createdAt = range;

        if (type === 'payments') {
            const payments = await prisma.payment.findMany({
                where,
                include: { mode: true, shift: { include: { staff: { select: { username: true } } } } },
                orderBy: { createdAt: 'desc' },
            });

            const csvRows = ['ID,Date,Mode,Amount,ReferenceType,ReferenceID,Staff'];
            payments.forEach(p => {
                csvRows.push([
                    p.id,
                    p.createdAt.toISOString(),
                    p.mode.name,
                    p.amount,
                    p.referenceType,
                    p.referenceId,
                    p.shift?.staff?.username || 'System',
                ].map(csvCell).join(','));
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=payments_export_${new Date().getTime()}.csv`);
            // BOM so Excel opens UTF-8 (e.g. Arabic names) correctly.
            return res.send('﻿' + csvRows.join('\n'));
        }

        res.status(400).json({ error: 'Unsupported export type' });
    } catch (error) {
        logger.error(error, 'Error exporting report');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Monthly sales summary for one calendar year (months bucketed in the viewer's timezone).
 * Revenue = payments collected, split into room sessions and product orders.
 */
export const getMonthlySales = async (req: Request, res: Response) => {
    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        if (year < 2000 || year > 2100) return res.status(400).json({ error: 'Invalid year' });
        const tz = safeTimeZone(req.query.tz);

        // createdAt columns are timestamp-without-tz holding UTC; convert to local wall time first.
        const local = (col: string) => Prisma.raw(`((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${tz.replace(/'/g, "''")}')`);
        const yearStr = String(year);

        const [payments, sessions, orders, expenses, salaries] = await Promise.all([
            prisma.$queryRaw<any[]>`
                SELECT to_char(${local('p."createdAt"')}, 'MM') AS month,
                    COALESCE(SUM(p.amount), 0)::float AS total,
                    COALESCE(SUM(CASE WHEN p."referenceType" = 'session' THEN p.amount ELSE 0 END), 0)::float AS "sessionsRevenue",
                    COALESCE(SUM(CASE WHEN p."referenceType" <> 'session' THEN p.amount ELSE 0 END), 0)::float AS "ordersRevenue"
                FROM "Payment" p
                WHERE to_char(${local('p."createdAt"')}, 'YYYY') = ${yearStr}
                GROUP BY 1`,
            prisma.$queryRaw<any[]>`
                SELECT to_char(${local('sc."createdAt"')}, 'MM') AS month, COUNT(*)::int AS count
                FROM "SessionCharge" sc
                WHERE to_char(${local('sc."createdAt"')}, 'YYYY') = ${yearStr}
                GROUP BY 1`,
            prisma.$queryRaw<any[]>`
                SELECT to_char(${local('o."createdAt"')}, 'MM') AS month, COUNT(*)::int AS count
                FROM "Order" o
                WHERE o.status = 'approved' AND to_char(${local('o."createdAt"')}, 'YYYY') = ${yearStr}
                GROUP BY 1`,
            prisma.$queryRaw<any[]>`
                SELECT to_char(${local('e."createdAt"')}, 'MM') AS month, COALESCE(SUM(e.amount), 0)::float AS total
                FROM "Expense" e
                WHERE to_char(${local('e."createdAt"')}, 'YYYY') = ${yearStr}
                GROUP BY 1`,
            prisma.$queryRaw<any[]>`
                SELECT to_char(${local('s."createdAt"')}, 'MM') AS month, COALESCE(SUM(s.amount), 0)::float AS total
                FROM "Salary" s
                WHERE to_char(${local('s."createdAt"')}, 'YYYY') = ${yearStr}
                GROUP BY 1`,
        ]);

        const byMonth = (rows: any[]) => new Map<string, any>(rows.map(r => [r.month, r]));
        const pMap = byMonth(payments), sMap = byMonth(sessions), oMap = byMonth(orders), eMap = byMonth(expenses), salMap = byMonth(salaries);

        const months = Array.from({ length: 12 }, (_, i) => {
            const key = String(i + 1).padStart(2, '0');
            const pay = pMap.get(key);
            const expensesTotal = eMap.get(key)?.total ?? 0;
            const salariesTotal = salMap.get(key)?.total ?? 0;
            const totalRevenue = pay?.total ?? 0;
            return {
                month: `${year}-${key}`,
                sessionsRevenue: pay?.sessionsRevenue ?? 0,
                ordersRevenue: pay?.ordersRevenue ?? 0,
                totalRevenue,
                sessionsCount: sMap.get(key)?.count ?? 0,
                ordersCount: oMap.get(key)?.count ?? 0,
                expenses: expensesTotal,
                salaries: salariesTotal,
                net: totalRevenue - expensesTotal - salariesTotal,
            };
        });

        res.json({ year, timeZone: tz, months });
    } catch (error) {
        logger.error(error, 'Error fetching monthly sales');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getProductSales = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, categoryId, page = 1, pageSize = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limit = Math.min(10000, Math.max(1, parseInt(pageSize as string) || 50));
        const offset = (pageNum - 1) * limit;

        const whereConditions = [Prisma.sql`o.status = 'approved'`];
        const range = buildDateRange(startDate, endDate);
        if (range?.gte) {
            whereConditions.push(Prisma.sql`o."createdAt" >= ${range.gte}`);
        }
        if (range?.lt) {
            // endDate is inclusive of the whole day
            whereConditions.push(Prisma.sql`o."createdAt" < ${range.lt}`);
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
