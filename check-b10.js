const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPromo() {
    try {
        const promo = await prisma.promoCode.findUnique({
            where: { code: 'B10' }
        });
        console.log('Promo B10:', JSON.stringify(promo, null, 2));

        // Also check the last session charge for this promo
        const lastCharge = await prisma.sessionCharge.findFirst({
            where: { promoCode: 'B10' },
            orderBy: { createdAt: 'desc' },
            include: { session: true }
        });
        console.log('Last Charge with B10:', JSON.stringify(lastCharge, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkPromo();
