import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { text, positiveInt } from '../common/fields.js';
export const createSchema = z.strictObject({
  nome: text(255),
  ano_letivo: positiveInt.max(9999),
  turno: text(50),
  capacidade_maxima: positiveInt,
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateTurmasDto = z.input<typeof createSchema>;
export type UpdateTurmasDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  nome: true,
  ano_letivo: true,
  turno: true,
  capacidade_maxima: true,
} satisfies Prisma.turmaSelect;
export type Selected = Prisma.turmaGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    nome: value.nome,
    ano_letivo: value.ano_letivo,
    turno: value.turno,
    capacidade_maxima: value.capacidade_maxima,
  };
}
export type TurmasResponseDto = ReturnType<typeof toResponse>;
