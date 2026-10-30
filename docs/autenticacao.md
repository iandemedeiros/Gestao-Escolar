# Autenticação JWT e autorização inicial

## Configuração local

Nenhum `.env` existente foi alterado. Acrescente as variáveis abaixo manualmente
nos arquivos privados ou injete-as no processo. Os `.env.example` são apenas
referências, sem segredo padrão funcional.

| Aplicação | Variáveis |
| --- | --- |
| Todas as seis | `JWT_SECRET` |
| Gateway, Alunos e Professores | `INTERNAL_AUTH_TOKEN` |
| Gateway | `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD_HASH` |
| Gateway | `ALUNOS_SERVICE_URL`, `PROFESSORES_SERVICE_URL` |

`JWT_SECRET` e `INTERNAL_AUTH_TOKEN` devem ser segredos diferentes, aleatórios,
com pelo menos 32 bytes. Gere cada um localmente, por exemplo:

```powershell
node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(32).toString('hex'));"
```

Use o mesmo JWT_SECRET em todas as APIs. Compartilhe INTERNAL_AUTH_TOKEN apenas
entre Gateway, Alunos e Professores. Não reutilize senhas do MySQL nesses valores.

Para a conta administrativa da demonstração:

1. Na raiz, execute `npm.cmd run auth:hash` em um terminal interativo.
2. Digite a senha escolhida na solicitação oculta. Não passe a senha como argumento.
3. Copie somente o hash resultante para `SUPER_ADMIN_PASSWORD_HASH` no `.env` privado
   da Gateway. Em dotenv, coloque o hash entre aspas simples para preservar os `$`.
4. Configure `SUPER_ADMIN_USERNAME=admin67` nesse mesmo ambiente local.
5. Não versione o arquivo, o hash administrativo ou os segredos.

A senha de demonstração não aparece no código ou nesta documentação. O script
aceita entrada oculta em terminal ou stdin para automação; imprime somente o hash
Argon2id. A conta administrativa não possui tabela nem depende de MySQL.

Gateway carrega opcionalmente `apps/api-gateway/.env`; `GATEWAY_ENV_FILE` pode
indicar outro arquivo. Os demais serviços mantêm seus loaders existentes.
Variáveis injetadas têm prioridade. A configuração é lida sob demanda: `/health`
continua funcionando sem JWT, credenciais ou banco disponível.

Os endereços padrão dos serviços de credenciais são `http://127.0.0.1:3001` e
`http://127.0.0.1:3002`. No futuro Docker, use os nomes dos serviços, não localhost.
HTTP sem TLS destina-se somente à demonstração local em rede confiável. Use HTTPS
e rede restrita quando transportar credenciais entre máquinas. Não exponha
`/internal/auth/*` publicamente nem registre corpos, tokens ou senhas em logs.

## Endpoints públicos na Gateway

### POST /auth/login

Aluno ou professor:

```json
{"cpf":"111.111.111-11","senha":"SENHA_DO_USUARIO"}
```

Super Admin:

```json
{"usuario":"admin67","senha":"SENHA_LOCAL"}
```

CPF aceita 11 dígitos ou máscara convencional, sem cálculo de verificadores.
Não envie `role`, `sub`, `id`, `admin` ou outros campos: DTOs estritos os rejeitam
com 400. CPF é normalizado para 11 dígitos em Alunos e máscara de 14 caracteres
em Professores. O formato dos dados legados precisa ser confirmado antes do uso
real. Não há consulta externa de CPF ou e-mail.

A Gateway não acessa bancos. Envia a verificação aos dois serviços proprietários,
que leem somente ID e hash, verificam Argon2 e devolvem apenas sujeito e perfil.
O perfil vem do serviço, nunca do cliente. `professor.admin=1` não concede
SUPER_ADMIN e nem é selecionado na consulta de credenciais.

Se CPF e senha corresponderem a ambos os bancos, o login retorna 401 genérico
por ambiguidade. Se um serviço estiver indisponível, o login por CPF retorna 503,
sem escolher um perfil com informação incompleta. Ambos precisam estar ativos
para esse login. Super Admin continua independente deles.

Resposta 200:

```json
{
  "access_token":"JWT_RECEBIDO",
  "token_type":"Bearer",
  "expires_in":900,
  "user":{"sub":"UUID_DO_USUARIO","role":"ALUNO"}
}
```

Perfis: ALUNO, PROFESSOR e SUPER_ADMIN. Para Super Admin, sub é `super-admin`.
CPF inexistente, senha incorreta e login ambíguo retornam a mesma mensagem
401: `Credenciais invalidas.`. Entradas malformadas retornam 400. Indisponibilidade
retorna 503 sem detalhes do driver ou do serviço remoto.

### GET /auth/me

Envie `Authorization: Bearer JWT_RECEBIDO`. Retorna somente `{ sub, role }`
validados do token, sem consultar o banco. Ausência, assinatura inválida,
expiração, algoritmo incorreto ou claims inválidos retornam 401.

### POST /auth/change-password

Requer JWT de ALUNO ou PROFESSOR:

```json
{"senha_atual":"SENHA_ATUAL","nova_senha":"NOVA_SENHA"}
```

