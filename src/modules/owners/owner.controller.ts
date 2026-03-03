import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

/**
 * GET /api/owners
 * List all users whose role name is 'OWNER'.
 */
export const getOwners = async (req: Request, res: Response) => {
    try {
        const owners = await prisma.user.findMany({
            where: { role: { name: 'OWNER' } },
            include: { role: true },
            orderBy: { username: 'asc' },
        });

        // Strip password from each record
        const sanitized = owners.map(({ password: _, ...u }) => u);
        res.json(sanitized);
    } catch (error) {
        logger.error(error, 'Error fetching owners');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/sessions/:id/assign-owner
 * Body: { ownerUserId: string, shiftId: string }
 * Assigns an owner to the session by creating or updating an owner-type order
 * linked to the session. The Order model already carries ownerUserId.
 */
export const assignOwnerToSession = async (req: any, res: Response) => {
    const sessionId = req.params.id as string;
    const { ownerUserId, shiftId } = req.body;
    const createdById = req.user.userId;

    if (!ownerUserId) return res.status(400).json({ error: 'ownerUserId is required' });

    try {
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }

        // Verify the user exists and has OWNER role
        const owner = await prisma.user.findFirst({
            where: { id: ownerUserId, role: { name: 'OWNER' } },
        });
        if (!owner) return res.status(404).json({ error: 'Owner user not found' });

        // Check if an owner-type order already exists for this session
        const existingOrder = await prisma.order.findFirst({
            where: { sessionId, type: 'owner' },
        });

        let order;
        if (existingOrder) {
            order = await prisma.order.update({
                where: { id: existingOrder.id },
                data: { ownerUserId },
            });
        } else {
            order = await prisma.order.create({
                data: {
                    type: 'owner',
                    sessionId,
                    roomId: session.roomId,
                    shiftId: shiftId || session.openedShiftId,
                    createdById,
                    ownerUserId,
                    status: 'pending',
                },
            });
        }

        res.json({ message: 'Owner assigned to session', order });
    } catch (error) {
        logger.error(error, 'Error assigning owner to session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/owners/:id/pay
 * Body: { amount: number, shiftId?: string, note?: string, modeId?: string }
 * amount > 0 → settlement (adds to shift revenue)
 * amount < 0 → post-pay debit (charges tab, no cash received yet)
 */
export const payOwner = async (req: any, res: Response) => {
    const ownerId = req.params.id as string;
    const { amount, shiftId, note, modeId } = req.body;

    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) === 0) {
        return res.status(400).json({ error: 'amount is required and must be a non-zero number (positive = settle, negative = post-pay debit)' });
    }

    const numAmount = Number(amount);

    try {
        const owner = await prisma.user.findFirst({
            where: { id: ownerId, role: { name: 'OWNER' } },
        });
        if (!owner) return res.status(404).json({ error: 'Owner user not found' });

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update owner wallet balance
            const updatedOwner = await (tx as any).user.update({
                where: { id: ownerId },
                data: { walletBalance: { increment: numAmount } },
                select: { id: true, username: true, walletBalance: true },
            });

            // 2. Record wallet transaction
            const transaction = await (tx as any).walletTransaction.create({
                data: {
                    userId: ownerId,
                    amount: numAmount,
                    note: note || (numAmount > 0 ? 'Owner balance settlement' : 'Post-pay debit / tab charge'),
                    ...(shiftId ? { shiftId } : {}),
                },
            });

            // 3. If this is a settlement (cash received), record it as shift revenue
            if (numAmount > 0 && shiftId) {
                // Resolve payment mode: use provided modeId or fall back to CASH
                let resolvedModeId = modeId;
                if (!resolvedModeId) {
                    const cashMode = await (tx as any).paymentMode.findFirst({
                        where: { name: { equals: 'CASH', mode: 'insensitive' }, active: true },
                    });
                    resolvedModeId = cashMode?.id;
                }

                if (resolvedModeId) {
                    // Create a Payment record so it shows in transaction history
                    await (tx as any).payment.create({
                        data: {
                            modeId: resolvedModeId,
                            amount: numAmount,
                            referenceType: 'owner',
                            referenceId: ownerId,
                            shiftId,
                        },
                    });
                }

                // Add to shift stats revenue
                const modeName = (await (tx as any).paymentMode.findUnique({ where: { id: resolvedModeId } }))?.name?.toUpperCase();
                const statsUpdate: any = {
                    totalRevenue: { increment: numAmount },
                    // Track under payment buckets
                    ...(modeName === 'CASH' ? { paymentsCash: { increment: numAmount } } :
                        modeName === 'WALLET' ? { paymentsWallet: { increment: numAmount } } :
                            { paymentsCard: { increment: numAmount } }), // INSTAPAY, CARD, etc.
                };
                await (tx as any).shiftStats.update({
                    where: { shiftId },
                    data: statsUpdate,
                });
            }

            return { owner: updatedOwner, transaction };
        });

        res.json(result);
    } catch (error) {
        logger.error(error, 'Error paying owner');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/owners/dashboard
 * Fetch dashboard stats for an owner
 */
export const getOwnerDashboard = async (req: any, res: Response) => {
    try {
        // Admin viewing another owner OR owner viewing themselves
        const targetUserId = (req.user.role === 'ADMIN' && req.query.ownerId) ? req.query.ownerId as string : req.user.userId;

        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { walletBalance: true, username: true, role: true }
        });

        if (!user || user.role.name !== 'OWNER') {
            return res.status(403).json({ error: 'Invalid owner user' });
        }

        const orders = await prisma.order.findMany({
            where: { ownerUserId: targetUserId, type: 'owner' },
            include: {
                items: { include: { product: { select: { name: true } } } },
                orderCharge: true,
                shift: { select: { startTime: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const sessions = await prisma.session.findMany({
            where: { orders: { some: { ownerUserId: targetUserId, type: 'owner' } } },
            include: {
                room: { select: { name: true } },
                sessionCharge: true,
                orders: { where: { ownerUserId: targetUserId, type: 'owner' }, select: { id: true, orderCharge: true } }
            },
            orderBy: { startTime: 'desc' }
        });

        const transactions = await prisma.walletTransaction.findMany({
            where: { userId: targetUserId },
            include: {
                order: { select: { id: true, createdAt: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            balance: user.walletBalance,
            orders,
            sessions,
            transactions
        });

    } catch (error) {
        logger.error(error, 'Error fetching owner dashboard');
        res.status(500).json({ error: 'Internal server error' });
    }
};
