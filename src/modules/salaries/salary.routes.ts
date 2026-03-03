import { Router } from 'express';
import * as salaryController from './salary.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.post('/', authenticate, authorize(['OPERATION', 'ADMIN']), salaryController.recordSalary);
router.get('/', authenticate, authorize(['OPERATION', 'ADMIN']), salaryController.getSalaries);
router.delete('/:id', authenticate, authorize(['ADMIN']), salaryController.deleteSalary);

export default router;
