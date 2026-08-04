import dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV ?? 'development';

dotenv.config({ path: nodeEnv === 'test' ? '.env.test' : '.env', quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  checkoutLockTtlSeconds: Number(required('CHECKOUT_LOCK_TTL_SECONDS')),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600),
};
