import { vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';

export const alunoId = '123e4567-e89b-42d3-a456-426614174000';
export const otherAlunoId = '123e4567-e89b-42d3-a456-426614174001';
export const contatoId = '123e4567-e89b-42d3-a456-426614174002';
export const alunoInput = {
  nome: 'Aluno ficticio',
  data_nascimento: '2000-01-02',
  cpf: '52998224725',
  email: 'example@example.invalid',
  senha: 'Fictional-password-123!',
};
export const alunoRow = {
  id: alunoId,
  nome: alunoInput.nome,
  data_nascimento: new Date('2000-01-02T00:00:00Z'),
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  endereco_rua: 'private',
  contato: ['private'],
};
export const alunoResponse = {
  id: alunoId,
  nome: alunoInput.nome,
  data_nascimento: '2000-01-02',
};
export const contatoRow = {
  id: contatoId,
  aluno_id: alunoId,
  telefone: 'private',
  celular: 'private',
  email: 'private',
};
export const contatoResponse = { id: contatoId, aluno_id: alunoId };
export function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('private driver details', {
    code,
    clientVersion: '7.10.1',
    meta: { target: ['private'] },
  });
}
export function createPrismaMock() {
  const delegates = {
    aluno: {
      findUnique: vi.fn().mockResolvedValue(alunoRow),
      findMany: vi.fn().mockResolvedValue([alunoRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(alunoRow),
      update: vi.fn().mockResolvedValue(alunoRow),
      delete: vi.fn().mockResolvedValue({ id: alunoId }),
    },
    contato: {
      findMany: vi.fn().mockResolvedValue([contatoRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(contatoRow),
      update: vi.fn().mockResolvedValue(contatoRow),
      delete: vi.fn().mockResolvedValue({ id: contatoId }),
    },
  };
  const client = {
    ...delegates,
    $transaction: vi.fn(
      async (callback: (tx: typeof delegates) => Promise<unknown>) =>
        callback(delegates),
    ),
  };
  return { client };
}
