const express = require('express');
const router = express.Router();
const { getStampConfig, updateStampConfig } = require('../controllers/stampConfigController');

router.get('/stamp-config', getStampConfig);
router.put('/stamp-config/:id', updateStampConfig);

module.exports = router;
