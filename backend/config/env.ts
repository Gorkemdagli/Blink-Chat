import { z } from 'zod';
import logger from './logger';

const envSchema = z.object({
    PORT: z.string().default('3000'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379'),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: z.string().optional(),
    SWAGGER_USER: z.string().default('admin'),
    SWAGGER_PASSWORD: z.string().default('admin_password'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const validateEnv = () => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n');
            logger.error(`❌ Critical environment variables are missing or invalid:\n${missingVars}`);
            process.exit(1);
        }
        throw error;
    }
};

export const env = validateEnv();
