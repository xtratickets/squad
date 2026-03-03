import { Router } from 'express';
import * as paymentController from './payment.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

import * as modeController from './mode.controller';

import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-receipt', authenticate, upload.single('receipt'), paymentController.uploadReceipt);

router.post('/', authenticate, paymentController.recordPayment);
router.get('/', authenticate, paymentController.getPayments);
router.patch('/:id', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), paymentController.editPayment);

router.get('/modes', authenticate, modeController.getPaymentModes);
router.post('/modes', authenticate, authorize(['ADMIN']), modeController.createPaymentMode);
router.patch('/modes/:id', authenticate, authorize(['ADMIN']), modeController.updatePaymentMode);
router.delete('/modes/:id', authenticate, authorize(['ADMIN']), modeController.deletePaymentMode);

export default router;
