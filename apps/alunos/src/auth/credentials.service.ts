import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { hash, verify, argon2id } from 'argon2';
import { z } from 'zod';
import { CredentialsRepository } from './credentials.repository.js';
import { loginSchema, changeSchema, parse } from './credentials.dto.js';
import { invalidLogin, type Principal } from './security.js';
import { databaseOperation } from '../common/database-errors.js';
// Random dummy hash, unrelated to any account, used to equalize missing-user verification.
const dummyHash =
  '$argon2id$v=19$m=19456,p=1,t=2$jyIQivQzOpFQMeAbqB42uw$qpH9/WGj+ereMM+90OF8O00XQugkUL2fotCn/QGm3us';
async function matches(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}
@Injectable()
export class CredentialsService {
  constructor(private readonly repository: CredentialsRepository) {}
  async authenticate(input: unknown): Promise<Principal> {
    const dto = parse(loginSchema, input);
    const cpf = dto.cpf;
    const row = await databaseOperation(() => this.repository.findByCpf(cpf));
    const valid = await matches(row?.senha_hash ?? dummyHash, dto.senha);
    if (!row || !valid) throw invalidLogin();
    if (!z.uuid().safeParse(row.id).success)
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    return { sub: row.id, role: 'ALUNO' };
  }
  async changePassword(sub: string, input: unknown) {
    const dto = parse(changeSchema, input);
    const row = await databaseOperation(() => this.repository.findById(sub));
    const valid = await matches(row?.senha_hash ?? dummyHash, dto.senha_atual);
    if (!row || !valid) throw invalidLogin();
    let encoded: string;
    try {
      encoded = await hash(dto.nova_senha, {
        type: argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
    } catch {
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    }
    const result = await databaseOperation(() =>
      this.repository.replacePassword(sub, row.senha_hash, encoded),
    );
    if (result.count !== 1)
      throw new ConflictException('Senha alterada concorrentemente.');
    return { message: 'Senha atualizada.' };
  }
}
