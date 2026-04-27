import { describe, it, expect } from 'vitest';
import { AppError, handlePrismaError, globalErrorHandler } from '../../utils/errorHandler';

describe('Error Handler Tests', () => {
    describe('AppError', () => {
        it('should properly instantiate an AppError', () => {
            const err = new AppError('Test error', 400);
            expect(err.message).toBe('Test error');
            expect(err.statusCode).toBe(400);
            expect(err.status).toBe('fail');
            expect(err.isOperational).toBe(true);
        });
    });

    describe('handlePrismaError', () => {
        it('should handle P2002 Unique Constraint error', () => {
            const mockPrismaError = {
                code: 'P2002',
                meta: { target: ['email'] }
            };
            const result = handlePrismaError(mockPrismaError);
            expect(result).toBeInstanceOf(AppError);
            expect(result.statusCode).toBe(409);
            expect(result.message).toContain('ข้อมูลซ้ำในระบบ');
        });

        it('should handle P2025 Not Found error', () => {
            const mockPrismaError = {
                code: 'P2025'
            };
            const result = handlePrismaError(mockPrismaError);
            expect(result).toBeInstanceOf(AppError);
            expect(result.statusCode).toBe(404);
            expect(result.message).toBe('Record not found');
        });
    });
});
