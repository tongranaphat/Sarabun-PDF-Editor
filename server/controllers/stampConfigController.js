const prisma = require('../prismaClient');

const getStampConfig = async (req, res) => {
    try {
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
    } catch (error) {
        console.error('[getStampConfig] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตั้งค่าแสตมป์ได้' });
    }
};

const updateStampConfig = async (req, res) => {
    try {
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
    } catch (error) {
        console.error('[updateStampConfig] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลตั้งค่าแสตมป์ได้' });
    }
};

module.exports = {
    getStampConfig,
    updateStampConfig
};
