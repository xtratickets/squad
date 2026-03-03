"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    systemName: process.env.SYSTEM_NAME || 'SQUAD_POS',
    systemLogo: process.env.SYSTEM_LOGO || '/assets/logo.png',
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV === 'development',
    jwtSecret: process.env.JWT_SECRET || 'secret',
};
