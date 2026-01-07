const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const morgan = require('morgan');
const logger = require('./config/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const basicAuth = require('express-basic-auth');

const { corsOptions, limiter } = require('./config/security');
const { setupSocketHandlers } = require('./socket/handlers');
const { scheduleCleanup } = require('./utils/cronJobs'); // Cron job update
const healthRoutes = require('./routes/health');

const app = express();

// Middleware
app.use(cors(corsOptions));
// Use morgan for HTTP request logging, piping to winston
app.use(morgan('combined', { stream: logger.stream }));
app.use('/api/', limiter);
app.use(express.json());


// Swagger Docs with Basic Auth
app.use('/api-docs', basicAuth({
    users: { [process.env.SWAGGER_USER || 'admin']: process.env.SWAGGER_PASSWORD || 'admin' },
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
    pingTimeout: 60000,
    pingInterval: 25000
});

// Setup Socket.IO event handlers
setupSocketHandlers(io);

// Initialize Cron Jobs (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    scheduleCleanup();
}

// Start server (only if run directly)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = { app, server, io };
