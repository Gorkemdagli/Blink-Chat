import Redis from 'ioredis';
import logger from './config/logger';

// Robust Host Extraction: Strips protocol part if user accidentally provided a URL
let redisHost = process.env.REDIS_HOST || 'localhost';
redisHost = redisHost.replace(/^https?:\/\/|^rediss?:\/\//, '').split(':')[0];

const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;

// Upstash (usually 6379 or 6380) requires TLS. 
// Render or Upstash should have REDIS_TLS=true
let isTLS = process.env.REDIS_TLS === 'true' || redisPort === 6380;

// Force TLS if the host ends with upstash.io for safety
if (redisHost.endsWith('upstash.io')) isTLS = true;

const redisOptions: any = {
    host: redisHost,
    port: redisPort,
    username: 'default',
    password: redisPassword,
    retryStrategy: (times: number) => {
        if (times > 10) {
            logger.error('❌ Redis: Maksimum yeniden bağlanma denemesine ulaşıldı.');
            return null;
        }
        return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: null, // Socket.io adapter için önerilir
};

if (isTLS) {
    redisOptions.tls = {
        rejectUnauthorized: false // Upstash ve bazı cloud sağlayıcılar için gerekebilir
    };
}

const redis = new Redis(redisOptions);

// ─── Lua Scripts ───

// Atomic message rate limit: SET NX PX, returns 1 if allowed, 0 if rate limited
redis.defineCommand('rateLimitMsg', {
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

// Safe connection decrement: DECR then DEL if <= 0, returns remaining count
redis.defineCommand('decrementConnections', {
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

redis.on('connect', () => {
    logger.info(`✅ Redis bağlantısı kuruldu: ${redisHost}:${redisPort} (TLS: ${isTLS})`);
});

redis.on('error', (err) => {
    logger.error('❌ Redis hatası:', err);
});

export default redis;
