import { Router } from 'express';
import * as orderController from './order.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, orderController.getOrders);
router.post('/', authenticate, orderController.createOrder);
router.post('/:id/approve', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), orderController.approveOrder);
router.post('/:id/checkout', authenticate, orderController.checkoutOrder);
router.patch('/:id', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), orderController.updateOrder);
router.patch('/:id/items', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), orderController.updateOrderItems);
router.get('/:id', authenticate, orderController.getOrder);

export default router;

