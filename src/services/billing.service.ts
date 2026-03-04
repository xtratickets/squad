import { prisma } from './prisma.service';

export class BillingService {
    static async computeSessionCharge(sessionId: string, endTime: Date, discountAmount: number = 0, tip: number = 0) {
        const session = await prisma.session.findUnique({
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

        if (!session) throw new Error('Session not found');

        // Check if session has any owner orders
        const isOwnerSession = session.orders.some(o => o.type === 'owner');

        const durationMs = endTime.getTime() - session.startTime.getTime();

        // Subtract paused duration in milliseconds for maximum precision
        let totalPausedMs = (session as any).totalPausedMs || 0;
        if ((session as any).isPaused && (session as any).lastPausedAt) {
            totalPausedMs += endTime.getTime() - new Date((session as any).lastPausedAt).getTime();
        }

        const billableMs = Math.max(0, durationMs - totalPausedMs);
        const billableMinutes = Math.max(Math.ceil(billableMs / 60000), session.room.minMinutes);

        // Room amount
        const roomAmount = (billableMinutes / 60) * session.room.pricePerHour;

        // Split orders into owner and non-owner
        const ownerOrders = session.orders.filter(o => o.type === 'owner');
        const regularOrders = session.orders.filter(o => o.type !== 'owner');

        const ownerOrdersAmount = ownerOrders.reduce(
            (sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)),
            0
        );
        const regularOrdersAmount = regularOrders.reduce(
            (sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)),
            0
        );

        // Get fee config
        const feeConfig = await (prisma as any).feeConfig.findUnique({
            where: { id: 'default' },
        });

        // Calculate fees separately
        const subtotal = roomAmount + regularOrdersAmount + ownerOrdersAmount;
        const discount = Math.min(discountAmount, subtotal);
        const discountedSubtotal = subtotal - discount;

        // Ratio for discount allocation (optional, but let's keep it simple and apply percentages to totals)
        // Actually, the user wants separated fees. 
        // If there's a discount, we apply it proportionally or just to the subtotal.
        // Let's apply fees to the full amounts and then maybe adjust? No, usually fees are on discounted amounts.

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

    static async computeOrderCharge(orderId: string, discountAmount: number = 0, tip: number = 0) {
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) throw new Error('Order not found');

        const orderItems = await prisma.orderItem.findMany({
            where: { orderId },
        });

        const itemsTotal = orderItems.reduce((sum, item) => sum + item.total, 0);

        const feeConfig = await (prisma as any).feeConfig.findUnique({
            where: { id: 'default' },
        });

        const discount = Math.min(discountAmount, itemsTotal);
        const discountedTotal = itemsTotal - discount;

        // Determine fee percent based on type
        let feePercent = 0;
        if (order.type === 'owner') {
            feePercent = feeConfig?.ownerServiceFeePercent || 0;
        } else if (order.type === 'regular') {
            feePercent = feeConfig?.walkInServiceFeePercent || 0;
        } else {
            // room order
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
