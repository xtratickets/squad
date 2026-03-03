"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.deleteProduct = exports.getStockMovements = exports.updateProduct = exports.addStock = exports.createProduct = exports.getProducts = exports.createCategory = exports.getCategories = void 0;
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const storage_service_1 = require("../../services/storage.service");
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
const getProducts = async (req, res) => {
    const { page, pageSize, search, categoryId } = req.query;
    try {
        const pageNum = parseInt(page) || 1;
        const limit = parseInt(pageSize) || 50;
        const where = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        const [products, total] = await Promise.all([
            prisma_service_1.prisma.product.findMany({
                where,
                include: { category: true },
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma_service_1.prisma.product.count({ where }),
        ]);
        const resProducts = await Promise.all(products.map(async (p) => ({
            ...p,
            imageUrl: p.imageUrl ? await storage_service_1.StorageService.getFileUrl(p.imageUrl) : p.imageUrl
        })));
        res.json({
            data: resProducts,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching products');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getProducts = getProducts;
const createProduct = async (req, res) => {
    let { name, categoryId, price, cost, stockQty } = req.body;
    const file = req.file;
    try {
        let imageUrl;
        if (file) {
            imageUrl = await storage_service_1.StorageService.uploadFile(file);
        }
        const product = await prisma_service_1.prisma.product.create({
            data: {
                name,
                categoryId,
                price: parseFloat(price),
                cost: parseFloat(cost),
                stockQty: parseInt(stockQty || '0'),
                imageUrl,
            },
        });
        res.status(201).json({
            ...product,
            imageUrl: product.imageUrl ? await storage_service_1.StorageService.getFileUrl(product.imageUrl) : product.imageUrl
        });
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
    const { name, categoryId, price, cost, stockQty } = req.body;
    const file = req.file;
    try {
        const existingProduct = await prisma_service_1.prisma.product.findUnique({ where: { id } });
        if (!existingProduct)
            return res.status(404).json({ error: 'Product not found' });
        let imageUrl = existingProduct.imageUrl;
        if (file) {
            if (imageUrl) {
                await storage_service_1.StorageService.deleteFile(imageUrl);
            }
            imageUrl = await storage_service_1.StorageService.uploadFile(file);
        }
        const updateData = {
            name,
            categoryId,
            price: price ? parseFloat(price) : undefined,
            cost: cost ? parseFloat(cost) : undefined,
            stockQty: stockQty !== undefined ? parseInt(stockQty) : undefined,
            imageUrl,
        };
        const product = await prisma_service_1.prisma.product.update({
            where: { id },
            data: updateData,
        });
        res.json({
            ...product,
            imageUrl: product.imageUrl ? await storage_service_1.StorageService.getFileUrl(product.imageUrl) : product.imageUrl
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating product');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateProduct = updateProduct;
const getStockMovements = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const [movements, total] = await Promise.all([
            prisma_service_1.prisma.stockMovement.findMany({
                include: { product: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma_service_1.prisma.stockMovement.count()
        ]);
        res.json({
            data: movements,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching stock movements');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getStockMovements = getStockMovements;
const deleteProduct = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.product.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting product');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteProduct = deleteProduct;
const deleteCategory = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.category.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting category');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteCategory = deleteCategory;
