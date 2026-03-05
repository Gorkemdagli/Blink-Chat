import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;

// TLS is required for Upstash (port 6380) and can be forced via REDIS_TLS=true
const isTLS = process.env.REDIS_TLS === 'true' || redisPort === 6380;

const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    tls: isTLS ? {} : undefined,
    retryStrategy: (times) => {
        if (times > 20) return null;
        return Math.min(times * 50, 2000);
    }
});

redis.on('connect', () => {
    console.log(`✅ Redis connected to ${redisHost}:${redisPort} (TLS: ${isTLS})`);
});

redis.on('error', (err) => {
    if ((err as any).code === 'ECONNREFUSED') {
        console.warn(`⚠️ Redis connection refused at ${redisHost}:${redisPort}. Ensure Redis is running.`);
    } else {
        console.error('❌ Redis error:', err);
    }
});

export default redis;
