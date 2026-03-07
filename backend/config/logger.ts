import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

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
        // Daily rotation for error logs
        new winston.transports.DailyRotateFile({
            filename: path.join(__dirname, '../logs/error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error'
        }),
        // Daily rotation for all logs (combined)
        new winston.transports.DailyRotateFile({
            filename: path.join(__dirname, '../logs/combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ]
}) as winston.Logger & { stream: { write: (message: string) => void } };

// If we're not in production and not in test, log to the `console` with the format:
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        )
    }));
}

// Create a stream object that will be used by `morgan`
(logger as any).stream = {
    write: function (message: string) {
        // Use the 'info' log level so the output will be picked up by both transports
        logger.info(message.trim());
    },
};

export default logger;

