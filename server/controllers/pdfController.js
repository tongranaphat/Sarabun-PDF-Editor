const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { PDFDocument } = require('pdf-lib');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');
const axios = require('axios');
const logger = require('../utils/logger');

const prepareWorkspace = async (req, res) => {
    try {
        const { id } = req.params;
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (!pdf) return res.status(404).json({ error: 'ไม่พบไฟล์ในฐานข้อมูล' });

        const rawSourcePath = pdf.EditedFile && pdf.EditedFilePath ? pdf.EditedFilePath : pdf.FilePath;
        if (!rawSourcePath) {
            return res.status(400).json({ error: 'ข้อมูล Path ใน Database ว่างเปล่า' });
        }
        const cleanSourcePath = rawSourcePath.replace(/^\//, '');
        const absoluteSource = path.join(__dirname, '..', cleanSourcePath);

        try {
            await fsp.access(absoluteSource);
        } catch {
            logger.error(`[prepareWorkspace] File not found on disk: ${absoluteSource}`);
            return res.status(404).json({ error: 'ไม่พบไฟล์ต้นฉบับบนเซิร์ฟเวอร์' });
        }

        const tempDirPath = path.join(__dirname, '../uploads/temp');
        await fsp.mkdir(tempDirPath, { recursive: true });

        const tempFileName = `temp_${id}.pdf`;
        const tempFilePath = `/uploads/temp/${tempFileName}`;
        const cleanTempPath = tempFilePath.replace(/^\//, '');
        const absoluteTemp = path.join(__dirname, '..', cleanTempPath);

        await fsp.copyFile(absoluteSource, absoluteTemp);

        await prisma.pdfCache.update({
            where: { OriginalFileId: id },
            data: { TempFilePath: tempFilePath }
        });

        res.json({
            message: 'เตรียม Workspace สำเร็จ',
            tempPath: tempFilePath,
            editState: pdf.editState
        });
    } catch (error) {
        console.error('[prepareWorkspace] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถเตรียมไฟล์ใน Temp ได้', details: error.message });
    }
};

const resetToOriginal = async (req, res) => {
    try {
        const { id } = req.params;
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (!pdf) return res.status(404).json({ error: 'ไม่พบโปรเจกต์ในระบบ' });

        const cleanSourcePath = pdf.FilePath.replace(/^\//, '');
        const absoluteOriginal = path.join(__dirname, '..', cleanSourcePath);

        try {
            await fsp.access(absoluteOriginal);
        } catch {
            return res.status(404).json({
                error: 'ไม่สามารถรีเซ็ตได้เนื่องจากไฟล์ต้นฉบับสูญหายบนเซิร์ฟเวอร์'
            });
        }

        const tempDirPath = path.join(__dirname, '../uploads/temp');
        await fsp.mkdir(tempDirPath, { recursive: true });

        const absoluteTemp = path.join(__dirname, '..', `uploads/temp/temp_${id}.pdf`);
        await fsp.copyFile(absoluteOriginal, absoluteTemp);

        await prisma.pdfCache.update({
            where: { OriginalFileId: id },
            data: {
                EditedFile: false,
                EditedFilePath: null,
                editState: null,
                TempFilePath: `/uploads/temp/temp_${id}.pdf`
            }
        });

        res.json({
            message: 'รีเซ็ตสำเร็จ ดึงไฟล์ต้นฉบับมาไว้ในพื้นที่ทำงานแล้ว',
            tempPath: `/uploads/temp/temp_${id}.pdf`
        });
    } catch (error) {
        logger.error('[resetToOriginal] Error:', error);
        res.status(500).json({ error: 'การรีเซ็ตข้อมูลล้มเหลว: ' + error.message });
    }
};

const UPLOAD_DIR = path.join(__dirname, '../uploads/original/cache');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
        fieldSize: 50 * 1024 * 1024
    }
});

const convertGDriveUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    const fileIdMatch = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
    return url;
};

const importPdfUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        let cachedPdf = await prisma.pdfCache.findFirst({
            where: { OriginalUrlorPath: url }
        });

        if (!cachedPdf) {
            const downloadUrl = convertGDriveUrl(url);

            const response = await axios.get(downloadUrl, { responseType: 'stream' });

            let exactName = `GDrive_Document_${Date.now()}.pdf`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) exactName = decodeURIComponent(match[1]);
            } else {
                const urlName = path.basename(new URL(downloadUrl).pathname);
                if (urlName && urlName !== 'uc' && urlName !== 'download') exactName = urlName;
            }

            const uploadDir = path.join(__dirname, '../uploads/original/cache');
            await fsp.mkdir(uploadDir, { recursive: true });

            const destPath = path.join(uploadDir, exactName);

            const writer = fs.createWriteStream(destPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            cachedPdf = await prisma.pdfCache.create({
                data: {
                    FileName: exactName,
                    OriginalUrlorPath: url,
                    FilePath: `/uploads/original/cache/${exactName}`,
                    OriginalFile: true,
                    EditedFile: false
                }
            });
        }

        res.status(200).json({
            ...cachedPdf,
            id: cachedPdf.OriginalFileId,
            fileId: cachedPdf.OriginalFileId,
            filepath: cachedPdf.FilePath
        });
    } catch (error) {
        console.error('URL Import Error:', error.message);
        res.status(500).json({ error: 'Failed to import file from URL' });
    }
};

const checkPdfType = asyncHandler(async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        const existingPdfBytes = req.file.buffer || require('fs').readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        let subject = null;
        let keywords = null;

        try {
            const { PDFName, PDFString, PDFHexString } = require('pdf-lib');

            const infoDict = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);

            const decodePdfString = (pdfStr) => {
                if (!pdfStr) return null;
                const bytes = pdfStr.asBytes();
                if (bytes[0] === 0xfe && bytes[1] === 0xff) {
                    return Buffer.from(bytes.slice(2))
                        .toString('utf16le')
                        .split('')
                        .map((c, i, a) => (i % 2 === 0 ? a[i + 1] + c : ''))
                        .join('');
                }
                return Buffer.from(bytes).toString('utf-8');
            };

            const decodeBuffer = (buf) => {
                if (!buf || buf.length < 2) return buf?.toString('utf-8') || null;
                if (buf[0] === 0xfe && buf[1] === 0xff) {
                    const content = Buffer.from(buf.slice(2));
                    content.swap16();
                    return content.toString('utf16le');
                }
                return buf.toString('utf-8');
            };

            if (infoDict) {
                const subjectEntry = infoDict.get(PDFName.of('Subject'));
                if (subjectEntry instanceof PDFString || subjectEntry instanceof PDFHexString) {
                    subject = decodeBuffer(Buffer.from(subjectEntry.asBytes()));
                }

                const keywordsEntry = infoDict.get(PDFName.of('Keywords'));
                if (keywordsEntry instanceof PDFString || keywordsEntry instanceof PDFHexString) {
                    keywords = decodeBuffer(Buffer.from(keywordsEntry.asBytes()));
                }
            }
        } catch (unsafeErr) {
            logger.warn('Safe metadata read failed, falling back to standard', unsafeErr);
            subject = pdfDoc.getSubject();
            keywords = pdfDoc.getKeywords();
        }

        let foundId = null;
        let foundType = null;
        let embeddedLayout = null;

        if (keywords) {
            const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;
            logger.info(`Checking PDF metadata: ${keywordString.substring(0, 100)}...`);

            const idMatch = keywordString.match(/dynamic-id:(\S+)/);
            if (idMatch) foundId = idMatch[1];

            const typeMatch = keywordString.match(/dynamic-type:(\S+)/);
            if (typeMatch) foundType = typeMatch[1];

            if (!foundId) {
                const legacyMatch = keywordString.match(/dynamic-report-id:(\S+)/);
                if (legacyMatch) {
                    foundId = legacyMatch[1];
                    foundType = 'template';
                }
            }
        }

        if (subject && subject.startsWith('layout:')) {
            try {
                const base64Str = subject.substring(7);
                const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
                embeddedLayout = JSON.parse(jsonStr);
                logger.success('Found embedded layout data in PDF');
            } catch (e) {
                logger.error('Failed to parse embedded layout:', e);
            }
        }

        res.json({
            isGenerated: !!foundId || !!embeddedLayout,
            id: foundId,
            type: foundType,
            embeddedLayout: embeddedLayout,
            url: null
        });
    } catch (error) {
        logger.error('Failed to check PDF:', error);
        res.json({ isGenerated: false, url: null });
    }
});

