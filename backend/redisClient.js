const Redis = require('ioredis');

// Default to localhost for local dev without docker or if env vars missing
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

const redis = new Redis({
    host: redisHost,
    port: redisPort,
    // Retry strategy
    retryStrategy: (times) => {
        // Stop retrying after 20 times
        if (times > 20) {
            return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log(`✅ Redis connected to ${redisHost}:${redisPort}`);
});

redis.on('error', (err) => {
    // Suppress connection refused errors during development if redis isn't running
    if (err.code === 'ECONNREFUSED') {
        console.warn(`⚠️ Redis connection refused at ${redisHost}:${redisPort}. Ensure Redis is running.`);
    } else {
        console.error('❌ Redis error:', err);
    }
});

module.exports = redis;
