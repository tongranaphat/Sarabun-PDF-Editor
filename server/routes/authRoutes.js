const express = require('express');
const router = express.Router();
const { decodeToken } = require('../controllers/authController');
const { asyncHandler } = require('../utils/errorHandler');

router.post('/auth/decode-token', asyncHandler(decodeToken));

module.exports = router;
