import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { argon2id, hash } from 'argon2';

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    try {
      return await hash(password, {
        type: argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Cadastro temporariamente indisponivel.',
      );
    }
  }
}
