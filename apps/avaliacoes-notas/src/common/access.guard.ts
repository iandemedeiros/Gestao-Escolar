import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/security.js';
@Injectable()
export class AccessGuard extends JwtAuthGuard {}
