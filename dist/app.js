"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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
const wallet_routes_1 = __importDefault(require("./modules/wallet/wallet.routes"));
const owner_routes_1 = __importDefault(require("./modules/owners/owner.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const app = (0, express_1.default)();
console.log('--- APP.TS LOADING ---');
logger_1.logger.info('--- APP.TS INITIALIZING ---');
app.get('/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString(), env: process.env.NODE_ENV });
});
app.get('/env-config.js', (req, res) => {
    res.type('application/javascript');
    const env = {
        VITE_API_URL: process.env.VITE_API_URL || '',
    };
    res.send(`window.ENV = ${JSON.stringify(env)};`);
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    logger_1.logger.info({ method: req.method, url: req.url }, 'Request received');
    next();
});
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
app.use('/api/wallet', wallet_routes_1.default);
app.use('/api/owners', owner_routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/logo', (req, res) => {
    const logoPath = path_1.default.join(__dirname, '../public/Squad-logo-Final.png');
    if (fs_1.default.existsSync(logoPath)) {
        res.sendFile(logoPath);
    }
    else {
        res.status(404).json({ error: 'Logo not found' });
    }
});
const candidatePaths = [
    path_1.default.join(__dirname, '../frontend/dist'),
    path_1.default.join(__dirname, '../../frontend/dist'),
];
const staticPath = candidatePaths.find(p => fs_1.default.existsSync(path_1.default.join(p, 'index.html'))) ?? candidatePaths[0];
const indexHtmlPath = path_1.default.join(staticPath, 'index.html');
const indexExists = fs_1.default.existsSync(indexHtmlPath);
console.log('--- Static Serving Debug ---');
logger_1.logger.info({
    nodeEnv: process.env.NODE_ENV,
    __dirname,
    staticPath,
    indexExists,
    cwd: process.cwd(),
    candidatePaths,
}, 'Static serving debug info v5');
if (indexExists) {
    logger_1.logger.info({ staticPath }, 'Serving frontend static files');
    app.use(express_1.default.static(staticPath));
    app.get(/^(?!\/api).*/, (req, res) => {
        if (req.url.startsWith('/api')) {
            logger_1.logger.warn({ method: req.method, url: req.url }, 'API route not found (falling to catch-all)');
            return res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
        }
        res.sendFile(indexHtmlPath);
    });
}
else {
    logger_1.logger.warn({ staticPath, candidatePaths }, 'Frontend build (index.html) not found. Serving API only.');
}
app.use(error_middleware_1.errorHandler);
exports.default = app;
