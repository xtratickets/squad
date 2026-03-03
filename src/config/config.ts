import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    systemName: process.env.SYSTEM_NAME || 'SQUAD_POS',
    systemLogo: process.env.SYSTEM_LOGO || '/assets/logo.png',
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV === 'development',
    jwtSecret: process.env.JWT_SECRET || 'secret',
};
