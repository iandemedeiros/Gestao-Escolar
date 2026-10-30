import { vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const mensagemRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  remetenteId: '123e4567-e89b-42d3-a456-426614174010',
  destinatarioId: '123e4567-e89b-42d3-a456-426614174011',
  tipoId: '123e4567-e89b-42d3-a456-426614174012',
  dataEnvio: new Date('2026-10-01T12:00:00Z'),
  cpf: 'private',
  email: 'private',
  senha_hash: 'private',
  conteudo: 'private',
  telefone: 'private',
  admin: true,
};
export const tipomensagemRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  nome: 'Tipo ficticio',
  descricao: 'Descricao ficticia',
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
    mensagem: {
      findUnique: vi.fn().mockResolvedValue(mensagemRow),
      findMany: vi.fn().mockResolvedValue([mensagemRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(mensagemRow),
      update: vi.fn().mockResolvedValue(mensagemRow),
      delete: vi.fn().mockResolvedValue({ id: uuid }),
    },
    tipomensagem: {
      findUnique: vi.fn().mockResolvedValue(tipomensagemRow),
      findMany: vi.fn().mockResolvedValue([tipomensagemRow]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(tipomensagemRow),
      update: vi.fn().mockResolvedValue(tipomensagemRow),
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
