import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const alunoSelect = {
  id: true,
  nome: true,
  data_nascimento: true,
} satisfies Prisma.alunoSelect;

@Injectable()
export class AlunosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.client.aluno.findUnique({
      where: { id },
      select: alunoSelect,
    });
  }
}
