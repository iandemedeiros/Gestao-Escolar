import { vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const professorRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  nome: 'Professor ficticio',
  formacao: null,
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const contatoRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  professor_id: '123e4567-e89b-42d3-a456-426614174010',
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const disponibilidade_horarioRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  professor_id: '123e4567-e89b-42d3-a456-426614174010',
  dia_semana: 'segunda',
  hora_inicio: new Date('1970-01-01T08:00:00Z'),
  hora_fim: new Date('1970-01-01T10:00:00Z'),
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
    professor: {
      findUnique: vi.fn().mockResolvedValue(professorRow),
      findMany: vi.fn().mockResolvedValue([professorRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(professorRow),
      update: vi.fn().mockResolvedValue(professorRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
    contato: {
      findUnique: vi.fn().mockResolvedValue(contatoRow),
      findMany: vi.fn().mockResolvedValue([contatoRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(contatoRow),
      update: vi.fn().mockResolvedValue(contatoRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
    disponibilidade_horario: {
      findUnique: vi.fn().mockResolvedValue(disponibilidade_horarioRow),
      findMany: vi.fn().mockResolvedValue([disponibilidade_horarioRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(disponibilidade_horarioRow),
      update: vi.fn().mockResolvedValue(disponibilidade_horarioRow),
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
