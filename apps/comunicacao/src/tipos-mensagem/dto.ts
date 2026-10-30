import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { text } from '../common/fields.js';
export const createSchema = z.strictObject({
  nome: text(255),
  descricao: text(255).nullable().optional(),
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateTiposMensagemDto = z.input<typeof createSchema>;
export type UpdateTiposMensagemDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  nome: true,
  descricao: true,
} satisfies Prisma.tipomensagemSelect;
export type Selected = Prisma.tipomensagemGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return { id: value.id, nome: value.nome, descricao: value.descricao };
}
export type TiposMensagemResponseDto = ReturnType<typeof toResponse>;
