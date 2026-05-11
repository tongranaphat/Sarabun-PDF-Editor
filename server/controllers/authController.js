const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const decodeToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        let decoded;

        if (JWT_SECRET) {
            try {
                decoded = jwt.verify(token, JWT_SECRET);
                logger.info('[JWT] Token verified successfully with secret key');
            } catch (verifyErr) {
                logger.warn(`[JWT] Verify failed: ${verifyErr.message}, falling back to decode-only`);
                decoded = jwt.decode(token);
                if (!decoded) {
                    return res.status(400).json({ error: 'Invalid token format' });
                }
            }
        } else {
            logger.warn('[JWT] No JWT_SECRET configured — decoding without verification (dev mode)');
            decoded = jwt.decode(token);
            if (!decoded) {
                return res.status(400).json({ error: 'Invalid token format' });
            }
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
