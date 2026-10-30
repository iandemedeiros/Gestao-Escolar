# Integração acadêmica e API Gateway

## Rotas pela Gateway

As rotas de autenticação continuam em `/auth`. Envie `Authorization: Bearer JWT`
também nas rotas abaixo. Gateway verifica o JWT e o microsserviço verifica
novamente sua assinatura e a autorização do recurso.

| Gateway | Serviço e caminho de destino |
| --- | --- |
| `/alunos` e `/alunos/:id` | alunos, mesmo caminho |
| `/alunos/:alunoId/contatos[/contatoId]` | alunos, mesmo caminho |
| `/professores` | professores, `/professores` |
| `/contatos-professores` | professores, `/contatos` |
| `/disponibilidades-professores` | professores, `/disponibilidades` |
| `/turmas`, `/disciplinas` | turmas-disciplinas, mesmos caminhos |
| `/alocacoes-alunos`, `/alocacoes-professores` | turmas-disciplinas, mesmos caminhos |
| `/avaliacoes`, `/notas` | avaliacoes-notas, mesmos caminhos |
| `/mensagens`, `/tipos-mensagem` | comunicacao, mesmos caminhos |

Cada base preserva seus endpoints existentes de GET paginado, GET por ID,
POST, PATCH e DELETE, conforme a permissão do perfil. Os aliases de recursos
auxiliares evitam colisão entre contatos de alunos e professores. Contatos de
alunos mantêm os caminhos aninhados que já possuíam.

Gateway mantém método, corpo JSON, parâmetros, query string (inclusive ordem e
repetições), paginação e status das respostas dos CRUDs. DELETE 204 não recebe
corpo. Erros HTTP preservam o status, com mensagem genérica na Gateway para não
encaminhar erros brutos ou credenciais de um upstream mal configurado. Falhas de
rede, timeout ou resposta inválida retornam 503, sem fallback para acesso amplo.

O proxy usa uma lista fixa de destinos. Não encaminha cookies, x-role ou tokens
internos enviados pelo frontend. Não segue redirects. Rotas `/internal/*` não
são expostas pelo proxy. Caminhos com separadores codificados ou tentativa de
alterar o caminho do destino são rejeitados. Gateway não possui Prisma nem
acessa bancos. `/health` de todas as aplicações continua independente do banco.

## Configuração de ambiente

Nenhum `.env` foi modificado. Configure manualmente ou injete no processo:

| Variável | Onde configurar |
| --- | --- |
| `ALUNOS_SERVICE_URL` | Gateway, turmas-disciplinas e avaliacoes-notas |
| `PROFESSORES_SERVICE_URL` | Gateway, turmas-disciplinas e avaliacoes-notas |
| `TURMAS_DISCIPLINAS_SERVICE_URL` | Gateway, alunos e avaliacoes-notas |
| `AVALIACOES_NOTAS_SERVICE_URL` | Gateway |
| `COMUNICACAO_SERVICE_URL` | Gateway |
| `INTERNAL_AUTH_TOKEN` | Mesmo segredo em Gateway, alunos, professores, turmas-disciplinas e avaliacoes-notas |
| `JWT_SECRET` | Mesmo segredo nas seis aplicações, como anteriormente |

Os valores padrão dos URLs usam `http://127.0.0.1` e as portas 3001–3005 dos
domínios correspondentes. No futuro Compose, use hostnames dos serviços.
Os segredos não possuem fallback funcional. Endpoints internos exigem segredo
interno **e JWT**, e a identidade vem exclusivamente do JWT. CPF, hashes e dados
de login nunca são transmitidos pelas chamadas acadêmicas, apenas IDs necessários.
As chamadas internas têm timeout de três segundos; o proxy usa cinco segundos.
Não há retry automático de operações de escrita. Em rede não local, usar TLS.

## Regra provisória professor–disciplina–turma

O banco não possui vínculo direto professor–turma. A regra adotada é:

1. `alocacao_professor` associa professor a disciplina.
2. `alocacao_aluno` associa aluno, turma e disciplina.
3. Professor pode atuar em uma turma quando está alocado à disciplina e existe
   alocação de aluno nessa turma/disciplina.
