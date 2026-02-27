/**
 * E2E Test — Landing & Auth Flow (Unauthenticated)
 *
 * Critical Journey: Landing → Login page → Register page → Navigation
 * These tests run WITHOUT stored auth state.
 */
import { test, expect } from '@playwright/test';
import { selectors, waitForAppReady } from './helpers';

test.describe('Landing Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);
    });

    test('should render landing page with brand and CTA', async ({ page }) => {
        // Logo visible
        await expect(page.locator(selectors.landing.logo).first()).toBeVisible();

        // Hero headline
        await expect(page.locator('text=Özgürce Sohbet Et')).toBeVisible();

        // Primary CTA
        const startBtn = page.locator(selectors.landing.startButton).first();
        await expect(startBtn).toBeVisible();
    });

    test('should navigate to features page', async ({ page }) => {
        const featuresBtn = page.locator(selectors.landing.featuresButton).first();
        if (await featuresBtn.isVisible()) {
            await featuresBtn.click();
            // Features section or page should be visible
            await expect(page.locator('text=Grup Sohbetleri')).toBeVisible({ timeout: 5000 });
        }
    });

    test('should navigate to login page via CTA', async ({ page }) => {
        await page.locator(selectors.landing.startButton).first().click();

        // Should see either login form or auth page
        await page.waitForSelector(selectors.auth.emailInput, { timeout: 10_000 });
        await expect(page.locator(selectors.auth.emailInput)).toBeVisible();
    });
});

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);

        // Navigate to login
        await page.locator(selectors.landing.startButton).first().click();
        await page.waitForSelector(selectors.auth.emailInput, { timeout: 10_000 });
    });

    test('should show login form with all fields', async ({ page }) => {
        await expect(page.locator(selectors.auth.emailInput)).toBeVisible();
        await expect(page.locator(selectors.auth.passwordInput)).toBeVisible();
        await expect(page.locator(selectors.auth.loginSubmit)).toBeVisible();
    });

    test('should show error on invalid credentials', async ({ page }) => {
        await page.fill(selectors.auth.emailInput, 'invalid@test.com');
        await page.fill(selectors.auth.passwordInput, 'wrongpassword');
        await page.click(selectors.auth.loginSubmit);

        // Error message should appear
        await page.waitForSelector(selectors.auth.errorMessage, { timeout: 10_000 });
        const errorEl = page.locator(selectors.auth.errorMessage);
        await expect(errorEl).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
        const registerLink = page.locator(selectors.auth.registerLink);
        await expect(registerLink).toBeVisible();
        await registerLink.click();

        // Register form should be visible
        await expect(page.locator(selectors.auth.firstNameInput)).toBeVisible({ timeout: 5000 });
        await expect(page.locator(selectors.auth.registerSubmit)).toBeVisible();
    });

    test('should navigate back to landing', async ({ page }) => {
        await page.locator(selectors.auth.backButton).click();

        // Should see landing page again
        await expect(page.locator(selectors.landing.startButton).first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Register Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);

        // Navigate to login first
        await page.locator(selectors.landing.startButton).first().click();
        await page.waitForSelector(selectors.auth.emailInput, { timeout: 10_000 });

        // Then to register
        await page.locator(selectors.auth.registerLink).click();
        await page.waitForSelector(selectors.auth.firstNameInput, { timeout: 5000 });
    });

    test('should show register form with all fields', async ({ page }) => {
        await expect(page.locator(selectors.auth.firstNameInput)).toBeVisible();
        await expect(page.locator(selectors.auth.lastNameInput)).toBeVisible();
        await expect(page.locator(selectors.auth.emailInput)).toBeVisible();
        await expect(page.locator(selectors.auth.passwordInput)).toBeVisible();
        await expect(page.locator(selectors.auth.termsCheckbox)).toBeVisible();
        await expect(page.locator(selectors.auth.registerSubmit)).toBeVisible();
    });

    test('should require terms acceptance', async ({ page }) => {
        // Fill form without checking terms
        await page.fill(selectors.auth.firstNameInput, 'Test');
        await page.fill(selectors.auth.lastNameInput, 'User');
        await page.fill(selectors.auth.emailInput, 'newuser@test.com');
        await page.fill(selectors.auth.passwordInput, 'TestPassword123!');

        await page.click(selectors.auth.registerSubmit);

        // Terms validation — either browser native validation or custom error
        // The form should not navigate away
        await expect(page.locator(selectors.auth.registerSubmit)).toBeVisible();
    });

    test('should navigate back to login', async ({ page }) => {
        const loginLink = page.locator(selectors.auth.loginLink);
        await expect(loginLink).toBeVisible();
        await loginLink.click();

        // Login form should be visible
        await expect(page.locator(selectors.auth.loginSubmit)).toBeVisible({ timeout: 5000 });
    });
});
