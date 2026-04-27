const prisma = require('../prismaClient');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

const getStampConfig = asyncHandler(async (req, res) => {
    const { pdfCacheId } = req.query;

    if (pdfCacheId) {
        const config = await prisma.stampConfig.findUnique({
            where: { pdfCacheId }
        });
        if (config) return res.json(config);
        return res.status(404).json({ error: 'ไม่พบข้อมูลแสตมป์ของไฟล์นี้' });
    }

    const configs = await prisma.stampConfig.findMany({
        orderBy: { seqNo: 'desc' },
        take: 20
    });
    res.json(configs);
});

const updateStampConfig = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { schoolName, seqNo, dateStr, timeStr } = req.body;

    const updated = await prisma.stampConfig.update({
        where: { id },
        data: {
            ...(schoolName !== undefined && { schoolName }),
            ...(seqNo !== undefined && { seqNo }),
            ...(dateStr !== undefined && { dateStr }),
            ...(timeStr !== undefined && { timeStr })
        }
    });

    res.json(updated);
});

module.exports = {
    getStampConfig,
    updateStampConfig
};
