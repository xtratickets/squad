import { Router } from 'express';
import * as walletController from './wallet.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/:userId', authenticate, walletController.getWallet);
router.post('/:userId/topup', authenticate, authorize(['ADMIN', 'OPERATION']), walletController.topUpWallet);

export default router;
