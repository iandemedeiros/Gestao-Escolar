import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .min(3)
  .max(15)
  .regex(/^\+?[0-9 ()-]+$/)
  .refine((value) => /[0-9]/.test(value))
  .nullable()
  .optional();
const fields = z.strictObject({
  telefone: phone,
  celular: phone,
  email: z
    .email()
    .max(150)
    .transform((value) => value.toLowerCase())
    .nullable()
    .optional(),
});
export const createContatoSchema = fields.refine((value) =>
  Object.values(value).some((field) => typeof field === 'string'),
);
export const updateContatoSchema = fields.refine((value) =>
  Object.values(value).some((field) => field !== undefined),
);
export type CreateContatoDto = z.input<typeof createContatoSchema>;
export type UpdateContatoDto = z.input<typeof updateContatoSchema>;
export class ContatoResponseDto {
  id!: string;
  aluno_id!: string;
}
