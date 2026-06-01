import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load .env file before running tests
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
    },
});