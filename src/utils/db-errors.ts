import { Response } from 'express';
import { logger } from './logger';

/**
 * Maps common Prisma errors to meaningful HTTP responses instead of a blanket 500.
 */
export const sendDbError = (res: Response, error: any, context: string, entity = 'record') => {
    switch (error?.code) {
        case 'P2025':
            return res.status(404).json({ error: `${entity} not found` });
        case 'P2003':
            return res.status(409).json({ error: `Cannot complete: this ${entity} is referenced by other records (history, sessions, orders...).` });
        case 'P2002':
            return res.status(409).json({ error: `A ${entity} with the same value already exists` });
        default:
            logger.error(error, context);
            return res.status(500).json({ error: 'Internal server error' });
    }
};
