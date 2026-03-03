"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReservation = exports.updateReservationStatus = exports.getReservations = exports.createReservation = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const socket_1 = require("../../websocket/socket");
const createReservation = async (req, res) => {
    const { roomId, startTime, endTime, guestName, guestPhone, note } = req.body;
    const createdById = req.user?.userId;
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;
    try {
        // ── Overlap Check ──────────────────────────────────────────────────
        // Treat open-timed reservations (no endTime) as occupying from startTime to forever.
        // A conflict exists when:
        //   (A) existing starts before new ends AND existing ends (or is open) after new starts
        const conflictConditions = [
            // Existing has endTime and its window overlaps the new slot
            {
                AND: [
                    { endTime: { not: null } },
                    { startTime: { lt: end ?? new Date('2100-01-01') } },
                    { endTime: { gt: start } },
                ],
            },
            // Existing is open-timed (no endTime): it starts before the new reservation ends
            {
                AND: [
                    { endTime: null },
                    { startTime: { lt: end ?? new Date('2100-01-01') } },
                ],
            },
        ];
        const existing = await prisma_service_1.prisma.reservation.findFirst({
            where: {
                roomId,
                status: { in: ['pending', 'confirmed', 'checked_in'] },
                OR: conflictConditions,
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'Room has an overlapping reservation for this time slot' });
        }
        const reservation = await prisma_service_1.prisma.reservation.create({
            data: {
                roomId,
                startTime: start,
                endTime: end,
                status: 'pending',
                ...(guestName ? { guestName } : {}),
                ...(guestPhone ? { guestPhone } : {}),
                ...(note ? { note } : {}),
                ...(createdById ? { createdById } : {}),
            },
            include: { room: true },
        });
        (0, socket_1.broadcast)('reservation_update', reservation);
        res.status(201).json(reservation);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating reservation');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createReservation = createReservation;
const getReservations = async (req, res) => {
    try {
        const reservations = await prisma_service_1.prisma.reservation.findMany({
            include: { room: true, createdBy: true },
            orderBy: { startTime: 'desc' },
        });
        res.json(reservations);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching reservations');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getReservations = getReservations;
/**
 * PATCH /api/reservations/:id/status
 * Body: { status: 'confirmed' | 'cancelled' | 'checked_in' }
 * Approves or cancels a reservation and emits reservation_update.
 */
const updateReservationStatus = async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const allowed = ['confirmed', 'cancelled', 'checked_in'];
    if (!status || !allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    try {
        const existing = await prisma_service_1.prisma.reservation.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Reservation not found' });
        const updated = await prisma_service_1.prisma.reservation.update({
            where: { id },
            data: { status },
            include: { room: true },
        });
        (0, socket_1.broadcast)('reservation_update', updated);
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating reservation status');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateReservationStatus = updateReservationStatus;
const deleteReservation = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.reservation.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting reservation');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteReservation = deleteReservation;
