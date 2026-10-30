# CRUDs dos quatro domínios

## Acesso e execução

Os 11 recursos abaixo têm GET paginado, GET por ID, POST, PATCH e DELETE.
O `AccessGuard` de cada aplicação valida JWT e política de acesso. Sem token
válido retorna 401; sem permissão, 403. SUPER_ADMIN acessa as rotas administrativas,
PROFESSOR lê somente seu cadastro básico e as operações acadêmicas pendentes
continuam bloqueadas para todos. A matriz atual e a configuração estão em
[autenticação](autenticacao.md). `/health` permanece público e independente do banco.

| API | Caminhos base dos recursos |
| --- | --- |
| professores | `/professores`, `/contatos`, `/disponibilidades` |
| turmas-disciplinas | `/turmas`, `/disciplinas`, `/alocacoes-alunos`, `/alocacoes-professores` |
| avaliacoes-notas | `/avaliacoes`, `/notas` |
| comunicacao | `/mensagens`, `/tipos-mensagem` |

Para cada base: `GET /base`, `POST /base`, `GET /base/:id`, `PATCH /base/:id`,
`DELETE /base/:id`. Com autorização futura, os contratos são 200 para leituras
e PATCH, 201 para POST e 204 sem corpo para DELETE, conforme a autorização atual.

## Arquitetura e arquivos

Cada aplicação mantém seu PrismaService independente. `ResourcesModule`,
importado pelo AppModule, registra controller, service e repository de cada
recurso. Os diretórios por recurso correspondem aos caminhos da tabela e contêm:

```text
dto.ts
<recurso>.controller.ts
<recurso>.service.ts
<recurso>.repository.ts
<recurso>.service.spec.ts
```

`common/` contém validação Zod, campos reutilizáveis, paginação, tradução de
erros e guard. A validação de existência de referências externas foi adiada,
sem criar adapters provisórios ou bloquear o service com 503. Professores possui também
`PasswordHasher`, com o mesmo Argon2id usado em Alunos. Testes HTTP e fixtures
fictícias ficam em `test/resources.e2e-spec.ts` e `test/support/crud-fixtures.ts`.
Não foram adicionados pacotes, projetos npm, configurações de banco ou migrations.

## Modelos introspectados e regras de entrada

Os schemas não foram modificados. Todos os IDs são UUIDs gerados pelo servidor,
exceto `turma.id`, inteiro autoincrementado pelo MySQL. Os corpos não aceitam IDs
primários, relações Prisma aninhadas, operadores de atualização ou propriedades
desconhecidas. PATCH exige ao menos um campo permitido. Campos anuláveis aceitam
`null`; obrigatórios não aceitam. IDs numéricos de caminho são inteiros positivos
até 2147483647, sem sinal, fração ou notação exponencial. FKs numéricas no corpo
devem ser números JSON, não strings.

### Professores

- `professor`: exige `nome` (até 255), `cpf` (até 14 no banco), `email` (255) e
  `senha` na API. `formacao` é opcional/anulável (255). CPF e e-mail possuem
  restrições únicas reais. CPF aceita exatamente 11 dígitos ou a máscara
  convencional, **sem validar dígitos verificadores**. A API normaliza o CPF de
  professor para `XXX.XXX.XXX-XX`, compatível com `VarChar(14)`; Alunos permanece
  intacta, com seu armazenamento de 11 dígitos. O tamanho da coluna não prova
  o formato de todos os dados legados: confirme essa convenção antes de liberar
  escritas e o login futuro. E-mail usa apenas formato básico
  `usuario@dominio.com`, sem consulta externa, e normalização para minúsculas.
- `senha_hash` nunca é aceito do cliente. `senha` tem 8–128 caracteres e é
  transformada em Argon2id (19 MiB, duas iterações, paralelismo 1, salt aleatório).
  `admin` não é editável: o cadastro força `false`, respeitando o padrão existente.
- `contato`: exige `professor_id` e ao menos um entre telefone, celular e e-mail.
  Telefones têm até 20 caracteres e e-mail 255; são anuláveis. A FK real aponta
  para `professor`, com exclusão em cascata. PATCH pode anular os dados de contato.
