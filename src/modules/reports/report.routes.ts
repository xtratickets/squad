import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/global', authenticate, authorize(['ADMIN']), reportController.getGlobalStats);
router.get('/export', authenticate, authorize(['ADMIN']), reportController.exportReport);

export default router;
