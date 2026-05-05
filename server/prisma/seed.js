const prisma = require('../prismaClient');

async function main() {
    console.log('🌱 Seeding sample data...');

    // --- Cleanup old default data ---
    await prisma.signatory.deleteMany({
        where: { id: '8c86513f-50f3-42aa-b4a8-4df5610dd020' }
    });

    // --- Upsert User ---
    const user = await prisma.user.upsert({
        where: { id: 'user_sample' },
        update: {},
        create: {
            id: 'user_sample',
            username: 'นายทดสอบ ระบบ',
            password: '',
        },
    });
    console.log(`  ✅ User: ${user.id} (${user.username})`);

    // --- Upsert Signatory ---
    const signatory = await prisma.signatory.upsert({
        where: { id: 'sig_sample' },
        update: {},
        create: {
            id: 'sig_sample',
            fullName: 'นายทดสอบ ระบบ',
            signatureImage: 'upload_sample/sig_test.png',
            variableName: '{{sig_sample}}',
            prefixText: 'ทดสอบ',
            position: 'นักทดสอบระบบ',
        },
    });
    console.log(`  ✅ Signatory: ${signatory.id} (${signatory.fullName})`);

    // --- Upsert PdfCache ---
    const pdfCache = await prisma.pdfCache.upsert({
        where: { OriginalFileId: 'pdfcache_sample' },
        update: {},
        create: {
            OriginalFileId: 'pdfcache_sample',
            FileName: 'sample.pdf',
            OriginalUrlorPath: 'upload_sample/sample.pdf',
            FilePath: 'upload_sample/sample.pdf',
        },
    });
    console.log(`  ✅ PdfCache: ${pdfCache.OriginalFileId} (${pdfCache.FileName})`);

    console.log('🌱 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
