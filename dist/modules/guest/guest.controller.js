"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicRoomState = exports.getPublicMenu = exports.getPublicRooms = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getPublicRooms = async (req, res) => {
    try {
        const rooms = await prisma_service_1.prisma.room.findMany({
            select: { id: true, name: true, category: true, status: true },
        });
        res.json(rooms);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching public rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPublicRooms = getPublicRooms;
const getPublicMenu = async (req, res) => {
    try {
        const categories = await prisma_service_1.prisma.category.findMany({
            include: { products: { where: { stockQty: { gt: 0 } } } },
        });
        res.json(categories);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching public menu');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPublicMenu = getPublicMenu;
const getPublicRoomState = async (req, res) => {
    const id = req.params.id;
    try {
        const room = await prisma_service_1.prisma.room.findUnique({
            where: { id },
            select: { id: true, name: true, status: true, category: true },
        });
        if (!room)
            return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching public room state');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPublicRoomState = getPublicRoomState;
