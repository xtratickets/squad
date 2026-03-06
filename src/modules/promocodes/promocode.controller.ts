import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const createPromoCode = async (req: Request, res: Response) => {
    const { code, type, value, expiry, usageLimit, applyTo } = req.body;
    try {
        const promo = await prisma.promoCode.create({
            data: {
                code,
                type,
                value,
                expiry: expiry ? new Date(expiry) : null,
                usageLimit,
                applyTo: applyTo ?? 'both',
            } as any,
        });
        res.status(201).json(promo);
    } catch (error) {
        logger.error(error, 'Error creating promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const validatePromoCode = async (req: Request, res: Response) => {
    const code = req.params.code as string;
    try {
        const promo = await prisma.promoCode.findUnique({
            where: { code },
        });

        if (!promo || !promo.active) {
            return res.status(404).json({ error: 'Promo code not found or inactive' });
        }

        if (promo.expiry && promo.expiry < new Date()) {
            return res.status(400).json({ error: 'Promo code expired' });
        }

        if (promo.usageLimit !== null && promo.usageLimit <= 0) {
            return res.status(400).json({ error: 'Promo code usage limit reached' });
        }

        res.json(promo);
    } catch (error) {
        logger.error(error, 'Error validating promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPromoCodes = async (req: Request, res: Response) => {
    try {
        const promos = await prisma.promoCode.findMany();
        res.json(promos);
    } catch (error) {
        logger.error(error, 'Error fetching promocodes');
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deletePromoCode = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.promoCode.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updatePromoCode = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { code, type, value, expiry, usageLimit, applyTo, active } = req.body;
    try {
        const updated = await prisma.promoCode.update({
            where: { id },
            data: {
                ...(code !== undefined ? { code } : {}),
                ...(type !== undefined ? { type } : {}),
                ...(value !== undefined ? { value: Math.round(parseFloat(value)) } : {}),
                ...(expiry !== undefined ? { expiry: expiry ? new Date(expiry) : null } : {}),
                ...(usageLimit !== undefined ? { usageLimit: parseInt(usageLimit) } : {}),
                ...(applyTo !== undefined ? { applyTo } : {}),
                ...(active !== undefined ? { active } : {}),
            } as any,
        });
        res.json(updated);
    } catch (error) {
        logger.error(error, 'Error updating promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
