import { prisma } from './prisma.service';
import { logger } from '../utils/logger';

export class ReceiptService {
    static async createSnapshot(type: 'session' | 'order', referenceId: string) {
        try {
            let snapshotData: any = {};
            let totalAmount = 0;

            if (type === 'session') {
                const session: any = await prisma.session.findUnique({
                    where: { id: referenceId },
                    include: {
                        room: true,
                        sessionCharge: true,
                        orders: {
                            include: {
                                items: { include: { product: true } },
                                orderCharge: true,
                            },
                        },
                    },
                });

                if (!session) throw new Error('Session not found');
                snapshotData = session;
                totalAmount = session.sessionCharge?.finalTotal || 0;
            } else {
                const order: any = await prisma.order.findUnique({
                    where: { id: referenceId },
                    include: {
                        items: { include: { product: true } },
                        orderCharge: true,
                        room: true,
                    },
                });

                if (!order) throw new Error('Order not found');
                snapshotData = order;
                totalAmount = order.orderCharge?.finalTotal || 0;
            }

            await (prisma as any).receiptSnapshot.create({
                data: {
                    type,
                    referenceId,
                    snapshotData: JSON.stringify(snapshotData),
                    totalAmount,
                },
            });
        } catch (error) {
            logger.error({ error, type, referenceId }, 'Failed to create receipt snapshot');
        }
    }
}
