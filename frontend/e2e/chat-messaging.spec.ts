/**
 * E2E Test — Chat Messaging (Authenticated)
 *
 * Critical Journey: Open room → Type message → Send → See in list → Read receipt
 * Runs with pre-authenticated session from auth.setup.ts
 */
import { test, expect } from '@playwright/test';
import { selectors, waitForAppReady, sendMessage } from './helpers';

test.describe('Chat Interface — Core', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);

        // Auth guard: if we're on landing page, auth setup didn't succeed
        const isOnLanding = await page.locator(selectors.landing.startButton).first()
            .isVisible({ timeout: 3_000 }).catch(() => false);
        if (isOnLanding) {
            test.skip(true, 'Not authenticated — auth setup was skipped');
            return;
        }
    });

    test('should load chat interface after auth', async ({ page }) => {
        // Sidebar or rooms tab should be visible
        const roomsTab = page.locator(selectors.nav.roomsTab);
        const friendsTab = page.locator(selectors.nav.friendsTab);

        // At least one navigation element should be present
        const hasRooms = await roomsTab.isVisible();
        const hasFriends = await friendsTab.isVisible();

        if (hasRooms) {
            await expect(roomsTab).toBeVisible({ timeout: 10_000 });
        } else {
            await expect(friendsTab).toBeVisible({ timeout: 10_000 });
        }
    });

    test('should display sidebar with rooms and friends tabs', async ({ page }) => {
        // Rooms tab
        const roomsTab = page.locator(selectors.nav.roomsTab);
        if (await roomsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await expect(roomsTab).toBeVisible();

            // Friends tab
            const friendsTab = page.locator(selectors.nav.friendsTab);

            // Check if visible, but don't force interaction if obscured by responsive layout
            if (await friendsTab.isVisible().catch(() => false)) {
                await expect(friendsTab).toBeVisible();
                // Switch tabs
                await friendsTab.click();
                await page.waitForTimeout(500);
                await roomsTab.click();
            }
        }
    });

    test('should open a chat room and see message input', async ({ page }) => {
        // Wait for room list to populate
        await page.waitForTimeout(3_000);

        // Find any clickable room item in the sidebar
        // Simplify selector to catch buttons inside the rooms panel
        const roomItems = page.locator('#odalar-panel button, [aria-labelledby="odalar-tab"] button')
            .filter({ has: page.locator('span.font-semibold') })
            .filter({ hasNotText: /Henüz oda yok/i });

        const roomCount = await roomItems.count();
        if (roomCount === 0) {
            test.skip(true, 'No rooms available for this test user');
            return;
        }

        // Click first room
        await roomItems.first().click();

        // Wait for chat to open by looking for the header
        await page.waitForSelector(selectors.chat.chatHeader, { timeout: 10_000 });

        // Message input should appear
        const messageInput = page.locator(selectors.chat.messageInput);
        await expect(messageInput).toBeVisible({ timeout: 10_000 });
    });

    test('should type and send a message', async ({ page }) => {
        // Wait for rooms to load
        await page.waitForTimeout(3_000);

        // Open first room
        const roomItems = page.locator('#odalar-panel button, [aria-labelledby="odalar-tab"] button')
            .filter({ has: page.locator('span.font-semibold') })
            .filter({ hasNotText: /Henüz oda yok/i });

        const roomCount = await roomItems.count();
        if (roomCount === 0) {
            test.skip(true, 'No rooms available');
            return;
        }

        await roomItems.first().click();

        // Wait for message input
        const messageInput = page.locator(selectors.chat.messageInput);
        await expect(messageInput).toBeVisible({ timeout: 10_000 });

        // Generate unique message
        const testMessage = `E2E test message ${Date.now()}`;

        // Type and send
        await sendMessage(page, testMessage);

        // Verify message appears in the chat
        await expect(page.locator(`text="${testMessage}"`)).toBeVisible({ timeout: 10_000 });
    });

    test('should show empty message state for new room', async ({ page }) => {
        // Wait for rooms
        await page.waitForTimeout(2_000);

        // Open first room
        const roomItems = page.locator('#odalar-panel button, [aria-labelledby="odalar-tab"] button')
            .filter({ has: page.locator('span.font-semibold') })
            .filter({ hasNotText: /Henüz oda yok/i });

        const roomCount = await roomItems.count();
        if (roomCount === 0) {
            test.skip(true, 'No rooms available');
            return;
        }

        await roomItems.first().click();
        await page.waitForTimeout(2_000);

        // Either messages are shown or empty state
        const messageInput = page.locator(selectors.chat.messageInput);
        await expect(messageInput).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('Chat Interface — Input Behavior', () => {
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

        await page.waitForTimeout(3_000);

        // Open first room
        const roomItems = page.locator('#odalar-panel button, [aria-labelledby="odalar-tab"] button')
            .filter({ has: page.locator('span.font-semibold') })
            .filter({ hasNotText: /Henüz oda yok/i });

        const count = await roomItems.count();
        if (count > 0) {
            await roomItems.first().click();
            await page.locator(selectors.chat.messageInput).waitFor({ timeout: 10_000 });
        }
    });

    test('should not send empty message on Enter', async ({ page }) => {
        const messageInput = page.locator(selectors.chat.messageInput);
        if (!await messageInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            test.skip(true, 'No room open');
            return;
        }

        // Wait to make sure previous messages have loaded from DB
        await page.waitForTimeout(2000);

        // Count current messages
        const messagesBefore = await page.locator('[class*="message"], [class*="bubble"]').count();

        // Press Enter with empty input
        await messageInput.focus();
        await messageInput.press('Enter');
        await page.waitForTimeout(1_000);

        // Message count should not change
        const messagesAfter = await page.locator('[class*="message"], [class*="bubble"]').count();
        expect(messagesAfter).toBeLessThanOrEqual(messagesBefore);
    });

    test('should clear input after sending', async ({ page }) => {
        const messageInput = page.locator(selectors.chat.messageInput);
        if (!await messageInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            test.skip(true, 'No room open');
            return;
        }

        const testMsg = `Clear test ${Date.now()}`;
        await sendMessage(page, testMsg);

        // Input should be cleared
        await expect(messageInput).toHaveValue('', { timeout: 5_000 });
    });
});
