/**
 * Auth Setup — runs before authenticated test suites.
 * Logs in via UI and persists session state to .auth/user.json
 * so subsequent tests skip the login flow.
 */
import { test as setup, expect } from '@playwright/test';
import { TEST_USER, selectors, waitForAppReady } from './helpers';

const authFile = './e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('/');
    await waitForAppReady(page);

    // 2. Click start / go to login
    const startBtn = page.locator(selectors.landing.startButton).first();
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startBtn.click();
    }

    // 3. Wait for login form
    await page.waitForSelector(selectors.auth.emailInput, { timeout: 10_000 });

    // 4. Ensure we're on login page
    const loginSubmit = page.locator(selectors.auth.loginSubmit);
    if (!await loginSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
        const loginLink = page.locator(selectors.auth.loginLink);
        if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginLink.click();
        }
    }

    // 5. Fill credentials
    await page.fill(selectors.auth.emailInput, TEST_USER.email);
    await page.fill(selectors.auth.passwordInput, TEST_USER.password);

    await page.click(selectors.auth.loginSubmit);

    // 6. Wait for successful auth navigation OR an error message
    const authResult = await Promise.race([
        page.waitForSelector(selectors.nav.roomsTab, { timeout: 10_000 }).then(() => 'success'),
        page.waitForSelector(selectors.auth.errorMessage, { timeout: 10_000 }).then(() => 'error')
    ]).catch(() => 'timeout');

    // 7. If login fails or times out, fallback to registering the test user
    if (authResult === 'error' || authResult === 'timeout') {
        console.log(`Auth setup: Login ${authResult}, attempting registration...`);
        const registerLink = page.locator(selectors.auth.registerLink);
        if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await registerLink.click();
            await page.waitForSelector(selectors.auth.firstNameInput, { timeout: 10_000 });

            // Fill Registration form
            await page.fill(selectors.auth.firstNameInput, 'E2E');
            await page.fill(selectors.auth.lastNameInput, 'User');
            await page.fill(selectors.auth.emailInput, TEST_USER.email);
            await page.fill(selectors.auth.passwordInput, TEST_USER.password);
            await page.check(selectors.auth.termsCheckbox);

            await page.click(selectors.auth.registerSubmit);

            // Wait for navigation to chat after successful registration
            await page.waitForSelector(selectors.nav.roomsTab, { timeout: 20_000 });
        } else if (authResult === 'timeout') {
            throw new Error('Login timed out and registration link not found.');
        }
    }

    // 8. Verify we're in the chat interface
    await expect(page).not.toHaveURL(/login|register|landing/i);

    // 9. Ensure at least one room exists for tests
    await page.waitForTimeout(2000); // Give rooms time to load

    // Check if there are any clickable rooms
    const roomItems = page.locator('button').filter({
        has: page.locator('span.font-semibold')
    });

    const rootCount = await roomItems.count();

    if (rootCount === 0) {
        console.log('WARNING: No rooms found. Tests requiring a room will likely skip/fail. Make sure the database triggers are assigning the Genel room to this user.');
    }

    // 10. Store authenticated state
    await page.context().storageState({ path: authFile });
});
