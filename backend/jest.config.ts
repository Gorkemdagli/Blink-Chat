import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    forceExit: true,
    setupFiles: ['<rootDir>/tests/setup.ts'],
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    testTimeout: 30000,
    collectCoverageFrom: [
        'services/**/*.ts',
        'controllers/**/*.ts',
        'validators/**/*.ts',
        'utils/**/*.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 55,
            functions: 75,
            lines: 75,
            statements: 75,
        },
    },
};

export default config;
