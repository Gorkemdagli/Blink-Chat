const express = require('express');
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
 */
router.get('/', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date(), uptime: process.uptime() });
});

module.exports = router;
