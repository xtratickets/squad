"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcast = exports.emitToRoom = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("../utils/logger");
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        logger_1.logger.info({ socketId: socket.id }, 'New client connected');
        socket.on('join', (room) => {
            socket.join(room);
            logger_1.logger.debug({ socketId: socket.id, room }, 'Client joined room');
        });
        socket.on('disconnect', () => {
            logger_1.logger.info({ socketId: socket.id }, 'Client disconnected');
        });
    });
    return io;
};
exports.initSocket = initSocket;
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
        logger_1.logger.debug({ room, event }, 'Event emitted to room');
    }
};
exports.emitToRoom = emitToRoom;
const broadcast = (event, data) => {
    if (io) {
        io.emit(event, data);
        logger_1.logger.debug({ event }, 'Global event broadcasted');
    }
};
exports.broadcast = broadcast;
