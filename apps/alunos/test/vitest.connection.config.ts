import { defineConfig } from 'vitest/config';

if (process.env.RUN_ALUNOS_DB_CHECK !== '1') {
  throw new Error(
    'Defina RUN_ALUNOS_DB_CHECK=1 para autorizar o teste SELECT 1.',
  );
}

export default defineConfig({
  test: {
    globals: true,
    include: ['apps/alunos/test/prisma.connection.integration.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
