"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptService = void 0;
const prisma_service_1 = require("./prisma.service");
const logger_1 = require("../utils/logger");
class ReceiptService {
    static async createSnapshot(type, referenceId) {
        try {
            let snapshotData = {};
            let totalAmount = 0;
            if (type === 'session') {
                const session = await prisma_service_1.prisma.session.findUnique({
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
                if (!session)
                    throw new Error('Session not found');
                snapshotData = session;
                totalAmount = session.sessionCharge?.finalTotal || 0;
            }
            else {
                const order = await prisma_service_1.prisma.order.findUnique({
                    where: { id: referenceId },
                    include: {
                        items: { include: { product: true } },
                        orderCharge: true,
                        room: true,
                    },
                });
                if (!order)
                    throw new Error('Order not found');
                snapshotData = order;
                totalAmount = order.orderCharge?.finalTotal || 0;
            }
            await prisma_service_1.prisma.receiptSnapshot.create({
                data: {
                    type,
                    referenceId,
                    snapshotData: JSON.stringify(snapshotData),
                    totalAmount,
                },
            });
        }
        catch (error) {
            logger_1.logger.error({ error, type, referenceId }, 'Failed to create receipt snapshot');
        }
    }
}
exports.ReceiptService = ReceiptService;
