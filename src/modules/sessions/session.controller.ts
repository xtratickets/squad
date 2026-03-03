import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { BillingService } from '../../services/billing.service';
import { logger } from '../../utils/logger';
import { emitToRoom, broadcast } from '../../websocket/socket';
import { AuditService } from '../../services/audit.service';
import { ReceiptService } from '../../services/receipt.service';

export const getSession = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const session = await prisma.session.findUnique({
            where: { id },
            include: {
                room: true,
                orders: {
                    include: {
                        items: { include: { product: { select: { id: true, name: true, price: true } } } },
                        orderCharge: true,
                    },
                },
            },
        });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const billing = await BillingService.computeSessionCharge(id, new Date());

        res.json({ session, billing });
    } catch (error) {
        logger.error(error, 'Error fetching session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const startSession = async (req: any, res: Response) => {
    const { roomId, openedShiftId } = req.body;
    const openedById = req.user.userId;

    try {
        // Check if room is already occupied
        const activeSession = await prisma.session.findFirst({
            where: { roomId, status: 'active' },
        });

        if (activeSession) {
            return res.status(400).json({ error: 'Room is already occupied' });
        }

        // Start session and update room status in a transaction
        const session = await prisma.$transaction(async (tx) => {
            const s = await tx.session.create({
                data: {
                    roomId,
                    openedShiftId,
                    openedById,
                    status: 'active',
                },
            });

            await tx.room.update({
                where: { id: roomId },
                data: { status: 'occupied' },
            });

            return s;
        });

        // Realtime & Audit
        broadcast('room.state_updated', { roomId, status: 'occupied' });
        broadcast('session.started', session);
        await AuditService.log('Session', session.id, 'START', openedById, null, session);

        res.status(201).json(session);
    } catch (error) {
        logger.error(error, 'Error starting session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const endSession = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { closedShiftId, promoCode, tip } = req.body;
    const closedById = req.user.userId;
    const endTime = new Date();

    try {
        const session = await prisma.session.findUnique({
            where: { id },
            include: {
                room: true,
                orders: {
                    include: { orderCharge: true },
                },
            },
        });

        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }

        let discountAmount = 0;
        if (promoCode) {
            const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
            if (promo && promo.active && (promo.usageLimit === null || promo.usageLimit > 0) && (!promo.expiry || promo.expiry > new Date())) {
                const durationMs = endTime.getTime() - session.startTime.getTime();
                const totalPausedMs = (session as any).totalPausedMs || 0;
                const billableMs = Math.max(0, durationMs - totalPausedMs);
                const billableMinutes = Math.max(Math.ceil(billableMs / 60000), session.room.minMinutes);

                const roomAmount = (billableMinutes / 60) * session.room.pricePerHour;
                const ordersAmount = session.orders.reduce((sum, order) => {
                    const oc = order.orderCharge;
                    return sum + ((oc?.itemsTotal || 0) - (oc?.discount || 0));
                }, 0);

                // Determine base for discount based on applyTo
                const applyTo = (promo as any).applyTo ?? 'both';
                const base =
                    applyTo === 'room' ? roomAmount :
                        applyTo === 'orders' ? ordersAmount :
                            roomAmount + ordersAmount; // 'both'

                if (promo.type === 'percent') {
                    discountAmount = (base * promo.value) / 100;
                } else {
                    discountAmount = Math.min(promo.value, base); // fixed — cap at base
                }
            }
        }

        const charges = await BillingService.computeSessionCharge(id, endTime, discountAmount, tip || 0);

        const closedSession = await prisma.$transaction(async (tx) => {
            const s = await tx.session.update({
                where: { id },
                data: { endTime, closedShiftId, closedById, status: 'closed' },
            });

            await tx.sessionCharge.create({
                data: { sessionId: id, shiftId: closedShiftId, ...charges, promoCode: promoCode || null } as any,
            });

            await tx.room.update({
                where: { id: session.roomId },
                data: { status: 'available' },
            });

            await tx.shiftStats.update({
                where: { shiftId: closedShiftId },
                data: {
                    sessionsRevenue: { increment: charges.roomAmount },
                    ordersRevenue: { increment: charges.ordersAmount },
                    totalRevenue: { increment: (charges.finalTotal - charges.tip) },
                    tipsTotal: { increment: charges.tip },
                },
            });

            // ── Owner Wallet Deduction ─────────────────────────────────────
            // If an owner-type order exists for this session, deduct the full
            // session room amount from the owner's wallet (allows negative balance
            // for post-paid / credit tab scenarios).
            const ownerOrder = session.orders.find(o => o.type === 'owner' && o.ownerUserId);
            if (ownerOrder?.ownerUserId) {
                const deductAmount = charges.finalTotal;
                if (deductAmount > 0) {
                    await tx.user.update({
                        where: { id: ownerOrder.ownerUserId },
                        data: { walletBalance: { decrement: deductAmount } },
                    });
                    await tx.walletTransaction.create({
                        data: {
                            userId: ownerOrder.ownerUserId,
                            amount: -deductAmount,
                            note: `Room charge: ${session.room.name} (session ${id.slice(0, 8)})`,
                            shiftId: closedShiftId,
                        },
                    });

                    // Record as a payment to match revenue in ShiftStats
                    await tx.payment.create({
                        data: {
                            modeId: 'WALLET',
                            amount: deductAmount,
                            referenceType: 'session',
                            referenceId: id,
                            shiftId: closedShiftId,
                        }
                    });

                    // Track wallet payment in stats
                    await tx.shiftStats.update({
                        where: { shiftId: closedShiftId },
                        data: { paymentsWallet: { increment: deductAmount } },
                    });
                    // Approve the owner order to mark it as settled
                    await tx.order.update({
                        where: { id: ownerOrder.id },
                        data: { status: 'approved' },
                    });
                }
            }

            if (promoCode) {
                const p = await tx.promoCode.findUnique({ where: { code: promoCode } });
                if (p && p.usageLimit !== null) {
                    await tx.promoCode.update({
                        where: { code: promoCode },
                        data: { usageLimit: { decrement: 1 } },
                    });
                }
            }

            return s;
        });

        // Realtime, Audit & Receipt
        broadcast('room.state_updated', { roomId: session.roomId, status: 'available' });
        broadcast('session.ended', { sessionId: id, charges });
        await AuditService.log('Session', id, 'END', closedById, session, closedSession);
        await ReceiptService.createSnapshot('session', id);

        res.json(closedSession);
    } catch (error) {
        logger.error(error, 'Error ending session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const pauseSession = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user.userId;

    try {
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }
        if ((session as any).isPaused) {
            return res.status(400).json({ error: 'Session is already paused' });
        }

        const updated = await prisma.session.update({
            where: { id },
            data: {
                isPaused: true,
                lastPausedAt: new Date(),
            } as any,
        });

        await AuditService.log('Session', id, 'PAUSE', userId, session, updated);
        broadcast('session.updated', updated);
        broadcast('room.state_updated', { roomId: session.roomId, status: 'paused', isPaused: true });

        res.json(updated);
    } catch (error) {
        logger.error(error, 'Error pausing session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const resumeSession = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user.userId;

    try {
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session || session.status !== 'active') {
            return res.status(404).json({ error: 'Active session not found' });
        }
        if (!(session as any).isPaused || !(session as any).lastPausedAt) {
            return res.status(400).json({ error: 'Session is not paused' });
        }

        const pausedDurationMs = new Date().getTime() - (session as any).lastPausedAt.getTime();

        const updated = await prisma.session.update({
            where: { id },
            data: {
                isPaused: false,
                lastPausedAt: null,
                totalPausedMs: { increment: pausedDurationMs },
            } as any,
        });

        await AuditService.log('Session', id, 'RESUME', userId, session, updated);
        broadcast('session.updated', updated);
        broadcast('room.state_updated', { roomId: session.roomId, status: 'occupied', isPaused: false });

        res.json(updated);
    } catch (error) {
        logger.error(error, 'Error resuming session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateSession = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { startTime, endTime, status } = req.body;
    const userId = req.user.userId;

    try {
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const updated = await prisma.session.update({
            where: { id },
            data: {
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                status: status || undefined,
                isPaused: req.body.isPaused !== undefined ? req.body.isPaused : undefined,
                totalPausedMinutes: req.body.totalPausedMinutes !== undefined ? req.body.totalPausedMinutes : undefined,
            } as any,
        });

        await AuditService.log('Session', id, 'UPDATE', userId, session, updated);
        broadcast('session.updated', updated);

        res.json(updated);
    } catch (error) {
        logger.error(error, 'Error updating session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/sessions/:id/checkout
 * Body: { payments: [{ modeId: string, amount: number }], shiftId: string }
 * Records multiple payments for a session (split payment support).
 */
export const checkoutSession = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { payments, shiftId } = req.body;

    if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'payments must be a non-empty array of { modeId, amount }' });
    }

    try {
        const session = await prisma.session.findUnique({
            where: { id },
            include: { sessionCharge: true },
        });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (!session.sessionCharge) return res.status(400).json({ error: 'Session has not been charged yet – end the session first' });

        const resolvedShiftId = shiftId || session.closedShiftId || session.openedShiftId;

        const createdPayments = await prisma.$transaction(async (tx) => {
            const result = [];
            for (const p of payments) {
                const { modeId, amount } = p;

                const created = await tx.payment.create({
                    data: {
                        modeId,
                        amount,
                        referenceType: 'session',
                        referenceId: id,
                        shiftId: resolvedShiftId,
                    },
                });
                result.push(created);

                const mode = await tx.paymentMode.findUnique({ where: { id: modeId } });
                if (!mode) throw new Error(`Payment mode ${modeId} not found`);

                const modeName = mode.name.toUpperCase();
                const updateData: any = {};
                if (modeName === 'CASH') updateData.paymentsCash = { increment: amount };
                else if (modeName === 'WALLET') updateData.paymentsWallet = { increment: amount };
                else updateData.paymentsCard = { increment: amount }; // INSTAPAY, CARD, etc.

                if (Object.keys(updateData).length > 0) {
                    await tx.shiftStats.update({
                        where: { shiftId: resolvedShiftId },
                        data: updateData,
                    });
                }
            }
            return result;
        });

        res.status(201).json(createdPayments);
    } catch (error) {
        logger.error(error, 'Error processing session checkout');
        res.status(500).json({ error: 'Internal server error' });
    }
};
