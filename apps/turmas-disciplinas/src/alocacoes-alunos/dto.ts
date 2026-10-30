import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { positiveInt, uuid } from '../common/fields.js';
export const createSchema = z.strictObject({
  turma_id: positiveInt,
  disciplina_id: uuid,
  aluno_id: uuid,
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateAlocacoesAlunosDto = z.input<typeof createSchema>;
export type UpdateAlocacoesAlunosDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  turma_id: true,
  disciplina_id: true,
  aluno_id: true,
} satisfies Prisma.alocacao_alunoSelect;
export type Selected = Prisma.alocacao_alunoGetPayload<{
  select: typeof select;
}>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    turma_id: value.turma_id,
    disciplina_id: value.disciplina_id,
    aluno_id: value.aluno_id,
  };
}
export type AlocacoesAlunosResponseDto = ReturnType<typeof toResponse>;
