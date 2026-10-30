import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DomainsClient } from './domains.client.js';
@Module({
  controllers: [AuthController],
  providers: [AuthService, DomainsClient],
})
export class AuthModule {}
