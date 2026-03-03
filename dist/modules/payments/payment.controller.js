"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editPayment = exports.uploadReceipt = exports.getPayments = exports.recordPayment = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const recordPayment = async (req, res) => {
    const { modeId, amount, referenceType, referenceId, shiftId, receiptUrl } = req.body;
    try {
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
        const existingPayments = await prisma_service_1.prisma.payment.aggregate({
            where: { referenceType, referenceId },
            _sum: { amount: true },
        });
        const payment = await prisma_service_1.prisma.$transaction(async (tx) => {
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
const storage_service_1 = require("../../services/storage.service");
const getPayments = async (req, res) => {
    const { referenceType, referenceId, shiftId, page, pageSize, startDate, endDate } = req.query;
    try {
        const where = {};
        if (referenceType)
            where.referenceType = referenceType;
        if (referenceId)
            where.referenceId = referenceId;
        if (shiftId)
            where.shiftId = shiftId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lt = new Date(new Date(endDate).getTime() + 86400000);
        }
        const p = parseInt(page) || 1;
        const size = parseInt(pageSize) || 50;
        const [payments, total] = await Promise.all([
            prisma_service_1.prisma.payment.findMany({
                where,
                include: { mode: true, shift: { include: { staff: { select: { username: true } } } } },
                orderBy: { createdAt: 'desc' },
                skip: (p - 1) * size,
                take: size,
            }),
            prisma_service_1.prisma.payment.count({ where })
        ]);
        const mappedPayments = await Promise.all(payments.map(async (p) => ({
            ...p,
            receiptUrl: p.receiptUrl ? await storage_service_1.StorageService.getFileUrl(p.receiptUrl) : p.receiptUrl
        })));
        res.json({
            data: mappedPayments,
            total,
            page: p,
            pageSize: size,
            totalPages: Math.ceil(total / size)
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching payments');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPayments = getPayments;
const uploadReceipt = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No receipt image provided' });
        }
        const receiptKey = await storage_service_1.StorageService.uploadFile(req.file, 'receipts');
        const receiptUrl = await storage_service_1.StorageService.getFileUrl(receiptKey);
        res.status(200).json({ receiptKey, receiptUrl });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error uploading receipt');
        res.status(500).json({ error: 'Failed to upload receipt image' });
    }
};
exports.uploadReceipt = uploadReceipt;
const editPayment = async (req, res) => {
    const id = req.params.id;
    const { amount, modeId } = req.body;
    const userRole = req.user?.role ?? '';
    try {
        const existing = await prisma_service_1.prisma.payment.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Payment not found' });
        if (amount !== undefined && !['OPERATION', 'ADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'You are not allowed to edit the payment amount' });
        }
        const updated = await prisma_service_1.prisma.payment.update({
            where: { id },
            data: {
                ...(amount !== undefined && ['OPERATION', 'ADMIN'].includes(userRole) ? { amount: parseFloat(amount) } : {}),
                ...(modeId ? { modeId } : {}),
            },
            include: { mode: true },
        });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error editing payment');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.editPayment = editPayment;
