import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
const senha = z.string().min(1).max(128);
const cpf = z
  .string()
  .trim()
  .regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/)
  .transform((value) => value.replace(/\D/g, ''));
export const loginSchema = z.union([
  z.strictObject({ usuario: z.string().trim().min(1).max(100), senha }),
  z.strictObject({ cpf, senha }),
]);
export const changeSchema = z.strictObject({
  senha_atual: senha,
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
