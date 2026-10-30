import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { uuid, decimal } from '../common/fields.js';
export const createSchema = z.strictObject({
  avaliacao_id: uuid,
  aluno_id: uuid,
  valor_obtido: decimal,
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateNotasDto = z.input<typeof createSchema>;
export type UpdateNotasDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  avaliacao_id: true,
  aluno_id: true,
  valor_obtido: true,
  media_calculada: true,
} satisfies Prisma.notaSelect;
export type Selected = Prisma.notaGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    avaliacao_id: value.avaliacao_id,
    aluno_id: value.aluno_id,
    valor_obtido: value.valor_obtido.toFixed(2),
    media_calculada: value.media_calculada?.toFixed(2) ?? null,
  };
}
export type NotasResponseDto = ReturnType<typeof toResponse>;
