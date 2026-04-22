const request = require('supertest');
const { app, prisma } = require('../index');

describe('API Integration Tests', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('GET /api/variables', () => {
        it('should return 200 and a list of variables', async () => {
            const res = await request(app).get('/api/variables');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });
});
