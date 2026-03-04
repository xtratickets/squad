import { Request, Response } from 'express';
import { config } from '../../config/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';

export const getSystemSettings = (req: Request, res: Response) => {
    res.json({
        systemName: config.systemName,
        systemLogo: config.systemLogo,
        version: '1.0.0', // Could be from package.json
    });
};

export const updateSystemSettings = (req: Request, res: Response) => {
    const { systemName, systemLogo } = req.body;

    if (systemName) config.systemName = systemName;
    if (systemLogo) config.systemLogo = systemLogo;

    // Write to .env file to persist across restarts
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');

            if (envContent.includes('SYSTEM_NAME=')) {
                envContent = envContent.replace(/SYSTEM_NAME=.*/g, `SYSTEM_NAME="${config.systemName}"`);
            } else {
                envContent += `\nSYSTEM_NAME="${config.systemName}"`;
            }

            if (envContent.includes('SYSTEM_LOGO=')) {
                envContent = envContent.replace(/SYSTEM_LOGO=.*/g, `SYSTEM_LOGO="${config.systemLogo}"`);
            } else {
                envContent += `\nSYSTEM_LOGO="${config.systemLogo}"`;
            }

            fs.writeFileSync(envPath, envContent);
        }
    } catch (err) {
        console.error('Failed to write to .env', err);
    }

    res.json({
        systemName: config.systemName,
        systemLogo: config.systemLogo,
        version: '1.0.0'
    });
};

export const seedAdmin = async (req: Request, res: Response) => {
    try {
        // Only allow if no users exist
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            return res.status(403).json({ error: 'System already has users. Seeding restricted.' });
        }

        logger.info('Starting manual system seed...');

        // 1. Roles
        const roles = ['GUEST', 'STAFF', 'OPERATION', 'ADMIN', 'OWNER'];
        const roleMap: Record<string, any> = {};

        for (const roleName of roles) {
            roleMap[roleName] = await prisma.role.upsert({
                where: { name: roleName },
                update: {},
                create: { name: roleName },
            });
        }

        // 2. Admin User
        const adminPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                password: adminPassword,
                roleId: roleMap['ADMIN'].id,
            },
        });

        // 3. Default Fee Config
        await (prisma as any).feeConfig.upsert({
            where: { id: 'default' },
            update: {},
            create: {
                id: 'default',
                roomServiceFeePercent: 10,
                orderServiceFeePercent: 10,
                walkInServiceFeePercent: 10,
                ownerServiceFeePercent: 0,
                taxPercent: 5,
            },
        });

        // 4. Default Payment Modes
        const paymentModes = [
            { name: 'CASH', allowSplit: true },
            { name: 'CARD', allowSplit: true },
            { name: 'WALLET', allowSplit: true },
        ];

        for (const mode of paymentModes) {
            await prisma.paymentMode.upsert({
                where: { id: mode.name },
                update: {},
                create: {
                    id: mode.name,
                    name: mode.name,
                    allowSplit: mode.allowSplit,
                },
            });
        }

        logger.info('System seed completed successfully.');
        res.json({ message: 'System seeded successfully. Default credentials: admin / admin123', version: 2 });
    } catch (error) {
        logger.error(error, 'Error seeding system');
        res.status(500).json({ error: 'Internal server error during seeding' });
    }
};
