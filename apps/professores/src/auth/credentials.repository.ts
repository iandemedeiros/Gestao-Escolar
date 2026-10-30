import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class CredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}
  findByCpf(cpf: string) {
    return this.prisma.client.professor.findUnique({
      where: { cpf },
      select: { id: true, senha_hash: true },
    });
  }
  findById(id: string) {
    return this.prisma.client.professor.findUnique({
      where: { id },
      select: { id: true, senha_hash: true },
    });
  }
  replacePassword(id: string, previous: string, next: string) {
    return this.prisma.client.professor.updateMany({
      where: { id, senha_hash: previous },
      data: { senha_hash: next },
    });
  }
}
