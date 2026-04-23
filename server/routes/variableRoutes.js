const express = require('express');
const router = express.Router();
const { getVariables, addVariable, seedDatabase } = require('../controllers/variableController');

const { validate, Schemas } = require('../middleware/validationMiddleware');

router.get('/variables', getVariables);
router.post('/variables', validate(Schemas.Variable), addVariable);

router.post('/seed', seedDatabase);

module.exports = router;
