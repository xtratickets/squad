"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReservations = exports.createReservation = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const createReservation = async (req, res) => {
    const { roomId, startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;
    try {
        // Overlap Check (Section 7/24)
        const existing = await prisma_service_1.prisma.reservation.findFirst({
            where: {
                roomId,
                status: { in: ['pending', 'confirmed'] },
                OR: [
                    {
                        // New reservation starts during an existing one
                        startTime: { lte: start },
                        endTime: { gte: start },
                    },
                    ...(end ? [{
                            // New reservation ends during an existing one
                            startTime: { lte: end },
                            endTime: { gte: end },
                        },
                        {
                            // New reservation completely covers an existing one
                            startTime: { gte: start },
                            endTime: { lte: end },
                        }] : []),
                ],
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'Room has an overlapping reservation' });
        }
        const reservation = await prisma_service_1.prisma.reservation.create({
            data: {
                roomId,
                startTime: start,
                endTime: end,
                status: 'pending',
            },
        });
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
            include: { room: true },
        });
        res.json(reservations);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching reservations');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getReservations = getReservations;
