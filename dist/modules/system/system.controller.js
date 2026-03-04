"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = exports.updateSystemSettings = exports.getSystemSettings = void 0;
const config_1 = require("../../config/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getSystemSettings = (req, res) => {
    res.json({
        systemName: config_1.config.systemName,
        systemLogo: config_1.config.systemLogo,
        version: '1.0.0',
    });
};
exports.getSystemSettings = getSystemSettings;
const updateSystemSettings = (req, res) => {
    const { systemName, systemLogo } = req.body;
    if (systemName)
        config_1.config.systemName = systemName;
    if (systemLogo)
        config_1.config.systemLogo = systemLogo;
    const envPath = path_1.default.resolve(process.cwd(), '.env');
    try {
        if (fs_1.default.existsSync(envPath)) {
            let envContent = fs_1.default.readFileSync(envPath, 'utf8');
            if (envContent.includes('SYSTEM_NAME=')) {
                envContent = envContent.replace(/SYSTEM_NAME=.*/g, `SYSTEM_NAME="${config_1.config.systemName}"`);
            }
            else {
                envContent += `\nSYSTEM_NAME="${config_1.config.systemName}"`;
            }
            if (envContent.includes('SYSTEM_LOGO=')) {
                envContent = envContent.replace(/SYSTEM_LOGO=.*/g, `SYSTEM_LOGO="${config_1.config.systemLogo}"`);
            }
            else {
                envContent += `\nSYSTEM_LOGO="${config_1.config.systemLogo}"`;
            }
            fs_1.default.writeFileSync(envPath, envContent);
        }
    }
    catch (err) {
        console.error('Failed to write to .env', err);
    }
    res.json({
        systemName: config_1.config.systemName,
        systemLogo: config_1.config.systemLogo,
        version: '1.0.0'
    });
};
exports.updateSystemSettings = updateSystemSettings;
const seedAdmin = async (req, res) => {
    try {
        const userCount = await prisma_service_1.prisma.user.count();
        if (userCount > 0) {
            return res.status(403).json({ error: 'System already has users. Seeding restricted.' });
        }
        logger_1.logger.info('Starting manual system seed...');
        const roles = ['GUEST', 'STAFF', 'OPERATION', 'ADMIN', 'OWNER'];
        const roleMap = {};
        for (const roleName of roles) {
            roleMap[roleName] = await prisma_service_1.prisma.role.upsert({
                where: { name: roleName },
                update: {},
                create: { name: roleName },
            });
        }
        const adminPassword = await bcryptjs_1.default.hash('admin123', 10);
        await prisma_service_1.prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                password: adminPassword,
                roleId: roleMap['ADMIN'].id,
            },
        });
        await prisma_service_1.prisma.feeConfig.upsert({
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
        const paymentModes = [
            { name: 'CASH', allowSplit: true },
            { name: 'CARD', allowSplit: true },
            { name: 'WALLET', allowSplit: true },
        ];
        for (const mode of paymentModes) {
            await prisma_service_1.prisma.paymentMode.upsert({
                where: { id: mode.name },
                update: {},
                create: {
                    id: mode.name,
                    name: mode.name,
                    allowSplit: mode.allowSplit,
                },
            });
        }
        logger_1.logger.info('System seed completed successfully.');
        res.json({ message: 'System seeded successfully. Default credentials: admin / admin123', version: 2 });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error seeding system');
        res.status(500).json({ error: 'Internal server error during seeding' });
    }
};
exports.seedAdmin = seedAdmin;
