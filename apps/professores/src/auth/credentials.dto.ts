import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
export const cpfSchema = z
  .string()
  .trim()
  .regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/)
  .transform((value) => value.replace(/\D/g, ''));
export const loginSchema = z.strictObject({
  cpf: cpfSchema,
  senha: z.string().min(1).max(128),
});
export const changeSchema = z.strictObject({
  senha_atual: z.string().min(1).max(128),
  nova_senha: z
    .string()
    .min(8)
    .max(128)
    .refine((value) => value.trim().length > 0),
});
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException('Entrada invalida.');
  return result.data;
}
