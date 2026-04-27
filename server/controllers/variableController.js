const prisma = require('../prismaClient');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

const getVariables = asyncHandler(async (req, res) => {
    logger.info('Fetching variables');

    const variables = await prisma.variable.findMany({
        where: {
            OR: [{ scope: 'GLOBAL' }, { scope: 'USER' }]
        },
        orderBy: [{ label: 'asc' }]
    });

    if (variables.length === 0) {
        const mockVariables = [
            { id: '1', key: 'school_name', label: 'ชื่อโรงเรียน', scope: 'GLOBAL' },
            { id: '2', key: 'school_year', label: 'ปีการศึกษา', scope: 'GLOBAL' },
            { id: '3', key: 'student_name', label: 'ชื่อนักเรียน', scope: 'GLOBAL' },
            { id: '4', key: 'student_id', label: 'รหัสนักเรียน', scope: 'GLOBAL' },
            { id: '5', key: 'student_class', label: 'ชั้นเรียน', scope: 'GLOBAL' },
            { id: '6', key: 'teacher_name', label: 'ชื่อครู', scope: 'GLOBAL' },
            { id: '7', key: 'teacher_id', label: 'รหัสครู', scope: 'GLOBAL' },
            { id: '8', key: 'school_address', label: 'ที่อยู่โรงเรียน', scope: 'GLOBAL' },
            { id: '9', key: 'school_phone', label: 'เบอร์โทรศัพท์', scope: 'GLOBAL' },
            { id: '10', key: 'report_date', label: 'วันที่รายงาน', scope: 'GLOBAL' },
            { id: '11', key: 'report_title', label: 'ชื่อรายงาน', scope: 'GLOBAL' },
            { id: '12', key: 'semester', label: 'ภาคการศึกษา', scope: 'GLOBAL' },
            { id: '13', key: 'grade_level', label: 'ระดับชั้น', scope: 'GLOBAL' }
        ];

        const categorizedMockVariables = mockVariables.map((v) => {
            let category = 'GENERAL';
            if (v.key.includes('student') || v.key.includes('school_year') || v.key.includes('student_class')) {
                category = 'STUDENT INFO';
            } else if (v.key.includes('teacher')) {
                category = 'TEACHER INFO';
            } else if (v.key.includes('school')) {
                category = 'SCHOOL INFO';
            } else if (v.key.includes('report')) {
                category = 'REPORT INFO';
            } else if (v.key.includes('semester') || v.key.includes('grade')) {
                category = 'ACADEMIC INFO';
            }
            return { ...v, category };
        });

        return res.json(categorizedMockVariables);
    }

    const categorizedVariables = variables.map((v) => {
        let category = 'GENERAL';
        if (v.key.includes('student') || v.key.includes('school_year') || v.key.includes('student_class')) {
            category = 'STUDENT INFO';
        } else if (v.key.includes('teacher')) {
            category = 'TEACHER INFO';
        } else if (v.key.includes('school')) {
            category = 'SCHOOL INFO';
        } else if (v.key.includes('report')) {
            category = 'REPORT INFO';
        } else if (v.key.includes('semester') || v.key.includes('grade')) {
            category = 'ACADEMIC INFO';
        }
        return { ...v, category };
    });

    logger.success(`Retrieved ${categorizedVariables.length} variables`);
    res.json(categorizedVariables);
});

const addVariable = asyncHandler(async (req, res) => {
    const { key, label } = req.body;
    const newVar = await prisma.variable.create({
        data: { key, label, scope: 'USER' }
    });
    res.json(newVar);
});

const seedDatabase = asyncHandler(async (req, res) => {
    try {
        logger.info('Checking database seed status...');
        const count = await prisma.variable.count();

        if (count === 0) {
            logger.info('Seeding default variables...');
            await prisma.variable.createMany({
                data: [
                    { key: 'school_name', label: 'ชื่อโรงเรียน', scope: 'GLOBAL' },
                    { key: 'school_year', label: 'ปีการศึกษา', scope: 'GLOBAL' },
                    { key: 'student_name', label: 'ชื่อนักเรียน', scope: 'GLOBAL' },
                    { key: 'student_id', label: 'รหัสนักเรียน', scope: 'GLOBAL' },
                    { key: 'class_level', label: 'ระดับชั้น', scope: 'GLOBAL' },
                    { key: 'gpa', label: 'เกรดเฉลี่ย', scope: 'GLOBAL' },
                    { key: 'teacher_name', label: 'ชื่อครูประจำชั้น', scope: 'GLOBAL' },
                    { key: 'date', label: 'วันที่ออกรายงาน', scope: 'GLOBAL' }
                ]
            });
            logger.success('Variables seeded successfully');
        } else {
            logger.info('Variables already exist. Skipping seed.');
        }
        res.json({ status: 'ok', message: 'Database seeded or already populated' });
    } catch (error) {
        logger.error('Seed database failed:', error);
        throw error;
    }
});

module.exports = {
    getVariables,
    addVariable,
    seedDatabase
};
