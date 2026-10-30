import { Injectable, type CanActivate } from '@nestjs/common';
@Injectable()
export class AccessGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}