4. Para lançar nota, o aluno alvo deve estar alocado **na turma e disciplina
   da avaliação**, e o professor deve continuar alocado à disciplina.

A consulta de alunos pelo professor é limitada às turmas relacionadas às suas
disciplinas. A lista devolve somente ID e nome, sem data de nascimento, CPF,
e-mail, endereço ou contatos. Isso não permite consultar um aluno fora do escopo.
Para notas e avaliações, a turma/disciplina é verificada de forma exata.

Sem alocações de alunos, o schema não permite concluir que uma turma contém
uma disciplina. Nesse caso a autorização de atuação é negada; não foi criada
uma tabela ou relação alternativa. Referências entre domínios são verificadas
por HTTP; não foram adicionadas foreign keys entre bancos.

## Permissões

| Recurso | SUPER_ADMIN | PROFESSOR | ALUNO |
| --- | --- | --- | --- |
| Alunos | CRUD administrativo | Ler ID/nome dos alunos das turmas autorizadas | Ler próprio cadastro |
| Contatos de alunos | CRUD | Não | Ler próprios contatos |
| Professores/contatos/disponibilidades | Administração existente | Próprio cadastro básico | Não |
| Turmas/disciplinas | CRUD administrativo | Ler as relacionadas às próprias disciplinas | Ler as próprias |
| Alocações de alunos | CRUD, validando aluno externo | Ler as das disciplinas autorizadas | Ler somente as próprias |
| Alocações de professores | CRUD, validando professor externo | Ler somente as próprias | Não |
| Avaliações | CRUD com validação de referências | Ler, criar e editar as próprias nos contextos autorizados | Ler somente as dos contextos de matrícula |
| Notas | CRUD com validação de contexto | Ler, lançar e editar nas próprias avaliações autorizadas | Ler somente as próprias e em contexto de matrícula |
| Mensagens | Bloqueado | Bloqueado | Bloqueado |
| Tipos de mensagem | Administração existente | Não | Não |

Professor não exclui avaliações/notas nem gerencia cadastros ou alocações.
Aluno não altera avaliações, notas ou matrículas. Nenhuma decisão usa roles
ou IDs de identidade fornecidos no corpo ou em headers do frontend.

Filtros de escopo são aplicados ao WHERE do Prisma **antes** de paginação e
contagem. Listagem vazia não amplia permissões. Detalhes e mutações também
recebem filtros; uma consulta fora do filtro local pode retornar 404. Violações
de perfil/contexto verificadas explicitamente retornam 403. Referências ausentes
retornam 404, campos inválidos 400, conflitos 409 e integração indisponível 503.

## Fluxo do professor

1. Login por CPF/senha na Gateway, recebendo JWT com perfil derivado do backend.
2. GET `/disciplinas`, `/turmas` e `/alunos` pela Gateway: dados limitados aos vínculos.
3. POST `/avaliacoes`, com turma e disciplina autorizadas. Exemplo fictício:

```json
{
  "turma_id":1,
  "disciplina_id":"UUID_DA_DISCIPLINA",
  "titulo":"Prova",
  "tipo":"prova",
  "peso":"1.00",
  "data_realizacao":"2026-11-10",
  "data_entrega_final":"2026-11-10T18:00:00Z"
}
```

Para professor, `professor_id` é preenchido com sub do JWT; tentar escolher
outro professor retorna 403. Para Super Admin esse campo precisa indicar um
professor existente e corretamente alocado. O contexto é verificado em Turmas.

4. POST `/notas`, com `avaliacao_id`, `aluno_id` e `valor_obtido`. Valida existência
   de aluno/professor, autoria da avaliação e matrícula exata no contexto.
5. PATCH de avaliação ou nota é autorizado novamente antes da alteração.

Turma, disciplina e professor de uma avaliação criada são imutáveis nesta etapa.
Avaliação e aluno de uma nota também não podem ser reassociados (409). Isso evita
transferir lançamentos existentes para contextos diferentes. O WHERE da mutação
inclui o contexto previamente autorizado; horários/prazos mantêm a detecção de
alteração concorrente já existente. Nenhuma fórmula foi adicionada para
`media_calculada`, que continua somente leitura e sem cálculo automático.

