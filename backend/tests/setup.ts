// Set NODE_ENV to test for all test runs
process.env.NODE_ENV = 'test';

// Comprehensive Supabase Mock for all tests
const mockSupabaseBuilder = {
    _table: null as string | null,
    _insertData: null as any,
    _selectCalled: false,
    _filterField: null as string | null,
    _filterValue: null as any,

    from: jest.fn(function (this: any, table: string) {
        this._table = table;
        this._insertData = null;
        this._selectCalled = false;
        this._filterField = null;
        this._filterValue = null;
        return this;
    }),

    insert: jest.fn(function (this: any, data: any) {
        this._insertData = data;
        return this;
    }),

    select: jest.fn(function (this: any, fields?: string) {
        this._selectCalled = true;
        return this;
    }),

    eq: jest.fn(function (this: any, field: string, value: any) {
        this._filterField = field;
        this._filterValue = value;
        return this;
    }),

    neq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),

    single: jest.fn(function (this: any) {
        // Return user data for user queries
        return Promise.resolve({
            data: {
                id: this._filterValue || 'test-user-id',
                username: 'testuser',
                email: 'test@example.com',
                user_code: 'TEST123',
                avatar_url: null
            },
            error: null
        });
    }),

    // Handle await on the builder (for insert().select() chains)
    then: function (this: any, resolve: any, reject: any) {
        if (this._insertData) {
            // Return inserted message data
            const messageData = Array.isArray(this._insertData) ? this._insertData[0] : this._insertData;
            resolve({
                data: [{
                    id: Math.floor(Math.random() * 10000),
                    ...messageData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }],
                error: null
            });
        } else if (this._table === 'messages' && this._filterField) {
            // Return empty array for update queries
            resolve({
                data: [],
                error: null,
                count: 0
            });
        } else {
            resolve({ data: [], error: null });
        }
    }
};

jest.mock('../supabaseClient', () => mockSupabaseBuilder);

// Mock Redis to avoid connection errors during tests
const mockRedis = {
    get: jest.fn().mockResolvedValue(null), // Always return null (cache miss)
    set: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(), // Mock event listeners
};

jest.mock('../redisClient', () => mockRedis);
