import dotenv from 'dotenv';
dotenv.config();

// Validate environment variables early
import { env } from './config/env';

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import basicAuth from 'express-basic-auth';

import logger from './config/logger';
import swaggerSpecs from './config/swagger';
import { corsOptions, limiter } from './config/security';
import { setupSocketHandlers } from './socket/handlers';
import { scheduleCleanup, runCleanup } from './utils/cronJobs';
import healthRoutes from './routes/health';

const app = express();

// Trust proxy (required for Render/Vercel — correct IP for rate limiting)
app.set('trust proxy', 1);

// Middleware
app.use(cors(corsOptions));
// Use morgan for HTTP request logging, piping to winston
app.use(morgan('combined', { stream: logger.stream }));
app.use('/api/', limiter);
app.use(express.json());


// Swagger Docs with Basic Auth
app.use('/api-docs', basicAuth({
    users: { [env.SWAGGER_USER]: env.SWAGGER_PASSWORD },
    challenge: true,
    realm: 'SwaggerDocs',
}), swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Health Check Endpoint
app.use('/health', healthRoutes);

// HTTP Server
const server = http.createServer(app);

// Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Setup Socket.IO event handlers
setupSocketHandlers(io);

// Initialize Cron Jobs (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    // Run cleanup immediately on startup to catch missed jobs
    console.log('🚀 Server starting... Running initial cleanup check.');
    runCleanup();

    // Schedule daily job
    scheduleCleanup();
}

// Start server (only if run directly and not in test/worker environment)
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID || !!process.env.VITEST_WORKER_ID;

if (!isTestEnv) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export { app, server, io };
