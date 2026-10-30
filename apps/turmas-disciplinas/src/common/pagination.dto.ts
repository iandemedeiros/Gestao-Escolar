import { z } from 'zod';

const integer = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .transform(Number),
  ])
  .pipe(z.number().int().positive().safe());
export const paginationSchema = z.strictObject({
  page: integer.pipe(z.number().max(10_000)).default(1),
  limit: integer.pipe(z.number().max(100)).default(20),
});
export type PaginationDto = z.output<typeof paginationSchema>;
export interface PaginatedDto<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}
