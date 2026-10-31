import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const services = [
  ['api-gateway', 'GATEWAY_ENV_FILE'],
  ['alunos', 'ALUNOS_ENV_FILE'],
  ['professores', 'PROFESSORES_ENV_FILE'],
  ['turmas-disciplinas', 'TURMAS_DISCIPLINAS_ENV_FILE'],
  ['avaliacoes-notas', 'AVALIACOES_NOTAS_ENV_FILE'],
  ['comunicacao', 'COMUNICACAO_ENV_FILE'],
];
// Match dotenv's precedence: variables inherited from the terminal win.
const configurations = services.map(([name, override]) => {
  const path = resolve(root, process.env[override] ?? `apps/${name}/.env`);
  return {
    name,
    env: {
      ...(existsSync(path) ? parse(readFileSync(path)) : {}),
      ...process.env,
    },
  };
});
const gateway = configurations[0].env;
const problems = [];
for (const { name, env } of configurations) {
  for (const key of [
    'JWT_SECRET',
    ...(name === 'comunicacao' ? [] : ['INTERNAL_AUTH_TOKEN']),
  ]) {
    if (Buffer.byteLength(env[key] ?? '') < 32)
      problems.push(`${name}: ${key} ausente ou menor que 32 bytes.`);
    else if (env[key] !== gateway[key])
      problems.push(`${name}: ${key} diferente da Gateway.`);
  }
}
if (problems.length) {
  console.error(
    'Configuracao incompleta; nenhum processo foi iniciado. Salve os .env e tente novamente.',
  );
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else if (process.argv.includes('--check')) {
  console.log(
    'JWT_SECRET e INTERNAL_AUTH_TOKEN consistentes. Nenhum processo iniciado; bancos nao consultados.',
  );
} else {
  const children = [];
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) {
      if (!child.pid || child.exitCode !== null) continue;
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else child.kill('SIGTERM');
    }
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
  for (const [name] of services) {
    if (stopping) break;
    console.log(`[start:all:dev] Iniciando ${name}`);
    const child = spawn(
      process.execPath,
      [
        resolve(root, 'node_modules/@nestjs/cli/bin/nest.js'),
        'start',
        name,
        '--watch',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    children.push(child);
    child.on('error', () => {
      console.error(`Nao foi possivel iniciar ${name}.`);
      stop(1);
    });
    child.on('exit', (code) => {
      if (!stopping) {
        console.error(`${name} encerrou; encerrando o grupo.`);
        stop(code || 1);
      }
    });
  }
}
