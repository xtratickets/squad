import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { broadcast } from '../../websocket/socket';

export const createReservation = async (req: any, res: Response) => {
    const { roomId, startTime, endTime, guestName, guestPhone, note } = req.body;
    const createdById: string | undefined = req.user?.userId;
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;

    try {
        // ── Overlap Check ──────────────────────────────────────────────────
        // Treat open-timed reservations (no endTime) as occupying from startTime to forever.
        // A conflict exists when:
        //   (A) existing starts before new ends AND existing ends (or is open) after new starts
        const conflictConditions: any[] = [
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

        const existing = await prisma.reservation.findFirst({
            where: {
                roomId,
                status: { in: ['pending', 'confirmed', 'checked_in'] },
                OR: conflictConditions,
            },
        });

        if (existing) {
            return res.status(400).json({ error: 'Room has an overlapping reservation for this time slot' });
        }

        const reservation = await (prisma.reservation as any).create({
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

        broadcast('reservation_update', reservation);
        res.status(201).json(reservation);
    } catch (error) {
        logger.error(error, 'Error creating reservation');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getReservations = async (req: Request, res: Response) => {
    try {
        const reservations = await prisma.reservation.findMany({
            include: { room: true, createdBy: true },
            orderBy: { startTime: 'desc' },
        });
        res.json(reservations);
    } catch (error) {
        logger.error(error, 'Error fetching reservations');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PATCH /api/reservations/:id/status
 * Body: { status: 'confirmed' | 'cancelled' | 'checked_in' }
 * Approves or cancels a reservation and emits reservation_update.
 */
export const updateReservationStatus = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status } = req.body;

    const allowed = ['confirmed', 'cancelled', 'checked_in'];
    if (!status || !allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    try {
        const existing = await prisma.reservation.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Reservation not found' });

        const updated = await prisma.reservation.update({
            where: { id },
            data: { status },
            include: { room: true },
        });

        broadcast('reservation_update', updated);
        res.json(updated);
    } catch (error) {
        logger.error(error, 'Error updating reservation status');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteReservation = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.reservation.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting reservation');
        res.status(500).json({ error: 'Internal server error' });
    }
};