- `disponibilidade_horario`: exige `professor_id`, `dia_semana` (texto até 20),
  `hora_inicio` e `hora_fim` (`HH:mm:ss`, 00:00:00–23:59:59). Fim deve ser posterior
  ao início. Não foi inventado um enum de dias ou uma regra para turnos noturnos.
  A FK real aponta para professor, com cascata.

### Turmas e disciplinas

- `turma`: exige `nome` (255), `ano_letivo` (1–9999), `turno` (50) e
  `capacidade_maxima` (inteiro positivo). O ID é autoincrementado.
- `disciplina`: UUID, `nome` (255) e `carga_horaria` positiva.
- `alocacao_aluno`: UUID, `turma_id` inteiro e `disciplina_id` UUID são FKs locais;
  `aluno_id` UUID é referência externa, sem FK para outro banco.
- `alocacao_professor`: UUID e FK local `disciplina_id`; `professor_id` UUID é
  referência externa. Exclusões de disciplinas removem suas alocações; exclusões
  de turmas removem alocações de alunos conforme as cascatas já existentes.

A alocação de professor liga professor a disciplina, não diretamente a turma.
Não existe FK professor-turma e nenhum vínculo desse tipo foi inferido no código.

Não há restrição única por combinação de IDs nas tabelas de alocação: nenhuma
foi inventada no banco ou prometida pela API. Regras de capacidade, duplicidade
de matrícula e compatibilidade de disciplinas precisam de definição de negócio
antes da liberação. Índices existentes não são tratados como constraints únicas.

### Avaliações e notas

- `avaliacao`: UUID; exige `turma_id` inteiro, `disciplina_id`, `professor_id`,
  `titulo` (255), `tipo` (100), `peso`, `data_realizacao` e `data_entrega_final`.
  Essas três referências são externas: o schema não possui FKs para outros bancos.
  `entrega_do_aluno` é timestamp anulável preservado exatamente no modelo real.
  A interpretação desse campo por avaliação, em vez de por aluno, precisa ser
  confirmada; não foi criado um modelo alternativo.
- `nota`: UUID, `avaliacao_id` (FK local), `aluno_id` (referência externa) e
  `valor_obtido`. A exclusão de avaliação remove notas em cascata.
  `media_calculada` é anulável, somente leitura: não foi inventada fórmula ou
  processamento automático de média.
- Decimais respeitam `Decimal(5,2)`: valores não negativos até 999.99, com até
  duas casas. Peso deve ser maior que zero. Aceitam string decimal ou número;
  a API devolve strings com duas casas para preservar precisão. A escala
  acadêmica (por exemplo, 0–10) ainda precisa ser definida.
- Datas usam `YYYY-MM-DD`; timestamps exigem ISO 8601 com timezone e segundos,
  sem frações. Anos de datas ficam entre 1000 e 9999. Prazo de entrega não pode
  preceder a realização. Horários e prazos são revalidados em PATCH parcial
  contra o estado existente; o update inclui os valores anteriores no filtro
  para detectar alteração concorrente (409) em vez de gravar intervalo inválido.

### Comunicação

- `tipomensagem`: UUID, `nome` obrigatório (255), `descricao` anulável (255).
- `mensagem`: UUID, `remetenteId`, `destinatarioId`, `tipoId` e `conteudo`.
  `dataEnvio` é preenchido pelo servidor, com precisão de segundos, e não pode
  ser enviado ou alterado pelo cliente. Conteúdo tem limite conservador de
  16000 caracteres e 65535 bytes UTF-8, compatível com o campo TEXT.
- Apenas `tipoId` tem FK local real. O banco não informa se remetente/destinatário
  pertence a Alunos ou Professores: não foi inventada FK ou atribuição de domínio.
  Essa resolução está pendente de contrato de identidade/autenticação.
- A exclusão de tipo referenciado por mensagens é restrita pelo banco e tratada
  como conflito 409. Não foi adicionada cascata que o schema não possua.

