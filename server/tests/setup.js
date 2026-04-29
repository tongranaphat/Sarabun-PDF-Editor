import { beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import prisma from '../prismaClient';

const testDbUrl = process.env.DATABASE_URL;

beforeAll(async () => {
    console.log('Applying migrations to test schema...');
    execSync('npx prisma db push --accept-data-loss --skip-generate', { env: { ...process.env, DATABASE_URL: testDbUrl } });
});

afterAll(async () => {
    const tablenames = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='test'`;
    for (const { tablename } of tablenames) {
        if (tablename !== '_prisma_migrations') {
            try {
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE "test"."${tablename}" CASCADE;`);
            } catch (error) {
                console.log({ error });
            }
        }
    }
    await prisma.$disconnect();
});

afterEach(async () => {
});
