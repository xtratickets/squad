import { Router } from 'express';
import * as ownerController from './owner.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, ownerController.getOwners);
router.get('/dashboard', authenticate, authorize(['OWNER', 'ADMIN']), ownerController.getOwnerDashboard);
router.post('/:id/pay', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), ownerController.payOwner);

export default router;
