import { z } from 'zod';

import type { Prisma } from '../generated/prisma/client.js';
import { text, cpf, email, password } from '../common/fields.js';
export const createSchema = z.strictObject({
  nome: text(255),
  cpf: cpf,
  email: email(255),
  senha: password,
  formacao: text(255).nullable().optional(),
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateProfessoresDto = z.input<typeof createSchema>;
export type UpdateProfessoresDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  nome: true,
  formacao: true,
} satisfies Prisma.professorSelect;
export type Selected = Prisma.professorGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return { id: value.id, nome: value.nome, formacao: value.formacao };
}
export type ProfessoresResponseDto = ReturnType<typeof toResponse>;