O ID vem exclusivamente do JWT. A Gateway encaminha o token ao serviço
correspondente, que o verifica novamente, confirma a senha atual e faz update
condicionado ao hash anterior para detectar concorrência. O novo hash usa
Argon2id; nenhum hash é retornado. Senha nova e cadastro exigem 8–128 caracteres,
sem regras de combinações de caracteres. Login não impõe um mínimo novo sobre
senhas legadas. Nenhuma senha é truncada ou registrada.

Resposta 200: `{"message":"Senha atualizada."}`. Senha atual incorreta retorna
401 genérico; alteração concorrente retorna 409; falhas de banco retornam 503.
Super Admin recebe 403: sua senha é alterada substituindo o hash no ambiente.

Essa implementação contém uma escrita de senha quando a rota é invocada pelo
usuário. Nenhuma escrita foi executada durante o desenvolvimento. Não teste
trocas de senha ou outros endpoints de mutação no banco compartilhado sem
autorização para escrever: os testes automatizados usam exclusivamente mocks.

## Comunicação interna

Alunos e Professores possuem `POST /internal/auth/verify`, que exige o segredo
`x-internal-auth-token`. Retorna somente `{ sub, role }`, nunca o hash. CPF ausente
usa verificação com hash fictício para reduzir diferença de tempo em relação
à senha incorreta. Erros não expõem valores ou detalhes internos.

`POST /internal/auth/change-password` exige **segredo interno e JWT** do perfil
correto. Seu corpo tem apenas senha atual e nova; não aceita um ID arbitrário.
JWT público, sozinho, não dá acesso às rotas internas. Chamadas HTTP têm timeout
de três segundos e não seguem redirects para evitar encaminhar credenciais.

## Matriz de autorização atual

| Recurso | SUPER_ADMIN | PROFESSOR | ALUNO |
| --- | --- | --- | --- |
| Cadastros de alunos e seus contatos | CRUD | Não | GET do próprio aluno e lista de seus próprios contatos |
| Cadastros de professores | CRUD | GET do próprio cadastro básico | Não |
| Contatos e disponibilidades de professores | CRUD | Não nesta etapa | Não |
| Turmas e disciplinas | CRUD administrativo | Não nesta etapa | Não |
| Tipos de mensagem | CRUD administrativo | Não | Não |
| Alocações de alunos/professores | Bloqueado | Bloqueado | Bloqueado |
| Avaliações e notas | Bloqueado | Bloqueado | Bloqueado |
| Mensagens | Bloqueado | Bloqueado | Bloqueado |

Cada microsserviço valida assinatura, expiração, emissor, audiência, perfil e
sujeito por conta própria. Não confia em x-role, IDs de usuário no corpo ou no
fato de uma requisição ter passado pela Gateway. Sem token válido retorna 401;
com token válido e sem permissão, 403. Leitura própria compara o ID do caminho
com sub antes de consultar Prisma. Não há autocadastro, alteração de admin pelo
cliente, isAdmin em Alunos ou liberação genérica para qualquer usuário logado.

`Roles` e `Self` são decorators simples; ausência de política de acesso em rota
protegida significa negar, inclusive para Super Admin. Os endpoints acadêmicos
permanecem assim até implementar autorização baseada em vínculos reais.

Nesta etapa a Gateway expõe autenticação, sem proxy geral de CRUDs. Use o JWT
diretamente nos endpoints autorizados dos microsserviços, nas portas existentes.
O roteamento geral pela Gateway pode ser adicionado no próximo bloco.

## Limites e próxima etapa

- JWT HS256, duração de 15 minutos, emissor/audiência fixos, sem refresh token.
  O segredo compartilhado exige confiança entre os serviços; assinatura assimétrica
  poderá separar a chave privada da Gateway das chaves públicas dos verificadores.
- Não há revogação imediata após troca de senha, exclusão de conta ou alteração
  de permissões. Tokens existentes expiram em até 15 minutos; /auth/me mostra
  claims, não o estado atual da conta. Revogação será uma etapa própria.
- Limite de 10 tentativas por minuto por IP em memória, também nas verificações
  internas. Reiniciar limpa o contador; múltiplas instâncias não compartilham
  estado. O serviço interno enxerga o IP da Gateway e pode limitar usuários
  agregados na demonstração. Não se confia em X-Forwarded-For do cliente.
- A validação de vínculos professor–disciplina–turma, matrícula e participantes
  de mensagens permanece pendente. O schema não define professor–turma direto.
- SUPER_ADMIN cria e gerencia cadastros; professores e alunos não ganham direitos
  administrativos por campos do banco ou dados enviados pelo frontend.
- Confirmar convenções de CPF legado, TLS, rede e autorização de escrita antes
  de executar mutações reais. Schemas e clients gerados não foram modificados.

Os helpers de segurança ficam dentro de src de cada aplicação para preservar
os builds tsc independentes e seus caminhos atuais. Não foi necessário alterar
tsconfig, criar novas aplicações ou adicionar tabelas.

## Validação local sem MySQL

```powershell
npm.cmd run build:all
npm.cmd run lint
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd test
npm.cmd run test:e2e
```

Prisma e transporte HTTP entre domínios são substituídos por mocks nas suítes.
JWT e Argon2 são exercitados localmente com chaves e contas fictícias. O teste
opcional de conexão de Alunos não é executado automaticamente. Não houve login
ou consulta de credenciais reais nem qualquer operação de escrita no MySQL.
