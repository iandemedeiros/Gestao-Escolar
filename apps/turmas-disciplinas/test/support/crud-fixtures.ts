import { vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const turmaRow = {
  id: 1,
  nome: 'Turma ficticia',
  ano_letivo: 2026,
  turno: 'matutino',
  capacidade_maxima: 30,
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const disciplinaRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  nome: 'Disciplina ficticia',
  carga_horaria: 60,
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const alocacao_alunoRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  turma_id: 1,
  disciplina_id: '123e4567-e89b-42d3-a456-426614174010',
  aluno_id: '123e4567-e89b-42d3-a456-426614174011',
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const alocacao_professorRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  disciplina_id: '123e4567-e89b-42d3-a456-426614174010',
  professor_id: '123e4567-e89b-42d3-a456-426614174011',
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
    turma: {
      findUnique: vi.fn().mockResolvedValue(turmaRow),
      findMany: vi.fn().mockResolvedValue([turmaRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(turmaRow),
      update: vi.fn().mockResolvedValue(turmaRow),
      delete: vi.fn().mockResolvedValue({ id: 1 }),
    },
    disciplina: {
      findUnique: vi.fn().mockResolvedValue(disciplinaRow),
      findMany: vi.fn().mockResolvedValue([disciplinaRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(disciplinaRow),
      update: vi.fn().mockResolvedValue(disciplinaRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
    alocacao_aluno: {
      findUnique: vi.fn().mockResolvedValue(alocacao_alunoRow),
      findMany: vi.fn().mockResolvedValue([alocacao_alunoRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(alocacao_alunoRow),
      update: vi.fn().mockResolvedValue(alocacao_alunoRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
    alocacao_professor: {
      findUnique: vi.fn().mockResolvedValue(alocacao_professorRow),
      findMany: vi.fn().mockResolvedValue([alocacao_professorRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(alocacao_professorRow),
      update: vi.fn().mockResolvedValue(alocacao_professorRow),
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
