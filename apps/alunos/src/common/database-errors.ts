import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export async function databaseOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2003') {
        throw new ConflictException('Conflito nos dados informados.');
      }
      if (error.code === 'P2025')
        throw new NotFoundException('Registro nao encontrado.');
      if (['P2000', 'P2006', 'P2007'].includes(error.code)) {
        throw new BadRequestException('Entrada invalida.');
      }
    }
    // Never log driver exceptions or return their messages/metadata.
    throw new ServiceUnavailableException('Consulta de aluno indisponivel.');
  }
}
