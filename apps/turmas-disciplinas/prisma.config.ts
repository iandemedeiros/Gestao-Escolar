import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Run the npm scripts from the monorepo root. Injected variables take priority.
config({
  path: resolve(
    process.env.TURMAS_DISCIPLINAS_ENV_FILE ?? 'apps/turmas-disciplinas/.env',
  ),
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Offline commands can load this config without real credentials.
  // Commands accessing the database require a real URL and explicit authorization.
  ...(process.env.DATABASE_URL
    ? { datasource: { url: process.env.DATABASE_URL } }
    : {}),
});