## Fluxo do aluno

1. Login por CPF/senha e GET `/auth/me` para obter seu sub assinado.
2. GET `/alunos/:sub` e seus contatos, conforme a autorização existente.
3. GET `/alocacoes-alunos`, `/disciplinas`, `/turmas`, `/avaliacoes` e `/notas`
   com `page` e `limit`; a identidade e os filtros de matrícula vêm do JWT.
4. GET `/notas/:id` exige que a nota pertença ao aluno autenticado; tentar outra
   nota retorna 403, sem expor a nota ou dados do outro aluno.

Não há filtro livre `aluno_id` para substituir a identidade do JWT. Parâmetros
desconhecidos são rejeitados. As avaliações do aluno omitem `entrega_do_aluno`:
esse campo está na avaliação e não identifica uma entrega individual no schema.
Não foi inventada uma relação de entregas por aluno.

## Contratos internos

- Alunos e Professores: POST `/internal/academic/exists`, corpo `{id}`, retorna
  `{exists:true}` ou 404, selecionando somente ID no banco proprietário.
- Turmas: POST `/internal/academic/scope`, corpo `{}`. O JWT determina o ator;
  retorna pares turma/disciplina e IDs de alunos autorizados, sem dados pessoais.
- Turmas: POST `/internal/academic/context`, corpo com turma, disciplina e IDs
  opcionais de professor/aluno. Verifica os vínculos reais e retorna `{allowed:true}`.

Escopos internos são limitados a 10000 contextos/IDs; ultrapassar esse limite
retorna 503, sem truncar silenciosamente ou liberar dados. Esta solução é
adequada à escala acadêmica; consultas de maior volume exigirão outro contrato.

## Limites e pendências

- Mensagens continuam bloqueadas porque remetente/destinatário não possuem tipo
  de domínio ou relação que permita autorização segura. Tipos de mensagem continuam
  administrativos. Não basta conhecer um UUID para receber acesso a uma mensagem.
- As regras usam vínculos atuais, não histórico de matrícula. Alterações externas
  podem mudar a visibilidade de avaliações/notas antigas. Não há histórico no schema.
- Não existe transação distribuída: há uma janela entre validar vínculo remoto e
  gravar localmente. Validamos antes da escrita e condicionamos mutações ao contexto
  local, mas não prometemos atomicidade entre cinco bancos.
- Duplicidade de alocações, capacidade de turma, escala final de notas e fórmula
  de média continuam dependentes de regras de negócio. Constraints não foram inventadas.
- Revogação JWT permanece fora desta etapa. Validade de 15 minutos e demais
  limites de autenticação continuam conforme `autenticacao.md`.
- CORS para frontend em outra origem e Swagger/OpenAPI ainda precisam ser
  configurados. O Swagger deverá documentar Bearer, matriz de permissões,
  aliases auxiliares, exemplos e respostas 400/401/403/404/409/503. Não publicar
  tokens internos, senhas ou valores de `.env` nos exemplos.
- Testes reais dependem de endpoints/segredos locais corretamente configurados,
  dados e vínculos de demonstração autorizados e permissão explícita para escrever
  no banco compartilhado. Nenhuma chamada real ou escrita foi feita nesta etapa.

## Validação automatizada

Build das seis aplicações, lint, TypeScript, testes unitários e HTTP/e2e. As
suítes incluem proxy, filtros, autorização, vínculos ausentes, falhas de rede,
privacidade e fluxo encadeado Gateway → Avaliações → Turmas → Alunos/Professores.
Nesse fluxo, os controllers, JWT e regras são reais; Prisma e transporte entre
aplicações são simulados em memória. Não há dependência dos MySQL remotos.

Não houve migração, seed, alteração de schema/client gerado, modificação de `.env`,
commit, push ou merge. O arquivo `t` e a branch `feature/monorepo` são preservados.
