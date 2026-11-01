import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { StorageService } from '../../services/storage.service';
import { AuditService } from '../../services/audit.service';
import { buildDateRange } from '../../utils/date-range';
import { sendDbError } from '../../utils/db-errors';

// Categories
export const getCategories = async (req: Request, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            include: { children: true },
        });
        res.json(categories);
    } catch (error) {
        logger.error(error, 'Error fetching categories');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createCategory = async (req: Request, res: Response) => {
    const { name, parentId } = req.body;
    try {
        const category = await prisma.category.create({
            data: { name, parentId },
        });
        res.status(201).json(category);
    } catch (error) {
        logger.error(error, 'Error creating category');
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Products
export const getProducts = async (req: Request, res: Response) => {
    const { page, pageSize, search, categoryId } = req.query;

    try {
        const pageNum = parseInt(page as string) || 1;
        const limit = parseInt(pageSize as string) || 50;

        const where: any = {};
        if (search) {
            where.name = { contains: search as string, mode: 'insensitive' };
        }
        if (categoryId) {
            where.categoryId = categoryId as string;
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: { category: true },
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma.product.count({ where }),
        ]);

        const resProducts = await Promise.all(products.map(async p => ({
            ...p,
            imageUrl: p.imageUrl ? await StorageService.getFileUrl(p.imageUrl) : p.imageUrl
        })));

        res.json({
            data: resProducts,
            total,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        logger.error(error, 'Error fetching products');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    let { name, categoryId, price, cost, stockQty } = req.body;
    const file = req.file;

    const parsedPrice = parseFloat(price as string);
    const parsedCost = parseFloat(cost as string);
    const parsedStock = parseInt((stockQty as string) || '0');
    if (!name || !categoryId || !Number.isFinite(parsedPrice) || !Number.isFinite(parsedCost) || !Number.isInteger(parsedStock)) {
        return res.status(400).json({ error: 'name, categoryId, price, cost and stockQty must be valid' });
    }
    if (parsedPrice < 0 || parsedCost < 0 || parsedStock < 0) {
        return res.status(400).json({ error: 'price, cost and stockQty cannot be negative' });
    }

    try {
        let imageUrl: string | undefined;
        if (file) {
            imageUrl = await StorageService.uploadFile(file);
        }

        const product = await prisma.product.create({
            data: {
                name,
                categoryId,
                price: Math.round(parsedPrice),
                cost: Math.round(parsedCost),
                stockQty: parsedStock,
                imageUrl,
            },
        });
        if (parsedStock > 0) {
            await prisma.stockMovement.create({
                data: { productId: product.id, qty: parsedStock, type: 'add', reference: 'initial_stock' },
            });
        }
        res.status(201).json({
            ...product,
            imageUrl: product.imageUrl ? await StorageService.getFileUrl(product.imageUrl) : product.imageUrl
        });
    } catch (error) {
        logger.error(error, 'Error creating product');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addStock = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { reference, type } = req.body;
    const qty = Number(req.body.qty);

    if (!Number.isInteger(qty) || qty === 0) {
        return res.status(400).json({ error: 'qty must be a non-zero integer' });
    }

    // 'deduct' always removes stock; any other type applies the signed quantity as given.
    const delta = type === 'deduct' ? -Math.abs(qty) : qty;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const current = await tx.product.findUnique({ where: { id }, select: { stockQty: true } });
            if (!current) return null;
            if (current.stockQty + delta < 0) throw new Error('INSUFFICIENT_STOCK');

            const product = await tx.product.update({
                where: { id },
                data: { stockQty: { increment: delta } },
            });

            await tx.stockMovement.create({
                data: {
                    productId: id,
                    qty: delta,
                    type: typeof type === 'string' && type ? type : 'add',
                    reference: reference || 'manual_adjustment',
                },
            });

            return product;
        });

        if (!result) return res.status(404).json({ error: 'Product not found' });
        res.json(result);
    } catch (error: any) {
        if (error?.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ error: 'Stock cannot go below zero' });
        }
        sendDbError(res, error, 'Error adding stock', 'product');
    }
};

export const resetStock = async (req: any, res: Response) => {
    const { productIds, categoryId, quantity } = req.body;
    const target = quantity === undefined ? 0 : parseInt(quantity);

    if (!Number.isInteger(target) || target < 0) {
        return res.status(400).json({ error: 'quantity must be a non-negative integer' });
    }

    try {
        const where: any = {};
        if (Array.isArray(productIds)) {
            // An explicit but empty selection must never fall through to "everything".
            if (productIds.length === 0) return res.status(400).json({ error: 'productIds cannot be empty' });
            where.id = { in: productIds };
        }
        if (categoryId) where.categoryId = categoryId;

        const count = await prisma.$transaction(async (tx) => {
            const products = await tx.product.findMany({ where, select: { id: true, stockQty: true } });
            const changed = products.filter(p => p.stockQty !== target);

            for (const p of changed) {
                await tx.product.update({ where: { id: p.id }, data: { stockQty: target } });
                await tx.stockMovement.create({
                    data: {
                        productId: p.id,
                        qty: target - p.stockQty,
                        type: 'reset',
                        reference: `admin_reset_to_${target}`,
                    },
                });
            }
            return changed.length;
        });

        await AuditService.log('Product', categoryId || 'ALL', 'RESET_STOCK', req.user.userId, null, { productIds, categoryId, quantity: target, count });
        res.json({ updated: count, quantity: target });
    } catch (error) {
        logger.error(error, 'Error resetting stock');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { name, categoryId, price, cost, stockQty } = req.body;
    const file = req.file;

    try {
        const existingProduct = await prisma.product.findUnique({ where: { id } });
        if (!existingProduct) return res.status(404).json({ error: 'Product not found' });

        let imageUrl = existingProduct.imageUrl;
        if (file) {
            // Delete old image if it exists
            if (imageUrl) {
                await StorageService.deleteFile(imageUrl);
            }
            imageUrl = await StorageService.uploadFile(file);
        }

        const updateData: any = {
            name,
            categoryId,
            price: price ? Math.round(parseFloat(price as string)) : undefined,
            cost: cost ? Math.round(parseFloat(cost as string)) : undefined,
            stockQty: stockQty !== undefined ? parseInt(stockQty as string) : undefined,
            imageUrl,
        };

        const newStock = updateData.stockQty;
        if (newStock !== undefined && (!Number.isInteger(newStock) || newStock < 0)) {
            return res.status(400).json({ error: 'stockQty must be a non-negative integer' });
        }
        for (const key of ['price', 'cost'] as const) {
            if (updateData[key] !== undefined && (!Number.isFinite(updateData[key]) || updateData[key] < 0)) {
                return res.status(400).json({ error: `${key} must be a non-negative number` });
            }
        }

        const product = await prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({ where: { id }, data: updateData });
            // Keep the inventory log complete when stock is edited directly.
            if (newStock !== undefined && newStock !== existingProduct.stockQty) {
                await tx.stockMovement.create({
                    data: {
                        productId: id,
                        qty: newStock - existingProduct.stockQty,
                        type: 'adjustment',
                        reference: 'manual_edit',
                    },
                });
            }
            return updated;
        });
        res.json({
            ...product,
            imageUrl: product.imageUrl ? await StorageService.getFileUrl(product.imageUrl) : product.imageUrl
        });
    } catch (error) {
        logger.error(error, 'Error updating product');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getStockMovements = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;
        const { startDate, endDate, productId, type } = req.query;

        const where: any = {};
        const range = buildDateRange(startDate, endDate);
        if (range) where.createdAt = range;
        if (typeof productId === 'string' && productId) where.productId = productId;
        if (typeof type === 'string' && type) where.type = type;

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                include: { product: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.stockMovement.count({ where })
        ]);

        res.json({
            data: movements,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        logger.error(error, 'Error fetching stock movements');
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const sold = await prisma.orderItem.count({ where: { productId: id } });
        if (sold > 0) {
            return res.status(409).json({ error: 'Cannot delete a product that has sales history' });
        }
        // Stock movements are only audit rows for this product; remove them with it.
        await prisma.$transaction([
            prisma.stockMovement.deleteMany({ where: { productId: id } }),
            prisma.product.delete({ where: { id } }),
        ]);
        res.status(204).send();
    } catch (error) {
        sendDbError(res, error, 'Error deleting product', 'product');
    }
};

export const deleteCategory = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const [products, children] = await Promise.all([
            prisma.product.count({ where: { categoryId: id } }),
            prisma.category.count({ where: { parentId: id } }),
        ]);
        if (products > 0 || children > 0) {
            return res.status(409).json({ error: 'Category still has products or sub-categories. Reassign them first.' });
        }
        await prisma.category.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        sendDbError(res, error, 'Error deleting category', 'category');
    }
};
