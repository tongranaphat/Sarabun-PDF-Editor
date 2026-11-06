const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

// Only the two document operations below can use the server-held credential.
const authorize = (req, res, next) => {
    if (!process.env.JWT_SECRET || !process.env.SDC_API_AUTHORIZATION) {
        return res.status(503).json({ error: 'SDC integration is not configured' });
    }
    try {
        const token = (req.headers.authorization || '').replace(/^Bearer /, '');
        const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256', 'HS384', 'HS512'] });
        if (!claims.doc_attach_id || String(claims.doc_attach_id) !== req.params.id) {
            return res.status(403).json({ error: 'Document access denied' });
        }
        next();
    } catch {
        return res.status(401).json({ error: 'A valid document token is required' });
    }
};

async function forward(req, res, operation, data) {
    try {
        const base = process.env.SDC_API_BASE_URL || 'http://10.0.0.99/api/service';
        const response = await axios({
            method: data ? 'POST' : 'GET',
            url: `${base.replace(/\/$/, '')}/saraban-doc/${operation}/${encodeURIComponent(req.params.id)}`,
            headers: { Accept: 'application/json', Authorization: process.env.SDC_API_AUTHORIZATION },
            data,
            timeout: 30000,
            maxRedirects: 0,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 51 * 1024 * 1024,
        });
        return res.status(response.status).json(response.data);
    } catch {
        // Axios errors include request headers; never return or log them.
        return res.status(502).json({ error: 'SDC request failed' });
    }
}
router.get('/sdc/saraban-doc/file-detail/:id', authorize, (req, res) => forward(req, res, 'file-detail'));
router.post('/sdc/saraban-doc/save-pdf-sign/:id', authorize, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' });
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    return forward(req, res, 'save-pdf-sign', form);
});
module.exports = router;
