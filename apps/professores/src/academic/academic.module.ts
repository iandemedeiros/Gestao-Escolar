import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExistsController } from './exists.controller.js';
@Module({ imports: [PrismaModule], controllers: [ExistsController] })
export class AcademicModule {}
