import { Router } from 'express';
import * as systemController from './system.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/settings', systemController.getSystemSettings);
router.put('/settings', authenticate, systemController.updateSystemSettings);

export default router;
