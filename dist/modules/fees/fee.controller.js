"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFeeConfig = exports.getFeeConfig = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getFeeConfig = async (req, res) => {
    try {
        const config = await prisma_service_1.prisma.feeConfig.findUnique({
            where: { id: 'default' },
        });
        res.json(config);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching fee config');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getFeeConfig = getFeeConfig;
const updateFeeConfig = async (req, res) => {
    const { roomServiceFeePercent, orderServiceFeePercent, walkInServiceFeePercent, ownerServiceFeePercent, taxPercent } = req.body;
    try {
        const config = await prisma_service_1.prisma.feeConfig.update({
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
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating fee config');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateFeeConfig = updateFeeConfig;
