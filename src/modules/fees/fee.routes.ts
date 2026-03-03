import { Router } from 'express';
import * as feeController from './fee.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, feeController.getFeeConfig);
router.patch('/', authenticate, authorize(['ADMIN']), feeController.updateFeeConfig);

export default router;
