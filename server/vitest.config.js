import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        include: ['tests/**/*.test.js'],
        env: {
            DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5433/document_management_db?schema=test'
        }
    },
});
