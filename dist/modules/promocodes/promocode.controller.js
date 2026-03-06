"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePromoCode = exports.deletePromoCode = exports.getPromoCodes = exports.validatePromoCode = exports.createPromoCode = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const createPromoCode = async (req, res) => {
    const { code, type, value, expiry, usageLimit, applyTo } = req.body;
    try {
        const promo = await prisma_service_1.prisma.promoCode.create({
            data: {
                code,
                type,
                value,
                expiry: expiry ? new Date(expiry) : null,
                usageLimit,
                applyTo: applyTo ?? 'both',
            },
        });
        res.status(201).json(promo);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createPromoCode = createPromoCode;
const validatePromoCode = async (req, res) => {
    const code = req.params.code;
    try {
        const promo = await prisma_service_1.prisma.promoCode.findUnique({
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
    }
    catch (error) {
        logger_1.logger.error(error, 'Error validating promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.validatePromoCode = validatePromoCode;
const getPromoCodes = async (req, res) => {
    try {
        const promos = await prisma_service_1.prisma.promoCode.findMany();
        res.json(promos);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching promocodes');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPromoCodes = getPromoCodes;
const deletePromoCode = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.promoCode.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deletePromoCode = deletePromoCode;
const updatePromoCode = async (req, res) => {
    const id = req.params.id;
    const { code, type, value, expiry, usageLimit, applyTo, active } = req.body;
    try {
        const updated = await prisma_service_1.prisma.promoCode.update({
            where: { id },
            data: {
                ...(code !== undefined ? { code } : {}),
                ...(type !== undefined ? { type } : {}),
                ...(value !== undefined ? { value: Math.round(parseFloat(value)) } : {}),
                ...(expiry !== undefined ? { expiry: expiry ? new Date(expiry) : null } : {}),
                ...(usageLimit !== undefined ? { usageLimit: parseInt(usageLimit) } : {}),
                ...(applyTo !== undefined ? { applyTo } : {}),
                ...(active !== undefined ? { active } : {}),
            },
        });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating promocode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePromoCode = updatePromoCode;
