import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { env } from '../../config/env';

function createTestRedisClient() {
    const options: any = {
        host: env.REDIS_HOST,
        port: parseInt(env.REDIS_PORT, 10),
        username: 'default',
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 5,
        retryStrategy: (times: number) => Math.min(times * 200, 2000),
        tls: env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
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
}

describe('rateLimitMsg Lua script', () => {
    let redis: Redis;

    beforeAll(() => new Promise<void>((resolve, reject) => {
        redis = createTestRedisClient();
        if (redis.status === 'ready') return resolve();
        redis.once('ready', () => resolve());
        redis.once('error', reject);
    }), 10000);

    afterAll(() => { if (redis) redis.disconnect(); });

    it('returns 1 on first call (allowed)', async () => {
        const key = `test:ratelimit:${Date.now()}`;
        const result = await (redis as any).rateLimitMsg(key, 500);
        expect(result).toBe(1);
        await redis.del(key);
    });

    it('returns 0 on second call within window (rate limited)', async () => {
        const key = `test:ratelimit:${Date.now()}`;
        await (redis as any).rateLimitMsg(key, 500);
        const result = await (redis as any).rateLimitMsg(key, 500);
        expect(result).toBe(0);
        await redis.del(key);
    });

    it('returns 1 after TTL expires', async () => {
        const key = `test:ratelimit:${Date.now()}`;
        await (redis as any).rateLimitMsg(key, 100);
        await new Promise(r => setTimeout(r, 150));
        const result = await (redis as any).rateLimitMsg(key, 100);
        expect(result).toBe(1);
        await redis.del(key);
    });
});

describe('decrementConnections Lua script', () => {
    let redis: Redis;

    beforeAll(() => new Promise<void>((resolve, reject) => {
        redis = createTestRedisClient();
        if (redis.status === 'ready') return resolve();
        redis.once('ready', () => resolve());
        redis.once('error', reject);
    }), 10000);

    afterAll(() => { if (redis) redis.disconnect(); });

    it('returns remaining count after DECR', async () => {
        const key = `test:conn:${Date.now()}`;
        await redis.set(key, 3);
        const result = await (redis as any).decrementConnections(key);
        expect(result).toBe(2);
        await redis.del(key);
    });

    it('returns 0 and DELs key when count goes to 0', async () => {
        const key = `test:conn:${Date.now()}`;
        await redis.set(key, 1);
        const result = await (redis as any).decrementConnections(key);
        expect(result).toBe(0);
        const exists = await redis.exists(key);
        expect(exists).toBe(0);
    });

    it('returns 0 and DELs key if DECR goes negative', async () => {
        const key = `test:conn:${Date.now()}`;
        await redis.set(key, 0);
        const result = await (redis as any).decrementConnections(key);
        expect(result).toBe(0);
        const exists = await redis.exists(key);
        expect(exists).toBe(0);
    });
});