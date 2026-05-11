const express = require('express');
const router = express.Router();
const signatoryController = require('../controllers/signatoryController');

router.get('/signatories', signatoryController.getSignatories);
router.post('/signatories/import', signatoryController.importSignatories);

module.exports = router;
