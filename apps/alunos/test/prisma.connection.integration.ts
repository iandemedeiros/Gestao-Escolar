import '../src/config/environment.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Not matched by the normal unit or e2e configurations; opt-in is mandatory.
describe('alunos optional database connection', () => {
  it('executes only SELECT 1 through Prisma', async () => {
    if (process.env.RUN_ALUNOS_DB_CHECK !== '1') {
      throw new Error('Teste de conexão não autorizado.');
    }
    const service = new PrismaService();
    try {
      const rows = await service.client.$queryRaw<
        Array<{ ok: number | bigint }>
      >`
        SELECT 1 AS ok
      `;
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].ok)).toBe(1);
    } catch {
      // Avoid including driver errors, connection settings or data in test output.
      throw new Error(
        'Falha no teste opcional SELECT 1; verifique acesso e configuração.',
      );
    } finally {
      await service.onModuleDestroy();
    }
  });
});
