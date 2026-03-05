import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { StorageService } from '../../services/storage.service';

export const openShift = async (req: any, res: Response) => {
    const staffId = req.user.userId;
    const { openingCash } = req.body;

    try {
        // Check if staff already has an open shift
        const existingShift = await prisma.shift.findFirst({
            where: { staffId, status: 'open' },
        });

        if (existingShift) {
            return res.status(400).json({
                error: 'You already have an active shift. Please close it before opening a new one.'
            });
        }

        const shift = await prisma.$transaction(async (tx) => {
            const s = await tx.shift.create({
                data: {
                    staffId,
                    status: 'open',
                },
            });

            await tx.shiftStats.create({
                data: {
                    shiftId: s.id,
                    openingCash: openingCash || 0,
                },
            });

            return s;
        });

        res.status(201).json(shift);
    } catch (error) {
        logger.error(error, 'Error opening shift');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getActiveShift = async (req: any, res: Response) => {
    const staffId = req.user.userId;
    try {
        const activeShift = await prisma.shift.findFirst({
            where: { staffId, status: 'open' },
        });
        if (!activeShift) return res.status(200).json(null);
        res.json(activeShift);
    } catch (error) {
        logger.error(error, 'Error fetching active shift');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const closeShift = async (req: any, res: Response) => {
    const { id } = req.params;
    const { cashPhysical } = req.body;

    try {
        const shift = await prisma.$transaction(async (tx) => {
            const s = await tx.shift.update({
                where: { id },
                data: {
                    endTime: new Date(),
                    status: 'closed',
                },
                include: { stats: true }
            });

            if (s.stats && cashPhysical !== undefined) {
                const cashDifference = cashPhysical - s.stats.paymentsCash;
                await tx.shiftStats.update({
                    where: { shiftId: id },
                    data: {
                        cashPhysical,
                        cashDifference
                    }
                });
            }

            return s;
        });

        res.json(shift);
    } catch (error) {
        logger.error(error, 'Error closing shift');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getShiftStats = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const [stats, payments, activeModes, expenses, sessions, sessionCharges, orderCharges] = await Promise.all([
            prisma.shiftStats.findUnique({
                where: { shiftId: id },
                include: { shift: { include: { staff: { select: { username: true } } } } },
            }),
            prisma.payment.findMany({
                where: { shiftId: id },
                include: { mode: true }
            }),
            prisma.paymentMode.findMany({ where: { active: true } }),
            prisma.expense.findMany({ where: { shiftId: id } }),
            prisma.session.findMany({
                where: { closedShiftId: id, status: 'closed' },
                orderBy: { endTime: 'desc' },
                include: {
                    room: { select: { name: true } },
                    sessionCharge: true
                }
            }),
            prisma.sessionCharge.findMany({ where: { shiftId: id } }),
            prisma.orderCharge.findMany({ where: { shiftId: id } })
        ]);

        const totalServiceFees = sessionCharges.reduce((s, c) => s + c.serviceFee, 0) + orderCharges.reduce((s, c) => s + c.serviceFee, 0);
        const totalTax = sessionCharges.reduce((s, c) => s + c.tax, 0) + orderCharges.reduce((s, c) => s + c.tax, 0);
        const totalDiscounts = sessionCharges.reduce((s, c) => s + c.discount, 0) + orderCharges.reduce((s, c) => s + c.discount, 0);

        const groupedPayments = payments.reduce((acc: any, p) => {
            const modeName = p.mode?.name || 'Unknown';
            acc[modeName] = (acc[modeName] || 0) + p.amount;
            return acc;
        }, {});

        const paymentsByMode = activeModes.map(mode => ({
            name: mode.name,
            amount: groupedPayments[mode.name] || 0
        }));

        res.json({
            ...stats,
            paymentsByMode,
            expenses,
            totalServiceFees,
            totalTax,
            totalDiscounts,
            sessions: sessions.map(s => ({
                id: s.id,
                roomName: s.room.name,
                startTime: s.startTime,
                endTime: s.endTime,
                totalPausedMinutes: (s as any).totalPausedMinutes || 0,
                totalPausedMs: (s as any).totalPausedMs || 0,
                finalTotal: s.sessionCharge?.finalTotal || 0,
                roomAmount: s.sessionCharge?.roomAmount || 0,
                ordersAmount: s.sessionCharge?.ordersAmount || 0,
                discount: s.sessionCharge?.discount || 0,
            }))
        });
    } catch (error) {
        logger.error(error, 'Error fetching shift stats');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getShifts = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;

        const [shiftsData, total, activeModes] = await Promise.all([
            prisma.shift.findMany({
                include: {
                    staff: { select: { username: true } },
                    stats: true,
                    expenses: true,
                    openedSessions: true,
                    payments: { include: { mode: true } }
                } as any,
                orderBy: { startTime: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.shift.count(),
            prisma.paymentMode.findMany({ where: { active: true } })
        ]);

        const shifts = await Promise.all(shiftsData.map(async shift => {
            const grouped = shift.payments.reduce((acc: any, p) => {
                const modeName = p.mode?.name || 'Unknown';
                acc[modeName] = (acc[modeName] || 0) + p.amount;
                return acc;
            }, {});

            const paymentsByMode = activeModes.map(mode => ({
                name: mode.name,
                amount: grouped[mode.name] || 0
            }));

            const openedSessions = await Promise.all(shift.openedSessions?.map(async (session: any) => {
                const sessionPayments = shift.payments.filter(p => p.referenceType === 'session' && p.referenceId === session.id);
                const paymentsWithUrls = await Promise.all(sessionPayments.map(async p => ({
                    ...p,
                    receiptUrl: p.receiptUrl ? await StorageService.getFileUrl(p.receiptUrl) : p.receiptUrl
                })));
                return {
                    ...session,
                    payments: paymentsWithUrls
                };
            }) || []);

            return {
                ...shift,
                stats: shift.stats ? { ...shift.stats, expenses: shift.expenses } : { expenses: shift.expenses },
                openedSessions,
                paymentsByMode,
                payments: undefined // remove full payments list from response to save bandwidth
            };
        }));

        res.json({
            data: shifts,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        logger.error(error, 'Error fetching shifts');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/shifts/history
 * Returns past (closed) shifts for the currently authenticated user,
 * joined with session and order data.
 */
export const getShiftHistory = async (req: any, res: Response) => {
    const staffId = req.user?.userId;
    if (!staffId) {
        return res.status(401).json({ error: 'User ID not found in token' });
    }

    try {
        const [shifts, activeModes] = await Promise.all([
            prisma.shift.findMany({
                where: { staffId },
                include: {
                    stats: true,
                    expenses: true,
                    openedSessions: {
                        orderBy: { endTime: 'desc' },
                        include: {
                            room: { select: { id: true, name: true } },
                            orders: {
                                include: {
                                    items: {
                                        include: { product: { select: { id: true, name: true, price: true } } },
                                    },
                                    orderCharge: true,
                                },
                            },
                            sessionCharge: true,
                        },
                    },
                    orders: {
                        where: { sessionId: null }, // standalone orders not linked to a session
                        orderBy: { createdAt: 'desc' },
                        include: {
                            items: {
                                include: { product: { select: { id: true, name: true, price: true } } },
                            },
                            orderCharge: true,
                        },
                    },
                    payments: { include: { mode: true } }
                } as any,
                orderBy: { startTime: 'desc' },
            }),
            prisma.paymentMode.findMany({ where: { active: true } })
        ]);

        const shiftsWithPayments = await Promise.all(shifts.map(async shift => {
            const grouped = shift.payments.reduce((acc: any, p) => {
                const modeName = p.mode?.name || 'Unknown';
                acc[modeName] = (acc[modeName] || 0) + p.amount;
                return acc;
            }, {});

            const paymentsByMode = activeModes.map(mode => ({
                name: mode.name,
                amount: grouped[mode.name] || 0
            }));

            const openedSessions = await Promise.all(shift.openedSessions?.map(async (session: any) => {
                const sessionPayments = shift.payments.filter(p => p.referenceType === 'session' && p.referenceId === session.id);
                const paymentsWithUrls = await Promise.all(sessionPayments.map(async p => ({
                    ...p,
                    receiptUrl: p.receiptUrl ? await StorageService.getFileUrl(p.receiptUrl) : p.receiptUrl
                })));
                return {
                    ...session,
                    payments: paymentsWithUrls
                };
            }) || []);

            const settlements = await Promise.all(shift.payments
                .filter(p => p.referenceType === 'owner')
                .map(async p => {
                    const owner = await prisma.user.findUnique({
                        where: { id: p.referenceId },
                        select: { username: true }
                    });
                    return {
                        ...p,
                        ownerName: owner?.username || 'Unknown Owner'
                    };
                }));

            // Calculate derived stats
            const sessionsWithCharges = shift.openedSessions as any[];
            const standaloneOrders = shift.orders as any[];

            const totalServiceFees =
                sessionsWithCharges.reduce((sum, s) => sum + (s.sessionCharge?.serviceFee || 0), 0) +
                standaloneOrders.reduce((sum, o) => sum + (o.orderCharge?.serviceFee || 0), 0);

            const totalTax =
                sessionsWithCharges.reduce((sum, s) => sum + (s.sessionCharge?.tax || 0), 0) +
                standaloneOrders.reduce((sum, o) => sum + (o.orderCharge?.tax || 0), 0);

            const totalDiscounts =
                sessionsWithCharges.reduce((sum, s) => sum + (s.sessionCharge?.discount || 0), 0) +
                standaloneOrders.reduce((sum, o) => sum + (o.orderCharge?.discount || 0), 0);

            return {
                ...shift,
                stats: shift.stats ? {
                    ...shift.stats,
                    expenses: shift.expenses,
                    totalServiceFees,
                    totalTax,
                    totalDiscounts
                } : {
                    expenses: shift.expenses,
                    totalServiceFees,
                    totalTax,
                    totalDiscounts
                },
                openedSessions,
                settlements,
                paymentsByMode,
                payments: undefined
            };
        }));

        res.json(shiftsWithPayments);
    } catch (error) {
        logger.error(error, 'Error fetching shift history');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/shifts/all
 * Returns all shifts across all staff — for OPERATION and ADMIN roles.
 */
export const getAllShifts = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;

        const [shifts, total, activeModes] = await Promise.all([
            prisma.shift.findMany({
                include: {
                    staff: { select: { username: true } },
                    stats: true,
                    expenses: true,
                    openedSessions: {
                        orderBy: { endTime: 'desc' },
                        include: {
                            room: { select: { id: true, name: true } },
                            sessionCharge: true,
                        },
                    },
                    payments: { include: { mode: true } },
                } as any,
                orderBy: { startTime: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.shift.count(),
            prisma.paymentMode.findMany({ where: { active: true } }),
        ]);

        // Attach filtered payments to each session
        const data = shifts.map(shift => ({
            ...shift,
            stats: shift.stats ? { ...shift.stats, expenses: shift.expenses } : { expenses: shift.expenses },
            openedSessions: shift.openedSessions.map((session: any) => ({
                ...session,
                staffUsername: shift.staff?.username,
                payments: shift.payments.filter(
                    (p: any) => p.referenceType === 'session' && p.referenceId === session.id
                ),
            })),
            payments: undefined, // strip raw payments array from shift level
        }));

        res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize), modes: activeModes });
    } catch (error) {
        logger.error(error, 'Error fetching all shifts');
        res.status(500).json({ error: 'Internal server error' });
    }
};

