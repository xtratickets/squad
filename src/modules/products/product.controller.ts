import { Request, Response } from 'express';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { StorageService } from '../../services/storage.service';

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
    const { page, pageSize } = req.query;

    try {
        const pageNum = parseInt(page as string) || 1;
        const limit = parseInt(pageSize as string) || 50;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                include: { category: true },
                skip: (pageNum - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma.product.count(),
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

    try {
        let imageUrl: string | undefined;
        if (file) {
            imageUrl = await StorageService.uploadFile(file);
        }

        const product = await prisma.product.create({
            data: {
                name,
                categoryId,
                price: parseFloat(price as string),
                cost: parseFloat(cost as string),
                stockQty: parseInt(stockQty as string || '0'),
                imageUrl,
            },
        });
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
    const { qty, reference } = req.body;

    try {
        const result = await prisma.$transaction(async (tx) => {
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
    } catch (error) {
        logger.error(error, 'Error adding stock');
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
            price: price ? parseFloat(price as string) : undefined,
            cost: cost ? parseFloat(cost as string) : undefined,
            stockQty: stockQty !== undefined ? parseInt(stockQty as string) : undefined,
            imageUrl,
        };

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
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

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                include: { product: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.stockMovement.count()
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
        await prisma.product.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting product');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteCategory = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.category.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        logger.error(error, 'Error deleting category');
        res.status(500).json({ error: 'Internal server error' });
    }
};
