"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config/config");
const logger_1 = require("./utils/logger");
const socket_1 = require("./websocket/socket");
const server = http_1.default.createServer(app_1.default);
(0, socket_1.initSocket)(server);
server.listen(config_1.config.port, () => {
    logger_1.logger.info({ port: config_1.config.port, env: config_1.config.nodeEnv, system: config_1.config.systemName }, 'Server started successfully');
});
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
    });
});
