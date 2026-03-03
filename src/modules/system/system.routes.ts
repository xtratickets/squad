import { Router } from 'express';
import * as systemController from './system.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/settings', systemController.getSystemSettings);
router.put('/settings', authenticate, systemController.updateSystemSettings);
router.get('/seed-admin', systemController.seedAdmin);

export default router;
