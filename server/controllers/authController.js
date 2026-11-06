const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const decodeToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            return res.status(503).json({ error: 'JWT verification is not configured' });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256', 'HS384', 'HS512'] });
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const { doc_attach_id, user_id, user_type, date } = decoded;

        if (!doc_attach_id) {
            return res.status(400).json({ error: 'Token missing required field: doc_attach_id' });
        }

        logger.info(`[JWT] Decoded — doc_attach_id: ${doc_attach_id}, user_id: ${user_id}, user_type: ${user_type}`);

        res.json({
            doc_attach_id,
            user_id: user_id || null,
            user_type: user_type || null,
            date: date || null
        });
    } catch (error) {
        logger.error('[JWT] Decode error:', error);
        res.status(500).json({ error: 'Failed to decode token' });
    }
};

module.exports = { decodeToken };
