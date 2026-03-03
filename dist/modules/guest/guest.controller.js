"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuestOrder = exports.getGuestSession = exports.getPublicReservations = exports.getPublicRoomState = exports.getPublicMenu = exports.getPublicRooms = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const socket_1 = require("../../websocket/socket");
const storage_service_1 = require("../../services/storage.service");
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
        const mappedCategories = await Promise.all(categories.map(async (cat) => {
            const products = await Promise.all(cat.products.map(async (p) => ({
                ...p,
                imageUrl: p.imageUrl ? await storage_service_1.StorageService.getFileUrl(p.imageUrl) : p.imageUrl
            })));
            return { ...cat, products };
        }));
        res.json(mappedCategories);
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
const getPublicReservations = async (req, res) => {
    try {
        const reservations = await prisma_service_1.prisma.reservation.findMany({
            select: {
                id: true,
                roomId: true,
                startTime: true,
                endTime: true,
                status: true,
                room: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                    },
                },
            },
            where: {
                status: {
                    in: ['pending', 'confirmed', 'checked_in']
                }
            },
            orderBy: { startTime: 'desc' },
        });
        res.json(reservations);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching public reservations');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPublicReservations = getPublicReservations;
const getGuestSession = async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await prisma_service_1.prisma.room.findUnique({
            where: { id: roomId },
            include: {
                sessions: {
                    where: { status: 'active' },
                    include: {
                        orders: {
                            where: { status: { not: 'cancelled' } },
                            include: {
                                items: { include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } } },
                                orderCharge: true
                            },
                            orderBy: { createdAt: 'desc' }
                        }
                    },
                    take: 1
                }
            }
        });
        if (!room)
            return res.status(404).json({ error: 'Room not found' });
        const activeSession = room.sessions[0];
        if (!activeSession) {
            return res.status(400).json({ error: 'No active session for this room' });
        }
        const mappedOrders = await Promise.all(activeSession.orders.map(async (order) => {
            const items = await Promise.all(order.items.map(async (item) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await storage_service_1.StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
            return { ...order, items };
        }));
        res.json({ session: { ...activeSession, orders: mappedOrders }, room });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching guest session');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getGuestSession = getGuestSession;
const createGuestOrder = async (req, res) => {
    const roomId = req.params.id;
    const { items, note } = req.body;
    try {
        const session = await prisma_service_1.prisma.session.findFirst({
            where: { roomId, status: 'active' },
            include: { room: true }
        });
        if (!session) {
            return res.status(400).json({ error: 'No active session for this room' });
        }
        const shiftId = session.openedShiftId;
        const createdById = session.openedById; // Attribute to staff who opened the room
        let subtotal = 0;
        const products = await prisma_service_1.prisma.product.findMany({
            where: { id: { in: items.map((i) => i.productId) } }
        });
        const orderItemsData = items.map((item) => {
            const product = products.find(p => p.id === item.productId);
            if (!product)
                throw new Error(`Product ${item.productId} not found`);
            if (product.stockQty < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }
            const total = product.price * item.quantity;
            subtotal += total;
            return {
                productId: item.productId,
                qty: item.quantity,
                unitPrice: product.price,
                total
            };
        });
        const order = await prisma_service_1.prisma.$transaction(async (tx) => {
            const o = await tx.order.create({
                data: {
                    shiftId,
                    sessionId: session.id,
                    roomId,
                    type: 'room',
                    status: 'pending',
                    createdById,
                    items: {
                        create: orderItemsData
                    }
                },
                include: {
                    items: { include: { product: true } },
                    orderCharge: true // Will be null initially
                }
            });
            return o;
        });
        (0, socket_1.emitToRoom)(`room_${roomId}`, 'order_update', order);
        (0, socket_1.broadcast)('order_notification', order); // Notify staff
        res.status(201).json(order);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating guest order');
        res.status(400).json({ error: error.message || 'Error processing order' });
    }
};
exports.createGuestOrder = createGuestOrder;
