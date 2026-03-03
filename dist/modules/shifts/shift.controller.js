"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShiftStats = exports.closeShift = exports.openShift = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const openShift = async (req, res) => {
    const staffId = req.user.userId;
    const { openingCash } = req.body;
    try {
        // Check if staff already has an open shift
        const openShift = await prisma_service_1.prisma.shift.findFirst({
            where: { staffId, status: 'open' },
        });
        if (openShift) {
            return res.status(400).json({ error: 'Staff already has an open shift' });
        }
        const shift = await prisma_service_1.prisma.$transaction(async (tx) => {
            const s = await tx.shift.create({
                data: {
                    staffId,
                    status: 'open',
                },
            });
            await tx.shiftStats.create({
                data: {
                    shiftId: s.id,
                    openingCash: openingCash || 0,
                },
            });
            return s;
        });
        res.status(201).json(shift);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error opening shift');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.openShift = openShift;
const closeShift = async (req, res) => {
    const { id } = req.params;
    const { cashPhysical } = req.body;
    try {
        const activeSessions = await prisma_service_1.prisma.session.findFirst({
            where: { openedShiftId: id, status: 'active' },
        });
        if (activeSessions) {
            return res.status(400).json({ error: 'Cannot close shift with active sessions' });
        }
        const shift = await prisma_service_1.prisma.$transaction(async (tx) => {
            const s = await tx.shift.update({
                where: { id },
                data: {
                    endTime: new Date(),
                    status: 'closed',
                },
                include: { stats: true }
            });
            if (s.stats && cashPhysical !== undefined) {
                const cashDifference = cashPhysical - s.stats.paymentsCash;
                await tx.shiftStats.update({
                    where: { shiftId: id },
                    data: {
                        cashPhysical,
                        cashDifference
                    }
                });
            }
            return s;
        });
        res.json(shift);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error closing shift');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.closeShift = closeShift;
const getShiftStats = async (req, res) => {
    const id = req.params.id;
    try {
        const stats = await prisma_service_1.prisma.shiftStats.findUnique({
            where: { shiftId: id },
            include: { shift: { include: { staff: { select: { username: true } } } } },
        });
        res.json(stats);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching shift stats');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getShiftStats = getShiftStats;
