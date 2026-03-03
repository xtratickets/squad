import { Router } from 'express';
import * as roomController from './room.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, roomController.getRooms);
router.get('/active', authenticate, roomController.listRooms);
router.get('/:id', authenticate, roomController.getRoomById);
router.get('/:id/state', authenticate, roomController.getRoomState);
router.post('/', authenticate, authorize(['ADMIN', 'OPERATION']), roomController.createRoom);
router.patch('/:id', authenticate, authorize(['ADMIN', 'OPERATION']), roomController.updateRoom);
router.delete('/:id', authenticate, authorize(['ADMIN']), roomController.deleteRoom);

export default router;
