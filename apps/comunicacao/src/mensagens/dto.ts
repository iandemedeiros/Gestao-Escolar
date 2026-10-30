import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { uuid, text } from '../common/fields.js';
export const createSchema = z.strictObject({
  remetenteId: uuid,
  destinatarioId: uuid,
  tipoId: uuid,
  conteudo: text(16_000).refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 65_535,
  ),
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateMensagensDto = z.input<typeof createSchema>;
export type UpdateMensagensDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  remetenteId: true,
  destinatarioId: true,
  tipoId: true,
  dataEnvio: true,
} satisfies Prisma.mensagemSelect;
export type Selected = Prisma.mensagemGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    remetenteId: value.remetenteId,
    destinatarioId: value.destinatarioId,
    tipoId: value.tipoId,
    dataEnvio: value.dataEnvio.toISOString(),
  };
}
export type MensagensResponseDto = ReturnType<typeof toResponse>;
