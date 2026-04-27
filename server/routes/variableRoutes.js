const express = require('express');
const router = express.Router();
const { getVariables, addVariable, seedDatabase } = require('../controllers/variableController');

const { validate, Schemas } = require('../middleware/validationMiddleware');

router.get('/variables', getVariables);
router.post('/variables', validate(Schemas.Variable), addVariable);

router.post('/seed', (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Seed endpoint is disabled in production' });
    }
    next();
}, seedDatabase);

module.exports = router;
