import { Injectable, type CanActivate } from '@nestjs/common';

// Deny all access until authentication AND resource authorization are implemented.
// No environment variable, header or query parameter can enable this route.
@Injectable()
export class AlunosAccessGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}
