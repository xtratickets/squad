import { Router } from 'express';
import * as reservationController from './reservation.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.post('/', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), reservationController.createReservation);
router.get('/', authenticate, reservationController.getReservations);
router.patch('/:id/status', authenticate, authorize(['STAFF', 'OPERATION', 'ADMIN']), reservationController.updateReservationStatus);
router.delete('/:id', authenticate, authorize(['ADMIN']), reservationController.deleteReservation);

export default router;
