import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
export const uuid = z.uuid();
export const positiveInt = z.number().int().min(1).max(2147483647);
export const text = (max: number) => z.string().trim().min(1).max(max);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return (
      value >= '1000-01-01' &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  })
  .transform((value) => new Date(value + 'T00:00:00Z'));
export const dateTime = z.iso
  .datetime({ offset: true, precision: 0 })
  .refine((value) => {
    const year = new Date(value).getUTCFullYear();
    return year >= 1000 && year <= 9999;
  })
  .transform((value) => new Date(value));
export const decimal = z
  .union([z.string(), z.number().finite().transform(String)])
  .pipe(z.string().regex(/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?$/))
  .transform((value) => new Prisma.Decimal(value));
