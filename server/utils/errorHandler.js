const logger = require('./logger');

/**
 * Custom error classes for structured error handling.
 */
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

class DatabaseError extends AppError {
    constructor(message) {
        super(`Database error: ${message}`, 500);
    }
}

/**
 * Wraps async route handlers to catch unhandled rejections
 * and forward them to Express error middleware.
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Zod/Joi validation middleware factory.
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const message = error.details.map((detail) => detail.message).join(', ');
            logger.warn(`Validation error: ${message}`);
            return next(new ValidationError(message));
        }
        next();
    };
};

/**
 * Converts Prisma-specific error codes to structured AppError instances.
 */
const handlePrismaError = (error) => {
    logger.error('Prisma error:', error);

    switch (error.code) {
        case 'P2002':
            return new AppError('Unique constraint violation: ข้อมูลซ้ำในระบบ', 409);
        case 'P2025':
            return new NotFoundError('Record');
        case 'P2003':
            return new AppError('Foreign key constraint violation: ข้อมูลที่อ้างอิงไม่มีอยู่', 400);
        case 'P2014':
            return new AppError('Invalid relation: ความสัมพันธ์ข้อมูลไม่ถูกต้อง', 400);
        case 'P2024':
            return new DatabaseError('Connection pool timeout — ลองอีกครั้ง');
        default:
            return new DatabaseError(error.message);
    }
};

/**
 * Development error response — includes stack trace.
 */
const sendErrorDev = (err, req, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err.message,
        code: err.code || undefined,
        stack: err.stack,
        path: req.originalUrl
    });
};

/**
 * Production error response — hides internals for non-operational errors.
 */
const sendErrorProd = (err, req, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            error: err.message
        });
    } else {
        logger.error(`Unexpected error on ${req.method} ${req.originalUrl}:`, err);
        res.status(500).json({
            status: 'error',
            error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่'
        });
    }
};

/**
 * Global Express error handler — single source of truth.
 * Replaces both errorMiddleware.js and the old globalErrorHandler.
 */
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
        err = handlePrismaError(err);
    }

    if (err.name === 'ValidationError' && !(err instanceof AppError)) {
        err = new ValidationError(err.message);
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        err = new AppError('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 50MB)', 413);
    }

    logger.error(`${req.method} ${req.originalUrl} → ${err.statusCode}`, err);

    if (process.env.NODE_ENV === 'production') {
        sendErrorProd(err, req, res);
    } else {
        sendErrorDev(err, req, res);
    }
};

/**
 * 404 catch-all for undefined routes.
 */
const notFound = (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl}`));
};

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    DatabaseError,
    asyncHandler,
    validateRequest,
    globalErrorHandler,
    notFound,
    handlePrismaError
};
