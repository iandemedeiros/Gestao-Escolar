import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CredentialsService } from './credentials.service.js';
import {
  InternalAuthGuard,
  JwtAuthGuard,
  LoginRateGuard,
  Roles,
  type AuthRequest,
} from './security.js';
@Controller('internal/auth')
@UseGuards(InternalAuthGuard)
export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}
  @Post('verify')
  @HttpCode(200)
  @UseGuards(LoginRateGuard)
  verify(@Body() body: unknown) {
    return this.service.authenticate(body);
  }
  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, LoginRateGuard)
  @Roles('ALUNO')
  change(@Req() request: AuthRequest, @Body() body: unknown) {
    return this.service.changePassword(request.user.sub, body);
  }
}
