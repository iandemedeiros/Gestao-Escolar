import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';
import { validate } from '../common/validation.js';
import { uuid } from '../common/fields.js';
import { select } from './dto.js';
@Injectable()
export class AlocacoesProfessoresRepository {
  constructor(private readonly prisma: PrismaService) {}
  list(
    { page, limit }: PaginationDto,
    scope?: Prisma.alocacao_professorWhereInput,
  ) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.alocacao_professor.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        ...(scope ? { where: scope } : {}),
      }),
      total: await (scope
        ? tx.alocacao_professor.count({ where: scope })
        : tx.alocacao_professor.count()),
    }));
  }
  findById(id: string, scope?: Prisma.alocacao_professorWhereInput) {
    return this.prisma.client.alocacao_professor.findUnique({
      where: { id, ...(scope ? { AND: scope } : {}) },
      select,
    });
  }
  private async checkRelations(
    tx: Prisma.TransactionClient,
    data: {
      disciplina_id?: unknown;
    },
  ) {
    if (data.disciplina_id !== undefined) {
      const parent = await tx.disciplina.findUnique({
        where: { id: validate(uuid, data.disciplina_id) },
        select: { id: true },
      });
      if (!parent)
        throw new NotFoundException('Referencia local nao encontrada.');
    }
  }
  create(data: Prisma.alocacao_professorUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      await this.checkRelations(tx, data);
      return tx.alocacao_professor.create({ data, select });
    });
  }
  update(
    id: string,
    data: Prisma.alocacao_professorUncheckedUpdateInput,
    scope?: Prisma.alocacao_professorWhereInput,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.alocacao_professor.findUnique({
        where: { id, ...(scope ? { AND: scope } : {}) },
        select,
      });
      if (!current) throw new NotFoundException('Registro nao encontrado.');
      await this.checkRelations(tx, data);
      return await tx.alocacao_professor.update({
        where: { id, ...(scope ? { AND: scope } : {}) },
        data,
        select,
      });
    });
  }
  delete(id: string, scope?: Prisma.alocacao_professorWhereInput) {
    return this.prisma.client.alocacao_professor.delete({
      where: { id, ...(scope ? { AND: scope } : {}) },
      select: { id: true },
    });
  }
}
