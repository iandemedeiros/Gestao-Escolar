import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';
import { validate } from '../common/validation.js';
import { uuid, positiveInt } from '../common/fields.js';
import { select } from './dto.js';
@Injectable()
export class AlocacoesAlunosRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.alocacao_aluno.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.alocacao_aluno.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.alocacao_aluno.findUnique({
      where: { id },
      select,
    });
  }
  private async checkRelations(
    tx: Prisma.TransactionClient,
    data: { turma_id?: unknown; disciplina_id?: unknown },
  ) {
    if (data.turma_id !== undefined) {
      const parent = await tx.turma.findUnique({
        where: { id: validate(positiveInt, data.turma_id) },
        select: { id: true },
      });
      if (!parent)
        throw new NotFoundException('Referencia local nao encontrada.');
    }
    if (data.disciplina_id !== undefined) {
      const parent = await tx.disciplina.findUnique({
        where: { id: validate(uuid, data.disciplina_id) },
        select: { id: true },
      });
      if (!parent)
        throw new NotFoundException('Referencia local nao encontrada.');
    }
  }
  create(data: Prisma.alocacao_alunoUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      await this.checkRelations(tx, data);
      return tx.alocacao_aluno.create({ data, select });
    });
  }
  update(id: string, data: Prisma.alocacao_alunoUncheckedUpdateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.alocacao_aluno.findUnique({
        where: { id },
        select,
      });
      if (!current) throw new NotFoundException('Registro nao encontrado.');
      await this.checkRelations(tx, data);

      return await tx.alocacao_aluno.update({ where: { id }, data, select });
    });
  }
  delete(id: string) {
    return this.prisma.client.alocacao_aluno.delete({
      where: { id },
      select: { id: true },
    });
  }
}
