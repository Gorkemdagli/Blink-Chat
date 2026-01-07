import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Dummy env vars for tests to prevent Supabase initialization errors
if (typeof import.meta.env === 'undefined') {
    global.import = { meta: { env: {} } };
}

import.meta.env.VITE_SUPABASE_URL = 'https://dummy.supabase.co';
import.meta.env.VITE_SUPABASE_ANON_KEY = 'dummy-key';

// Mock Supabase client globally
vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        })),
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(),
                getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://dummy.url' } })),
            })),
        },
    },
}));
