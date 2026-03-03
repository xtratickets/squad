import { Router } from 'express';
import * as shiftController from './shift.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.post('/open', authenticate, shiftController.openShift);
router.get('/active', authenticate, shiftController.getActiveShift);
router.post('/:id/close', authenticate, shiftController.closeShift);
router.get('/history', authenticate, shiftController.getShiftHistory);
router.get('/:id/stats', authenticate, shiftController.getShiftStats);
router.get('/all', authenticate, authorize(['OPERATION', 'ADMIN']), shiftController.getAllShifts);
router.get('/', authenticate, authorize(['ADMIN', 'OPERATION']), shiftController.getShifts);

export default router;

