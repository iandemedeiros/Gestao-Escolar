import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Do not serialize Zod issues: they can include unknown field names/values.
    throw new BadRequestException('Entrada invalida.');
  }
  return result.data;
}

export function uuid(value: unknown): string {
  return validate(z.uuid(), value);
}
