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
    const {
        roomServiceFeePercent,
        orderServiceFeePercent,
        walkInServiceFeePercent,
        ownerServiceFeePercent,
        taxPercent
    } = req.body;
    try {
        const config = await (prisma as any).feeConfig.update({
            where: { id: 'default' },
            data: {
                roomServiceFeePercent,
                orderServiceFeePercent,
                walkInServiceFeePercent,
                ownerServiceFeePercent,
                taxPercent
            },
        });
        res.json(config);
    } catch (error) {
        logger.error(error, 'Error updating fee config');
        res.status(500).json({ error: 'Internal server error' });
    }
};
