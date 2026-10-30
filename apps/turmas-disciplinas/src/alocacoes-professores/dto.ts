import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { uuid } from '../common/fields.js';
export const createSchema = z.strictObject({
  disciplina_id: uuid,
  professor_id: uuid,
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateAlocacoesProfessoresDto = z.input<typeof createSchema>;
export type UpdateAlocacoesProfessoresDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  disciplina_id: true,
  professor_id: true,
} satisfies Prisma.alocacao_professorSelect;
export type Selected = Prisma.alocacao_professorGetPayload<{
  select: typeof select;
}>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    disciplina_id: value.disciplina_id,
    professor_id: value.professor_id,
  };
}
export type AlocacoesProfessoresResponseDto = ReturnType<typeof toResponse>;
