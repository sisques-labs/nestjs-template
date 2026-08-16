import { z } from 'zod';

import { validateProductionCorsOrigins } from './cors-origins';

function formatZodIssues(issues: z.ZodIssue[]): string {
  return issues
    .map(
      (issue) =>
        `  - ${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
    )
    .join('\n');
}

const baseEnvSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_DRIVER: z.string().optional(),
    DATABASE_HOST: z.string().trim().min(1, 'DATABASE_HOST must not be empty'),
    DATABASE_PORT: z.string().optional(),
    DATABASE_USERNAME: z
      .string()
      .trim()
      .min(1, 'DATABASE_USERNAME must not be empty'),
    DATABASE_PASSWORD: z.string().min(1, 'DATABASE_PASSWORD must not be empty'),
    DATABASE_DATABASE: z
      .string()
      .trim()
      .min(1, 'DATABASE_DATABASE must not be empty'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().trim().url().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_TRACES_SAMPLE_RATIO: z.coerce.number().min(0).max(1).optional(),
    OTEL_METRIC_EXPORT_INTERVAL_MILLIS: z.coerce.number().positive().optional(),
    KAFKA_ENABLED: z.enum(['true', 'false']).optional(),
    KAFKA_BROKERS: z.string().optional(),
    KAFKA_CLIENT_ID: z.string().optional(),
    KAFKA_TOPIC_PREFIX: z.string().optional(),
    KAFKA_SSL: z.enum(['true', 'false']).optional(),
    KAFKA_SASL_MECHANISM: z
      .enum(['plain', 'scram-sha-256', 'scram-sha-512'])
      .optional(),
    KAFKA_SASL_USERNAME: z.string().optional(),
    KAFKA_SASL_PASSWORD: z.string().optional(),
    IDENTITY_PROVIDER: z.enum(['cognito', 'supabase', 'oidc']).optional(),
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    COGNITO_REGION: z.string().optional(),
    COGNITO_HOSTED_UI_DOMAIN: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_JWT_SECRET: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    OIDC_ISSUER_URL: z.string().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    OIDC_ROLE_CLAIM: z.string().optional(),
    // OAuth/BFF session login (src/core/identity/) — opt-in via
    // OAUTH_SESSION_ENABLED, layered on top of IDENTITY_PROVIDER.
    OAUTH_SESSION_ENABLED: z.enum(['true', 'false']).optional(),
    SESSION_REDIS_URL: z.string().optional(),
    // Defaults applied at the config-reading call site, not here — mirrors
    // how e.g. kafkaConfig()/appConfig() fall back with `?? 'default'`.
    SESSION_COOKIE_NAME: z.string().optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().optional(),
    OAUTH_REDIRECT_URI: z.string().optional(),
    OAUTH_SUCCESS_REDIRECT_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.KAFKA_ENABLED === 'true' && !env.KAFKA_BROKERS?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KAFKA_BROKERS'],
        message: 'KAFKA_BROKERS is required when KAFKA_ENABLED is "true"',
      });
    }

    if (env.IDENTITY_PROVIDER === 'cognito') {
      requireFields(
        ctx,
        [
          'COGNITO_USER_POOL_ID',
          'COGNITO_CLIENT_ID',
          'COGNITO_REGION',
          'COGNITO_HOSTED_UI_DOMAIN',
        ],
        env,
        { field: 'IDENTITY_PROVIDER', value: env.IDENTITY_PROVIDER },
      );
    }

    if (env.IDENTITY_PROVIDER === 'supabase') {
      requireFields(
        ctx,
        ['SUPABASE_URL', 'SUPABASE_JWT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'],
        env,
        { field: 'IDENTITY_PROVIDER', value: env.IDENTITY_PROVIDER },
      );
    }

    if (env.IDENTITY_PROVIDER === 'oidc') {
      requireFields(
        ctx,
        ['OIDC_ISSUER_URL', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'],
        env,
        { field: 'IDENTITY_PROVIDER', value: env.IDENTITY_PROVIDER },
      );
    }

    if (env.OAUTH_SESSION_ENABLED === 'true') {
      requireFields(
        ctx,
        [
          'SESSION_REDIS_URL',
          'OAUTH_REDIRECT_URI',
          'OAUTH_SUCCESS_REDIRECT_URL',
        ],
        env,
        { field: 'OAUTH_SESSION_ENABLED', value: env.OAUTH_SESSION_ENABLED },
      );

      if (!env.IDENTITY_PROVIDER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['IDENTITY_PROVIDER'],
          message:
            'IDENTITY_PROVIDER is required when OAUTH_SESSION_ENABLED is "true"',
        });
      }
    }
  });

function requireFields(
  ctx: z.RefinementCtx,
  fields: string[],
  env: Record<string, unknown>,
  trigger: { field: string; value: string | undefined },
): void {
  for (const field of fields) {
    const value = env[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} is required when ${trigger.field} is "${String(trigger.value)}"`,
      });
    }
  }
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = baseEnvSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(
      `Environment validation failed:\n${formatZodIssues(parsed.error.issues)}`,
    );
  }

  if (parsed.data.NODE_ENV === 'production') {
    const productionErrors = validateProductionCorsOrigins({
      CORS_ORIGINS:
        typeof config.CORS_ORIGINS === 'string'
          ? config.CORS_ORIGINS
          : undefined,
      FRONTEND_URL:
        typeof config.FRONTEND_URL === 'string'
          ? config.FRONTEND_URL
          : undefined,
    });

    if (productionErrors.length > 0) {
      throw new Error(
        `Environment validation failed:\n${productionErrors.join('\n')}`,
      );
    }
  }

  return config;
}
