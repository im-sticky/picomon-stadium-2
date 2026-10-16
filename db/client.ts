import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Db = LibSQLDatabase<typeof schema>;

let instance: Db | null = null;

export function getDb(): Db {
  if (instance) return instance;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set');
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  instance = drizzle(client, { schema });
  return instance;
}

export function setDbForTests(db: Db | null): void {
  instance = db;
}
