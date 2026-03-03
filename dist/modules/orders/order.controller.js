"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrder = exports.getOrder = exports.approveOrder = exports.createOrder = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const billing_service_1 = require("../../services/billing.service");
const logger_1 = require("../../utils/logger");
const socket_1 = require("../../websocket/socket");
const audit_service_1 = require("../../services/audit.service");
const receipt_service_1 = require("../../services/receipt.service");
const createOrder = async (req, res) => {
    const { type, roomId, sessionId, shiftId, items } = req.body;
    const createdById = req.user.userId;
    try {
        const order = await prisma_service_1.prisma.$transaction(async (tx) => {
            const o = await tx.order.create({
                data: { type, roomId, sessionId, shiftId, createdById, status: 'pending' },
            });
            if (items && items.length > 0) {
                for (const item of items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product)
                        throw new Error(`Product ${item.productId} not found`);
                    let unitPrice = product.price;
                    let originalUnitPrice = null;
                    if (item.overridePrice !== undefined) {
                        const userRole = req.user.role;
                        if (['OPERATION', 'ADMIN'].includes(userRole)) {
                            unitPrice = item.overridePrice;
                            originalUnitPrice = product.price;
                        }
                        else {
                            logger_1.logger.warn({ userId: createdById, productId: item.productId }, 'Unauthorized price override attempt');
                        }
                    }
                    await tx.orderItem.create({
                        data: {
                            orderId: o.id,
                            productId: item.productId,
                            qty: item.qty,
                            unitPrice,
                            originalUnitPrice,
                            total: unitPrice * item.qty,
                        },
                    });
                }
            }
            return o;
        });
        // Realtime & Audit
        (0, socket_1.broadcast)('order.created', order);
        await audit_service_1.AuditService.log('Order', order.id, 'CREATE', createdById, null, order);
        res.status(201).json(order);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating order');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createOrder = createOrder;
const approveOrder = async (req, res) => {
    const id = req.params.id;
    const { promoCode } = req.body;
    const userId = req.user.userId;
    try {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!order || order.status !== 'pending') {
            return res.status(404).json({ error: 'Pending order not found' });
        }
        let discountAmount = 0;
        if (promoCode) {
            const promo = await prisma_service_1.prisma.promoCode.findUnique({ where: { code: promoCode } });
            if (promo && promo.active && (promo.usageLimit ?? 0) > 0 && (!promo.expiry || promo.expiry > new Date())) {
                const itemsTotal = order.items.reduce((sum, item) => sum + item.total, 0);
                if (promo.type === 'percent') {
                    discountAmount = (itemsTotal * promo.value) / 100;
                }
                else {
                    discountAmount = promo.value;
                }
            }
        }
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const { tip } = req.body;
            for (const item of order.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQty: { decrement: item.qty } },
                });
                await tx.stockMovement.create({
                    data: { productId: item.productId, qty: item.qty, type: 'deduct', reference: `order_${order.id}` },
                });
            }
            const charges = await billing_service_1.BillingService.computeOrderCharge(order.id, discountAmount, tip || 0);
            await tx.orderCharge.create({
                data: { orderId: order.id, shiftId: order.shiftId, ...charges },
            });
            // Update ShiftStats (Section 11)
            await tx.shiftStats.update({
                where: { shiftId: order.shiftId },
                data: {
                    ordersRevenue: { increment: charges.itemsTotal - charges.discount },
                    totalRevenue: { increment: charges.itemsTotal - charges.discount },
                    tipsTotal: { increment: charges.tip },
                },
            });
            if (promoCode) {
                await tx.promoCode.update({
                    where: { code: promoCode },
                    data: { usageLimit: { decrement: 1 } },
                });
            }
            return await tx.order.update({
                where: { id },
                data: { status: 'approved' },
                include: { orderCharge: true },
            });
        });
        // Realtime, Audit & Receipt
        (0, socket_1.broadcast)('order.approved', result);
        await audit_service_1.AuditService.log('Order', order.id, 'APPROVE', userId, order, result);
        await receipt_service_1.ReceiptService.createSnapshot('order', id);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error approving order');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.approveOrder = approveOrder;
const getOrder = async (req, res) => {
    const id = req.params.id;
    try {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id },
            include: { items: { include: { product: true } }, orderCharge: true },
        });
        res.json(order);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching order');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOrder = getOrder;
const updateOrder = async (req, res) => {
    const id = req.params.id;
    const { status, type } = req.body;
    const userId = req.user.userId;
    try {
        const order = await prisma_service_1.prisma.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        const updated = await prisma_service_1.prisma.order.update({
            where: { id },
            data: {
                status: status || undefined,
                type: type || undefined,
            },
        });
        await audit_service_1.AuditService.log('Order', id, 'UPDATE', userId, order, updated);
        (0, socket_1.broadcast)('order.updated', updated);
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating order');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateOrder = updateOrder;
