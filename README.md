<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Monorepo nativo do Nest CLI para o sistema de gestão escolar. As seis aplicações
ficam em `apps/`, cada uma com código em `src/` e testes HTTP em `test/`.
As dependências e os scripts ficam na raiz, em um único projeto npm.

O builder é `tsc`, com ESM, `NodeNext` e suporte a top-level `await`.
O build gera `dist/apps/api-gateway/main.js`. O gateway atende na porta 3000
por padrão, configurável pela variável `PORT`.

| Aplicação | Porta padrão | Variável específica |
| --- | --- | --- |
| api-gateway | 3000 | `PORT` |
| alunos | 3001 | `ALUNOS_PORT` |
| professores | 3002 | `PROFESSORES_PORT` |
| turmas-disciplinas | 3003 | `TURMAS_DISCIPLINAS_PORT` |
| avaliacoes-notas | 3004 | `AVALIACOES_NOTAS_PORT` |
| comunicacao | 3005 | `COMUNICACAO_PORT` |

Cada serviço novo oferece `GET /health`, com JSON
`{"service":"alunos","status":"ok"}` (nome correspondente ao serviço).
Esse endpoint indica que a aplicação está respondendo; não verifica banco ou
dependências externas. A variável específica tem prioridade sobre `PORT`, que
também pode sobrescrever a porta de cada processo. Não defina um `PORT` comum
ao iniciar todos os serviços com as portas padrão.

Execute cada aplicação em um terminal separado:

```powershell
npm.cmd run start:dev # api-gateway
npm.cmd run start:alunos:dev
npm.cmd run start:professores:dev
npm.cmd run start:turmas-disciplinas:dev
npm.cmd run start:avaliacoes-notas:dev
npm.cmd run start:comunicacao:dev
```

`npm run build:all` compila as seis aplicações. Para cada serviço novo,
`npm run build:<nome>` compila e `npm run start:<nome>:prod` executa o arquivo
`dist/apps/<nome>/main.js`. O script `build` continua compilando o gateway.
Exemplo de porta personalizada no PowerShell:

```powershell
$env:ALUNOS_PORT = '3101'
npm.cmd run start:alunos
```

Nesta etapa não há encaminhamento pelo gateway nem comunicação entre serviços.

No PowerShell, caso `npm.ps1` seja bloqueado pela política de execução,
utilize `npm.cmd` nos comandos abaixo.

## Project setup

### Autenticação e autorização inicial

A Gateway expõe `/auth/login`, `/auth/me` e `/auth/change-password`.
Configure os segredos locais e o hash administrativo seguindo
[as instruções de autenticação](docs/autenticacao.md). Os `.env` existentes
não foram alterados. Cada microsserviço verifica JWT e permissões; operações
acadêmicas sem validação de vínculos continuam bloqueadas. A matriz atual de
acesso está nesse documento.

### CRUD de alunos e contatos: acesso autorizado por perfil

O `AlunosAccessGuard` valida JWT e permissões antes de validação de entrada,
hashing ou Prisma. SUPER_ADMIN gerencia os cadastros; ALUNO pode ler somente
seu próprio cadastro e seus contatos. Não existe autocadastro. Token ausente
ou inválido retorna 401; acesso sem permissão retorna 403.

Controllers delegam aos services, que validam DTOs estritos com Zod. Repositories
usam somente os modelos introspectados e seleções explícitas. Respostas de
alunos contêm apenas `id`, `nome` e `data_nascimento` (`YYYY-MM-DD`); respostas
de contatos contêm apenas `id` e `aluno_id`. CPF, e-mail, hash, endereço e
telefones nunca são retornados. A senha de entrada é transformada em Argon2id;
`senha_hash`, IDs e associações enviados no corpo são rejeitados.

Listagens usam `page` (padrão 1, máximo 10000) e `limit` (padrão 20, máximo 100),
com `{ data, page, limit, total }` e ordenação por ID. Erros são sanitizados:
400 para entrada inválida, 404 para registro ausente, 409 para conflito e
503 para falha de infraestrutura. PATCH/DELETE de contatos incluem `aluno_id`
no filtro atômico para impedir alterações em contatos de outro aluno.

