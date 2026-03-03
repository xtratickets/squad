import { Router } from 'express';
import * as expenseController from './expense.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.post('/', authenticate, authorize(['OPERATION', 'ADMIN']), expenseController.createExpense);
router.get('/', authenticate, authorize(['OPERATION', 'ADMIN']), expenseController.getExpenses);
router.delete('/:id', authenticate, authorize(['ADMIN']), expenseController.deleteExpense);

export default router;
