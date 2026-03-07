import express, { Request, Response } from 'express';
import redis from '../redisClient';
import supabase from '../supabaseClient';
import logger from '../config/logger';

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check server health
 *     description: Returns the health status, timestamp, and uptime of the server.
 *     responses:
 *       200:
 *         description: Server is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 services:
 *                   type: object
 *                   properties:
 *                     redis:
 *                       type: string
 *                       example: UP
 *                     database:
 *                       type: string
 *                       example: UP
 *       503:
 *         description: A dependent service (Redis or database) is down
 */
router.get('/', async (req: Request, res: Response) => {
    let redisStatus = 'DOWN';
    let postgresStatus = 'DOWN';

    // 1. Check Redis
    try {
        const ping = await redis.ping();
        if (ping === 'PONG') redisStatus = 'UP';
    } catch (error) {
        logger.error('HealthCheck: Redis connection failed', error);
    }

    // 2. Check Database (Supabase)
    try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (!error) {
            postgresStatus = 'UP';
        } else {
            logger.error('HealthCheck: Supabase query failed', error);
        }
    } catch (error) {
        logger.error('HealthCheck: Supabase exception', error);
    }

    // Determine overall health
    const isHealthy = redisStatus === 'UP' && postgresStatus === 'UP';
    const httpStatus = isHealthy ? 200 : 503;

    res.status(httpStatus).json({
        status: isHealthy ? 'UP' : 'DOWN',
        services: {
            redis: redisStatus,
            database: postgresStatus
        },
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

export default router;
