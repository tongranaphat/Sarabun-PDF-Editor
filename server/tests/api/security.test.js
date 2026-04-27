import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';

describe('Security API Tests', () => {
    describe('POST /api/pdf/import-local', () => {
        it('should block path traversal attempts (../)', async () => {
            const res = await request(app)
                .post('/api/pdf/import-local')
                .send({ localPath: '../../../Windows/System32/cmd.exe.pdf' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Security Policy: เส้นทางไฟล์ไม่ได้รับอนุญาต');
        });

        it('should block sensitive directory access (.env)', async () => {
            const res = await request(app)
                .post('/api/pdf/import-local')
                .send({ localPath: '/app/.env/config.pdf' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Security Policy: เส้นทางไฟล์ไม่ได้รับอนุญาต');
        });

        it('should reject non-PDF files', async () => {
            const res = await request(app)
                .post('/api/pdf/import-local')
                .send({ localPath: 'D:\\Documents\\image.png' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Security Policy: อนุญาตให้อิมพอร์ตเฉพาะไฟล์ .pdf เท่านั้น');
        });
    });
});