const generatePDF = asyncHandler(async (req, res) => {
    logger.info('Starting PDF generation...');
    const startTime = Date.now();
    let browser = null;

    try {
        const { canvasImages, recordId, recordType, pagesData } = req.body;

        if (!canvasImages || !Array.isArray(canvasImages) || canvasImages.length === 0) {
            res.status(400);
            throw new Error('No pages data received');
        }

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        const A4_WIDTH_PX = 794;
        const A4_HEIGHT_PX = 1123;
        const totalHeight = canvasImages.length * A4_HEIGHT_PX;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
                    body, html {
                        margin: 0;
                        padding: 0;
                        width: ${A4_WIDTH_PX}px;
                        font-family: 'Sarabun', sans-serif;
                    }
                    img {
                        display: block;
                        width: 100%;
                        height: ${A4_HEIGHT_PX}px;
                        page-break-after: always;
                    }
                    img:last-child { page-break-after: avoid; }
                </style>
            </head>
            <body>
                ${canvasImages.map((img) => `<img src="${img}" />`).join('')}
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        await page.setViewport({ width: A4_WIDTH_PX, height: totalHeight });

        let pdfBuffer = await page.pdf({
            printBackground: true,
            width: `${A4_WIDTH_PX}px`,
            height: `${A4_HEIGHT_PX}px`
        });

        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);

            const typeToEmbed = recordType || 'report';
            const keywords = [];
            if (recordId) keywords.push(`dynamic-id:${recordId}`);
            keywords.push(`dynamic-type:${typeToEmbed}`);

            pdfDoc.setKeywords(keywords);

            if (pagesData) {
                const jsonStr = JSON.stringify(pagesData);
                const MAX_METADATA_BYTES = 50 * 1024;
                if (Buffer.byteLength(jsonStr, 'utf-8') > MAX_METADATA_BYTES) {
                    logger.warn(
                        `Layout data too large to embed (${Math.round(Buffer.byteLength(jsonStr, 'utf-8') / 1024)}KB > 50KB). Metadata will be omitted.`
                    );
                } else {
                    const base64Str = Buffer.from(jsonStr, 'utf-8').toString('base64');
                    pdfDoc.setSubject(`layout:${base64Str}`);
                    logger.info('Embedded full layout data into PDF metadata');
                }
            }

            pdfDoc.setProducer('Dynamic Report Creator');
            pdfDoc.setCreator('Dynamic Report Creator System');

            const modifiedPdfBytes = await pdfDoc.save();
            pdfBuffer = Buffer.from(modifiedPdfBytes);

            logger.info(`Embedded Metadata -> ID: ${recordId}, Type: ${typeToEmbed}`);
        } catch (e) {
            logger.warn('Failed to embed metadata, sending original PDF', e);
        }

        const duration = Date.now() - startTime;
        logger.success(`PDF Generated in ${duration}ms`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`PDF FAILED (${duration}ms):`, error);
        throw error;
    } finally {
        if (browser) {
            try {
                await browser.close();
                logger.info('Browser closed');
            } catch (e) {
                console.error('Error closing browser:', e);
            }
        }
    }
});

const uploadPdf = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const existingPdf = await prisma.pdfCache.findFirst({
            where: { FileName: req.file.originalname },
            orderBy: { createdAt: 'desc' }
        });

        if (existingPdf) {
            return res.status(200).json({
                ...existingPdf,
                id: existingPdf.OriginalFileId,
                filepath: existingPdf.FilePath
            });
        }

        const filepath = `/uploads/original/cache/${req.file.filename}`;

        const savedPdf = await prisma.pdfCache.create({
            data: {
                FileName: req.file.originalname,
                OriginalUrlorPath: req.file.originalname,
                FilePath: filepath,
                OriginalFile: true,
                EditedFile: false
            }
        });
        res.status(201).json({ ...savedPdf, id: savedPdf.OriginalFileId, filepath: savedPdf.FilePath });
    } catch (error) {
        console.error('Upload DB Error:', error);
        res.status(500).json({ error: 'Failed to upload PDF' });
    }
};

const getPdfById = async (req, res) => {
    const { id } = req.params;
    const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });
    if (!pdf) return res.status(404).json({ error: 'PDF not found' });
    res.json({ ...pdf, id: pdf.OriginalFileId, filepath: pdf.FilePath, originalUrl: pdf.OriginalUrlorPath });
};

