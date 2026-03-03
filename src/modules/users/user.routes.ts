import { Router } from 'express';
import * as userController from './user.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, authorize(['ADMIN', 'OPERATION']), userController.getUsers);
router.get('/list', authenticate, authorize(['ADMIN', 'OPERATION', 'STAFF']), userController.getUsersList);
router.post('/', authenticate, authorize(['ADMIN']), userController.createUser);
router.patch('/:id', authenticate, authorize(['ADMIN']), userController.updateUser);
router.delete('/:id', authenticate, authorize(['ADMIN']), userController.deleteUser);
router.get('/roles', authenticate, authorize(['ADMIN']), userController.getRoles);

export default router;
