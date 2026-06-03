/// <reference types="vitest/globals" />
// Set NODE_ENV to test for all test runs
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

// ─── Chainable Query Builder (per-call isolation) ───
function createChainBuilder() {
    const chain: any = {
        _insertData: null,
        _table: null,
        _filterField: null,
        _filterValue: null,
    };

    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn((field: string, value: any) => {
        chain._filterField = field;
        chain._filterValue = value;
        return chain;
    });
    chain.neq = vi.fn(() => chain);
    chain.not = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.insert = vi.fn((data: any) => {
        chain._insertData = data;
        return chain;
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'test-user-id' }, error: null });
    chain.single = vi.fn(() => {
        return Promise.resolve({
            data: {
                id: chain._filterValue || 'test-user-id',
                username: 'testuser',
                email: 'test@example.com',
                user_code: 'TEST123',
                avatar_url: null
            },
            error: null
        });
    });

    // Handle await on the chain (for insert().select() pattern)
    chain.then = function (resolve: any, _reject: any) {
        if (chain._insertData) {
            const messageData = Array.isArray(chain._insertData) ? chain._insertData[0] : chain._insertData;
            resolve({
                data: [{
                    id: Math.floor(Math.random() * 10000),
                    ...messageData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }],
                error: null
            });
        } else if (chain._table === 'messages' && chain._filterField) {
            resolve({ data: [], error: null, count: 0 });
        } else {
            resolve({ data: [], error: null });
        }
    };

    return chain;
}

// ─── Root mock (NO `then` — prevents thenable resolution) ───
const mockSupabaseClient = {
    from: vi.fn((table: string) => {
        const chain = createChainBuilder();
        chain._table = table;
        return chain;
    }),
    auth: {
        getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null
        }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
    },
};

vi.mock('../supabaseClient', () => ({
    __esModule: true,
    default: mockSupabaseClient,
}));
