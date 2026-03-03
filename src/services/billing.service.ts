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
                        type: { not: 'owner' },
                    },
                },
            },
        });

        if (!session) throw new Error('Session not found');

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

        // Orders total (pre-tax/fee portion to avoid double taxing when session taxes it again)
        const ordersAmount = session.orders.reduce(
            (sum, order) => sum + ((order.orderCharge?.itemsTotal || 0) - (order.orderCharge?.discount || 0)),
            0
        );

        // Get group fee config
        const feeConfig = await prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });

        const subtotal = roomAmount + ordersAmount;
        const discount = Math.min(discountAmount, subtotal); // Cannot discount more than subtotal
        const discountedSubtotal = subtotal - discount;

        const serviceFee = (discountedSubtotal * (feeConfig?.serviceFeePercent || 0)) / 100;
        const tax = (discountedSubtotal * (feeConfig?.taxPercent || 0)) / 100;

        const finalTotal = discountedSubtotal + serviceFee + tax + tip;

        const durationMinutes = Math.ceil(billableMs / 60000);

        return {
            durationMinutes,
            billableMinutes,
            hourlyPrice: session.room.pricePerHour,
            roomAmount,
            ordersAmount,
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

        const orderItems = await prisma.orderItem.findMany({
            where: { orderId },
        });

        const itemsTotal = orderItems.reduce((sum, item) => sum + item.total, 0);

        const feeConfig = await prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });

        const discount = Math.min(discountAmount, itemsTotal);
        const discountedTotal = itemsTotal - discount;

        const serviceFee = (discountedTotal * (feeConfig?.serviceFeePercent || 0)) / 100;
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
