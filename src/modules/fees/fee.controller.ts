import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const getFeeConfig = async (req: Request, res: Response) => {
    try {
        const config = await prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });
        res.json(config);
    } catch (error) {
        logger.error(error, 'Error fetching fee config');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateFeeConfig = async (req: Request, res: Response) => {
    const { serviceFeePercent, taxPercent } = req.body;
    try {
        const config = await prisma.feeConfig.update({
            where: { id: 'default' },
            data: { serviceFeePercent, taxPercent },
        });
        res.json(config);
    } catch (error) {
        logger.error(error, 'Error updating fee config');
        res.status(500).json({ error: 'Internal server error' });
    }
};
