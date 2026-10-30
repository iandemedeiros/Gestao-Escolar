import { ResourcesModule } from './resources/resources.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [PrismaModule, ResourcesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
