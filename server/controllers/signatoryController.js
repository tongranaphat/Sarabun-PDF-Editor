const prisma = require('../prismaClient');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

exports.getSignatories = asyncHandler(async (req, res) => {
    const { documentId } = req.query;
    
    const whereClause = documentId 
        ? { OR: [{ documentId: null }, { documentId: documentId }] }
        : { documentId: null };

    const signatories = await prisma.signatory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' }
    });
    res.json(signatories);
});

exports.importSignatories = asyncHandler(async (req, res) => {
    const { transactions, documentId } = req.body;
    if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid transactions array' });
    }

    let importedCount = 0;

    for (const [index, t] of transactions.entries()) {
        const fullName = t.fullName?.trim();
        const prefixText = t.prefixText?.trim();

        if (!fullName) continue;

        const existing = await prisma.signatory.findFirst({
            where: {
                fullName: fullName,
                prefixText: prefixText || null,
                documentId: documentId || null
            }
        });

        if (!existing) {
            const uniqueVarName = `sig_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}`;
            await prisma.signatory.create({
                data: {
                    fullName: fullName,
                    prefixText: prefixText || null,
                    variableName: uniqueVarName,
                    documentId: documentId || null
                }
            });
            importedCount++;
        }
    }

    res.json({ message: 'Import successful', importedCount });
});
