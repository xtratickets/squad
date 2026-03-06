import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { BillingService } from '../../services/billing.service';
import { logger } from '../../utils/logger';
import { emitToRoom, broadcast } from '../../websocket/socket';
import { AuditService } from '../../services/audit.service';
import { ReceiptService } from '../../services/receipt.service';
import { StorageService } from '../../services/storage.service';

export const getOrders = async (req: Request, res: Response) => {
    const { shiftId, status, type, page, pageSize } = req.query;
    try {
        const where: Record<string, unknown> = {};
        if (shiftId) where.shiftId = shiftId as string;
        if (status) where.status = status as string;
        if (type) where.type = type as string;

        const include = {
            items: { include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } } },
            orderCharge: true,
            room: { select: { name: true } },
        };

        // If pagination params provided, return paginated envelope
        if (page !== undefined) {
            const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
            const size = Math.min(100, Math.max(1, parseInt(pageSize as string, 10) || 10));
            const skip = (pageNum - 1) * size;

            const [orders, total] = await Promise.all([
                prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take: size }),
                prisma.order.count({ where }),
            ]);

            const mappedOrders = await Promise.all(orders.map(async order => {
                const items = await Promise.all(order.items.map(async (item: any) => {
                    if (item.product && item.product.imageUrl) {
                        item.product.imageUrl = await StorageService.getFileUrl(item.product.imageUrl);
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

        // Legacy: no pagination params — return flat array for backwards compatibility
        const flatOrders = await prisma.order.findMany({
            where,
            include,
            orderBy: { createdAt: 'desc' },
        });

        const mappedFlatOrders = await Promise.all(flatOrders.map(async order => {
            const items = await Promise.all(order.items.map(async (item: any) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
            return { ...order, items };
        }));

        res.json(mappedFlatOrders);
    } catch (error) {
        logger.error(error, 'Error fetching orders');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createOrder = async (req: any, res: Response) => {
    const { type, roomId, sessionId, shiftId, items, ownerUserId } = req.body;
    const createdById = req.user.userId;

    try {
        const order = await prisma.$transaction(async (tx) => {
            const o = await tx.order.create({
                data: {
                    type, roomId, sessionId, shiftId, createdById, status: 'pending',
                    ...(type === 'owner' && ownerUserId ? { ownerUserId } : {}),
                },
            });

            if (items && items.length > 0) {
                for (const item of items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product) throw new Error(`Product ${item.productId} not found`);

                    let unitPrice = product.price;
                    let originalUnitPrice = null;

                    if (item.overridePrice !== undefined) {
                        const userRole = req.user.role;
                        if (['OPERATION', 'ADMIN'].includes(userRole)) {
                            unitPrice = item.overridePrice;
                            originalUnitPrice = product.price;
                        } else {
                            logger.warn({ userId: createdById, productId: item.productId }, 'Unauthorized price override attempt');
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
        broadcast('order.created', order);
        broadcast('order_notification', order);
        await AuditService.log('Order', order.id, 'CREATE', createdById, null, order);

        res.status(201).json(order);
    } catch (error) {
        logger.error(error, 'Error creating order');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const approveOrder = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { promoCode } = req.body;
    const userId = req.user.userId;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true },
            // ownerUserId is a scalar field — no include needed, it's on the order directly
        });
        // Cast to access ownerUserId until Prisma client regenerates
        const orderData = order as typeof order & { ownerUserId?: string | null };

        if (!order || order.status !== 'pending') {
            return res.status(404).json({ error: 'Pending order not found' });
        }

        let discountAmount = 0;
        if (promoCode) {
            const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
            if (promo && promo.active && (promo.usageLimit === null || promo.usageLimit > 0) && (!promo.expiry || promo.expiry > new Date())) {
                const itemsTotal = order.items.reduce((sum, item) => sum + item.total, 0);
                if (promo.type === 'percent') {
                    discountAmount = (itemsTotal * promo.value) / 100;
                } else {
                    discountAmount = promo.value;
                }
            }
        }

        const result = await prisma.$transaction(async (tx) => {
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

            const charges = await BillingService.computeOrderCharge(order.id, discountAmount, tip || 0);

            await tx.orderCharge.upsert({
                where: { orderId: order.id },
                create: { orderId: order.id, shiftId: order.shiftId, ...charges },
                update: { shiftId: order.shiftId, ...charges }
            });

            // Owner order: deduct finalTotal from owner's wallet
            const ownerUserId = (order as any).ownerUserId as string | null;
            if (order.type === 'owner' && ownerUserId) {
                await (tx as any).user.update({
                    where: { id: ownerUserId! },
                    data: { walletBalance: { decrement: charges.finalTotal } },
                });

                await (tx as any).walletTransaction.create({
                    data: {
                        userId: ownerUserId!,
                        amount: -charges.finalTotal,
                        note: `Order #${order.id.slice(0, 8)} deduction`,
                        orderId: order.id,
                        shiftId: order.shiftId,
                    },
                });

                // Record as a payment to match revenue in ShiftStats
                await tx.payment.create({
                    data: {
                        modeId: 'WALLET',
                        amount: charges.finalTotal,
                        referenceType: 'order',
                        referenceId: order.id,
                        shiftId: order.shiftId,
                    }
                });

                // Track wallet payment in stats (overview cards)
                await tx.shiftStats.update({
                    where: { shiftId: order.shiftId },
                    data: { paymentsWallet: { increment: charges.finalTotal } },
                });
            }

            // Update ShiftStats Revenue (Section 11)
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

        // Realtime, Audit & Receipt
        broadcast('order.approved', result);
        await AuditService.log('Order', order.id, 'APPROVE', userId, order, result);
        await ReceiptService.createSnapshot('order', id);

        res.json(result);
    } catch (error: any) {
        logger.error(error, 'Error approving order');
        if (error?.statusCode) return res.status(error.statusCode as number).json({ error: error.message as string });
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getOrder = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: { include: { product: true } }, orderCharge: true },
        });

        if (order) {
            order.items = await Promise.all(order.items.map(async (item: any) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
        }

        res.json(order);
    } catch (error) {
        logger.error(error, 'Error fetching order');
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateOrder = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { status, type } = req.body;
    const userId = req.user.userId;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true, orderCharge: true }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const result = await prisma.$transaction(async (tx) => {
            // If transition to cancelled from approved, revert everything
            if (status === 'cancelled' && order.status === 'approved') {
                // 1. Revert stock
                for (const item of order.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: { increment: item.qty } },
                    });
                    await tx.stockMovement.create({
                        data: { productId: item.productId, qty: item.qty, type: 'add', reference: `order_${order.id}_cancel` },
                    });
                }

                // 2. Revert ShiftStats revenue
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

                    // 3. Revert ALL Payments for this order and update ShiftStats
                    const payments = await tx.payment.findMany({
                        where: { referenceType: 'order', referenceId: id },
                        include: { mode: true }
                    });

                    for (const p of payments) {
                        const modeName = p.mode.name.toUpperCase();
                        const updateData: any = {};
                        if (modeName === 'CASH') updateData.paymentsCash = { decrement: p.amount };
                        else if (modeName === 'WALLET') updateData.paymentsWallet = { decrement: p.amount };
                        else updateData.paymentsCard = { decrement: p.amount };

                        if (Object.keys(updateData).length > 0) {
                            await tx.shiftStats.update({
                                where: { shiftId: order.shiftId },
                                data: updateData,
                            });
                        }
                        await tx.payment.delete({ where: { id: p.id } });
                    }

                    // 4. If owner order, credit wallet back
                    const ownerUserId = (order as any).ownerUserId as string | null;
                    if (order.type === 'owner' && ownerUserId) {
                        await (tx as any).user.update({
                            where: { id: ownerUserId },
                            data: { walletBalance: { increment: charge.finalTotal } },
                        });
                        await (tx as any).walletTransaction.create({
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

        await AuditService.log('Order', id, 'UPDATE', userId, order, result);
        broadcast('order.updated', result);
        res.json(result);
    } catch (error) {
        logger.error(error, 'Error updating order');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateOrderItems = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { items, type, ownerUserId } = req.body;
    const userId = req.user.userId;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true, orderCharge: true }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.status === 'approved' && order.type === 'regular') {
            const payments = await prisma.payment.count({ where: { referenceType: 'order', referenceId: id } });
            if (payments > 0) return res.status(400).json({ error: 'Cannot edit items of a paid walk-in order' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const discountAmount = order.orderCharge?.discount || 0;
            const tip = order.orderCharge?.tip || 0;

            // 1. Revert previous state if approved
            if (order.status === 'approved') {
                // Revert stock
                for (const item of order.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: { increment: item.qty } }
                    });
                    await tx.stockMovement.create({
                        data: { productId: item.productId, qty: item.qty, type: 'add', reference: `order_${order.id}_edit_revert` }
                    });
                }

                // Revert owner wallet if it was an owner order
                if (order.type === 'owner' && (order as any).ownerUserId) {
                    const oldCharge = order.orderCharge!;
                    await (tx as any).user.update({
                        where: { id: (order as any).ownerUserId },
                        data: { walletBalance: { increment: oldCharge.finalTotal } }
                    });
                    await (tx as any).walletTransaction.create({
                        data: {
                            userId: (order as any).ownerUserId,
                            amount: oldCharge.finalTotal,
                            note: `Order #${order.id.slice(0, 8)} edit revert`,
                            orderId: order.id,
                            shiftId: order.shiftId
                        }
                    });

                    // Revert ALL Payments for this order and update ShiftStats
                    const payments = await tx.payment.findMany({
                        where: { referenceType: 'order', referenceId: id },
                        include: { mode: true }
                    });

                    for (const p of payments) {
                        const modeName = p.mode.name.toUpperCase();
                        const updateData: any = {};
                        if (modeName === 'CASH') updateData.paymentsCash = { decrement: p.amount };
                        else if (modeName === 'WALLET') updateData.paymentsWallet = { decrement: p.amount };
                        else updateData.paymentsCard = { decrement: p.amount };

                        if (Object.keys(updateData).length > 0) {
                            await tx.shiftStats.update({
                                where: { shiftId: order.shiftId },
                                data: updateData,
                            });
                        }
                        await tx.payment.delete({ where: { id: p.id } });
                    }
                }

                // Revert ShiftStats Revenue
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

            // 2. Update Order items & basic info
            await tx.orderItem.deleteMany({ where: { orderId: id } });
            if (!items || items.length === 0) throw new Error('Order must have at least one item');

            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product) throw new Error(`Product ${item.productId} not found`);

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

                // Apply new stock if approved
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

            // Update Order Type/Owner
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    type: type || order.type,
                    ownerUserId: type === 'owner' ? (ownerUserId || (order as any).ownerUserId) : null,
                }
            });

            // 3. Apply new state if approved
            if (order.status === 'approved') {
                const charges = await BillingService.computeOrderCharge(id, discountAmount, tip, tx);

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

                // Apply new Revenue Stats
                await tx.shiftStats.update({
                    where: { shiftId: order.shiftId },
                    data: {
                        ordersRevenue: { increment: charges.itemsTotal - charges.discount },
                        totalRevenue: { increment: charges.itemsTotal - charges.discount },
                        tipsTotal: { increment: charges.tip },
                    }
                });

                // Apply new Owner Wallet deduction if applicable
                if (updatedOrder.type === 'owner' && (updatedOrder as any).ownerUserId) {
                    await (tx as any).user.update({
                        where: { id: (updatedOrder as any).ownerUserId },
                        data: { walletBalance: { decrement: charges.finalTotal } }
                    });

                    await (tx as any).walletTransaction.create({
                        data: {
                            userId: (updatedOrder as any).ownerUserId,
                            amount: -charges.finalTotal,
                            note: `Order #${order.id.slice(0, 8)} edit application`,
                            orderId: order.id,
                            shiftId: order.shiftId
                        }
                    });

                    // Create Payment record
                    await tx.payment.create({
                        data: {
                            modeId: 'WALLET',
                            amount: charges.finalTotal,
                            referenceType: 'order',
                            referenceId: order.id,
                            shiftId: order.shiftId,
                        }
                    });

                    // Update ShiftStats Wallet
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
            result.items = await Promise.all(result.items.map(async (item: any) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
        }

        await AuditService.log('Order', id, 'UPDATE_ITEMS', userId, order.items, result?.items);
        broadcast('order.updated', result);
        res.json(result);
    } catch (error: any) {
        logger.error(error, 'Error updating order items');
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

/**
 * POST /api/orders/:id/checkout
 * Body: { payments: [{ modeId: string, amount: number }], shiftId: string }
 * Records multiple payments for an order (split payment support).
 */
export const checkoutOrder = async (req: any, res: Response) => {
    const id = req.params.id as string;
    const { payments, shiftId } = req.body;

    if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'payments must be a non-empty array of { modeId, amount }' });
    }

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { orderCharge: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (!order.orderCharge) return res.status(400).json({ error: 'Order has not been charged yet' });

        const createdPayments = await prisma.$transaction(async (tx) => {
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
                if (!mode) throw new Error(`Payment mode ${modeId} not found`);

                const modeName = mode.name.toUpperCase();
                const updateData: any = {};
                if (modeName === 'CASH') updateData.paymentsCash = { increment: amount };
                else if (modeName === 'WALLET') updateData.paymentsWallet = { increment: amount };
                else updateData.paymentsCard = { increment: amount }; // INSTAPAY, CARD, etc. go here

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
    } catch (error) {
        logger.error(error, 'Error processing order checkout');
        res.status(500).json({ error: 'Internal server error' });
    }
};
