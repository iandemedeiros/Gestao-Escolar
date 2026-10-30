# Persistência por domínio

Prisma 7.10.1 e o adapter MySQL/MariaDB são dependências compartilhadas na raiz
do monorepo. Cada API possui configuração, schema, client gerado e provider
independentes. O gateway não possui acesso ao banco.

Para `professores`, `turmas-disciplinas`, `avaliacoes-notas` e `comunicacao`:

```text
apps/<servico>/
  .env.example
  prisma.config.ts
  prisma/schema.prisma
  src/config/environment.ts
  src/prisma/prisma.module.ts
  src/prisma/prisma.service.ts
  src/prisma/prisma.service.spec.ts
  src/generated/prisma/          # gerado, ignorado no Git
  test/prisma-offline.e2e-spec.ts
```

Os quatro schemas já contêm os modelos reais fornecidos por introspecção.
Nenhuma tabela é criada ou alterada. Os CRUDs seguem esses modelos e estão
documentados em [CRUDs dos quatro domínios](crud-dominios.md); seus endpoints
permanecem bloqueados com 403 enquanto não houver autenticação e autorização.

## Ambiente

Cada processo recebe sua própria `DATABASE_URL`. O arquivo opcional padrão é
`apps/<servico>/.env`, ignorado pelo Git. Os exemplos contêm somente placeholders.
As variáveis já injetadas no processo têm prioridade sobre o arquivo local.
Não reutilize uma URL de Alunos ou uma `DATABASE_URL` global de outro domínio.

| API | Arquivo de ambiente alternativo |
| --- | --- |
| professores | `PROFESSORES_ENV_FILE` |
| turmas-disciplinas | `TURMAS_DISCIPLINAS_ENV_FILE` |
| avaliacoes-notas | `AVALIACOES_NOTAS_ENV_FILE` |
| comunicacao | `COMUNICACAO_ENV_FILE` |

Execute os scripts da raiz do monorepo. Os caminhos alternativos podem ser
absolutos ou relativos ao diretório de execução. A CLI carrega o arquivo do
próprio serviço, assim como o `main.ts` em runtime. Sem arquivo ou URL, o
build e `/health` continuam funcionando. A tentativa de usar `.client` sem
URL produz um erro de configuração sanitizado, sem exibir credenciais.

## Ciclo de vida

`PrismaModule` exporta o `PrismaService` local. `service.client` cria uma única
instância com o client gerado do domínio e `PrismaMariaDb`, sob demanda.
Nenhum `$connect()` ou consulta é executado na inicialização. A primeira
consulta futura abriria a conexão. `onModuleDestroy` fecha os recursos com
`$disconnect()`; `main.ts` habilita os shutdown hooks do Nest.

Não há logs de queries ou exposição dos erros originais de configuração e
encerramento. Os CRUDs usam essa infraestrutura sem conexão na inicialização.

## Comandos locais

```powershell
npm.cmd run prisma:professores:validate
npm.cmd run prisma:professores:generate
npm.cmd run prisma:turmas-disciplinas:validate
npm.cmd run prisma:turmas-disciplinas:generate
npm.cmd run prisma:avaliacoes-notas:validate
npm.cmd run prisma:avaliacoes-notas:generate
npm.cmd run prisma:comunicacao:validate
npm.cmd run prisma:comunicacao:generate

npm.cmd run build:all
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
```

`validate` e `generate` trabalham com arquivos locais, sem consultar o banco.
Os clients refletem os schemas introspectados. Em checkout limpo, gere cada
client antes do build; os arquivos gerados não devem ser editados ou versionados.
O client de Alunos também precisa ser gerado com seu script existente.

As suítes verificam inicialização/encerramento sem conexão, singleton lazy,
configuração inválida sanitizada e `/health` com banco indisponível. O teste
opcional de conexão de Alunos permanece fora da execução automática.

## Docker futuro e pendências

Preservados ESM, NodeNext, imports `.js`, top-level await e builder `tsc`.
O código gerado fica dentro de `src/`, compatível com o `rootDir` atual.
No futuro build Docker, gere e compile os clients sem credenciais reais.
Injete `DATABASE_URL` separadamente em cada contêiner na execução; o hostname
será o servidor remoto da faculdade, não `localhost`. Não inclua `.env` na imagem.

Ainda falta confirmar os schemas de cada domínio, autorização de introspecção,
requisitos de TLS/rede e permissões do usuário MySQL. Compartilhar credenciais
não garante isolamento de acesso no banco; schemas e clients separados não
substituem permissões adequadas. Nenhuma introspecção, consulta, migration,
`db push` ou seed é executada pelos scripts novos.
