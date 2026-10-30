import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { uuid, text, time } from '../common/fields.js';
export const createSchema = z.strictObject({
  professor_id: uuid,
  dia_semana: text(20),
  hora_inicio: time,
  hora_fim: time,
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateDisponibilidadesDto = z.input<typeof createSchema>;
export type UpdateDisponibilidadesDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  professor_id: true,
  dia_semana: true,
  hora_inicio: true,
  hora_fim: true,
} satisfies Prisma.disponibilidade_horarioSelect;
export type Selected = Prisma.disponibilidade_horarioGetPayload<{
  select: typeof select;
}>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    professor_id: value.professor_id,
    dia_semana: value.dia_semana,
    hora_inicio: value.hora_inicio.toISOString().slice(11, 19),
    hora_fim: value.hora_fim.toISOString().slice(11, 19),
  };
}
export type DisponibilidadesResponseDto = ReturnType<typeof toResponse>;
export function assertState(value: Pick<Selected, 'hora_inicio' | 'hora_fim'>) {
  if (value.hora_fim.getTime() <= value.hora_inicio.getTime())
    throw new BadRequestException('Intervalo de datas/horarios invalido.');
}
