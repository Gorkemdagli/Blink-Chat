import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend env vars (SUPABASE_SERVICE_ROLE_KEY for auth.setup.ts)
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
// Load frontend env vars (E2E_USER_EMAIL / E2E_USER_PASSWORD overrides)
dotenv.config({ path: path.resolve(__dirname, '.env'), override: false });

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false, // Auth tests need isolation
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 2,
    reporter: process.env.CI
        ? [['html', { open: 'never' }], ['github']]
        : [['html', { open: 'on-failure' }]],

    timeout: 60_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },

    projects: [
        // Auth setup — runs first, stores session state
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },
        // Main tests — depend on authenticated session
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            testIgnore: /.*\.unauth\.spec\.ts/,
            dependencies: ['setup'],
        },
        // Unauthenticated tests (landing, login, register)
        {
            name: 'unauthenticated',
            testMatch: /.*\.unauth\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: [
        {
            command: process.env.CI
                ? 'npm run preview -- --port 5173'
                : 'npm run dev -- --port 5173',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
            env: {
                ...process.env,
                VITE_HCAPTCHA_SITE_KEY: '10000000-ffff-ffff-ffff-000000000001',
            },
        },
        {
            command: 'npm --prefix ../backend run start',
            port: 3000,
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
        },
    ],
});
