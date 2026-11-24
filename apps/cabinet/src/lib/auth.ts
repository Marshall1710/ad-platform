import { betterAuth } from 'better-auth';
import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export function createAuth(defaultRole: 'advertiser' | 'admin' = 'advertiser') {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL ?? '';
  if (!databaseUrl || !secret || !baseURL) {
    throw new Error('DATABASE_URL, BETTER_AUTH_SECRET и BETTER_AUTH_URL обязательны');
  }
  const origin = new URL(baseURL);
  const loopbackAlias = new URL(baseURL);
  if (origin.hostname === '127.0.0.1') loopbackAlias.hostname = 'localhost';
  else if (origin.hostname === 'localhost') loopbackAlias.hostname = '127.0.0.1';
  const trustedOrigins = loopbackAlias.hostname !== origin.hostname ? [loopbackAlias.origin] : [];
  return betterAuth({
    database: pool,
    secret,
    baseURL,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: defaultRole !== 'admin',
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 24 * 60 * 60,
      disableSessionRefresh: true,
    },
    user: {
      additionalFields: {
        role: {
          type: ['advertiser', 'admin'],
          required: false,
          defaultValue: defaultRole,
          input: false,
        },
      },
    },
    advanced: {
      useSecureCookies: baseURL.startsWith('https://'),
    },
  });
}

let currentAuth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return currentAuth ??= createAuth();
}


