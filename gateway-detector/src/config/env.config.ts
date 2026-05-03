import { z } from 'zod';

const EnvSchema = z.object({
  PORT:                z.coerce.number().default(4000),
  DB_HOST:             z.string().default('localhost'),
  DB_PORT:             z.coerce.number().default(3306),
  DB_USERNAME:         z.string(),
  DB_PASSWORD:         z.string(),
  DB_DATABASE:         z.string(),
  ML_SERVICE_URL:      z.string().url(),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().default(10_000),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${result.error.issues
        .map(e => `  ${e.path.join('.')}: ${e.message}`)
        .join('\n')}`
    );
  }
  return result.data;
}