import { Router } from 'express';
import * as sessionController from './session.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { assignOwnerToSession } from '../owners/owner.controller';

const router = Router();

router.get('/:id', authenticate, sessionController.getSession);
router.post('/start', authenticate, sessionController.startSession);
router.post('/:id/end', authenticate, sessionController.endSession);
router.post('/:id/pause', authenticate, sessionController.pauseSession);
router.post('/:id/resume', authenticate, sessionController.resumeSession);
router.post('/:id/checkout', authenticate, sessionController.checkoutSession);
router.post('/:id/assign-owner', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), assignOwnerToSession);
router.patch('/:id', authenticate, authorize(['OPERATION', 'ADMIN']), sessionController.updateSession);
router.post('/:id/cancel', authenticate, authorize(['OPERATION', 'ADMIN']), sessionController.cancelSession);
router.post('/:id/discount', authenticate, authorize(['OPERATION', 'ADMIN']), sessionController.updateSessionDiscount);

export default router;

