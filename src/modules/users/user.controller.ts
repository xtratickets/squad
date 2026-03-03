import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const getUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                include: { role: true },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { username: 'asc' }, // Ensure consistent pagination order
            }),
            prisma.user.count()
        ]);

        res.json({
            data: users,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        logger.error(error, 'Error fetching users');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    const { username, password, roleId } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                roleId,
            },
            include: { role: true },
        });

        // @ts-ignore
        delete user.password;
        res.status(201).json(user);
    } catch (error) {
        logger.error(error, 'Error creating user');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { username, password, roleId } = req.body;

    try {
        const data: any = {};
        if (username) data.username = username;
        if (roleId) data.roleId = roleId;
        if (password) data.password = await bcrypt.hash(password, 10);

        const user = await prisma.user.update({
            where: { id },
            data,
            include: { role: true },
        });

        // @ts-ignore
        delete user.password;
        res.json(user);
    } catch (error) {
        logger.error(error, 'Error updating user');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany();
        res.json(roles);
    } catch (error) {
        logger.error(error, 'Error fetching roles');
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteUser = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        await prisma.user.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting user');
        res.status(500).json({ error: 'Internal server error' });
    }
};
// For selection lists (e.g. owners), returns simplified objects
export const getUsersList = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                role: {
                    name: 'OWNER'
                }
            },
            select: {
                id: true,
                username: true,
                walletBalance: true,
            },
            orderBy: { username: 'asc' }
        });
        res.json(users);
    } catch (error) {
        logger.error(error, 'Error fetching users list');
        res.status(500).json({ error: 'Internal server error' });
    }
};
