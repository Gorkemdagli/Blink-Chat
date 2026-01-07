const cors = require('cors');
const rateLimit = require('express-rate-limit');

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow env var (possibly multiple, comma separated) or default to localhost
        const envOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : [];
        const allowedOrigins = [...envOrigins, 'http://localhost:5173'].filter(Boolean);
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST"],
    credentials: true
};

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: "Çok fazla istek, lütfen bekleyin"
});

module.exports = { corsOptions, limiter };