Os testes unitários simulam Prisma. Os testes HTTP verificam o bloqueio e,
somente em uma aplicação de teste com Prisma simulado, substituem o guard
para validar o contrato do CRUD. Não leem ou escrevem dados reais.
Consulte [o contrato e as pendências de segurança](apps/alunos/README.md).

### Prisma 7 na API alunos

As cinco APIs de domínio possuem configuração Prisma independente; o gateway
permanece sem persistência. A configuração das outras quatro APIs está documentada em
[persistência por domínio](docs/persistencia-prisma.md). Versões fixas:
`prisma`, `@prisma/client` e `@prisma/adapter-mariadb` em `7.10.1`,
com `dotenv` em `18.0.9`. O adapter atende MySQL/MariaDB.

Execute os comandos a partir da raiz do monorepo:

```powershell
npm.cmd run prisma:alunos:validate
npm.cmd run prisma:alunos:generate
npm.cmd run build:all
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
```

`validate` verifica o schema local e `generate` gera código local; esses
comandos não consultam nem alteram o MySQL. O schema contém os modelos
introspectados `aluno` e `contato`, sem alterações estruturais nesta etapa.
O client é gerado em `apps/alunos/src/generated/prisma`, ignorado pelo Git,
como TypeScript ESM com imports `.js`, compilado pelo builder `tsc`.
Após uma instalação limpa, execute a geração antes do build para incluir o client.

A CLI usa `apps/alunos/prisma.config.ts`. Tanto a CLI quanto a aplicação
carregam opcionalmente `apps/alunos/.env`; `ALUNOS_ENV_FILE` permite indicar
outro arquivo, relativo ao diretório de execução ou absoluto. Variáveis já
definidas no processo têm prioridade sobre o arquivo. Sem arquivo e sem
`DATABASE_URL`, a aplicação e as validações locais continuam funcionando.
`PrismaModule` exporta `PrismaService` apenas na API alunos. Injete o serviço
e use `prismaService.client` quando for necessário acessar o banco. O client
é criado uma única vez, sob demanda, com `PrismaMariaDb`; a conexão é aberta
somente na primeira consulta ou em um `$connect()` explícito. Não há tentativa
de conexão na inicialização, mantendo `/health` independente do MySQL.
O Nest fecha o client em `app.close()` e nos sinais de encerramento suportados,
com `enableShutdownHooks()`. O adapter gerencia e encerra seu próprio pool.
O client não registra queries, e os erros de configuração/encerramento não
incluem URL nem credenciais. Nenhum endpoint retorna registros do banco.

O teste opcional abaixo usa somente `SELECT 1 AS ok` via Prisma, sem consultar
alunos ou contatos. Ele tem configuração própria e não faz parte de `test`,
`test:e2e` ou do build. Execute somente com autorização de acesso, da raiz:

```powershell
$env:RUN_ALUNOS_DB_CHECK = '1'
try {
  npm.cmd run test:alunos:connection
} finally {
  Remove-Item Env:RUN_ALUNOS_DB_CHECK -ErrorAction SilentlyContinue
}
```

O comando exige a variável de opt-in e `DATABASE_URL` configurada no ambiente
ou no arquivo privado. Não imprime resultados, URL ou erros brutos do driver.
Esse teste não é executado automaticamente. Os testes HTTP locais simulam
um banco indisponível e verificam que `/health` responde sem tentar conectar.

`apps/alunos/.env.example` contém apenas placeholders. Quando o acesso for
autorizado, use um arquivo `.env` privado ou injete `DATABASE_URL` no processo.
No MySQL, o último segmento da URL seleciona o schema/database atribuído ao
aluno; não use parâmetro `?schema=` de PostgreSQL. Codifique caracteres
especiais do usuário e senha para uso na URL. Não registre a URL em logs.

As credenciais compartilhadas da faculdade não isolam o acesso por serviço
ou por aluno: escolher o database na URL não restringe as permissões do usuário.
Não execute introspecção, migrations, `db push`, seeds ou consultas sem a
autorização correspondente. As tabelas existentes não devem ser modificadas.

No futuro Docker Compose, injete as variáveis na execução, sem incluir `.env`
ou credenciais na imagem. O host será o servidor remoto da faculdade.
Não há configuração Docker nesta etapa. A conferência de tabelas, relações,
tipos, TLS e permissões fica pendente até recebermos o DDL ou autorização
para introspecção e acesso.

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run build
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
