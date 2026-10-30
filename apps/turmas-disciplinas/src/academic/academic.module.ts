import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AcademicHttp } from './academic.http.js';
import { AcademicPolicy } from './academic.policy.js';
import { AcademicGuard } from './academic.guard.js';
import { InternalAcademicController } from './internal.controller.js';
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AcademicHttp, AcademicPolicy, AcademicGuard],
  exports: [AcademicHttp, AcademicPolicy, AcademicGuard],
  controllers: [InternalAcademicController],
})
export class AcademicModule {}
