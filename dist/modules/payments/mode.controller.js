"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePaymentMode = exports.updatePaymentMode = exports.createPaymentMode = exports.getPaymentModes = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getPaymentModes = async (req, res) => {
    try {
        const modes = await prisma_service_1.prisma.paymentMode.findMany();
        res.json(modes);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching payment modes');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPaymentModes = getPaymentModes;
const createPaymentMode = async (req, res) => {
    const { name, active, allowSplit } = req.body;
    try {
        const mode = await prisma_service_1.prisma.paymentMode.create({
            data: { name, active, allowSplit },
        });
        res.status(201).json(mode);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating payment mode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createPaymentMode = createPaymentMode;
const updatePaymentMode = async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    try {
        const mode = await prisma_service_1.prisma.paymentMode.update({
            where: { id },
            data,
        });
        res.json(mode);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating payment mode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePaymentMode = updatePaymentMode;
const deletePaymentMode = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.paymentMode.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting payment mode');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deletePaymentMode = deletePaymentMode;
