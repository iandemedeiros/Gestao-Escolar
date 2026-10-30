import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';

import { select } from './dto.js';
@Injectable()
export class ProfessoresRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.professor.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.professor.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.professor.findUnique({ where: { id }, select });
  }

  create(data: Prisma.professorUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      return tx.professor.create({ data, select });
    });
  }
  update(id: string, data: Prisma.professorUncheckedUpdateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.professor.findUnique({ where: { id }, select });
      if (!current) throw new NotFoundException('Registro nao encontrado.');

      return await tx.professor.update({ where: { id }, data, select });
    });
  }
  delete(id: string) {
    return this.prisma.client.professor.delete({
      where: { id },
      select: { id: true },
    });
  }
}
