import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const getPaymentModes = async (req: Request, res: Response) => {
    try {
        const modes = await prisma.paymentMode.findMany();
        res.json(modes);
    } catch (error) {
        logger.error(error, 'Error fetching payment modes');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createPaymentMode = async (req: Request, res: Response) => {
    const { name, active, allowSplit } = req.body;
    try {
        const mode = await prisma.paymentMode.create({
            data: { name, active, allowSplit },
        });
        res.status(201).json(mode);
    } catch (error) {
        logger.error(error, 'Error creating payment mode');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updatePaymentMode = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = req.body;
    try {
        const mode = await prisma.paymentMode.update({
            where: { id },
            data,
        });
        res.json(mode);
    } catch (error) {
        logger.error(error, 'Error updating payment mode');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deletePaymentMode = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.paymentMode.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting payment mode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
