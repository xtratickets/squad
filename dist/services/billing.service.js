"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const prisma_service_1 = require("./prisma.service");
class BillingService {
    static round(val) {
        return Math.round(val * 100) / 100;
    }
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
        const roomAmount = this.round((billableMinutes / 60) * session.room.pricePerHour);
        const ownerOrders = session.orders.filter(o => o.type === 'owner');
        const regularOrders = session.orders.filter(o => o.type !== 'owner');
        const ownerOrdersAmount = ownerOrders.reduce((sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)), 0);
        const regularOrdersAmount = regularOrders.reduce((sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)), 0);
        const feeConfig = await prisma_service_1.prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });
        const subtotal = this.round(roomAmount + regularOrdersAmount + ownerOrdersAmount);
        const discount = this.round(Math.min(discountAmount, subtotal));
        const discountedSubtotal = this.round(subtotal - discount);
        const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
        const discountedRoomAmount = roomAmount * discountFactor;
        const discountedRegularOrdersAmount = regularOrdersAmount * discountFactor;
        const discountedOwnerOrdersAmount = ownerOrdersAmount * discountFactor;
        let roomFeePercent = isOwnerSession ? (feeConfig?.ownerServiceFeePercent || 0) : (feeConfig?.roomServiceFeePercent || 0);
        let orderFeePercent = feeConfig?.orderServiceFeePercent || 0;
        let ownerFeePercent = feeConfig?.ownerServiceFeePercent || 0;
        const roomServiceFee = this.round((discountedRoomAmount * roomFeePercent) / 100);
        const regularOrdersServiceFee = this.round((discountedRegularOrdersAmount * orderFeePercent) / 100);
        const ownerOrdersServiceFee = this.round((discountedOwnerOrdersAmount * ownerFeePercent) / 100);
        const serviceFee = this.round(roomServiceFee + regularOrdersServiceFee + ownerOrdersServiceFee);
        const tax = this.round((discountedSubtotal * (feeConfig?.taxPercent || 0)) / 100);
        const finalTotal = this.round(discountedSubtotal + serviceFee + tax + tip);
        const durationMinutes = Math.ceil(billableMs / 60000);
        return {
            durationMinutes,
            billableMinutes,
            hourlyPrice: session.room.pricePerHour,
            roomAmount,
            ordersAmount: this.round(regularOrdersAmount + ownerOrdersAmount),
            discount,
            serviceFee,
            tax,
            tip: this.round(tip),
            finalTotal,
        };
    }
    static async computeOrderCharge(orderId, discountAmount = 0, tip = 0, tx = prisma_service_1.prisma) {
        const order = await tx.order.findUnique({
            where: { id: orderId }
        });
        if (!order)
            throw new Error('Order not found');
        const orderItems = await tx.orderItem.findMany({
            where: { orderId },
        });
        const itemsTotal = this.round(orderItems.reduce((sum, item) => sum + item.total, 0));
        const feeConfig = await tx.feeConfig.findUnique({
            where: { id: 'default' },
        });
        const discount = this.round(Math.min(discountAmount, itemsTotal));
        const discountedTotal = this.round(itemsTotal - discount);
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
        const serviceFee = this.round((discountedTotal * feePercent) / 100);
        const tax = this.round((discountedTotal * (feeConfig?.taxPercent || 0)) / 100);
        const finalTotal = this.round(discountedTotal + serviceFee + tax + tip);
        return {
            itemsTotal,
            discount,
            serviceFee,
            tax,
            tip: this.round(tip),
            finalTotal,
        };
    }
}
exports.BillingService = BillingService;
