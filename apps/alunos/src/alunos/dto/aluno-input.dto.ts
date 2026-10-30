import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00.000Z');
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value &&
      value >= '1900-01-01' &&
      value <= new Date().toISOString().slice(0, 10)
    );
  })
  .transform((value) => new Date(value + 'T00:00:00.000Z'));
const nullableText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();
export const createAlunoSchema = z.strictObject({
  nome: z.string().trim().min(1).max(150),
  data_nascimento: date,
  cpf: z
    .string()
    .trim()
    .regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/)
    .transform((value) => value.replace(/\D/g, '')),
  email: z
    .string()
    .trim()
    .max(150)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .transform((value) => value.toLowerCase()),
  senha: z
    .string()
    .min(8)
    .max(128)
    .refine((value) => value.trim().length > 0),
  endereco_rua: nullableText(150),
  endereco_numero: nullableText(10),
  endereco_complemento: nullableText(100),
  endereco_bairro: nullableText(100),
  endereco_cidade: nullableText(100),
  endereco_estado: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  endereco_cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/)
    .nullable()
    .optional(),
});
export const updateAlunoSchema = createAlunoSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateAlunoDto = z.input<typeof createAlunoSchema>;
export type UpdateAlunoDto = z.input<typeof updateAlunoSchema>;
