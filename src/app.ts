import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { logger } from './utils/logger';
import systemRoutes from './modules/system/system.routes';
import authRoutes from './modules/auth/auth.routes';
import roomRoutes from './modules/rooms/room.routes';
import sessionRoutes from './modules/sessions/session.routes';
import productRoutes from './modules/products/product.routes';
import orderRoutes from './modules/orders/order.routes';
import paymentRoutes from './modules/payments/payment.routes';
import shiftRoutes from './modules/shifts/shift.routes';
import userRoutes from './modules/users/user.routes';
import expenseRoutes from './modules/expenses/expense.routes';
import feeRoutes from './modules/fees/fee.routes';
import reservationRoutes from './modules/reservations/reservation.routes';
import reportRoutes from './modules/reports/report.routes';
import promoRoutes from './modules/promocodes/promocode.routes';
import salaryRoutes from './modules/salaries/salary.routes';
import guestRoutes from './modules/guest/guest.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import ownerRoutes from './modules/owners/owner.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Request received');
    next();
});

// Routes
app.use('/api/guest', guestRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes); // rooms: GET /, GET /:id/state, GET /:id, POST /, PATCH /:id, DELETE /:id
app.use('/api/sessions', sessionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/promocodes', promoRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/owners', ownerRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets in production
const staticPath = path.join(__dirname, '../frontend/dist');
const indexHtmlPath = path.join(staticPath, 'index.html');
const indexExists = fs.existsSync(indexHtmlPath);

console.log('--- Static Serving Debug ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Static Path:', staticPath);
console.log('Index HTML Exists:', indexExists);
console.log('---------------------------');

if (indexExists) {
    logger.info({ staticPath }, 'Serving frontend static files');
    app.use(express.static(staticPath));

    app.get('*', (req, res) => {
        // Skip API routes
        if (req.url.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
        res.sendFile(indexHtmlPath);
    });
} else {
    logger.warn({ staticPath }, 'Frontend build (index.html) not found. Serving API only.');
}

// Error handling
app.use(errorHandler);

// Force reload
export default app;
