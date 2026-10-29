import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { service: 'comunicacao', status: 'ok' };
  }
}
