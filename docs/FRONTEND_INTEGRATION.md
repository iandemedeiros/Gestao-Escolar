# Integração frontend — Gestão Escolar

A URL base local é `http://localhost:3000`. Todas as chamadas do frontend passam pela Gateway; os caminhos abaixo são relativos a essa URL. A porta pode ser alterada por `PORT` no processo da Gateway.

## Executar localmente

Use seis terminais na raiz do monorepo, com as configurações locais de autenticação e serviços descritas em [autenticacao.md](autenticacao.md) e [integracao-academica.md](integracao-academica.md):

| Aplicação | Comando | Porta padrão |
|---|---|---|
| Gateway | `npm run start:dev` | 3000 |
| Alunos | `npm run start:alunos:dev` | 3001 |
| Professores | `npm run start:professores:dev` | 3002 |
| Turmas e disciplinas | `npm run start:turmas-disciplinas:dev` | 3003 |
| Avaliações e notas | `npm run start:avaliacoes-notas:dev` | 3004 |
| Comunicação | `npm run start:comunicacao:dev` | 3005 |

No PowerShell, use `npm.cmd` se a política local bloquear `npm.ps1`. Não copie credenciais para o frontend. Inicializar os processos não concede autorização para alterar os bancos compartilhados. Os exemplos seguintes são fictícios; não execute cadastros ou alterações no banco remoto sem autorização.

## Swagger e exportação

- Interface: <http://localhost:3000/api/docs>.
- JSON servido: <http://localhost:3000/api/docs-json>.
- Arquivo para importar no Postman, Insomnia ou geradores: [openapi.json](openapi.json).
- Gerar: `npm run openapi:generate`.
- Verificar atualização: `npm run openapi:check`.

São 69 operações: 64 de recursos, três de autenticação, `/` e `/health`. As cinco operações de mensagens estão explicitamente bloqueadas. A documentação não publica os endpoints internos entre serviços. Swagger UI e JSON são públicos e não contêm configurações privadas. Em **Authorize**, cole somente o token; o Swagger acrescenta `Bearer`.

