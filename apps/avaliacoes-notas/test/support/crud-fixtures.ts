import { vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const avaliacaoRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  turma_id: 1,
  disciplina_id: '123e4567-e89b-42d3-a456-426614174010',
  professor_id: '123e4567-e89b-42d3-a456-426614174011',
  titulo: 'Avaliacao ficticia',
  tipo: 'prova',
  peso: new Prisma.Decimal('1.25'),
  data_realizacao: new Date('2026-10-01T00:00:00Z'),
  data_entrega_final: new Date('2026-10-02T12:00:00Z'),
  entrega_do_aluno: null,
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const notaRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  avaliacao_id: '123e4567-e89b-42d3-a456-426614174010',
  aluno_id: '123e4567-e89b-42d3-a456-426614174011',
  valor_obtido: new Prisma.Decimal('8.50'),
  media_calculada: null,
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('private driver details', {
    code,
    clientVersion: '7.10.1',
    meta: { target: ['private'] },
  });
}
export function createPrismaMock() {
  const delegates = {
    avaliacao: {
      findUnique: vi.fn().mockResolvedValue(avaliacaoRow),
      findMany: vi.fn().mockResolvedValue([avaliacaoRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(avaliacaoRow),
      update: vi.fn().mockResolvedValue(avaliacaoRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
    nota: {
      findUnique: vi.fn().mockResolvedValue(notaRow),
      findMany: vi.fn().mockResolvedValue([notaRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(notaRow),
      update: vi.fn().mockResolvedValue(notaRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
  };
  return {
    client: {
      ...delegates,
      $transaction: vi.fn(
        async (callback: (tx: typeof delegates) => Promise<unknown>) =>
          callback(delegates),
      ),
    },
  };
}
