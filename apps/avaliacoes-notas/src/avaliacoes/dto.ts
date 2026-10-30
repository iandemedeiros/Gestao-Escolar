import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  positiveInt,
  uuid,
  text,
  decimal,
  dateOnly,
  dateTime,
} from '../common/fields.js';
export const createSchema = z.strictObject({
  turma_id: positiveInt,
  disciplina_id: uuid,
  professor_id: uuid,
  titulo: text(255),
  tipo: text(100),
  peso: decimal.refine((value) => value.greaterThan(0)),
  data_realizacao: dateOnly,
  data_entrega_final: dateTime,
  entrega_do_aluno: dateTime.nullable().optional(),
});

export const updateSchema = createSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type CreateAvaliacoesDto = z.input<typeof createSchema>;
export type UpdateAvaliacoesDto = z.input<typeof updateSchema>;
export const select = {
  id: true,
  turma_id: true,
  disciplina_id: true,
  professor_id: true,
  titulo: true,
  tipo: true,
  peso: true,
  data_realizacao: true,
  data_entrega_final: true,
  entrega_do_aluno: true,
} satisfies Prisma.avaliacaoSelect;
export type Selected = Prisma.avaliacaoGetPayload<{ select: typeof select }>;
export function toResponse(value: Selected) {
  return {
    id: value.id,
    turma_id: value.turma_id,
    disciplina_id: value.disciplina_id,
    professor_id: value.professor_id,
    titulo: value.titulo,
    tipo: value.tipo,
    peso: value.peso.toFixed(2),
    data_realizacao: value.data_realizacao.toISOString().slice(0, 10),
    data_entrega_final: value.data_entrega_final.toISOString(),
    entrega_do_aluno: value.entrega_do_aluno?.toISOString() ?? null,
  };
}
export type AvaliacoesResponseDto = ReturnType<typeof toResponse>;
export function assertState(
  value: Pick<Selected, 'data_realizacao' | 'data_entrega_final'>,
) {
  if (value.data_entrega_final.getTime() < value.data_realizacao.getTime())
    throw new BadRequestException('Intervalo de datas/horarios invalido.');
}
