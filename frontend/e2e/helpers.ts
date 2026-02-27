/**
 * E2E Test Helpers
 * Shared utilities, selectors, and test data for all E2E tests.
 */
/// <reference types="node" />
import { Page, expect } from '@playwright/test';

// ─── Test Credentials ───────────────────────────────
// Set via environment variables for CI, fallback for local dev
export const TEST_USER = {
    email: process.env.E2E_USER_EMAIL || 'e2e-test@chatapp.dev',
    password: process.env.E2E_USER_PASSWORD || 'TestPassword123!',
    username: 'e2e-test',
};

export const TEST_USER_2 = {
    email: process.env.E2E_USER2_EMAIL || 'e2e-test2@chatapp.dev',
    password: process.env.E2E_USER2_PASSWORD || 'TestPassword123!',
    username: 'e2e-test2',
};

// ─── Page Object Selectors ──────────────────────────
export const selectors = {
    // Landing
    landing: {
        startButton: 'text=Hemen Başla',
        loginButton: 'text=Giriş Yap',
        featuresButton: 'text=Özellikler',
        logo: 'text=ChatApp',
    },

    // Auth
    auth: {
        emailInput: 'input[type="email"]',
        passwordInput: 'input[type="password"]',
        loginSubmit: 'button:has-text("Giriş Yap")',
        registerSubmit: 'button:has-text("Kaydı Tamamla")',
        registerLink: 'text=Ücretsiz Kayıt Olun',
        loginLink: 'text=Giriş Yapın',
        errorMessage: '.bg-red-50, .bg-red-900\\/20',
        backButton: 'text=Anasayfaya Dön',
        rememberMe: 'text=Beni Hatırla',
        firstNameInput: 'input[name="firstName"]',
        lastNameInput: 'input[name="lastName"]',
        termsCheckbox: 'input[name="acceptTerms"]',
    },

    // Chat
    chat: {
        sidebar: '[class*="sidebar"], [class*="Sidebar"]',
        roomList: '[class*="room"]',
        messageInput: 'input[placeholder*="Mesaj yaz"], textarea[placeholder*="Mesaj yaz"]',
        sendButton: '[data-testid="send-button"], button:has(svg)',
        messageList: '[data-testid="message-list"], [class*="message-list"], [class*="MessageList"]',
        chatHeader: '[data-testid="chat-header"]',
    },

    // Navigation
    nav: {
        friendsTab: 'text=Arkadaşlar',
        roomsTab: 'text=Sohbetler',
        addFriend: 'text=Arkadaş Ekle',
        createGroup: 'text=Grup Oluştur',
    },

    // Common
    common: {
        loading: '.animate-spin',
        toast: '[class*="toast"], [class*="Toast"]',
    },
} as const;

// ─── Helper Functions ───────────────────────────────

/** Wait for the app to finish initial loading */
export async function waitForAppReady(page: Page) {
    // Wait for the loading spinner to disappear
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 30_000 }).catch(() => {
        // Spinner may never appear if load is fast
    });
    // Ensure page is not blank
    await expect(page.locator('body')).not.toBeEmpty();
}

/** Perform login via the UI */
export async function loginViaUI(page: Page, email: string, password: string) {
    // Navigate to base
    await page.goto('/');
    await waitForAppReady(page);

    // Click "Hemen Başla" or "Giriş Yap" on landing
    const startBtn = page.locator(selectors.landing.startButton).first();
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startBtn.click();
    }

    // Wait for login form
    await page.waitForSelector(selectors.auth.emailInput, { timeout: 10_000 });

    // Make sure we're on login page (not register)
    const loginSubmit = page.locator(selectors.auth.loginSubmit);
    if (!await loginSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Might be on register, click login link
        const loginLink = page.locator(selectors.auth.loginLink);
        if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginLink.click();
            await page.waitForSelector(selectors.auth.loginSubmit, { timeout: 5000 });
        }
    }

    // Fill credentials
    await page.fill(selectors.auth.emailInput, email);
    await page.fill(selectors.auth.passwordInput, password);

    // Submit
    await page.click(selectors.auth.loginSubmit);

    // Wait for navigation to chat or error
    await Promise.race([
        page.waitForSelector(selectors.chat.messageInput, { timeout: 15_000 }),
        page.waitForSelector(selectors.auth.errorMessage, { timeout: 15_000 }),
    ]);
}

/** Check if currently on chat interface (authenticated) */
export async function isOnChatInterface(page: Page): Promise<boolean> {
    try {
        await page.waitForSelector(selectors.chat.messageInput, { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/** Send a text message in the current chat room */
export async function sendMessage(page: Page, text: string) {
    const input = page.locator(selectors.chat.messageInput);
    await input.fill(text);
    await input.press('Enter');
}

/** Wait for a specific message to appear in the message list */
export async function waitForMessage(page: Page, text: string, timeout = 10_000) {
    await page.waitForSelector(`text="${text}"`, { timeout });
}
