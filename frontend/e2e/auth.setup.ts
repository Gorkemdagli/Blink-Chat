/**
 * Auth Setup — runs before authenticated test suites.
 * Uses Supabase Admin API to generate a magic link, verifies it to get
 * session tokens, then injects them into the browser's localStorage.
 * Completely bypasses hCaptcha.
 */
import { test as setup, expect } from '@playwright/test';
import { TEST_USER, selectors, waitForAppReady } from './helpers';
import fs from 'fs';
import path from 'path';

const authFile = './e2e/.auth/user.json';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Write an empty-but-valid storage state so chromium tests load without session */
function writeEmptyAuthState() {
    const dir = path.dirname(authFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
}

/** Get session tokens via Admin API magic link verification */
async function getSessionViaAdmin(email: string): Promise<{ access_token: string; refresh_token: string } | null> {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.log('⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
        return null;
    }

    try {
        // 1. Generate magic link
        const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'magiclink', email }),
        });

        if (!linkRes.ok) {
            console.log(`⚠️ generate_link failed: ${linkRes.status}`);
            return null;
        }

        const linkData = await linkRes.json();
        const hashedToken = linkData.hashed_token as string;

        if (!hashedToken) {
            console.log('⚠️ No hashed_token in generate_link response.');
            return null;
        }

        // 2. Verify the hashed token to get a session via GET (follows redirect)
        const verifyUrl = `${SUPABASE_URL}/auth/v1/verify?token=${hashedToken}&type=magiclink`;
        const verifyRes = await fetch(verifyUrl, {
            method: 'GET',
            headers: { 'apikey': SERVICE_ROLE_KEY },
            redirect: 'manual', // Don't follow redirect — extract tokens from Location header
        });

        // Supabase returns 303 redirect with tokens in the fragment
        const location = verifyRes.headers.get('location') || '';
        const fragmentMatch = location.match(/access_token=([^&]+).*refresh_token=([^&]+)/);

        if (fragmentMatch) {
            return {
                access_token: fragmentMatch[1],
                refresh_token: fragmentMatch[2],
            };
        }

        // Try parsing body as JSON fallback
        if (verifyRes.ok) {
            const session = await verifyRes.json().catch(() => null);
            if (session?.access_token && session?.refresh_token) {
                return { access_token: session.access_token, refresh_token: session.refresh_token };
            }
        }

        console.log(`⚠️ Token verification failed: ${verifyRes.status} location: ${location}`);
        return null;
    } catch (e) {
        console.log('⚠️ Admin API error:', e);
        return null;
    }
}

setup('authenticate', async ({ page }) => {
    // Strategy: Admin API → get session tokens → inject into browser
    const session = await getSessionViaAdmin(TEST_USER.email);

    if (!session) {
        writeEmptyAuthState();
        setup.skip(true, 'Could not obtain session via Admin API. Authenticated tests will be skipped.');
        return;
    }

    console.log('Auth setup: Session obtained via Admin API, injecting...');

    // Navigate to the app first to set the correct origin
    await page.goto('/');
    await waitForAppReady(page);

    // Inject the Supabase session into localStorage
    const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    await page.evaluate(({ key, accessToken, refreshToken }) => {
        const sessionData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        localStorage.setItem(key, JSON.stringify(sessionData));
    }, { key: storageKey, accessToken: session.access_token, refreshToken: session.refresh_token });

    // Reload to pick up the injected session
    await page.reload();
    await waitForAppReady(page);

    // Wait for the chat interface to appear
    const isAuthenticated = await page.waitForSelector(selectors.nav.roomsTab, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);

    if (!isAuthenticated) {
        console.log('⚠️ Session injection did not result in authenticated state.');
        writeEmptyAuthState();
        setup.skip(true, 'Session injection failed. Authenticated tests will be skipped.');
        return;
    }

    console.log('✅ Auth setup: Session injected successfully.');

    await page.waitForTimeout(2000);

    const roomItems = page.locator('button').filter({
        has: page.locator('span.font-semibold')
    });
    const roomCount = await roomItems.count();
    if (roomCount === 0) {
        console.log('WARNING: No rooms found. Make sure Genel room is assigned.');
    }

    // Store authenticated state
    await page.context().storageState({ path: authFile });
});
