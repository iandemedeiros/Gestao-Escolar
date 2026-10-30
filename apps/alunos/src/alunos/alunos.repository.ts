import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PaginationDto } from '../common/pagination.dto.js';
const alunoSelect = {
  id: true,
  nome: true,
  data_nascimento: true,
} satisfies Prisma.alunoSelect;
@Injectable()
export class AlunosRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto, scope?: Prisma.alunoWhereInput) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.aluno.findMany({
        select: alunoSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        ...(scope ? { where: scope } : {}),
      }),
      total: await (scope
        ? tx.aluno.count({ where: scope })
        : tx.aluno.count()),
    }));
  }
  findById(id: string, scope?: Prisma.alunoWhereInput) {
    return this.prisma.client.aluno.findUnique({
      where: { id, ...(scope ? { AND: scope } : {}) },
      select: alunoSelect,
    });
  }
  create(data: Prisma.alunoCreateInput) {
    return this.prisma.client.aluno.create({ data, select: alunoSelect });
  }
  update(
    id: string,
    data: Prisma.alunoUpdateInput,
    scope?: Prisma.alunoWhereInput,
  ) {
    return this.prisma.client.aluno.update({
      where: { id, ...(scope ? { AND: scope } : {}) },
      data,
      select: alunoSelect,
    });
  }
  delete(id: string, scope?: Prisma.alunoWhereInput) {
    return this.prisma.client.aluno.delete({
      where: { id, ...(scope ? { AND: scope } : {}) },
      select: { id: true },
    });
  }
}
