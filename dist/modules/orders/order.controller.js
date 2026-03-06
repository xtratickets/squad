"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutOrder = exports.updateOrderItems = exports.updateOrder = exports.getOrder = exports.approveOrder = exports.createOrder = exports.getOrders = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const billing_service_1 = require("../../services/billing.service");
const logger_1 = require("../../utils/logger");
const socket_1 = require("../../websocket/socket");
const audit_service_1 = require("../../services/audit.service");
const receipt_service_1 = require("../../services/receipt.service");
const storage_service_1 = require("../../services/storage.service");
const getOrders = async (req, res) => {
    const { shiftId, status, type, page, pageSize } = req.query;
    try {
        const where = {};
        if (shiftId)
            where.shiftId = shiftId;
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const include = {
            items: { include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } } },
            orderCharge: true,
            room: { select: { name: true } },
        };
        if (page !== undefined) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
            const skip = (pageNum - 1) * size;
            const [orders, total] = await Promise.all([
                prisma_service_1.prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take: size }),
                prisma_service_1.prisma.order.count({ where }),
            ]);
            const mappedOrders = await Promise.all(orders.map(async (order) => {
                const items = await Promise.all(order.items.map(async (item) => {
                    if (item.product && item.product.imageUrl) {
                        item.product.imageUrl = await storage_service_1.StorageService.getFileUrl(item.product.imageUrl);
                    }
                    return item;
                }));
                return { ...order, items };
            }));
            return res.json({
                data: mappedOrders,
                total,
                page: pageNum,
                pageSize: size,
                totalPages: Math.ceil(total / size),
            });
        }
        const flatOrders = await prisma_service_1.prisma.order.findMany({
            where,
            include,
            orderBy: { createdAt: 'desc' },
        });
        const mappedFlatOrders = await Promise.all(flatOrders.map(async (order) => {
            const items = await Promise.all(order.items.map(async (item) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await storage_service_1.StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
            return { ...order, items };
        }));
        res.json(mappedFlatOrders);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching orders');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOrders = getOrders;
const createOrder = async (req, res) => {
    const { type, roomId, sessionId, shiftId, items, ownerUserId } = req.body;
    const createdById = req.user.userId;
    try {
        const order = await prisma_service_1.prisma.$transaction(async (tx) => {
            const o = await tx.order.create({
                data: {
                    type, roomId, sessionId, shiftId, createdById, status: 'pending',
                    ...(type === 'owner' && ownerUserId ? { ownerUserId } : {}),
                },
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
        (0, socket_1.broadcast)('order.created', order);
        (0, socket_1.broadcast)('order_notification', order);
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
        const orderData = order;
        if (!order || order.status !== 'pending') {
            return res.status(404).json({ error: 'Pending order not found' });
        }
        let discountAmount = 0;
        if (promoCode) {
            const promo = await prisma_service_1.prisma.promoCode.findUnique({ where: { code: promoCode } });
            if (promo && promo.active && (promo.usageLimit === null || promo.usageLimit > 0) && (!promo.expiry || promo.expiry > new Date())) {
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
            await tx.orderCharge.upsert({
                where: { orderId: order.id },
                create: { orderId: order.id, shiftId: order.shiftId, ...charges },
                update: { shiftId: order.shiftId, ...charges }
            });
            const ownerUserId = order.ownerUserId;
            if (order.type === 'owner' && ownerUserId) {
                await tx.user.update({
                    where: { id: ownerUserId },
                    data: { walletBalance: { decrement: charges.finalTotal } },
                });
                await tx.walletTransaction.create({
                    data: {
                        userId: ownerUserId,
                        amount: -charges.finalTotal,
                        note: `Order #${order.id.slice(0, 8)} deduction`,
                        orderId: order.id,
                        shiftId: order.shiftId,
                    },
                });
                await tx.payment.create({
                    data: {
                        modeId: 'WALLET',
                        amount: charges.finalTotal,
                        referenceType: 'order',
                        referenceId: order.id,
                        shiftId: order.shiftId,
                    }
                });
                await tx.shiftStats.update({
                    where: { shiftId: order.shiftId },
                    data: { paymentsWallet: { increment: charges.finalTotal } },
                });
            }
            await tx.shiftStats.update({
                where: { shiftId: order.shiftId },
                data: {
                    ordersRevenue: { increment: charges.itemsTotal - charges.discount },
                    totalRevenue: { increment: charges.itemsTotal - charges.discount },
                    tipsTotal: { increment: charges.tip },
                },
            });
            if (promoCode) {
                const p = await tx.promoCode.findUnique({ where: { code: promoCode } });
                if (p && p.usageLimit !== null) {
                    await tx.promoCode.update({
                        where: { code: promoCode },
                        data: { usageLimit: { decrement: 1 } },
                    });
                }
            }
            return await tx.order.update({
                where: { id },
                data: { status: 'approved' },
                include: { orderCharge: true },
            });
        });
        (0, socket_1.broadcast)('order.approved', result);
        await audit_service_1.AuditService.log('Order', order.id, 'APPROVE', userId, order, result);
        await receipt_service_1.ReceiptService.createSnapshot('order', id);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error approving order');
        if (error?.statusCode)
            return res.status(error.statusCode).json({ error: error.message });
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
        if (order) {
            order.items = await Promise.all(order.items.map(async (item) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await storage_service_1.StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
        }
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
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id },
            include: { items: true, orderCharge: true }
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            if (status === 'cancelled' && order.status === 'approved') {
                for (const item of order.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: { increment: item.qty } },
                    });
                    await tx.stockMovement.create({
                        data: { productId: item.productId, qty: item.qty, type: 'add', reference: `order_${order.id}_cancel` },
                    });
                }
                if (order.orderCharge) {
                    const charge = order.orderCharge;
                    await tx.shiftStats.update({
                        where: { shiftId: order.shiftId },
                        data: {
                            ordersRevenue: { decrement: charge.itemsTotal - charge.discount },
                            totalRevenue: { decrement: charge.itemsTotal - charge.discount },
                            tipsTotal: { decrement: charge.tip },
                        },
                    });
                    const payments = await tx.payment.findMany({
                        where: { referenceType: 'order', referenceId: id },
                        include: { mode: true }
                    });
                    for (const p of payments) {
                        const modeName = p.mode.name.toUpperCase();
                        const updateData = {};
                        if (modeName === 'CASH')
                            updateData.paymentsCash = { decrement: p.amount };
                        else if (modeName === 'WALLET')
                            updateData.paymentsWallet = { decrement: p.amount };
                        else
                            updateData.paymentsCard = { decrement: p.amount };
                        if (Object.keys(updateData).length > 0) {
                            await tx.shiftStats.update({
                                where: { shiftId: order.shiftId },
                                data: updateData,
                            });
                        }
                        await tx.payment.delete({ where: { id: p.id } });
                    }
                    const ownerUserId = order.ownerUserId;
                    if (order.type === 'owner' && ownerUserId) {
                        await tx.user.update({
                            where: { id: ownerUserId },
                            data: { walletBalance: { increment: charge.finalTotal } },
                        });
                        await tx.walletTransaction.create({
                            data: {
                                userId: ownerUserId,
                                amount: charge.finalTotal,
                                note: `Order #${order.id.slice(0, 8)} cancellation credit`,
                                orderId: order.id,
                                shiftId: order.shiftId,
                            },
                        });
                    }
                }
            }
            return await tx.order.update({
                where: { id },
                data: {
                    status: status || undefined,
                    type: type || undefined,
                },
            });
        });
        await audit_service_1.AuditService.log('Order', id, 'UPDATE', userId, order, result);
        (0, socket_1.broadcast)('order.updated', result);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating order');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateOrder = updateOrder;
const updateOrderItems = async (req, res) => {
    const id = req.params.id;
    const { items, type, ownerUserId } = req.body;
    const userId = req.user.userId;
    try {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id },
            include: { items: true, orderCharge: true }
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (order.status === 'approved' && order.type === 'regular') {
            const payments = await prisma_service_1.prisma.payment.count({ where: { referenceType: 'order', referenceId: id } });
            if (payments > 0)
                return res.status(400).json({ error: 'Cannot edit items of a paid walk-in order' });
        }
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const discountAmount = order.orderCharge?.discount || 0;
            const tip = order.orderCharge?.tip || 0;
            if (order.status === 'approved') {
                for (const item of order.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: { increment: item.qty } }
                    });
                    await tx.stockMovement.create({
                        data: { productId: item.productId, qty: item.qty, type: 'add', reference: `order_${order.id}_edit_revert` }
                    });
                }
                if (order.type === 'owner' && order.ownerUserId) {
                    const oldCharge = order.orderCharge;
                    await tx.user.update({
                        where: { id: order.ownerUserId },
                        data: { walletBalance: { increment: oldCharge.finalTotal } }
                    });
                    await tx.walletTransaction.create({
                        data: {
                            userId: order.ownerUserId,
                            amount: oldCharge.finalTotal,
                            note: `Order #${order.id.slice(0, 8)} edit revert`,
                            orderId: order.id,
                            shiftId: order.shiftId
                        }
                    });
                    const payments = await tx.payment.findMany({
                        where: { referenceType: 'order', referenceId: id },
                        include: { mode: true }
                    });
                    for (const p of payments) {
                        const modeName = p.mode.name.toUpperCase();
                        const updateData = {};
                        if (modeName === 'CASH')
                            updateData.paymentsCash = { decrement: p.amount };
                        else if (modeName === 'WALLET')
                            updateData.paymentsWallet = { decrement: p.amount };
                        else
                            updateData.paymentsCard = { decrement: p.amount };
                        if (Object.keys(updateData).length > 0) {
                            await tx.shiftStats.update({
                                where: { shiftId: order.shiftId },
                                data: updateData,
                            });
                        }
                        await tx.payment.delete({ where: { id: p.id } });
                    }
                }
                if (order.orderCharge) {
                    const charge = order.orderCharge;
                    await tx.shiftStats.update({
                        where: { shiftId: order.shiftId },
                        data: {
                            ordersRevenue: { decrement: charge.itemsTotal - charge.discount },
                            totalRevenue: { decrement: charge.itemsTotal - charge.discount },
                            tipsTotal: { decrement: charge.tip },
                        },
                    });
                }
            }
            await tx.orderItem.deleteMany({ where: { orderId: id } });
            if (!items || items.length === 0)
                throw new Error('Order must have at least one item');
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product)
                    throw new Error(`Product ${item.productId} not found`);
                const unitPrice = product.price;
                await tx.orderItem.create({
                    data: {
                        orderId: id,
                        productId: item.productId,
                        qty: item.qty,
                        unitPrice,
                        total: unitPrice * item.qty
                    }
                });
                if (order.status === 'approved') {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: { decrement: item.qty } }
                    });
                    await tx.stockMovement.create({
                        data: { productId: item.productId, qty: item.qty, type: 'deduct', reference: `order_${order.id}_edit_apply` }
                    });
                }
            }
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    type: type || order.type,
                    ownerUserId: type === 'owner' ? (ownerUserId || order.ownerUserId) : null,
                }
            });
            if (order.status === 'approved') {
                const charges = await billing_service_1.BillingService.computeOrderCharge(id, discountAmount, tip, tx);
                await tx.orderCharge.update({
                    where: { orderId: id },
                    data: {
                        itemsTotal: charges.itemsTotal,
                        discount: charges.discount,
                        serviceFee: charges.serviceFee,
                        tax: charges.tax,
                        tip: charges.tip,
                        finalTotal: charges.finalTotal
                    }
                });
                await tx.shiftStats.update({
                    where: { shiftId: order.shiftId },
                    data: {
                        ordersRevenue: { increment: charges.itemsTotal - charges.discount },
                        totalRevenue: { increment: charges.itemsTotal - charges.discount },
                        tipsTotal: { increment: charges.tip },
                    }
                });
                if (updatedOrder.type === 'owner' && updatedOrder.ownerUserId) {
                    await tx.user.update({
                        where: { id: updatedOrder.ownerUserId },
                        data: { walletBalance: { decrement: charges.finalTotal } }
                    });
                    await tx.walletTransaction.create({
                        data: {
                            userId: updatedOrder.ownerUserId,
                            amount: -charges.finalTotal,
                            note: `Order #${order.id.slice(0, 8)} edit application`,
                            orderId: order.id,
                            shiftId: order.shiftId
                        }
                    });
                    await tx.payment.create({
                        data: {
                            modeId: 'WALLET',
                            amount: charges.finalTotal,
                            referenceType: 'order',
                            referenceId: order.id,
                            shiftId: order.shiftId,
                        }
                    });
                    await tx.shiftStats.update({
                        where: { shiftId: order.shiftId },
                        data: { paymentsWallet: { increment: charges.finalTotal } }
                    });
                }
            }
            return await tx.order.findUnique({
                where: { id },
                include: { items: { include: { product: true } }, orderCharge: true }
            });
        });
        if (result && result.items) {
            result.items = await Promise.all(result.items.map(async (item) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await storage_service_1.StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
        }
        await audit_service_1.AuditService.log('Order', id, 'UPDATE_ITEMS', userId, order.items, result?.items);
        (0, socket_1.broadcast)('order.updated', result);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating order items');
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateOrderItems = updateOrderItems;
const checkoutOrder = async (req, res) => {
    const id = req.params.id;
    const { payments, shiftId } = req.body;
    if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'payments must be a non-empty array of { modeId, amount }' });
    }
    try {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id },
            include: { orderCharge: true },
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (!order.orderCharge)
            return res.status(400).json({ error: 'Order has not been charged yet' });
        const createdPayments = await prisma_service_1.prisma.$transaction(async (tx) => {
            const result = [];
            for (const p of payments) {
                const { modeId, amount } = p;
                const created = await tx.payment.create({
                    data: {
                        modeId,
                        amount,
                        referenceType: 'order',
                        referenceId: id,
                        shiftId: shiftId || order.shiftId,
                    },
                });
                result.push(created);
                const mode = await tx.paymentMode.findUnique({ where: { id: modeId } });
                if (!mode)
                    throw new Error(`Payment mode ${modeId} not found`);
                const modeName = mode.name.toUpperCase();
                const updateData = {};
                if (modeName === 'CASH')
                    updateData.paymentsCash = { increment: amount };
                else if (modeName === 'WALLET')
                    updateData.paymentsWallet = { increment: amount };
                else
                    updateData.paymentsCard = { increment: amount };
                if (Object.keys(updateData).length > 0) {
                    await tx.shiftStats.update({
                        where: { shiftId: shiftId || order.shiftId },
                        data: updateData,
                    });
                }
            }
            return result;
        });
        res.status(201).json(createdPayments);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error processing order checkout');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.checkoutOrder = checkoutOrder;
