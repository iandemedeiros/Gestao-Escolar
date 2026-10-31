# Swagger estático no GitHub Pages

Este deploy publica somente Swagger UI, HTML, CSS, JavaScript e a cópia de `docs/openapi.json`. Não publica nem inicia as seis aplicações, não usa Docker/Prisma, não carrega `.env` e não acessa MySQL. O token automático/OIDC das actions oficiais serve apenas para publicar no Pages; não é necessário cadastrar Secrets, credenciais de banco ou variáveis da API.

## Habilitar e publicar

1. No repositório `iandemedeiros/Gestao-Escolar`, abra **Settings → Pages → Build and deployment → Source → GitHub Actions**. Habilite Actions nas configurações do repositório se estiver desativado.
2. Leve os arquivos desta alteração para `main` pelo seu fluxo normal de revisão. Nenhum commit, push ou merge é feito pelo assistente.
3. Cada push em `main` executa **Publicar Swagger estatico**. Há execução manual em **Actions → Publicar Swagger estatico → Run workflow**; o deploy só ocorre quando a branch selecionada é `main`.
4. Se houver regras de proteção no environment `github-pages`, permita deploy de `main` e aprove o job quando exigido pela configuração do repositório.
5. Depois do deploy, acesse <https://iandemedeiros.github.io/Gestao-Escolar/>. O JSON estará em <https://iandemedeiros.github.io/Gestao-Escolar/openapi.json>. A URL efetiva também aparece no job de deployment. Domínio personalizado, se configurado no repositório, pode alterar essa URL.

O workflow usa as actions oficiais de Pages e publica apenas `.tmp/swagger-pages`, nunca a raiz do repositório, a pasta inteira `docs`, os fontes das APIs ou os arquivos de ambiente. A versão do Swagger UI está fixada em **5.33.1**, uma [release estável](https://github.com/swagger-api/swagger-ui/releases/tag/v5.33.1). CSS e bundle JS são baixados dessa tag durante o build e incluídos no artefato; os visitantes não dependem de CDN. Para atualizar a interface, revise e altere a versão no script e no HTML.

## Fonte e revisão de publicação

A fonte é exclusivamente `docs/openapi.json`, já existente e versionado. Este workflow não regenera o contrato nem importa DTOs. Quando houver mudanças na API, regenere e revise esse JSON pelo processo local existente antes de enviar a alteração a `main`.

A revisão atual encontrou somente exemplos fictícios e o servidor relativo `/`, sem hosts internos, URLs MySQL, hashes, tokens reais ou rotas internas. Campos de entrada como `senha`, CPF e e-mail fazem parte do contrato e usam exemplos fictícios, não dados de produção. As 69 operações incluem cinco de mensagens marcadas como bloqueadas. O script também rejeita marcadores de credenciais, URLs HTTP absolutas, referências externas e servidores diferentes de `/`; falhas não imprimem o conteúdo suspeito. Essa checagem automática é preventiva e não substitui a revisão humana de novos exemplos ou campos.

O servidor `/` refere-se à origem de quem hospeda o contrato; GitHub Pages não é um servidor da API. Por isso, **Try it out está desabilitado** na publicação estática. Há aviso visível de que a API não está hospedada publicamente. Para testar requisições, use o Swagger da Gateway local em `http://localhost:3000/api/docs`, com backend acessível e autorização adequada. Não informe credenciais reais na página pública; ela serve à consulta dos contratos. A validação externa do Swagger e a persistência da autorização estão desativadas.

## Validar localmente e após publicar

Na raiz, com Node 24:

```powershell
node scripts/build-swagger-pages.mjs
```

Esse comando usa apenas módulos nativos do Node. Não precisa de `npm install`, credenciais ou banco. Precisa de internet somente para baixar CSS e JS da tag oficial. A saída em `.tmp/swagger-pages` é ignorada pelo Git e contém exatamente seis arquivos estáticos. O build verifica referências relativas e o caminho `/Gestao-Escolar/openapi.json`.

Para inspecionar no navegador, sirva essa pasta com um servidor HTTP estático de sua preferência; não abra o HTML via `file://`, pois a leitura do JSON pode ser bloqueada pelo navegador.

Após o deployment:

- Verifique os jobs **build** e **deploy** na aba Actions.
- Abra `/Gestao-Escolar/` e confira o aviso, as operações e os schemas.
- Baixe `/Gestao-Escolar/openapi.json` e compare com a fonte versionada.
- Na aba Network do navegador, confirme HTTP 200 para os seis arquivos relativos e ausência de chamadas aos microsserviços/validadores externos. A página não deve ter controles de execução de requisições.
- Se houver 404, confirme a opção **GitHub Actions** em Pages, a conclusão do deploy e o nome/capitalização do repositório. Todos os assets usam caminhos relativos, sem presumir a raiz do domínio.

Referência: [workflows personalizados de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
