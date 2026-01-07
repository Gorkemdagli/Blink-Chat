const winston = require('winston');
const path = require('path');

// Log level from environment (default: 'info' in production, 'debug' in development)
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

// Log format
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'chat-backend' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error'
        }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log')
        })
    ]
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        )
    }));
}

// Create a stream object that will be used by `morgan`
logger.stream = {
    write: function (message) {
        // Use the 'info' log level so the output will be picked up by both transports
        logger.info(message.trim());
    },
};

module.exports = logger;
