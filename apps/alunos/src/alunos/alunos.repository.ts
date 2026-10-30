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

  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.aluno.findMany({
        select: alunoSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.aluno.count(),
    }));
  }

  findById(id: string) {
    return this.prisma.client.aluno.findUnique({
      where: { id },
      select: alunoSelect,
    });
  }

  create(data: Prisma.alunoCreateInput) {
    return this.prisma.client.aluno.create({ data, select: alunoSelect });
  }

  update(id: string, data: Prisma.alunoUpdateInput) {
    return this.prisma.client.aluno.update({
      where: { id },
      data,
      select: alunoSelect,
    });
  }

  delete(id: string) {
    return this.prisma.client.aluno.delete({
      where: { id },
      select: { id: true },
    });
  }
}