const deletePdf = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (!record) return res.status(404).json({ error: 'PDF not found' });

        if (record.FilePath) {
            const cleanPath = record.FilePath.replace(/^\//, '');
            const absPath = path.join(__dirname, '..', cleanPath);

            try {
                await fsp.unlink(absPath);
                logger.info(`[deletePdf] ลบไฟล์ต้นฉบับสำเร็จ: ${absPath}`);
            } catch (e) {
                if (e.code !== 'ENOENT') logger.warn(`[deletePdf] ลบไฟล์ต้นฉบับไม่สำเร็จ ${absPath}: ${e.message}`);
            }
        }

        if (record.EditedFilePath) {
            const cleanEditedPath = record.EditedFilePath.replace(/^\//, '');
            const editedAbsPath = path.join(__dirname, '..', cleanEditedPath);
            try {
                await fsp.unlink(editedAbsPath);
                logger.info(`[deletePdf] ลบไฟล์ Edited สำเร็จ: ${editedAbsPath}`);
            } catch (e) {
                if (e.code !== 'ENOENT') logger.warn(`[deletePdf] ลบไฟล์ Edited ไม่สำเร็จ ${editedAbsPath}: ${e.message}`);
            }
        }

        if (record.TempFilePath) {
            const cleanTempPath = record.TempFilePath.replace(/^\//, '');
            const tempAbsPath = path.join(__dirname, '..', cleanTempPath);
            try {
                await fsp.unlink(tempAbsPath);
            } catch (e) {
                if (e.code !== 'ENOENT') logger.warn(`[deletePdf] ลบไฟล์ Temp ไม่สำเร็จ ${tempAbsPath}: ${e.message}`);
            }
        }

        await prisma.pdfCache.delete({ where: { OriginalFileId: id } });

        res.json({ message: 'PDF and physical files deleted successfully', id });
    } catch (error) {
        console.error('Delete PDF Error:', error.message);
        res.status(500).json({ error: 'Failed to delete PDF' });
    }
};

const savePdfState = async (req, res) => {
    try {
        const { OriginalFileId, editState } = req.body;

        if (!OriginalFileId || !editState) {
            return res.status(400).json({ error: 'Missing OriginalFileId or editState' });
        }

        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId } });
        if (!pdf) return res.status(404).json({ error: 'PDF not found' });

        const timestamp = Date.now();
        const editedFileName = `edited_${timestamp}_${pdf.FileName}`;
        const newEditedPath = `/uploads/edited/cache/${editedFileName}`;

        const absoluteEditedPath = path.join(__dirname, '..', newEditedPath.replace(/^\//, ''));
        const editedDir = path.dirname(absoluteEditedPath);
        await fsp.mkdir(editedDir, { recursive: true });

        if (req.file) {
            await fsp.copyFile(req.file.path, absoluteEditedPath);
            await fsp.unlink(req.file.path);
        } else {
            const absoluteTemp = path.join(__dirname, '..', `uploads/temp/temp_${OriginalFileId}.pdf`);
            try {
                await fsp.copyFile(absoluteTemp, absoluteEditedPath);
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
            }
        }


        if (pdf.EditedFile && pdf.EditedFilePath) {
            const oldPath = path.join(__dirname, '..', pdf.EditedFilePath.replace(/^\//, ''));
            if (oldPath !== path.join(__dirname, '..', pdf.FilePath.replace(/^\//, ''))) {
                try {
                    await fsp.unlink(oldPath);
                    logger.info(`[savePdfState] Cleaned up old cache file: ${oldPath}`);
                } catch (e) {
                    if (e.code !== 'ENOENT') logger.warn(`[savePdfState] Failed to delete old cache file: ${e.message}`);
                }
            }
        }

        let parsedState = editState;
        while (typeof parsedState === 'string') {
            try {
                parsedState = JSON.parse(parsedState);
            } catch (e) {
                break;
            }
        }
        const updatedPdf = await prisma.pdfCache.update({
            where: { OriginalFileId },
            data: {
                EditedFile: true,
                EditedFilePath: newEditedPath,
                editState: parsedState
            }
        });

        res.json({
            message: 'บันทึกสถานะสำเร็จ',
            id: updatedPdf.OriginalFileId,
            filepath: updatedPdf.EditedFilePath
        });
    } catch (error) {
        console.error('Save PDF State Error:', error);
        res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จ' });
    }
};

const importLocalPath = async (req, res) => {
    try {
        let { localPath } = req.body;
        if (!localPath) return res.status(400).json({ error: 'File path is required' });

        localPath = localPath.replace(/^["']|["']$/g, '');

        if (!localPath.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ error: 'Security Policy: อนุญาตให้อิมพอร์ตเฉพาะไฟล์ .pdf เท่านั้น' });
        }

        const normalizedPath = path.resolve(localPath);

        const BLOCKED_PATTERNS = [
            /^[a-zA-Z]:[\\/]?(Windows|System32|etc|proc|sys|boot)/i,
            /^[\\/]?(Windows|System32|etc|proc|sys|boot)/i,
            /[\\/](\.ssh|\.env|\.git|node_modules)[\\/]?/i
        ];

        // Check for directory traversal before resolving
        if (/\.\.[\\/]/.test(localPath)) {
            logger.warn(`[importLocalPath] Blocked path traversal attempt: ${localPath}`);
            return res.status(403).json({ error: 'Security Policy: เส้นทางไฟล์ไม่ได้รับอนุญาต' });
        }

        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(normalizedPath)) {
                logger.warn(`[importLocalPath] Blocked path traversal attempt: ${normalizedPath}`);
                return res.status(403).json({ error: 'Security Policy: เส้นทางไฟล์ไม่ได้รับอนุญาต' });
            }
        }

        try {
            await fsp.access(normalizedPath);
        } catch {
            return res.status(404).json({ error: 'File not found: ' + normalizedPath });
        }

        const existingPdf = await prisma.pdfCache.findFirst({
            where: { FileName: path.basename(normalizedPath) },
            orderBy: { createdAt: 'desc' }
        });

        if (existingPdf) {
            return res.status(200).json({
                ...existingPdf,
                filepath: existingPdf.FilePath,
                id: existingPdf.OriginalFileId
            });
        }

        const fileName = `local_${Date.now()}_${path.basename(normalizedPath)}`;
        const uploadDir = path.join(__dirname, '../uploads/original/cache');
        await fsp.mkdir(uploadDir, { recursive: true });

        const newPhysicalPath = path.join(uploadDir, fileName);
        await fsp.copyFile(normalizedPath, newPhysicalPath);

        const cachedPdf = await prisma.pdfCache.create({
            data: {
                OriginalUrlorPath: normalizedPath,
                FileName: path.basename(normalizedPath),
                FilePath: `/uploads/original/cache/${fileName}`,
                OriginalFile: true,
                EditedFile: false
            }
        });

        res.status(200).json({
            ...cachedPdf,
            filepath: cachedPdf.FilePath,
            id: cachedPdf.OriginalFileId
        });
    } catch (error) {
        console.error('Local Import Error:', error);
        res.status(500).json({ error: 'Failed to import local file' });
    }
};

const saveGeneratedPdfState = async (req, res) => {
    try {
        const { OriginalFileId, editState } = req.body;
        if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ PDF ที่ส่งมา' });
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId } });
        if (!pdf) return res.status(404).json({ error: 'ไม่พบโปรเจกต์ในระบบ' });
        const timestamp = Date.now();
        const editedFileName = `edited_${timestamp}_${pdf.FileName}`;
        const editedDir = path.join(__dirname, '../uploads/edited/cache');
        await fsp.mkdir(editedDir, { recursive: true });
        const newEditedPath = `/uploads/edited/cache/${editedFileName}`;
        const absoluteNewEdited = path.join(editedDir, editedFileName);

        await fsp.copyFile(req.file.path, absoluteNewEdited);
        await fsp.unlink(req.file.path);


        if (pdf.EditedFile && pdf.EditedFilePath) {
            const oldPath = path.join(__dirname, '..', pdf.EditedFilePath.replace(/^\//, ''));
            if (oldPath !== path.join(__dirname, '..', pdf.FilePath.replace(/^\//, ''))) {
                try {
                    await fsp.unlink(oldPath);
                } catch (e) { }
            }
        }
        const updatedPdf = await prisma.pdfCache.update({
            where: { OriginalFileId },
            data: {
                EditedFile: true,
                EditedFilePath: newEditedPath,
                editState: editState ? JSON.parse(editState) : pdf.editState
            }
        });
        res.status(200).json(updatedPdf);
    } catch (error) {
        console.error('Save Generated PDF Error:', error);
        res.status(500).json({ error: 'บันทึกไฟล์ไม่สำเร็จ' });
    }
};

const cleanupTempFile = async (req, res) => {
    try {
        const { id } = req.params;
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (pdf && pdf.TempFilePath) {
            const cleanTempPath = pdf.TempFilePath.replace(/^\//, '');
            const absoluteTemp = path.join(__dirname, '..', cleanTempPath);

            try {
                await fsp.unlink(absoluteTemp);
                logger.info(`[cleanupTempFile] ลบไฟล์ Temp ทิ้งเรียบร้อย: ${absoluteTemp}`);
            } catch (e) {
                if (e.code !== 'ENOENT') logger.warn(`[cleanupTempFile] Error deleting: ${e.message}`);
            }

            await prisma.pdfCache.update({
                where: { OriginalFileId: id },
                data: { TempFilePath: null }
            });
        }

        res.json({ message: 'ลบไฟล์ Temp ออกจากระบบสำเร็จ' });
    } catch (error) {
        logger.error('[cleanupTempFile] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถลบไฟล์ Temp ได้' });
    }
};

const getStampMetadata = async (req, res) => {
    try {
        const { fileId } = req.query;
        if (!fileId) {
            return res.status(400).json({ error: 'fileId is required' });
        }

        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: fileId } });
        if (!pdf) {
            return res.status(404).json({ error: 'ไม่พบไฟล์ PDF ในระบบ' });
        }

        let stampConfig = await prisma.stampConfig.findUnique({ where: { pdfCacheId: fileId } });

        if (!stampConfig) {
            const currentYearBE = new Date().getFullYear() + 543;
            const lastStamp = await prisma.stampConfig.findFirst({
                orderBy: { createdAt: 'desc' }
            });

            let nextSeqNoValue = `1/${currentYearBE}`;

            if (lastStamp && lastStamp.seqNo) {
                const parts = lastStamp.seqNo.split('/');
                if (parts.length === 2) {
                    const lastNum = parseInt(parts[0], 10);
                    const lastYear = parseInt(parts[1], 10);

                    if (lastYear === currentYearBE) {
                        nextSeqNoValue = `${lastNum + 1}/${currentYearBE}`;
                    }
                } else {
                    const lastNum = parseInt(lastStamp.seqNo, 10);
                    if (!isNaN(lastNum)) {
                        nextSeqNoValue = `${lastNum + 1}/${currentYearBE}`;
                    }
                }
            }

            stampConfig = await prisma.stampConfig.create({
                data: {
                    pdfCacheId: fileId,
                    seqNo: nextSeqNoValue,
                    schoolName: 'โรงเรียนทดสอบ'
                }
            });
        }

        const user = await prisma.user.findFirst();
        const receiverName = user ? user.username : 'ไม่ระบุ';

        let thDate = stampConfig.dateStr;
        let thTime = stampConfig.timeStr;

        if (!thDate || !thTime) {
            const targetDate = stampConfig.createdAt;
            thDate = targetDate.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' });
            thTime = targetDate
                .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                .replace(':', '.') + ' น.';

            await prisma.stampConfig.update({
                where: { id: stampConfig.id },
                data: {
                    dateStr: thDate,
                    timeStr: thTime
                }
            });
        }

        res.json({
            id: stampConfig.id,
            schoolName: stampConfig.schoolName,
            seqNo: stampConfig.seqNo,
            date: thDate,
            time: thTime,
            receiverName: receiverName
        });

    } catch (error) {
        console.error('[getStampMetadata] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลแสตมป์ได้' });
    }
};

module.exports = {
    upload,
    checkPdfType,
    generatePDF,
    importPdfUrl,
    autoImportUniversal: importPdfUrl, // backward compat alias
    deletePdf,
    uploadPdf,
    getPdfById,
    savePdfState,
    importLocalPath,
    saveGeneratedPdfState,
    prepareWorkspace,
    resetToOriginal,
    cleanupTempFile,
    getStampMetadata
};
