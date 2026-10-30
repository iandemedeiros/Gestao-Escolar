import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { uuid, phone, email } from '../common/fields.js';
export const createSchema = z
  .strictObject({
    professor_id: uuid,
    telefone: phone(20).nullable().optional(),
    celular: phone(20).nullable().optional(),
    email: email(255).nullable().optional(),
  })
  .refine((value) =>
    [value.telefone, value.celular, value.email].some(
      (field) => typeof field === 'string',
    ),
  );
const patchFields = z
  .strictObject({
    professor_id: uuid,
    telefone: phone(20).nullable().optional(),
    celular: phone(20).nullable().optional(),
    email: email(255).nullable().optional(),
  })
  .partial();
export const updateSchema = patchFields.refine((value) =>
  Object.values(value).some((field) => field !== undefined),
);
export type CreateContatosDto = z.input<typeof createSchema>;
export type UpdateContatosDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  professor_id: true,
} satisfies Prisma.contatoSelect;
export type Selected = Prisma.contatoGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return { id: value.id, professor_id: value.professor_id };
}
export type ContatosResponseDto = ReturnType<typeof toResponse>;
