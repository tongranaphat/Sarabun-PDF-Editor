const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const signatories = await prisma.signatory.findMany();
        console.log('SUCCESS: Signatories found:', signatories.length);
    } catch (error) {
        console.error('FAILURE:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();
