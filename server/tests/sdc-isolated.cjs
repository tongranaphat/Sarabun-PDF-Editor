const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axiosPath = require.resolve('axios');
const calls = [];
require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: async config => { calls.push(config); return { status: 200, data: { ok: true } }; } };
const secret = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = secret;
process.env.SDC_API_AUTHORIZATION = crypto.randomBytes(32).toString('hex');
const app = express();
app.use(express.json());
app.use('/api', require('../routes/sdcRoutes'));
app.post('/api/auth/decode-token', require('../controllers/authController').decodeToken);
const token = jwt.sign({ doc_attach_id: 42 }, secret, { expiresIn: '5m' });
test('SDC rejects missing, invalid and wrong-document tokens without upstream calls', async () => {
 for (const [id, value, status] of [['42', '', 401], ['42', 'invalid', 401], ['43', token, 403]]) {
  const res = await request(app).get(`/api/sdc/saraban-doc/file-detail/${id}`).set('Authorization', `Bearer ${value}`);
  assert.equal(res.status, status);
 }
 assert.equal(calls.length, 0);
});
test('verified document read forwards server credential only', async () => {
 const res = await request(app).get('/api/sdc/saraban-doc/file-detail/42').set('Authorization', `Bearer ${token}`);
 assert.equal(res.status, 200);
 assert.equal(calls.at(-1).headers.Authorization, process.env.SDC_API_AUTHORIZATION);
 assert.equal(calls.at(-1).maxRedirects, 0);
 assert.deepEqual(res.body, { ok: true });
});
test('verified PDF upload preserves multipart file and operation', async () => {
 const res = await request(app).post('/api/sdc/saraban-doc/save-pdf-sign/42').set('Authorization', `Bearer ${token}`).attach('file', Buffer.from('%PDF-1.4 test'), 'sample.pdf');
 assert.equal(res.status, 200);
 assert.equal(calls.at(-1).data.get('file').name, 'sample.pdf');
 assert.equal(await calls.at(-1).data.get('file').text(), '%PDF-1.4 test');
});
test('JWT decode rejects invalid signatures and accepts signed claims', async () => {
 const bad = jwt.sign({ doc_attach_id: 42 }, crypto.randomBytes(32).toString('hex'));
 assert.equal((await request(app).post('/api/auth/decode-token').send({ token: bad })).status, 401);
 assert.equal((await request(app).post('/api/auth/decode-token').send({ token })).body.doc_attach_id, 42);
});
test('missing backend credential fails closed', async () => {
 delete process.env.SDC_API_AUTHORIZATION;
 assert.equal((await request(app).get('/api/sdc/saraban-doc/file-detail/42').set('Authorization', `Bearer ${token}`)).status, 503);
});
after(() => { delete process.env.JWT_SECRET; delete process.env.SDC_API_AUTHORIZATION; });
