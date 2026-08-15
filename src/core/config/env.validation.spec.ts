import { validateEnv } from './env.validation';

function validEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string> {
  return {
    NODE_ENV: 'development',
    DATABASE_DRIVER: 'postgres',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: 'secret',
    DATABASE_DATABASE: 'nestjs_template_db',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('accepts a complete non-production environment', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('rejects missing DATABASE_HOST', () => {
    const env = validEnv({ DATABASE_HOST: '' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*DATABASE_HOST/,
    );
  });

  it('rejects missing DATABASE_USERNAME', () => {
    const env = validEnv({ DATABASE_USERNAME: '' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*DATABASE_USERNAME/,
    );
  });

  it('rejects KAFKA_ENABLED=true without KAFKA_BROKERS', () => {
    const env = validEnv({ KAFKA_ENABLED: 'true' });

    expect(() => validateEnv(env)).toThrow(
      /KAFKA_BROKERS is required when KAFKA_ENABLED is "true"/,
    );
  });

  it('accepts KAFKA_ENABLED=true with KAFKA_BROKERS set', () => {
    const env = validEnv({
      KAFKA_ENABLED: 'true',
      KAFKA_BROKERS: 'localhost:9092',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects missing CORS origins in production', () => {
    const env = validEnv({ NODE_ENV: 'production' });

    expect(() => validateEnv(env)).toThrow(
      /CORS_ORIGINS or FRONTEND_URL: at least one origin must be configured in production/,
    );
  });

  it('accepts FRONTEND_URL as CORS origin in production', () => {
    const env = validEnv({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('accepts CORS_ORIGINS as CORS origin in production', () => {
    const env = validEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.example.com',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('formats a root-level issue without a field path', () => {
    expect(() =>
      validateEnv(null as unknown as Record<string, unknown>),
    ).toThrow(/\(root\)/);
  });

  it('accepts a valid OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    const env = validEnv({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects a non-URL OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    const env = validEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*OTEL_EXPORTER_OTLP_ENDPOINT/,
    );
  });

  it('accepts IDENTITY_PROVIDER unset', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('rejects an unsupported IDENTITY_PROVIDER value', () => {
    const env = validEnv({ IDENTITY_PROVIDER: 'okta' });

    expect(() => validateEnv(env)).toThrow(/Environment validation failed/);
  });

  it('rejects IDENTITY_PROVIDER=cognito without COGNITO_* vars', () => {
    const env = validEnv({ IDENTITY_PROVIDER: 'cognito' });

    expect(() => validateEnv(env)).toThrow(
      /COGNITO_USER_POOL_ID is required when IDENTITY_PROVIDER is "cognito"/,
    );
  });

  it('accepts IDENTITY_PROVIDER=cognito with all COGNITO_* vars set', () => {
    const env = validEnv({
      IDENTITY_PROVIDER: 'cognito',
      COGNITO_USER_POOL_ID: 'us-east-1_abc123',
      COGNITO_CLIENT_ID: 'client-id',
      COGNITO_REGION: 'us-east-1',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects IDENTITY_PROVIDER=supabase without SUPABASE_* vars', () => {
    const env = validEnv({ IDENTITY_PROVIDER: 'supabase' });

    expect(() => validateEnv(env)).toThrow(
      /SUPABASE_URL is required when IDENTITY_PROVIDER is "supabase"/,
    );
  });

  it('accepts IDENTITY_PROVIDER=supabase with all SUPABASE_* vars set', () => {
    const env = validEnv({
      IDENTITY_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_JWT_SECRET: 'secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects IDENTITY_PROVIDER=oidc without OIDC_* vars', () => {
    const env = validEnv({ IDENTITY_PROVIDER: 'oidc' });

    expect(() => validateEnv(env)).toThrow(
      /OIDC_ISSUER_URL is required when IDENTITY_PROVIDER is "oidc"/,
    );
  });

  it('accepts IDENTITY_PROVIDER=oidc with all OIDC_* vars set', () => {
    const env = validEnv({
      IDENTITY_PROVIDER: 'oidc',
      OIDC_ISSUER_URL: 'https://idp.example.com',
      OIDC_CLIENT_ID: 'client-id',
      OIDC_CLIENT_SECRET: 'client-secret',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects TENANCY_ENABLED=true without IDENTITY_PROVIDER', () => {
    const env = validEnv({ TENANCY_ENABLED: 'true' });

    expect(() => validateEnv(env)).toThrow(
      /IDENTITY_PROVIDER is required when TENANCY_ENABLED is "true"/,
    );
  });

  it('accepts TENANCY_ENABLED=true with IDENTITY_PROVIDER set', () => {
    const env = validEnv({
      TENANCY_ENABLED: 'true',
      IDENTITY_PROVIDER: 'oidc',
      OIDC_ISSUER_URL: 'https://idp.example.com',
      OIDC_CLIENT_ID: 'client-id',
      OIDC_CLIENT_SECRET: 'client-secret',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });
});
