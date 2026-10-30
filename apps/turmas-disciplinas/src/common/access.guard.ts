import{Injectable}from'@nestjs/common';import{AcademicGuard}from'../academic/academic.guard.js';@Injectable()export class AccessGuard extends AcademicGuard{}
