import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Add lifecycle hooks if needed
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
