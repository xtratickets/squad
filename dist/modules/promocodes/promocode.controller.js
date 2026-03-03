"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromoCodes = exports.validatePromoCode = exports.createPromoCode = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const createPromoCode = async (req, res) => {
    const { code, type, value, expiry, usageLimit } = req.body;
    try {
        const promo = await prisma_service_1.prisma.promoCode.create({
            data: {
                code,
                type,
                value,
                expiry: expiry ? new Date(expiry) : null,
                usageLimit,
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
