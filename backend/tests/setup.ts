// Set NODE_ENV to test for all test runs
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';

// ─── Chainable Query Builder (per-call isolation) ───
function createChainBuilder() {
    const chain: any = {
        _insertData: null,
        _table: null,
        _filterField: null,
        _filterValue: null,
    };

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn((field: string, value: any) => {
        chain._filterField = field;
        chain._filterValue = value;
        return chain;
    });
    chain.neq = jest.fn(() => chain);
    chain.not = jest.fn(() => chain);
    chain.update = jest.fn(() => chain);
    chain.insert = jest.fn((data: any) => {
        chain._insertData = data;
        return chain;
    });
    chain.maybeSingle = jest.fn().mockResolvedValue({ data: { user_id: 'test-user-id' }, error: null });
    chain.single = jest.fn(() => {
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
    from: jest.fn((table: string) => {
        const chain = createChainBuilder();
        chain._table = table;
        return chain;
    }),
    auth: {
        getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null
        }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
    },
};

jest.mock('../supabaseClient', () => ({
    __esModule: true,
    default: mockSupabaseClient,
}));

// Mock Redis to avoid connection errors during tests
const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
};

jest.mock('../redisClient', () => ({
    __esModule: true,
    default: mockRedis,
}));
