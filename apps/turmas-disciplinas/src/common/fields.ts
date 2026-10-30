import { z } from 'zod';
export const uuid = z.uuid();
export const positiveInt = z.number().int().min(1).max(2147483647);
export const text = (max: number) => z.string().trim().min(1).max(max);
