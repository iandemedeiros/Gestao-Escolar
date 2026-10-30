import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { InternalAuthGuard, JwtAuthGuard, Roles } from '../auth/security.js';
import { databaseOperation } from '../common/database-errors.js';
import { validate } from '../common/validation.js';
@Controller('internal/academic')
@UseGuards(InternalAuthGuard, JwtAuthGuard)
@Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
export class ExistsController {
  constructor(private readonly prisma: PrismaService) {}
  @Post('exists')
  @HttpCode(200)
  async exists(@Body() body: unknown) {
    const { id } = validate(z.strictObject({ id: z.uuid() }), body);
    const record = await databaseOperation(() =>
      this.prisma.client.professor.findUnique({
        where: { id },
        select: { id: true },
      }),
    );
    if (!record) throw new NotFoundException('Referencia nao encontrada.');
    return { exists: true };
  }
}
