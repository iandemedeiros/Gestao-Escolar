import { z } from 'zod';
export const uuid = z.uuid();
export const text = (max: number) => z.string().trim().min(1).max(max);
export const email = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .transform((value) => value.toLowerCase());
export const phone = (max: number) =>
  text(max)
    .regex(/^\+?[0-9 ()-]+$/)
    .refine((value) => /[0-9]/.test(value));
export const password = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => value.trim().length > 0);
// Professor CPF uses the conventional 14-character representation; no checksum validation.
export const cpf = z
  .string()
  .trim()
  .regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/)
  .transform((value) => value.replace(/\D/g, ''))
  .transform(
    (value) =>
      value.slice(0, 3) +
      '.' +
      value.slice(3, 6) +
      '.' +
      value.slice(6, 9) +
      '-' +
      value.slice(9),
  );
export const time = z
  .string()
  .regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  .transform((value) => new Date('1970-01-01T' + value + 'Z'));
