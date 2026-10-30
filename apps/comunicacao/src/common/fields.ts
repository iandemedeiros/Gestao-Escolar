import { z } from 'zod';
export const uuid = z.uuid();
export const text = (max: number) => z.string().trim().min(1).max(max);
