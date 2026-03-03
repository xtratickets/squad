import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

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

    console.log('Roles created.');

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

    console.log('Admin user created.');

    // 3. Default Fee Config
    await prisma.feeConfig.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            serviceFeePercent: 10,
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