O gerador importa os schemas Zod de entrada e os mapeadores de resposta existentes. Não inicializa aplicações, PrismaService nem conexões. Requer dependências e os clients Prisma locais já gerados. Atualize os arquivos com o comando acima após mudanças nos DTOs. Refinamentos de data, comparação entre horários, identidade e vínculos continuam verificados no backend; nem todos podem ser expressos em JSON Schema. As restrições estão descritas nas operações. Testes verificam exemplos, projeções e atualização dos artefatos. A geração usa a conversão nativa [Zod JSON Schema](https://zod.dev/json-schema), no modo de entrada, preservando transforms no runtime.

## Login, sessão e senha

`POST /auth/login` é público. Aluno e professor usam o mesmo formato; o backend determina o perfil pelas credenciais, sem aceitar `role`:

```json
{"cpf":"111.111.111-11","senha":"senha-ficticia-123"}
```

Um professor usa seu próprio CPF e senha, por exemplo `22222222222`. A conta administrativa local usa outro formato:

```json
{"usuario":"operador-ficticio","senha":"senha-ficticia-123"}
```

Esses exemplos não são contas válidas. A configuração real da conta local permanece exclusivamente no backend. CPF aceita 11 dígitos ou máscara, sem validar dígitos verificadores. As normalizações específicas dos dois bancos são feitas pelos serviços. Credenciais válidas simultaneamente nos dois domínios são recusadas por ambiguidade. Login tem limite em memória de 10 tentativas por minuto por IP; não há proteção distribuída entre réplicas.

Resposta `200`:

```json
{"access_token":"TOKEN_FICTICIO_DO_LOGIN","token_type":"Bearer","expires_in":900,"user":{"sub":"123e4567-e89b-42d3-a456-426614174000","role":"ALUNO"}}
```

Para Super Admin, `sub` é `super-admin`; para os demais, é o UUID do cadastro. O token expira em 900 segundos (15 minutos). Não há refresh token, cookie de sessão ou revogação imediata. Não registre tokens ou senhas em logs. Toda requisição protegida envia `Authorization: Bearer <access_token>`. Dados de perfil na interface servem à apresentação: o backend verifica o JWT e os vínculos.

`GET /auth/me` devolve apenas `{"sub":"...","role":"ALUNO"}` conforme o JWT. Não consulta o estado atual do cadastro.

`POST /auth/change-password` aceita somente aluno/professor autenticado:

```json
{"senha_atual":"senha-ficticia-atual","nova_senha":"senha-ficticia-nova"}
```

Responde `200` com `{"message":"Senha atualizada."}`. Nova senha tem entre 8 e 128 caracteres. A identidade vem do token; não há campo para escolher usuário. A conta administrativa local não usa essa rota. Tokens anteriores permanecem válidos até expirar. Esta operação escreve no banco e requer autorização para uso no ambiente compartilhado.

Exemplo de leitura no navegador:

```ts
const response = await fetch(`${baseURL}/auth/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (response.status === 401) {
  // Descartar token local e apresentar login.
}
const result = await response.json();
```

Em POST/PATCH JSON, acrescente `Content-Type: application/json`. Não envie cookies nem cabeçalhos internos de comunicação.

## Recursos e permissões

Os recursos abaixo têm `GET /recurso`, `GET /recurso/{id}`, `POST /recurso`, `PATCH /recurso/{id}` e `DELETE /recurso/{id}`, salvo a exceção de contatos de aluno. Criação retorna `201`, atualização e leitura `200`, exclusão `204` sem corpo. JWT é obrigatório. IDs são UUIDs, exceto o ID inteiro positivo de turma.

| Caminho público | Leitura | Escrita |
|---|---|---|
| `/alunos` | Lista: admin/professor; detalhe: admin, professor com vínculo, aluno próprio | Super Admin |
| `/professores` | Lista: admin; detalhe: admin ou professor próprio | Super Admin |
| `/contatos-professores` | Super Admin | Super Admin |
| `/disponibilidades-professores` | Super Admin | Super Admin |
| `/turmas`, `/disciplinas` | Admin ou professor/aluno com vínculo | Super Admin |
| `/alocacoes-alunos` | Admin; professor no escopo; aluno próprio | Super Admin |
| `/alocacoes-professores` | Admin ou professor próprio | Super Admin |
| `/avaliacoes`, `/notas` | Admin ou professor/aluno no escopo | Admin; professor pode criar/editar no escopo; só admin exclui |
| `/tipos-mensagem` | Super Admin | Super Admin |
| `/mensagens` | Bloqueado | Bloqueado |

`/alunos/{alunoId}/contatos` oferece GET paginado e POST; `/alunos/{alunoId}/contatos/{contatoId}` oferece PATCH e DELETE, sem GET individual. Admin gerencia; aluno apenas lista seus próprios contatos. Respostas contêm somente IDs. Os aliases de contatos/disponibilidades de professor evitam ambiguidade entre os domínios.

Professor acessa alunos de turmas autorizadas e recebe somente `id` e `nome`. A alocação de professor no schema está ligada à disciplina; não existe associação direta professor–turma. As regras atuais derivam o escopo por disciplinas e matrículas, conforme [integracao-academica.md](integracao-academica.md). Não apresente isso como autorização definitiva para qualquer contexto escolar.

Aluno acessa apenas seus dados, suas matrículas, turmas/disciplinas vinculadas, avaliações correspondentes e próprias notas. Não pode listar todos os alunos, criar cadastros ou acessar outro aluno. O campo global `entrega_do_aluno` não é retornado nas avaliações para aluno. Professor não gerencia cadastros administrativos. O campo administrativo do professor não concede Super Admin.

Respostas de alunos não expõem CPF, e-mail, endereço ou contatos; professores retornam somente `id`, `nome`, `formacao`. Senhas e hashes nunca são respostas. Para os outros recursos, consulte a projeção explícita no Swagger. Identificadores entre bancos não criam foreign keys entre domínios: o backend consulta os serviços responsáveis.

## Fluxo administrativo

1. Autenticar a conta administrativa local e obter JWT `SUPER_ADMIN`.
2. Cadastrar aluno em `POST /alunos` com corpo:

```json
{"nome":"Aluno ficticio","data_nascimento":"2000-01-02","cpf":"11111111111","email":"aluno@example.invalid","senha":"senha-ficticia-123"}
```

Resposta exemplificativa (o ID real é gerado no servidor):

```json
{"id":"123e4567-e89b-42d3-a456-426614174000","nome":"Aluno ficticio","data_nascimento":"2000-01-02"}
```

3. Cadastrar professor em `POST /professores`:

```json
{"nome":"Professor ficticio","cpf":"22222222222","email":"professor@example.invalid","senha":"senha-ficticia-123","formacao":"Formacao ficticia"}
```

Resposta contém `id`, `nome` e `formacao`. Não enviar `admin` ou hashes. Não existe autocadastro. Campos desconhecidos são rejeitados. Datas devem ser reais; nascimento entre 1900 e hoje. E-mail usa validação básica. Senha de cadastro tem 8 a 128 caracteres.

4. Usar os IDs retornados para cadastrar turmas, disciplinas e alocações administrativas. `turma_id` é número JSON, por exemplo `1`; `disciplina_id`, `professor_id` e `aluno_id` são UUIDs. A ausência de registros/vínculos ou indisponibilidade de um serviço pode impedir o cadastro.

## Fluxo do professor

1. Fazer login com CPF/senha. Consultar `/alocacoes-professores`, `/disciplinas`, `/turmas` e `/alunos` para obter somente os IDs disponíveis no próprio escopo.
2. `POST /avaliacoes`, com JWT de professor e referências autorizadas:

```json
{"turma_id":1,"disciplina_id":"123e4567-e89b-42d3-a456-426614174002","titulo":"Avaliacao ficticia","tipo":"prova","peso":"1.25","data_realizacao":"2026-11-10","data_entrega_final":"2026-11-10T18:00:00Z"}
```

`professor_id` é derivado do JWT quando omitido; não é permitido escolher outro professor. Super Admin precisa informá-lo explicitamente. O prazo não pode anteceder a realização. A resposta contém ID, referências, título, tipo, peso e datas; peso é string decimal e `entrega_do_aluno` pode ser nulo para admin/professor. Os campos turma/disciplina/professor são imutáveis após criação (`409`).

3. Com o ID retornado, `POST /notas`:

```json
{"avaliacao_id":"123e4567-e89b-42d3-a456-426614174003","aluno_id":"123e4567-e89b-42d3-a456-426614174000","valor_obtido":"8.50"}
```

O backend verifica autoria da avaliação e matrícula exata do aluno na turma/disciplina. A resposta contém `id`, `avaliacao_id`, `aluno_id`, `valor_obtido` e `media_calculada`. Atualização usa `PATCH /notas/{id}` com `{"valor_obtido":"9.00"}`. Aluno e avaliação de uma nota são imutáveis. Não enviar `media_calculada`: é somente leitura e não há fórmula automática implementada.

## Fluxo do aluno e paginação

Após login, consultar `/auth/me`; usar `sub` para `GET /alunos/{sub}`. Consultar `GET /notas?page=1&limit=20` para as próprias notas. Não existe filtro arbitrário `aluno_id` nessa rota; o escopo vem do JWT.

```json
{"data":[{"id":"123e4567-e89b-42d3-a456-426614174004","avaliacao_id":"123e4567-e89b-42d3-a456-426614174003","aluno_id":"123e4567-e89b-42d3-a456-426614174000","valor_obtido":"8.50","media_calculada":null}],"page":1,"limit":20,"total":1}
```

Listagens usam `page` padrão 1 (máximo 10000), `limit` padrão 20 (máximo 100). Não repetir parâmetros nem acrescentar filtros não implementados. `total` respeita o escopo autorizado. Uma lista pode ser vazia. Datas de nascimento/realização são `YYYY-MM-DD`; timestamps são ISO; horários usam `HH:mm:ss`. Decimais são strings com duas casas na resposta; entradas aceitam string decimal ou número com até duas casas, até 999.99. Peso deve ser positivo. Não há escala acadêmica de notas definida além desses limites técnicos.

## Erros e recursos indisponíveis

Erros contêm `statusCode` e `message`; erros Nest podem incluir `error`. Não dependa de textos exatos para controle de fluxo.

| Código | Ação no frontend |
|---|---|
| 400 | Corrigir campos, UUID, paginação, datas ou propriedades extras |
| 401 | Credenciais inválidas ou JWT ausente/inválido/expirado; solicitar login |
| 403 | Perfil/identidade/vínculo insuficiente ou rota bloqueada |
| 404 | Recurso não encontrado no contexto permitido |
| 409 | Conflito de unicidade, contexto imutável, dependência ou mudança concorrente |
| 429 | Aguardar antes de tentar autenticação/troca de senha novamente |
| 503 | Serviço ou banco indisponível; apresentar falha temporária |

Não repetir automaticamente escritas. Não revelar mensagens de erro internas ao usuário. `GET /health` público responde `{"service":"api-gateway","status":"ok"}` e não confirma disponibilidade dos bancos. `/` preserva uma resposta textual legada.

Todas as operações `/mensagens` retornam `403` para qualquer usuário autenticado e `401` sem JWT válido. Não criar tela de envio/listagem funcional: o schema não permite identificar seguramente o domínio dos participantes. `/tipos-mensagem` administrativo continua disponível.

## CORS e hospedagem futura

Antes de iniciar a Gateway no PowerShell:

```powershell
$env:FRONTEND_ORIGINS='http://localhost:4200,http://localhost:5173'
npm.cmd run start:dev
```

A variável aceita origens HTTP(S) explícitas separadas por vírgula; sem caminhos, credenciais ou wildcard. Sem configuração, nenhuma origem externa recebe permissão de CORS. Acesso sem `Origin` (curl e comunicação servidor–servidor) e acesso na mesma origem continuam funcionando. CORS não substitui autenticação.

Para frontend em `http://localhost:3000`, use outra porta para Gateway, por exemplo `$env:PORT='3006'`, acrescente `http://localhost:3000` à lista e ajuste a baseURL para `http://localhost:3006`. Não é possível executar ambos na mesma porta/interface. São permitidos Authorization, Content-Type, GET, HEAD, POST, PATCH, DELETE e OPTIONS; cookies cross-origin não estão habilitados. Origens não permitidas não recebem `Access-Control-Allow-Origin`; o navegador bloqueia a leitura da resposta, mesmo se o HTTP retornar 200.

Para Docker, manter a configuração por ambiente e usar os hosts internos dos serviços nas variáveis de URL já existentes; a baseURL do frontend é a URL pública da Gateway, não os nomes internos do Compose. A compilação `tsc` copia o contrato JSON para o diretório de saída junto ao código da Gateway. Não há deploy ou Compose novo nesta etapa. Restam definir hospedagem, HTTPS, origens reais, endereço público e configuração de segredos; revisar o acesso público ao Swagger conforme o ambiente e resolver identidade das mensagens e regras acadêmicas definitivas.

## Validação local

```text
npm run openapi:generate
npm run openapi:check
npm run build:all
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run test:e2e
```

Esses testes usam mocks; não é necessário consultar dados reais. Os testes opcionais de conexão não fazem parte desses comandos. A exportação também não realiza conexão com MySQL.
