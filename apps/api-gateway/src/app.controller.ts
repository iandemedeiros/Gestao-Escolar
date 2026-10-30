import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return { service: 'api-gateway', status: 'ok' };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
