import { Injectable } from '@nestjs/common';
import { AcademicGuard } from '../academic/academic.guard.js';
@Injectable()
export class AlunosAccessGuard extends AcademicGuard {}
