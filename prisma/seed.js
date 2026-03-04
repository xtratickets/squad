"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    // 1. Roles
    const roles = ['GUEST', 'STAFF', 'OPERATION', 'ADMIN'];
    const roleMap = {};
    for (const roleName of roles) {
        roleMap[roleName] = await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName },
        });
    }
    console.log('Roles created.');
    // 2. Admin User
    const adminPassword = await bcryptjs_1.default.hash('admin123', 10);
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: adminPassword,
            roleId: roleMap['ADMIN'].id,
        },
    });
    console.log('Admin user created.');
    // 3. Default Fee Config
    await prisma.feeConfig.upsert({
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
    console.log('Default Fee Config created.');
    // 4. Default Payment Modes
    const paymentModes = [
        { name: 'CASH', allowSplit: true },
        { name: 'CARD', allowSplit: true },
        { name: 'WALLET', allowSplit: true },
    ];
    for (const mode of paymentModes) {
        await prisma.paymentMode.upsert({
            where: { id: mode.name }, // Using name as ID for simplicity in seeding
            update: {},
            create: {
                id: mode.name,
                name: mode.name,
                allowSplit: mode.allowSplit,
            },
        });
    }
    console.log('Payment Modes created.');
    console.log('Seeding finished.');
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
