import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { text, positiveInt } from '../common/fields.js';
export const createSchema = z.strictObject({
  nome: text(255),
  carga_horaria: positiveInt,
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateDisciplinasDto = z.input<typeof createSchema>;
export type UpdateDisciplinasDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  nome: true,
  carga_horaria: true,
} satisfies Prisma.disciplinaSelect;
export type Selected = Prisma.disciplinaGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return { id: value.id, nome: value.nome, carga_horaria: value.carga_horaria };
}
export type DisciplinasResponseDto = ReturnType<typeof toResponse>;
