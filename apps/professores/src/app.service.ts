import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { service: 'professores', status: 'ok' };
  }
}
