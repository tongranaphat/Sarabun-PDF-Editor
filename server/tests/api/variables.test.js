import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import prisma from '../../prismaClient';

describe('Variables API Tests', () => {
    beforeAll(async () => {
        // Seed some test data
        await prisma.variable.create({
            data: { key: 'TEST_KEY', label: 'Test Label' }
        });
    });

    describe('GET /api/variables', () => {
        it('should return a list of variables', async () => {
            const res = await request(app).get('/api/variables');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            const testVar = res.body.find(v => v.key === 'TEST_KEY');
            expect(testVar).toBeDefined();
            expect(testVar.label).toBe('Test Label');
        });
    });

    describe('POST /api/variables', () => {
        it('should add or update a variable', async () => {
            const res = await request(app)
                .post('/api/variables')
                .send({ key: 'NEW_KEY', label: 'New Label' });
            
            expect(res.status).toBe(200);
            expect(res.body.key).toBe('NEW_KEY');
            expect(res.body.label).toBe('New Label');
        });
    });
});
