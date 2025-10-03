import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/shared/database/schema/*',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./database.db',
  },
  verbose: true,
  strict: true,
});
