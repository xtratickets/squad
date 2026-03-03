import { Router } from 'express';
import * as guestController from './guest.controller';
import * as reservationController from '../reservations/reservation.controller';

const router = Router();

router.get('/rooms', guestController.getPublicRooms);
router.get('/rooms/:id/state', guestController.getPublicRoomState);
router.get('/rooms/:id/session', guestController.getGuestSession);
router.post('/rooms/:id/orders', guestController.createGuestOrder);
router.get('/menu', guestController.getPublicMenu);
router.get('/reservations', guestController.getPublicReservations);
router.post('/reservations', reservationController.createReservation); // Public reservation creation

export default router;
