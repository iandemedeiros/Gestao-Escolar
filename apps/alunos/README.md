# API Alunos

## Estado do acesso

Todas as rotas de alunos e contatos retornam **403** pelo `AlunosAccessGuard`,
sem acessar Prisma ou gerar hashes. Não existe flag de liberação. `/health`
continua disponível e não depende do banco. As operações abaixo estão prontas
na camada de negócio, mas só podem ser exercitadas com mocks nesta etapa.

| Método | Caminho | Contrato quando houver autorização |
| --- | --- | --- |
| GET | `/alunos` | 200, alunos paginados |
| GET | `/alunos/:id` | 200, aluno individual |
| POST | `/alunos` | 201, aluno criado |
| PATCH | `/alunos/:id` | 200, aluno atualizado |
| DELETE | `/alunos/:id` | 204, sem corpo |
| GET | `/alunos/:alunoId/contatos` | 200, contatos paginados |
| POST | `/alunos/:alunoId/contatos` | 201, contato criado |
| PATCH | `/alunos/:alunoId/contatos/:contatoId` | 200, contato atualizado |
| DELETE | `/alunos/:alunoId/contatos/:contatoId` | 204, sem corpo |

A barra final é aceita pelo roteamento Express. Não há listagem pública.
Após a autenticação, cada operação ainda precisará autorizar o usuário sobre
o recurso solicitado; simplesmente remover o guard não é uma solução.

## Entrada e resposta

POST de aluno exige `nome` (1–150 caracteres), `data_nascimento` (`YYYY-MM-DD`,
de 1900 até hoje), `cpf` (11 dígitos e dígitos verificadores válidos), `email`
(até 150 caracteres) e `senha` (12–128 caracteres). Não há truncamento de senha.
Essas políticas deverão ser confirmadas com os requisitos acadêmicos.
Os campos opcionais `endereco_*` respeitam os tamanhos do schema e aceitam
`null` para remoção. UF tem duas letras; CEP aceita oito dígitos, com hífen
opcional. E-mails são normalizados para minúsculas e UF para maiúsculas.

PATCH aceita um subconjunto não vazio desses campos. `null` é aceito apenas
nos campos opcionais do schema. `senha_hash`, `id`, `aluno_id`, relações e
qualquer campo desconhecido são rejeitados com 400. IDs são UUIDs gerados no
servidor; os UUIDs dos caminhos são validados também no service.

POST de contato aceita `telefone`, `celular` e `email`, com ao menos um valor
não nulo. Telefones têm 3–15 caracteres e devem conter dígitos; podem incluir
espaços, parênteses, hífen e um `+` inicial. E-mail tem até 150 caracteres.
PATCH exige ao menos um desses campos; os campos podem ser anulados, conforme
o schema existente. O aluno associado é sempre o do caminho, nunca o do corpo.

Respostas são montadas por whitelist:

- Aluno: `{ id, nome, data_nascimento }`, com data sem horário.
- Contato: `{ id, aluno_id }`; telefones e e-mails são deliberadamente omitidos.
- Listagem: `{ data, page, limit, total }`, inclusive para coleção vazia.
- Exclusão: 204 sem corpo.

Paginação: `page` inteiro de 1 a 10000, `limit` inteiro de 1 a 100, padrões 1 e
20. Parâmetros desconhecidos, repetidos, negativos ou fracionários são rejeitados.
Listagem e contagem usam uma transação e ordenação por `id` para paginação
determinística. Inserções/exclusões concorrentes ainda podem deslocar páginas
entre requisições; uma evolução futura poderá adotar cursores.

## Senhas, erros e isolamento

`PasswordHasher` usa Argon2id, salt aleatório, 19 MiB de memória, duas iterações
e paralelismo 1, seguindo o mínimo publicado pela
[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
O hash cabe no `VarChar(255)` existente e não é aceito do cliente ou retornado.
Antes da liberação real será obrigatório HTTPS, sem logging de corpos,
credenciais, senhas ou erros brutos do driver, além de limites de requisição.

`databaseOperation` traduz falhas conhecidas sem retornar mensagem SQL, valores
ou metadados: entrada inválida 400; registro ausente 404; unicidade/referência
em conflito 409; infraestrutura indisponível 503. Falhas de hashing também
retornam 503 genérico. Erros Zod não são serializados para evitar eco de entrada.

Contatos são listados sempre com filtro de aluno. Criação confirma o pai dentro
da transação. PATCH/DELETE usam `{ id: contatoId, aluno_id: alunoId }` na própria
mutação, evitando uma checagem separada sujeita a corrida. Um contato existente
sob outro aluno é tratado como ausente (404), sem confirmar sua existência.

O schema introspectado já possui `onDelete: Cascade` de aluno para contatos:
uma exclusão real de aluno também excluiria seus contatos. Nenhuma constraint
foi alterada. Essa regra e eventuais triggers devem ser confirmados com a
faculdade antes de liberar operações reais.

## Verificação local

Na raiz do monorepo:

```powershell
npm.cmd run build:alunos
npm.cmd run lint
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd test
npm.cmd run test:e2e
```

As suítes CRUD usam Prisma simulado e dados fictícios. Somente o teste de hash
executa Argon2id real, localmente. Os testes HTTP removem o guard apenas em
instâncias de teste com Prisma substituído, e verificam o bloqueio na aplicação
sem esse override. O teste opcional de conexão não faz parte dessas suítes.

## Pendências

- Implementar autenticação e autorização por operação e recurso.
- Confirmar regras de senha, CPF, datas e exclusão com o responsável acadêmico.
- Confirmar permissões e efeitos de constraints/triggers em ambiente autorizado.
- Revalidar Argon2 no Linux usado pelo futuro Docker; não copiar binários de
  `node_modules` do Windows para a imagem.
- As credenciais compartilhadas MySQL não isolam permissões por serviço.
- Não houve teste de leitura pessoal ou escrita no MySQL real. Migrações,
  `db push` e seeds continuam fora do escopo.
