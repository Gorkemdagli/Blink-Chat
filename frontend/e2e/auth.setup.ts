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

    // 5. Fill credentials and submit
    await page.fill(selectors.auth.emailInput, TEST_USER.email);
    await page.fill(selectors.auth.passwordInput, TEST_USER.password);
    await page.click(selectors.auth.loginSubmit);

    // 6. Wait for successful auth — sidebar or message input should appear
    await page.waitForSelector(selectors.chat.messageInput + ', ' + selectors.nav.roomsTab, {
        timeout: 20_000,
    });

    // 7. Verify we're in the chat interface
    await expect(page).not.toHaveURL(/login|register|landing/i);

    // 8. Store authenticated state
    await page.context().storageState({ path: authFile });
});
