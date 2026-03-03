import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../services/prisma.service';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true },
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role.name },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: { id: user.role.id, name: user.role.name },
            },
        });
    } catch (error) {
        logger.error(error, 'Login error');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getMe = async (req: any, res: Response) => {
    res.json({ user: req.user });
};
