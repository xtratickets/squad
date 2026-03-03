import { Router } from 'express';
import * as promoController from './promocode.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, promoController.getPromoCodes);
router.post('/', authenticate, authorize(['ADMIN']), promoController.createPromoCode);
router.patch('/:id', authenticate, authorize(['ADMIN']), promoController.updatePromoCode);
router.get('/:code', authenticate, promoController.validatePromoCode);
router.delete('/:id', authenticate, authorize(['ADMIN']), promoController.deletePromoCode);

export default router;
