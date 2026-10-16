import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

// `generate` needs no database; `migrate` does, so fail clearly there.
if (!process.env.TURSO_DATABASE_URL && process.argv.includes('migrate')) {
  throw new Error('TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) to .env.local before running db:migrate.');
}

export default defineConfig({
  dialect: 'turso',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
