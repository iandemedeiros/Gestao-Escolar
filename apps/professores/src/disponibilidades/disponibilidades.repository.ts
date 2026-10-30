import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';
import { validate } from '../common/validation.js';
import { uuid } from '../common/fields.js';
import { select, type Selected } from './dto.js';
@Injectable()
export class DisponibilidadesRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.disponibilidade_horario.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.disponibilidade_horario.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.disponibilidade_horario.findUnique({
      where: { id },
      select,
    });
  }
  private async checkRelations(
    tx: Prisma.TransactionClient,
    data: { professor_id?: unknown },
  ) {
    if (data.professor_id !== undefined) {
      const parent = await tx.professor.findUnique({
        where: { id: validate(uuid, data.professor_id) },
        select: { id: true },
      });
      if (!parent)
        throw new NotFoundException('Referencia local nao encontrada.');
    }
  }
  create(data: Prisma.disponibilidade_horarioUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      await this.checkRelations(tx, data);
      return tx.disponibilidade_horario.create({ data, select });
    });
  }
  update(
    id: string,
    data: Prisma.disponibilidade_horarioUncheckedUpdateInput,
    check: (current: Selected) => void,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.disponibilidade_horario.findUnique({
        where: { id },
        select,
      });
      if (!current) throw new NotFoundException('Registro nao encontrado.');
      await this.checkRelations(tx, data);
      check(current);
      try {
        return await tx.disponibilidade_horario.update({
          where: {
            id,
            hora_inicio: current.hora_inicio,
            hora_fim: current.hora_fim,
          },
          data,
          select,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        )
          throw new ConflictException('Registro alterado concorrentemente.');
        throw error;
      }
    });
  }
  delete(id: string) {
    return this.prisma.client.disponibilidade_horario.delete({
      where: { id },
      select: { id: true },
    });
  }
}
