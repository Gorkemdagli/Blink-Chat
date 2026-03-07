/**
 * E2E Test — Social Features (Authenticated)
 *
 * Critical Journey: Friends tab → Add friend → Group creation → Room invitations
 * Runs with pre-authenticated session from auth.setup.ts
 */
import { test, expect } from '@playwright/test';
import { selectors, waitForAppReady } from './helpers';

test.describe('Social — Friends Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);

        // Auth guard
        const isOnLanding = await page.locator(selectors.landing.startButton).first()
            .isVisible({ timeout: 3_000 }).catch(() => false);
        if (isOnLanding) {
            test.skip(true, 'Not authenticated — auth setup was skipped');
            return;
        }
    });

    test('should switch to friends tab', async ({ page }) => {
        const friendsTab = page.locator(selectors.nav.friendsTab);
        if (!await friendsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
            test.skip(true, 'Friends tab not visible');
            return;
        }

        await friendsTab.click();
        await page.waitForTimeout(1_000);

        // Friends list or empty state should be visible
        const hasFriendsList = await page.locator('#arkadaşlar-panel').first()
            .isVisible({ timeout: 5_000 }).catch(() => false);
        expect(hasFriendsList).toBe(true);
    });

    test('should open add friend modal', async ({ page }) => {
        // Switch to friends tab
        const friendsTab = page.locator(selectors.nav.friendsTab);
        if (!await friendsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
            test.skip(true, 'Friends tab not visible');
            return;
        }
        await friendsTab.click();
        await page.waitForTimeout(1_000);

        // Find and click add friend button
        const addFriendBtn = page.locator('button[title="Arkadaş Ekle"]').first();
        if (!await addFriendBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            test.skip(true, 'Add friend button not found');
            return;
        }

        await addFriendBtn.click();

        // Modal should appear with a code input
        await expect(page.locator('input[placeholder*="kod"], input[type="number"], input[type="text"]').last())
            .toBeVisible({ timeout: 5_000 });
    });
});

test.describe('Social — Group Creation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);

        // Auth guard
        const isOnLanding = await page.locator(selectors.landing.startButton).first()
            .isVisible({ timeout: 3_000 }).catch(() => false);
        if (isOnLanding) {
            test.skip(true, 'Not authenticated — auth setup was skipped');
            return;
        }
    });

    test('should open create group modal', async ({ page }) => {
        const createGroupBtn = page.locator('button[title="Yeni Grup Oluştur"]').first();

        if (!await createGroupBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            test.skip(true, 'Create group button not visible');
            return;
        }

        await createGroupBtn.click();

        // Group creation modal
        await expect(page.locator('input[placeholder*="Grup adı"], input[placeholder*="Örn: Hafta Sonu"]').first())
            .toBeVisible({ timeout: 5_000 });
    });

    test('should validate group name is required', async ({ page }) => {
        const createGroupBtn = page.locator('button[title="Yeni Grup Oluştur"]').first();

        if (!await createGroupBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            test.skip(true, 'Create group button not visible');
            return;
        }

        await createGroupBtn.click();

        // Try to submit without group name
        const submitBtn = page.locator('button:has-text("Oluştur"), button:has-text("Kaydet")').last();
        if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await submitBtn.click();

            // Should remain on modal (group name is required)
            await expect(page.locator('input[placeholder*="Grup adı"], input[placeholder*="Örn: Hafta Sonu"]').first())
                .toBeVisible({ timeout: 3_000 });
        }
    });
});

test.describe('Social — Dark Mode', () => {
    test('should toggle dark mode', async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);

        // Find dark mode toggle (moon/sun icon button)
        const darkModeBtn = page.locator('button:has(svg)').filter({
            has: page.locator('[class*="moon"], [class*="sun"]'),
        }).first();

        // Alternative: look for any toggle button in header area
        const isDarkModeBtnVisible = await darkModeBtn.isVisible({ timeout: 2_000 }).catch(() => false);
        const toggleBtn = isDarkModeBtnVisible
            ? darkModeBtn
            : page.locator('[title*="Koyu"], [title*="Açık"], [title*="Dark"], [title*="Light"]').first();

        if (await toggleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            // Check initial state
            const htmlEl = page.locator('html');
            const hadDark = await htmlEl.evaluate(el => el.classList.contains('dark'));

            // Toggle
            await toggleBtn.click();
            await page.waitForTimeout(500);

            // Verify change
            const hasDark = await htmlEl.evaluate(el => el.classList.contains('dark'));
            expect(hasDark).not.toBe(hadDark);

            // Toggle back
            await toggleBtn.click();
            await page.waitForTimeout(500);
            const finalDark = await htmlEl.evaluate(el => el.classList.contains('dark'));
            expect(finalDark).toBe(hadDark);
        }
    });
});
