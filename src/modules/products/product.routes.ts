import { Router } from 'express';
import * as productController from './product.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Categories
router.get('/categories', authenticate, productController.getCategories);
router.post('/categories', authenticate, authorize(['ADMIN']), productController.createCategory);
router.delete('/categories/:id', authenticate, authorize(['ADMIN']), productController.deleteCategory);

// Products
router.get('/', authenticate, productController.getProducts);
router.post('/', authenticate, authorize(['ADMIN', 'OPERATION']), upload.single('image'), productController.createProduct);
router.patch('/:id', authenticate, authorize(['ADMIN', 'OPERATION']), upload.single('image'), productController.updateProduct);
router.delete('/:id', authenticate, authorize(['ADMIN', 'OPERATION']), productController.deleteProduct);
router.post('/:id/stock', authenticate, authorize(['ADMIN', 'OPERATION']), productController.addStock);

router.get('/stock-movements', authenticate, productController.getStockMovements);

export default router;
