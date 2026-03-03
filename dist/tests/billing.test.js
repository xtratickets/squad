"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const billing_service_1 = require("../services/billing.service");
const prisma_service_1 = require("../services/prisma.service");
// Manually mock the prisma service
jest.mock('../services/prisma.service', () => ({
    prisma: {
        session: {
            findUnique: jest.fn(),
        },
        order: {
            findUnique: jest.fn(),
        },
        orderItem: {
            findMany: jest.fn(),
        },
        feeConfig: {
            findUnique: jest.fn(),
        },
    },
}));
describe('BillingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('computeSessionCharge', () => {
        it('should calculate session charge correctly with minimum minutes', async () => {
            const sessionId = 'session-1';
            const startTime = new Date('2026-03-02T10:00:00Z');
            const endTime = new Date('2026-03-02T10:15:00Z'); // 15 mins
            const mockSession = {
                id: sessionId,
                startTime,
                room: {
                    minMinutes: 30,
                    pricePerHour: 100,
                },
                orders: [],
            };
            prisma_service_1.prisma.session.findUnique.mockResolvedValue(mockSession);
            prisma_service_1.prisma.feeConfig.findUnique.mockResolvedValue({
                serviceFeePercent: 10,
                taxPercent: 5,
            });
            const result = await billing_service_1.BillingService.computeSessionCharge(sessionId, endTime);
            expect(result.durationMinutes).toBe(15);
            expect(result.billableMinutes).toBe(30);
            expect(result.roomAmount).toBe(50);
            expect(result.serviceFee).toBe(5);
            expect(result.tax).toBe(2.5);
            expect(result.finalTotal).toBe(57.5);
        });
        it('should calculate session charge correctly with orders (no double tax)', async () => {
            const sessionId = 'session-2';
            const startTime = new Date('2026-03-02T10:00:00Z');
            const endTime = new Date('2026-03-02T11:00:00Z'); // 60 mins
            const mockSession = {
                id: sessionId,
                startTime,
                room: {
                    minMinutes: 30,
                    pricePerHour: 100,
                },
                orders: [
                    {
                        // Order with 200 pre-tax. 
                        // If it was already taxed (say 10% tax = 220 final), 
                        // computeSessionCharge should pick up 200, not 220.
                        orderCharge: { itemsTotal: 200, discount: 0, finalTotal: 220 }
                    }
                ],
            };
            prisma_service_1.prisma.session.findUnique.mockResolvedValue(mockSession);
            prisma_service_1.prisma.feeConfig.findUnique.mockResolvedValue({
                serviceFeePercent: 10,
                taxPercent: 10,
            });
            const result = await billing_service_1.BillingService.computeSessionCharge(sessionId, endTime);
            expect(result.durationMinutes).toBe(60);
            expect(result.roomAmount).toBe(100);
            expect(result.ordersAmount).toBe(200); // Should be 200, not 220
            // subtotal = 100 (room) + 200 (orders) = 300
            // fees/tax (20% total) on 300 = 60
            // finalTotal = 300 + 60 = 360
            expect(result.finalTotal).toBe(360);
        });
        it('should apply discount correctly and cap it at subtotal', async () => {
            const sessionId = 'session-3';
            const startTime = new Date('2026-03-02T10:00:00Z');
            const endTime = new Date('2026-03-02T11:00:00Z'); // 60 mins
            const mockSession = {
                id: sessionId,
                startTime,
                room: {
                    minMinutes: 30,
                    pricePerHour: 100,
                },
                orders: [],
            };
            prisma_service_1.prisma.session.findUnique.mockResolvedValue(mockSession);
            prisma_service_1.prisma.feeConfig.findUnique.mockResolvedValue({ serviceFeePercent: 0, taxPercent: 0 });
            const res1 = await billing_service_1.BillingService.computeSessionCharge(sessionId, endTime, 20);
            expect(res1.discount).toBe(20);
            expect(res1.finalTotal).toBe(80);
            const res2 = await billing_service_1.BillingService.computeSessionCharge(sessionId, endTime, 150);
            expect(res2.discount).toBe(100);
            expect(res2.finalTotal).toBe(0);
        });
    });
    describe('computeOrderCharge', () => {
        it('should calculate order charge correctly', async () => {
            const orderId = 'order-1';
            prisma_service_1.prisma.order.findUnique.mockResolvedValue({ id: orderId });
            prisma_service_1.prisma.orderItem.findMany.mockResolvedValue([
                { total: 50 },
                { total: 100 },
            ]);
            prisma_service_1.prisma.feeConfig.findUnique.mockResolvedValue({
                serviceFeePercent: 10,
                taxPercent: 5,
            });
            const result = await billing_service_1.BillingService.computeOrderCharge(orderId, 10, 5);
            expect(result.itemsTotal).toBe(150);
            expect(result.discount).toBe(10);
            expect(result.finalTotal).toBe(166);
        });
    });
});
