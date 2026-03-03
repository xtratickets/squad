import { config } from './config/config';
import http from 'http';
import app from './app';
import { logger } from './utils/logger';
import { initSocket } from './websocket/socket';
import { StorageService } from './services/storage.service';

const server = http.createServer(app);
initSocket(server);

// Initialize storage (Minio)
StorageService.init();

server.listen(config.port, () => {
    logger.info(
        { port: config.port, env: config.nodeEnv, system: config.systemName },
        'Server started successfully'
    );
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
});
