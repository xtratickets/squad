import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { BillingService } from '../../services/billing.service';
import { emitToRoom, broadcast } from '../../websocket/socket';
import { StorageService } from '../../services/storage.service';

export const getPublicRooms = async (req: Request, res: Response) => {
    try {
        const rooms = await prisma.room.findMany({
            select: { id: true, name: true, category: true, status: true },
        });
        res.json(rooms);
    } catch (error) {
        logger.error(error, 'Error fetching public rooms');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPublicMenu = async (req: Request, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            include: { products: { where: { stockQty: { gt: 0 } } } },
        });
        const mappedCategories = await Promise.all(categories.map(async cat => {
            const products = await Promise.all(cat.products.map(async p => ({
                ...p,
                imageUrl: p.imageUrl ? await StorageService.getFileUrl(p.imageUrl) : p.imageUrl
            })));
            return { ...cat, products };
        }));
        res.json(mappedCategories);
    } catch (error) {
        logger.error(error, 'Error fetching public menu');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPublicRoomState = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const room = await prisma.room.findUnique({
            where: { id },
            select: { id: true, name: true, status: true, category: true },
        });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (error) {
        logger.error(error, 'Error fetching public room state');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPublicReservations = async (req: Request, res: Response) => {
    try {
        const reservations = await prisma.reservation.findMany({
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
    } catch (error) {
        logger.error(error, 'Error fetching public reservations');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getGuestSession = async (req: Request, res: Response) => {
    const roomId = req.params.id as string;
    try {
        const room = await prisma.room.findUnique({
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

        if (!room) return res.status(404).json({ error: 'Room not found' });

        const activeSession = room.sessions[0];
        if (!activeSession) {
            return res.status(400).json({ error: 'No active session for this room' });
        }

        const mappedOrders = await Promise.all(activeSession.orders.map(async order => {
            const items = await Promise.all(order.items.map(async (item: any) => {
                if (item.product && item.product.imageUrl) {
                    item.product.imageUrl = await StorageService.getFileUrl(item.product.imageUrl);
                }
                return item;
            }));
            return { ...order, items };
        }));

        res.json({ session: { ...activeSession, orders: mappedOrders }, room });
    } catch (error) {
        logger.error(error, 'Error fetching guest session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createGuestOrder = async (req: Request, res: Response) => {
    const roomId = req.params.id as string;
    const { items, note } = req.body;

    try {
        const session = await prisma.session.findFirst({
            where: { roomId, status: 'active' },
            include: { room: true }
        });

        if (!session) {
            return res.status(400).json({ error: 'No active session for this room' });
        }

        const shiftId = session.openedShiftId;
        const createdById = session.openedById; // Attribute to staff who opened the room

        let subtotal = 0;
        const products = await prisma.product.findMany({
            where: { id: { in: items.map((i: any) => i.productId) } }
        });

        const orderItemsData = items.map((item: any) => {
            const product = products.find(p => p.id === item.productId);
            if (!product) throw new Error(`Product ${item.productId} not found`);
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

        const order = await prisma.$transaction(async (tx) => {
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

        emitToRoom(`room_${roomId}`, 'order_update', order);
        broadcast('order_notification', order); // Notify staff

        res.status(201).json(order);
    } catch (error: any) {
        logger.error(error, 'Error creating guest order');
        res.status(400).json({ error: error.message || 'Error processing order' });
    }
};
