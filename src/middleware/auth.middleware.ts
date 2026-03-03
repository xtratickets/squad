import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export const authenticate = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        logger.error(error, 'JWT verification failed');
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: any, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Forbidden: Requires one of the following roles: ${roles.join(', ')}`,
            });
        }
        next();
    };
};
