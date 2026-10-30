import { resolve } from 'node:path';
import { config } from 'dotenv';

// Optional local file; Docker can inject variables without supplying this file.
// No database client is created or connected here.
config({
  path: resolve(process.env.GATEWAY_ENV_FILE ?? 'apps/api-gateway/.env'),
  quiet: true,
});
