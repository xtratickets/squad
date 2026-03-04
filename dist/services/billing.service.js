"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const prisma_service_1 = require("./prisma.service");
class BillingService {
    static async computeSessionCharge(sessionId, endTime, discountAmount = 0, tip = 0) {
        const session = await prisma_service_1.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                room: true,
                orders: {
                    include: {
                        orderCharge: true,
                    },
                    where: {
                        status: 'approved',
                    },
                },
            },
        });
        if (!session)
            throw new Error('Session not found');
        const isOwnerSession = session.orders.some(o => o.type === 'owner');
        const durationMs = endTime.getTime() - session.startTime.getTime();
        let totalPausedMs = session.totalPausedMs || 0;
        if (session.isPaused && session.lastPausedAt) {
            totalPausedMs += endTime.getTime() - new Date(session.lastPausedAt).getTime();
        }
        const billableMs = Math.max(0, durationMs - totalPausedMs);
        const billableMinutes = Math.max(Math.ceil(billableMs / 60000), session.room.minMinutes);
        const roomAmount = (billableMinutes / 60) * session.room.pricePerHour;
        const ownerOrders = session.orders.filter(o => o.type === 'owner');
        const regularOrders = session.orders.filter(o => o.type !== 'owner');
        const ownerOrdersAmount = ownerOrders.reduce((sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)), 0);
        const regularOrdersAmount = regularOrders.reduce((sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)), 0);
        const feeConfig = await prisma_service_1.prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });
        const subtotal = roomAmount + regularOrdersAmount + ownerOrdersAmount;
        const discount = Math.min(discountAmount, subtotal);
        const discountedSubtotal = subtotal - discount;
        const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
        const discountedRoomAmount = roomAmount * discountFactor;
        const discountedRegularOrdersAmount = regularOrdersAmount * discountFactor;
        const discountedOwnerOrdersAmount = ownerOrdersAmount * discountFactor;
        let roomFeePercent = isOwnerSession ? (feeConfig?.ownerServiceFeePercent || 0) : (feeConfig?.roomServiceFeePercent || 0);
        let orderFeePercent = feeConfig?.orderServiceFeePercent || 0;
        let ownerFeePercent = feeConfig?.ownerServiceFeePercent || 0;
        const roomServiceFee = (discountedRoomAmount * roomFeePercent) / 100;
        const regularOrdersServiceFee = (discountedRegularOrdersAmount * orderFeePercent) / 100;
        const ownerOrdersServiceFee = (discountedOwnerOrdersAmount * ownerFeePercent) / 100;
        const serviceFee = roomServiceFee + regularOrdersServiceFee + ownerOrdersServiceFee;
        const tax = (discountedSubtotal * (feeConfig?.taxPercent || 0)) / 100;
        const finalTotal = discountedSubtotal + serviceFee + tax + tip;
        const durationMinutes = Math.ceil(billableMs / 60000);
        return {
            durationMinutes,
            billableMinutes,
            hourlyPrice: session.room.pricePerHour,
            roomAmount,
            ordersAmount: regularOrdersAmount + ownerOrdersAmount,
            discount,
            serviceFee,
            tax,
            tip,
            finalTotal,
        };
    }
    static async computeOrderCharge(orderId, discountAmount = 0, tip = 0) {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id: orderId }
        });
        if (!order)
            throw new Error('Order not found');
        const orderItems = await prisma_service_1.prisma.orderItem.findMany({
            where: { orderId },
        });
        const itemsTotal = orderItems.reduce((sum, item) => sum + item.total, 0);
        const feeConfig = await prisma_service_1.prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });
        const discount = Math.min(discountAmount, itemsTotal);
        const discountedTotal = itemsTotal - discount;
        let feePercent = 0;
        if (order.type === 'owner') {
            feePercent = feeConfig?.ownerServiceFeePercent || 0;
        }
        else if (order.type === 'regular') {
            feePercent = feeConfig?.walkInServiceFeePercent || 0;
        }
        else {
            feePercent = feeConfig?.orderServiceFeePercent || 0;
        }
        const serviceFee = (discountedTotal * feePercent) / 100;
        const tax = (discountedTotal * (feeConfig?.taxPercent || 0)) / 100;
        const finalTotal = discountedTotal + serviceFee + tax + tip;
        return {
            itemsTotal,
            discount,
            serviceFee,
            tax,
            tip,
            finalTotal,
        };
    }
}
exports.BillingService = BillingService;
