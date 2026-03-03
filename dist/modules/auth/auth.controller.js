"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_service_1 = require("../../services/prisma.service");
const config_1 = require("../../config/config");
const logger_1 = require("../../utils/logger");
const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma_service_1.prisma.user.findUnique({
            where: { username },
            include: { role: true },
        });
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, role: user.role.name }, config_1.config.jwtSecret, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role.name,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Login error');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    res.json({ user: req.user });
};
exports.getMe = getMe;
