import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  JwtAuthGuard,
  LoginRateGuard,
  Roles,
  type AuthRequest,
} from './security.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginRateGuard)
  login(@Body() body: unknown) {
    return this.service.login(body);
  }
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
  me(@Req() request: AuthRequest) {
    return { sub: request.user.sub, role: request.user.role };
  }
  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, LoginRateGuard)
  @Roles('ALUNO', 'PROFESSOR')
  change(@Req() request: AuthRequest, @Body() body: unknown) {
    return this.service.change(
      request.user,
      request.headers.authorization!,
      body,
    );
  }
}
