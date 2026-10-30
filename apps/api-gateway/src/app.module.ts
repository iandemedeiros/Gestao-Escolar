import{RoutingModule}from'./routing/routing.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SecurityModule } from './auth/security.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [RoutingModule, SecurityModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
