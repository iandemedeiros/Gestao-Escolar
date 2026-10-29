import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { service: 'turmas-disciplinas', status: 'ok' };
  }
}