## Referências e tratamento de erros

Repositories verificam FKs locais em transações antes de criar ou reassociar
registros. As FKs continuam sendo a proteção final contra corridas; P2003 retorna
409 sanitizado. FKs ausentes detectadas antes da escrita retornam 404.

Referências a outros domínios são mantidas como IDs, com validação de UUID ou
inteiro conforme o schema. Não há consulta externa, FK entre bancos, adapter
provisório ou bloqueio adicional de 503. Sua existência e autorização serão
verificadas na próxima etapa de integração HTTP. Os services e os DTOs já
separam os IDs externos das relações locais; essas verificações poderão ser
acrescentadas antes da chamada ao repository. Não basta remover o guard para
considerar as referências verificadas ou as operações autorizadas.

Validação usa Zod estrito e erros genéricos, sem ecoar campos/valores recebidos.
Prisma P2002/P2003 vira 409, P2025 vira 404, limites/tipos inválidos viram 400,
e falhas inesperadas de banco viram 503. Mensagens brutas,
SQL, metadados e credenciais não são retornados ou registrados.

## Respostas explícitas

- Professor: `id`, `nome`, `formacao`. Sem CPF, e-mail, hash ou perfil admin.
- Contato de professor: apenas `id`, `professor_id`.
- Disponibilidade: ID, professor, dia e horários formatados; sem dados pessoais.
- Turmas, disciplinas e alocações: somente seus campos escalares selecionados.
- Avaliações: seus campos escalares selecionados, sem notas aninhadas.
- Notas: IDs, valor obtido e média anulável; dados acadêmicos que exigirão
  autorização por aluno/professor antes de qualquer acesso HTTP real.
- Mensagem: IDs e `dataEnvio`; **conteúdo não é retornado**. Exposição futura do
  conteúdo exige autorização de remetente/destinatário e contrato específico.
- Tipo de mensagem: ID, nome e descrição. Não há relações aninhadas nas respostas.

Paginação: `{ data, page, limit, total }`, page padrão 1/máximo 10000, limit
padrão 20/máximo 100, ordenação por ID e contagem em transação. Repetições de
parâmetros, campos desconhecidos e valores inválidos são rejeitados. Paginação
por offset pode deslocar registros entre requisições concorrentes.

## Verificações e pendências

Na raiz: `npm.cmd run build:all`, `npm.cmd run lint`,
`node node_modules/typescript/bin/tsc --noEmit --incremental false`,
`npm.cmd test` e `npm.cmd run test:e2e`.

Os testes CRUD usam apenas Prisma simulado e dados fictícios. Não executam o
teste de conexão opcional, consultas reais, escritas, introspecção ou migrations.
Os testes de hash são locais. Os schemas introspectados e o arquivo `t` foram
preservados, assim como o código de Alunos e gateway.

Antes de habilitar uso real: autenticação; autorização por operação/recurso,
incluindo escopo de listagens e reassociações; resolução de participantes de
mensagens; HTTP autenticado com timeouts e tradução de erros entre serviços;
HTTPS e ausência de logging de corpos sensíveis; limites de requisição;
confirmação de cascatas/triggers, escala de notas e regras de alocação.
Remetente deve ser vinculado à identidade autenticada, não confiado ao corpo.

A próxima etapa terá SUPER_ADMIN configurado no backend, fora do banco;
PROFESSOR autenticado por CPF/senha e limitado a seus vínculos; e ALUNO
autenticado por CPF/senha, com consulta somente de seus próprios dados
acadêmicos. Esses fluxos não foram implementados. Não há cadastro público,
atribuição livre de `admin` ou campo `isAdmin` acrescentado a aluno.

Sem testes reais autorizados não há garantia de integração com dados legados,
triggers ou configuração de timezone do MySQL. Confirme UTC/timezone no adapter
e no servidor antes de interpretar DATETIME no futuro Docker. As credenciais
compartilhadas da faculdade não isolam acesso entre domínios. Nenhum commit,
push ou merge faz parte desta etapa.
