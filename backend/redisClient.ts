import Redis from 'ioredis';
import logger from './config/logger';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;

// Upstash (genellikle 6379 veya 6380) TLS gerektirir. 
// Render veya Upstash ortamında REDIS_TLS=true olarak ayarlanmalıdır.
const isTLS = process.env.REDIS_TLS === 'true' || redisPort === 6380;

const redisOptions: any = {
    host: redisHost,
    port: redisPort,
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

redis.on('connect', () => {
    logger.info(`✅ Redis bağlantısı kuruldu: ${redisHost}:${redisPort} (TLS: ${isTLS})`);
});

redis.on('error', (err) => {
    logger.error('❌ Redis hatası:', err);
});

export default redis;
