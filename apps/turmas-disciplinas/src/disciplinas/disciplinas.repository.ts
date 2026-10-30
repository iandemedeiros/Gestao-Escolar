import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';

import { select } from './dto.js';
@Injectable()
export class DisciplinasRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.disciplina.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.disciplina.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.disciplina.findUnique({ where: { id }, select });
  }

  create(data: Prisma.disciplinaUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      return tx.disciplina.create({ data, select });
    });
  }
  update(id: string, data: Prisma.disciplinaUncheckedUpdateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.disciplina.findUnique({ where: { id }, select });
      if (!current) throw new NotFoundException('Registro nao encontrado.');

      return await tx.disciplina.update({ where: { id }, data, select });
    });
  }
  delete(id: string) {
    return this.prisma.client.disciplina.delete({
      where: { id },
      select: { id: true },
    });
  }
}
