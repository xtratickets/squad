"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProduct = exports.addStock = exports.createProduct = exports.getProducts = exports.createCategory = exports.getCategories = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
// Categories
const getCategories = async (req, res) => {
    try {
        const categories = await prisma_service_1.prisma.category.findMany({
            include: { children: true },
        });
        res.json(categories);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching categories');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    const { name, parentId } = req.body;
    try {
        const category = await prisma_service_1.prisma.category.create({
            data: { name, parentId },
        });
        res.status(201).json(category);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating category');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createCategory = createCategory;
// Products
const getProducts = async (req, res) => {
    try {
        const products = await prisma_service_1.prisma.product.findMany({
            include: { category: true },
        });
        res.json(products);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching products');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getProducts = getProducts;
const createProduct = async (req, res) => {
    const { name, categoryId, price, cost, stockQty } = req.body;
    try {
        const product = await prisma_service_1.prisma.product.create({
            data: { name, categoryId, price, cost, stockQty },
        });
        res.status(201).json(product);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating product');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createProduct = createProduct;
const addStock = async (req, res) => {
    const id = req.params.id;
    const { qty, reference } = req.body;
    try {
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const product = await tx.product.update({
                where: { id },
                data: { stockQty: { increment: qty } },
            });
            await tx.stockMovement.create({
                data: {
                    productId: id,
                    qty,
                    type: 'add',
                    reference: reference || 'manual_adjustment',
                },
            });
            return product;
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error adding stock');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.addStock = addStock;
const updateProduct = async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    try {
        const product = await prisma_service_1.prisma.product.update({
            where: { id },
            data,
        });
        res.json(product);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating product');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateProduct = updateProduct;
