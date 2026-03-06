import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const recordPayment = async (req: any, res: Response) => {
    const { modeId, amount, referenceType, referenceId, shiftId, receiptUrl } = req.body;

    try {
        // 1. Get the target charge to validate total payments
        let finalTotal = 0;
        if (referenceType === 'session') {
            const charge = await prisma.sessionCharge.findUnique({
                where: { sessionId: referenceId },
            });
            if (!charge) return res.status(404).json({ error: 'Session charge not found' });
            finalTotal = charge.finalTotal;
        } else if (referenceType === 'order') {
            const charge = await prisma.orderCharge.findUnique({
                where: { orderId: referenceId },
            });
            if (!charge) return res.status(404).json({ error: 'Order charge not found' });
            finalTotal = charge.finalTotal;
        } else {
            return res.status(400).json({ error: 'Invalid reference type' });
        }

        // 2. Calculate existing payments
        const existingPayments = await prisma.payment.aggregate({
            where: { referenceType, referenceId },
            _sum: { amount: true },
        });

        // Note: intentionally allow overpayment (e.g. cash customers paying a round number and receiving change)

        // 4. Create payment and update shift stats (incremental update is preferred, but here we just create)
        const payment = await prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
                data: {
                    modeId,
                    amount,
                    referenceType,
                    referenceId,
                    shiftId,
                    receiptUrl,
                },
            });

            // Update ShiftStats (Section 11)
            const mode = await tx.paymentMode.findUnique({ where: { id: modeId } });
            if (!mode) throw new Error('Payment mode not found');

            const modeName = mode.name.toUpperCase();
            const updateData: any = {};

            if (modeName === 'CASH') updateData.paymentsCash = { increment: amount };
            else if (modeName === 'CARD') updateData.paymentsCard = { increment: amount };
            else if (modeName === 'WALLET') updateData.paymentsWallet = { increment: amount };

            await tx.shiftStats.update({
                where: { shiftId },
                data: updateData,
            });

            return p;
        });

        res.status(201).json(payment);
    } catch (error) {
        logger.error(error, 'Error recording payment');
        res.status(500).json({ error: 'Internal server error' });
    }
};

import { StorageService } from '../../services/storage.service';

export const getPayments = async (req: Request, res: Response) => {
    const { referenceType, referenceId, shiftId, page, pageSize, startDate, endDate } = req.query;
    try {
        const where: any = {};
        if (referenceType) where.referenceType = referenceType as string;
        if (referenceId) where.referenceId = referenceId as string;
        if (shiftId) where.shiftId = shiftId as string;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lt = new Date(new Date(endDate as string).getTime() + 86400000); // include full day
        }

        const p = parseInt(page as string) || 1;
        const size = parseInt(pageSize as string) || 50;

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: { mode: true, shift: { include: { staff: { select: { username: true } } } } },
                orderBy: { createdAt: 'desc' },
                skip: (p - 1) * size,
                take: size,
            }),
            prisma.payment.count({ where })
        ]);

        const mappedPayments = await Promise.all(payments.map(async p => ({
            ...p,
            receiptUrl: p.receiptUrl ? await StorageService.getFileUrl(p.receiptUrl) : p.receiptUrl
        })));

        res.json({
            data: mappedPayments,
            total,
            page: p,
            pageSize: size,
            totalPages: Math.ceil(total / size)
        });
    } catch (error) {
        logger.error(error, 'Error fetching payments');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const uploadReceipt = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No receipt image provided' });
        }
        // Upload the file to S3 Minio — gets back the raw object key
        const receiptKey = await StorageService.uploadFile(req.file, 'receipts');
        // Generate a presigned URL for the frontend to use for preview / display
        const receiptUrl = await StorageService.getFileUrl(receiptKey);
        // Return BOTH: the key (to store in DB) and the signed URL (to display immediately)
        res.status(200).json({ receiptKey, receiptUrl });
    } catch (error) {
        logger.error(error, 'Error uploading receipt');
        res.status(500).json({ error: 'Failed to upload receipt image' });
    }
};

export const editPayment = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { amount, modeId } = req.body;
    const userRole: string = req.user?.role ?? '';
    try {
        const existing = await prisma.payment.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Payment not found' });

        // Staff can only change the payment mode, not the amount
        if (amount !== undefined && !['OPERATION', 'ADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'You are not allowed to edit the payment amount' });
        }

        const updated = await prisma.payment.update({
            where: { id },
            data: {
                ...(amount !== undefined && ['OPERATION', 'ADMIN'].includes(userRole) ? { amount: Math.round(parseFloat(amount)) } : {}),
                ...(modeId ? { modeId } : {}),
            },
            include: { mode: true },
        });

        res.json(updated);
    } catch (error) {
        logger.error(error, 'Error editing payment');
        res.status(500).json({ error: 'Internal server error' });
    }
};

