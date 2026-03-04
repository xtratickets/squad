import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient() as any;

// Add lifecycle hooks if needed
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
