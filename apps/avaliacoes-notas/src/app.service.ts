import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { service: 'avaliacoes-notas', status: 'ok' };
  }
}
