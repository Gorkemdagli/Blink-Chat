import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { env } from '../../config/env';

function createTestRedisClient(): Redis | null {
    try {
        const options: any = {
            host: env.REDIS_HOST,
            port: parseInt(env.REDIS_PORT, 10),
            username: 'default',
            password: env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
                if (times > 2) return null; // Stop retrying
                return Math.min(times * 200, 1000);
            },
            tls: env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
            lazyConnect: true,
        };
        const client = new Redis(options);

        // Define the same Lua scripts as redisClient.ts
        client.defineCommand('rateLimitMsg', {
            numberOfKeys: 1,
            lua: `
local key = KEYS[1]
local window = ARGV[1]
if redis.call('SET', key, '1', 'NX', 'PX', window) then
  return 1
else
  return 0
end
            `
        });

        client.defineCommand('decrementConnections', {
            numberOfKeys: 1,
            lua: `
local key = KEYS[1]
local val = redis.call('DECR', key)
if val <= 0 then
  redis.call('DEL', key)
  return 0
end
return val
            `
        });

        return client;
    } catch {
        return null;
    }
}

describe('rateLimitMsg Lua script', () => {
    let redis: Redis | null = null;
    let rateLimitKey: string;

    beforeAll(async () => {
        redis = createTestRedisClient();
        if (!redis) return;

        try {
            await redis.connect();
            await new Promise<void>((resolve, reject) => {
                if (redis!.status === 'ready') return resolve();
                const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
                redis!.once('ready', () => { clearTimeout(timeout); resolve(); });
                redis!.once('error', (err) => { clearTimeout(timeout); reject(err); });
            });
        } catch {
            redis = null;
        }
    }, 15000);

    afterAll(() => { if (redis) redis.disconnect(); });

    afterEach(() => { if (redis && redis.status === 'ready') redis.del(rateLimitKey); });

    it('returns 1 on first call (allowed)', async () => {
        if (!redis || redis.status !== 'ready') return;
        rateLimitKey = `test:ratelimit:${Date.now()}`;
        const result = await (redis as any).rateLimitMsg(rateLimitKey, 500);
        expect(result).toBe(1);
    });

    it('returns 0 on second call within window (rate limited)', async () => {
        if (!redis || redis.status !== 'ready') return;
        rateLimitKey = `test:ratelimit:${Date.now()}`;
        await (redis as any).rateLimitMsg(rateLimitKey, 500);
        const result = await (redis as any).rateLimitMsg(rateLimitKey, 500);
        expect(result).toBe(0);
    });

    it('returns 1 after TTL expires', async () => {
        if (!redis || redis.status !== 'ready') return;
        rateLimitKey = `test:ratelimit:${Date.now()}`;
        await (redis as any).rateLimitMsg(rateLimitKey, 100);
        await new Promise(r => setTimeout(r, 150));
        const result = await (redis as any).rateLimitMsg(rateLimitKey, 100);
        expect(result).toBe(1);
    });
});

describe('decrementConnections Lua script', () => {
    let redis: Redis | null = null;
    let connKey: string;

    beforeAll(async () => {
        redis = createTestRedisClient();
        if (!redis) return;

        try {
            await redis.connect();
            await new Promise<void>((resolve, reject) => {
                if (redis!.status === 'ready') return resolve();
                const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
                redis!.once('ready', () => { clearTimeout(timeout); resolve(); });
                redis!.once('error', (err) => { clearTimeout(timeout); reject(err); });
            });
        } catch {
            redis = null;
        }
    }, 15000);

    afterAll(() => { if (redis) redis.disconnect(); });

    afterEach(() => { if (redis && redis.status === 'ready') redis.del(connKey); });

    it('returns remaining count after DECR', async () => {
        if (!redis || redis.status !== 'ready') return;
        connKey = `test:conn:${Date.now()}`;
        await redis.set(connKey, 3);
        const result = await (redis as any).decrementConnections(connKey);
        expect(result).toBe(2);
    });

    it('returns 0 and DELs key when count goes to 0', async () => {
        if (!redis || redis.status !== 'ready') return;
        connKey = `test:conn:${Date.now()}`;
        await redis.set(connKey, 1);
        const result = await (redis as any).decrementConnections(connKey);
        expect(result).toBe(0);
        const exists = await redis.exists(connKey);
        expect(exists).toBe(0);
    });

    it('returns 0 and DELs key if DECR goes negative', async () => {
        if (!redis || redis.status !== 'ready') return;
        connKey = `test:conn:${Date.now()}`;
        await redis.set(connKey, 0);
        const result = await (redis as any).decrementConnections(connKey);
        expect(result).toBe(0);
        const exists = await redis.exists(connKey);
        expect(exists).toBe(0);
    });
});