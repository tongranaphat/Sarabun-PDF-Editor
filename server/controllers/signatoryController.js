const prisma = require('../prismaClient');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

exports.getSignatories = asyncHandler(async (req, res) => {
    const signatories = await prisma.signatory.findMany({
        orderBy: { createdAt: 'asc' }
    });
    res.json(signatories);
});
