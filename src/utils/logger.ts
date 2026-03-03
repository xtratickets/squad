import pino from 'pino';
import { config } from '../config/config';

export const logger = pino({
    level: config.isDev ? 'debug' : 'info',
    transport: config.isDev
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'HH:MM:ss Z',
            },
        }
        : undefined,
});
