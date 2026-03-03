"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayments = exports.recordPayment = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const recordPayment = async (req, res) => {
    const { modeId, amount, referenceType, referenceId, shiftId } = req.body;
    try {
        // 1. Get the target charge to validate total payments
        let finalTotal = 0;
        if (referenceType === 'session') {
            const charge = await prisma_service_1.prisma.sessionCharge.findUnique({
                where: { sessionId: referenceId },
            });
            if (!charge)
                return res.status(404).json({ error: 'Session charge not found' });
            finalTotal = charge.finalTotal;
        }
        else if (referenceType === 'order') {
            const charge = await prisma_service_1.prisma.orderCharge.findUnique({
                where: { orderId: referenceId },
            });
            if (!charge)
                return res.status(404).json({ error: 'Order charge not found' });
            finalTotal = charge.finalTotal;
        }
        else {
            return res.status(400).json({ error: 'Invalid reference type' });
        }
        // 2. Calculate existing payments
        const existingPayments = await prisma_service_1.prisma.payment.aggregate({
            where: { referenceType, referenceId },
            _sum: { amount: true },
        });
        const totalPaid = (existingPayments._sum.amount || 0) + amount;
        // 3. Rule: SUM(payments) <= charge.final_total
        // Allowing for floating point precision issues with a small epsilon
        if (totalPaid > finalTotal + 0.01) {
            return res.status(400).json({ error: `Payment exceeds total amount (Paid: ${totalPaid}, Total: ${finalTotal})` });
        }
        // 4. Create payment and update shift stats (incremental update is preferred, but here we just create)
        const payment = await prisma_service_1.prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
                data: {
                    modeId,
                    amount,
                    referenceType,
                    referenceId,
                    shiftId,
                },
            });
            // Update ShiftStats (Section 11)
            const mode = await tx.paymentMode.findUnique({ where: { id: modeId } });
            if (!mode)
                throw new Error('Payment mode not found');
            const modeName = mode.name.toUpperCase();
            const updateData = {};
            if (modeName === 'CASH')
                updateData.paymentsCash = { increment: amount };
            else if (modeName === 'CARD')
                updateData.paymentsCard = { increment: amount };
            else if (modeName === 'WALLET')
                updateData.paymentsWallet = { increment: amount };
            await tx.shiftStats.update({
                where: { shiftId },
                data: updateData,
            });
            return p;
        });
        res.status(201).json(payment);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error recording payment');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.recordPayment = recordPayment;
const getPayments = async (req, res) => {
    const { referenceType, referenceId } = req.query;
    try {
        const payments = await prisma_service_1.prisma.payment.findMany({
            where: {
                referenceType: referenceType,
                referenceId: referenceId,
            },
            include: { mode: true },
        });
        res.json(payments);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching payments');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPayments = getPayments;
