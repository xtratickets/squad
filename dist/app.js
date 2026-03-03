"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./utils/logger");
const system_routes_1 = __importDefault(require("./modules/system/system.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const room_routes_1 = __importDefault(require("./modules/rooms/room.routes"));
const session_routes_1 = __importDefault(require("./modules/sessions/session.routes"));
const product_routes_1 = __importDefault(require("./modules/products/product.routes"));
const order_routes_1 = __importDefault(require("./modules/orders/order.routes"));
const payment_routes_1 = __importDefault(require("./modules/payments/payment.routes"));
const shift_routes_1 = __importDefault(require("./modules/shifts/shift.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const expense_routes_1 = __importDefault(require("./modules/expenses/expense.routes"));
const fee_routes_1 = __importDefault(require("./modules/fees/fee.routes"));
const reservation_routes_1 = __importDefault(require("./modules/reservations/reservation.routes"));
const report_routes_1 = __importDefault(require("./modules/reports/report.routes"));
const promocode_routes_1 = __importDefault(require("./modules/promocodes/promocode.routes"));
const salary_routes_1 = __importDefault(require("./modules/salaries/salary.routes"));
const guest_routes_1 = __importDefault(require("./modules/guest/guest.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Logging middleware
app.use((req, res, next) => {
    logger_1.logger.info({ method: req.method, url: req.url }, 'Request received');
    next();
});
// Routes
app.use('/api/guest', guest_routes_1.default);
app.use('/api/system', system_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/rooms', room_routes_1.default);
app.use('/api/sessions', session_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/shifts', shift_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/expenses', expense_routes_1.default);
app.use('/api/fees', fee_routes_1.default);
app.use('/api/reservations', reservation_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/promocodes', promocode_routes_1.default);
app.use('/api/salaries', salary_routes_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handling
app.use(error_middleware_1.errorHandler);
exports.default = app;
