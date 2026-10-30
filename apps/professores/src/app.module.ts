import{AcademicModule}from'./academic/academic.module.js';
import { CredentialsModule } from './auth/credentials.module.js';
import { SecurityModule } from './auth/security.js';
import { ResourcesModule } from './resources/resources.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [AcademicModule, SecurityModule, CredentialsModule, PrismaModule, ResourcesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
