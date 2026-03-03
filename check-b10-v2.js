const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkPromo() {
    try {
        const promo = await prisma.promoCode.findUnique({
            where: { code: 'B10' }
        });

        // Also check the last session charge for this promo
        const lastCharge = await prisma.sessionCharge.findFirst({
            where: { promoCode: 'B10' },
            orderBy: { createdAt: 'desc' },
            include: { session: true }
        });

        const output = {
            promo,
            lastCharge
        };

        fs.writeFileSync('b10_output.json', JSON.stringify(output, null, 2));
        console.log('Results written to b10_output.json');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkPromo();
