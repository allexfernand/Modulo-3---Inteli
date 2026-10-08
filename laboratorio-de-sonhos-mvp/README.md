# Registro do Laboratório de Sonhos

Aplicação do **Instituto Ebenézer** para registrar, ao fim da oficina de sábado, a aspiração de cada criança em poucos toques, e transformar isso em indicadores agregados por turma e por ciclo. A operação fica na **Vercel, plano de US$ 20/mês**, com o banco em Postgres, para o serviço permanecer no ar entre um sábado e outro. Também roda na rede do Instituto, num computador local, se for o caso.

- Front-end: HTML, CSS e JavaScript puro (sem framework).
- Back-end: Node.js + Express.
- Banco: SQLite nativo do Node (`node:sqlite`), um arquivo local.
- Todos os dados que acompanham o projeto são **sintéticos**.

Código: https://github.com/allexfernand/Modulo-3---Inteli

Operação, no plano pago: https://laboratorio-sonhos.vercel.app

Demonstração do backend Express, no Render gratuito: https://laboratorio-de-sonhos-mvp.onrender.com. Essa instância dorme depois de cerca de 15 minutos e, ao acordar, recria o banco com os dados sintéticos do seed. O que precisa durar de um sábado para o outro fica na Vercel.

## Vídeo demonstrativo

Dois takes gravados em 8 de outubro de 2026, publicados com acesso livre:

- **Celular.** Fluxo de registro do sábado, do perfil até a exportação.
- **Computador.** Administração: troca do PIN provisório, cobertura por sessão, quem pode exportar e backup.

> Duas partes: **Parte 1 — para pessoas** (instalar e usar) e **Parte 2 — para IA** (como um agente como o Claude Code deve ler, rodar e alterar o projeto sem quebrar nada). Pessoas também podem ler a Parte 2.

---

# PARTE 1 — PARA PESSOAS

## 1. O que você precisa

- Um computador com **Node.js 22.5 ou mais recente** (`node -v` no terminal confere).
- O computador e os celulares precisam estar na **mesma rede Wi-Fi**.

## 2. Como rodar (primeira vez)

No terminal, **dentro da pasta do projeto**, um comando por vez:

```bash
npm install      # baixa as dependências (só na primeira vez)
npm run seed     # cria o banco com dados de exemplo
npm start        # liga o servidor
```

O terminal mostra:

```
Nesta máquina:           http://localhost:3000
Na rede local (celular): http://192.168.0.25:3000
```

- No computador do servidor, abra o primeiro endereço. No celular (mesma Wi-Fi), abra o segundo.
- Para desligar: `Ctrl + C` no terminal.
- O aviso `ExperimentalWarning: SQLite is an experimental feature` é normal.

## 3. Quem usa e o que cada pessoa pode fazer

| Papel | Como entra | O que pode | O que não pode |
|---|---|---|---|
| **Coordenadora** | um toque no próprio cartão | registrar, ver o painel; exporta **se o administrador permitir** | usar a Administração |
| **Educadora voluntária** | um toque no próprio cartão | registrar | ver painel ou usar a Administração; só exporta se o administrador permitir |
| **Administrador** | link **"Acesso administrativo"** (rodapé da tela inicial) + **PIN** | KPIs, pessoas e permissões, encerrar ciclo, backup, auditoria; vê Painel e Exportação | **registrar** (quem governa não registra) |

### Primeiro acesso do administrador (faça logo)
O sistema vem com **"Administrador do Instituto"** e o PIN provisório **`1234`**:
1. Toque em **Acesso administrativo** e entre com `1234`. Um alerta vermelho pede a troca.
2. **Pessoas e acessos → Trocar meu PIN** (4 a 8 dígitos).
3. Cadastre quem será o administrador de verdade (papel *Administrador*, PIN próprio) e, se quiser, desative a conta de exemplo.

Após **5 PINs errados** o login do administrador bloqueia por 5 minutos. Para já criar o banco com outro PIN: Mac/Linux `ADMIN_PIN_INICIAL=482913 npm run seed`; Windows (PowerShell) `$env:ADMIN_PIN_INICIAL="482913"; npm run seed`.

## 4. Usando no sábado (Coordenadora ou Educadora)

O registro é **uma tela só**, sem sequência obrigatória: ninguém fica preso até preencher todo mundo.

1. Toque no seu perfil e escolha a turma (**Abrir turma**; se já houver uma sessão em andamento, o botão vira **Continuar registro**).
2. Aparecem os cartões das crianças. **Toque numa criança**, depois **toque no que ela disse que quer ser**: já salvou, a janela fecha e a tela rola até a próxima pendente.
3. Não declarou? Use **"Ainda não declarou"** (embaixo, separada); conta como registrado.
4. Quer anotar **como estava hoje** (animada, concentrada, quieta, frustrada)? É opcional: toque numa carinha antes de escolher a resposta.
5. **A criança não veio?** Toque nela e escolha **"Não veio hoje"**.
6. **Errou?** Toque no cartão de novo: dá para mudar a resposta, marcar "citou um passo para chegar lá" (opcional) ou **Limpar registro**.
7. **Faltam crianças?** Use o filtro **Pendentes** para ver só quem falta.
8. **Para terminar**, toque em **Encerrar sessão** quando quiser (precisa de pelo menos 1 registrada). Diga o que aconteceu com as pendentes (marcar como ausentes ou deixar sem registro), toque em **quem conduziu a oficina** e confirme. Depois de confirmar, a exposição do dia não muda.

Pode sair da tela a qualquer momento: tudo que foi tocado já está salvo e o tempo parado não conta. Só existe **uma sessão aberta por turma**; se uma ficou aberta de outro dia, a tela avisa e você continua ou encerra.

## 5. Tela de Administração (4 abas)

- **Visão geral:** alertas e indicadores (tempo médio por criança, sessões acima da meta, cobertura, regularidade, "Ainda não declarou", exportações, último backup), uma linha por turma, **cobertura de registro por sessão (%)** e amplitude de categorias por ciclo.
- **Pessoas e acessos:** cadastrar, mudar papel, desativar/reativar (nunca excluir: o histórico guarda quem registrou; vale na hora), gerir PIN, definir **quem pode exportar** (por pessoa, vale na hora) e ver as turmas cadastradas.
- **Ciclos:** encerrar o ciclo atual e abrir o próximo. **Irreversível**: trava a edição do ciclo encerrado. Só funciona sem sessão aberta.
- **Sistema e auditoria:** baixar backup, rotina de gestão sugerida e a trilha de quem fez o quê.

## 6. Backup (importante)

- Há **1 backup automático por dia** em `backups/` (guarda os 14 mais recentes) e o administrador baixa um a qualquer hora.
- **Copie backups para fora do computador** (pen drive ou nuvem do Instituto). Backup só na mesma máquina se perde junto com o disco.
- Restaurar: desligue o servidor e troque `backend/db/laboratorio.db` por uma cópia de `backups/`.

## 7. Deixar o servidor sempre ligado (recomendado)

```bash
npm install -g pm2
pm2 start backend/server.js --name laboratorio-de-sonhos
pm2 save
pm2 startup      # siga as instruções impressas para iniciar junto com o computador
```

Reiniciar o servidor desloga todo mundo (sessões em memória): é só tocar no perfil de novo.

> **Windows:** `pm2 startup` não funciona no Windows; use um complemento como `pm2-windows-startup` ou o Agendador de Tarefas. **Não testei a instalação no Windows**; os comandos foram validados em Linux.

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `Banco de dados desatualizado` ao iniciar | Banco de versão antiga. Rode `npm run seed` (**apaga tudo e recria com dados de exemplo**). |
| O celular não abre o endereço | Mesma Wi-Fi (não use rede de visitantes) e firewall liberando a porta 3000. |
| `EADDRINUSE` / porta em uso | `PORTA=3001 npm start` (Mac/Linux) ou `$env:PORTA=3001; npm start` (PowerShell). |
| `node:sqlite` não encontrado | Node antigo: atualize para 22.5 ou mais recente. |
| Esqueci o PIN do administrador | Outro administrador redefine em *Pessoas e acessos*. Se for o único: `npm run seed` (apaga os dados) ou apoio técnico. |
| A turma mostra "Em andamento" de um sábado antigo | Toque em **Continuar registro** e encerre a sessão. |
| Sessão "sumiu" depois de reiniciar | Normal (sessões em memória): toque no perfil de novo. Os registros não se perdem. |

## 9. Limitações conhecidas (leia antes de usar com dado real)

- **Sem HTTPS:** na rede local o PIN trafega sem criptografia. Use uma rede confiável.
- Sessões em memória e servidor de processo único: adequado ao porte do piloto.
- Dados **sintéticos**. Antes de dado real de criança: validação LGPD com a psicóloga.
- **O ritmo de registro com esta tela nova ainda não foi cronometrado com uma pessoa real.** O que existe é teste automatizado de funcionamento (inclusive num navegador de verdade), que não mede o tempo humano.
- Criar/remover turmas e crianças na Administração **não existe** (as turmas e crianças sintéticas são fixas); depende da validação LGPD.

## 10. Documentos de apoio (pasta `docs/`)

`modelo-de-dados.md` (banco), `decisoes-tecnicas.md` (porquê de cada escolha, defeitos corrigidos), `roteiro-video-demo.md` (roteiro usado na gravação). Os dois takes estão no topo deste README. Saídas reais dos testes em `testes/evidencias/`.

---

# PARTE 2 — PARA IA (Claude Code e outros agentes)

> Leia esta parte inteira **antes** de alterar qualquer arquivo. O projeto é uma aplicação **funcional e testada**. Padrão: rodar, verificar, e só então fazer mudanças pequenas e justificadas. Não reescreva nem "modernize" o que funciona.

## A. Ao receber este projeto, faça exatamente isto

1. `node -v` (≥ 22.5; `node:sqlite` é nativo e emite `ExperimentalWarning`, esperado).
2. `npm install`
3. `npm run seed` (**apaga e recria o banco**; seguro porque só há dados sintéticos).
4. `npm test`. Esperado: **28 de 28**. Se for outro número, pare, mostre o erro completo e **não mude código** antes de entender a causa.
5. Se pediram para subir o app: `npm start` e informe as duas URLs impressas.
6. Opcional (mais forte): teste em navegador real — ver seção C.
7. No relatório final, separe o que você **executou e viu passar** do que **não verificou**. Nunca declare "funciona" sem ter rodado.

## B. Mapa do projeto

```
backend/
  server.js              Express; exige login em /api/* (exceto /api/auth); backup diário
  vocabularios.js        listas FECHADAS (categorias, estados, exposições) — validam antes do banco
  seguranca.js           hashPin / verificarPin (scrypt+salt) / pinValido (4–8 dígitos)
  auditoria.js           registrarAuditoria(usuarioId|null, acao, detalhe)
  backup.js              criarBackup (VACUUM INTO), backup diário, ultimoBackupEm()
  db/  schema.sql (9 tabelas, CHECK) · conexao.js · seed.js (RECRIA tudo) · verificarVersao.js
  rotas/
    middlewareAcesso.js  exigirLogin (reconsulta o banco), exigirPapel(papel|[papéis]), exigirExportacao
    auth.js turmas.js ciclos.js sessoes.js registros.js painel.js exportacao.js admin.js
frontend/
  index.html             redireciona para telas/00-login.html
  css/estilo.css         paleta + componentes (cartões, folha deslizante, Administração)
  js/api.js              api(), estado (sessionStorage), irPara(), esc(), dataLocalISO(),
                         e o vocabulário VISUAL (CATEGORIAS/ESTADOS/EXPOSICOES com emoji), avatares
  telas/                 00-login · 00b-admin-login · 01-entrada (turma) · 02-lista (REGISTRO) ·
                         06-confirmacao · 07-painel · 08-exportacao · admin
testes/
  teste-fluxo-principal.js  teste-casos-limite.js  teste-admin.js  teste-registro-flexivel.js  (npm test)
  helper-servidor-teste.js  servidor + banco isolado (4 turmas de 3 crianças, 4 usuários)
  e2e-navegador.js          opcional: Chromium real clicando nas telas (+ capturas de tela)
  evidencias/               saídas reais de testes
docs/                    modelo-de-dados.md, decisoes-tecnicas.md, roteiro-video-demo.md
```

São **3 telas principais** (Perfil, Turma, Registro), como promete o pitch; o registro é **uma tela só** com folha deslizante. Não recrie telas por criança.

## C. Comandos e variáveis de ambiente

| Comando | O que faz |
|---|---|
| `npm start` | servidor em `0.0.0.0:${PORTA:-3000}` |
| `npm run seed` | **apaga** e recria o banco com dados sintéticos |
| `npm test` | 28 testes (`node --test`, 4 arquivos; cada um com porta e banco próprios) |

**Teste em navegador real (opcional):** `npm install --no-save puppeteer-core @sparticuz/chromium` e depois `node testes/e2e-navegador.js` (ou `CHROME_PATH=/caminho/do/chrome`). Sobe servidor e banco temporários sozinho, clica como uma pessoa e deve terminar com `TODAS AS VERIFICAÇÕES NO NAVEGADOR PASSARAM`. Com `CAPTURAS=pasta` salva PNGs das telas (use para **olhar** a interface, não só testá-la).

| Variável | Efeito |
|---|---|
| `PORTA` | porta do servidor (padrão 3000) |
| `SEGREDO_SESSAO` | segredo do cookie; se ausente, aleatório a cada inicialização |
| `ADMIN_PIN_INICIAL` | PIN provisório do administrador no seed (padrão `1234`) |
| `CAMINHO_BANCO_TESTE` | usa outro arquivo de banco **e desliga o backup automático** |
| `DIRETORIO_BACKUPS` | pasta dos backups (padrão `./backups`) |

## D. Regras inegociáveis (não quebre, mesmo que pareça melhorar)

1. **Dados sintéticos sempre**; nenhuma foto de criança (avatar = inicial colorida).
2. **Nenhuma visão individual** no Painel, na Exportação nem nos KPIs da Administração (tudo agregado ou sobre equipe). A lista da tela de **registro** mostra a resposta de cada criança só a quem está registrando, na própria sessão.
3. **Nenhum texto livre** sobre comportamento/emoção da criança. O valor emocional vem do campo **fechado** `estado_observado`.
4. Nenhuma tela pede ação da psicóloga ou da criança.
5. **Papel e permissões aplicados no servidor** (sessão). Nunca confie em papel, id ou permissão vindos do cliente.
6. **Administrador governa, não registra:** `POST /api/sessoes`, `POST /api/registros` etc. retornam 403 para ele.
7. **Auditoria nunca grava nome de criança.** PIN nunca em texto puro; bloqueio após 5 erros.
8. Todo texto vindo do banco que for a `innerHTML` passa por `esc()`.
9. **Quem registra nunca fica preso:** não crie sequência obrigatória; encerrar é possível a qualquer momento com ≥ 1 registro; criança ausente é um estado (`ausencias`). Pergunta principal primeiro; "Ainda não declarou" visualmente separada; campos extras (estado, percurso) **opcionais** e abaixo da pergunta principal.
10. Saudação com o nome da sessão (nunca fixo); toda rota de `/api/*` (exceto `/api/auth`) exige login.
11. Os **valores gravados** são os do vocabulário oficial (`vocabularios.js` = `CHECK` do schema). A tela pode mostrar nomes curtos/emoji, mas **envia o valor oficial**. (Uma divergência aqui já causou um defeito real.)
12. Stack deste repositório: Node + Express + `node:sqlite` + HTML/CSS/JS puro. A hospedagem escolhida para a operação é a Vercel paga (US$ 20/mês), com Postgres; o Render gratuito é só a demonstração deste backend.

## E. Modelo de dados (resumo; ver `schema.sql`)

```
usuarios  (id, nome, papel[coordenadora|educadora_voluntaria|administrador], ativo, pin_hash, pin_provisorio, pode_exportar)
turmas    (id, nome, horario, tamanho_estimado)
criancas  (id, turma_id, nome_sintetico)
ciclos    (id, nome, data_inicio, data_fim)            data_fim NULL = ciclo atual
sessoes   (id, turma_id, ciclo_id, usuario_id, data, status, exposicao_profissional,
           hora_inicio, hora_fim, segundos_pausados, tempo_total_segundos)
pausas    (id, sessao_id, pausada_em, retomada_em)     informativa
registros (id, sessao_id, crianca_id, aspiracao_categoria, percurso_sim_nao, estado_observado,
           criado_em, editado_em)                      UNIQUE(sessao_id, crianca_id)
ausencias (id, sessao_id, crianca_id, criado_em)       UNIQUE(sessao_id, crianca_id)
auditoria (id, usuario_id [NULL = sistema], acao, detalhe, criado_em)
```

Invariantes: `tempo_total_segundos` = **tempo ativo** (intervalos entre toques limitados a 120 s); `percurso_sim_nao` é opcional (NULL = sem resposta) e sempre NULL com "Ainda não declarou"; registro só é editável/removível se o ciclo da sessão tem `data_fim` NULL; usuários são desativados, nunca excluídos; **uma sessão aberta por turma**; cobertura = registradas ÷ (crianças − ausentes).

## F. API (resumo)

Pública: `/api/auth/*` (`GET usuarios` só pessoas ativas que registram; `GET administradores` só id e nome; `POST login`; `GET me` → inclui `podeExportar`; `POST logout`). **Todo o resto exige sessão.**

| Rotas | Quem |
|---|---|
| `GET /api/turmas`, `/turmas/:id/{criancas,resumo-ultimo-encontro,sessao-aberta}`, `GET /api/ciclos` | qualquer pessoa logada |
| `POST /api/sessoes` (abre ou devolve a aberta da turma), `GET /api/sessoes/:id`, `POST …/:id/{pausar,retomar,exposicao,concluir}` | coordenadora, educadora |
| `POST/DELETE …/:id/ausencias` (`{criancaId}` \| `{criancaIds}` \| `{todosPendentes:true}`) | coordenadora, educadora |
| `POST /api/registros`, `PUT/DELETE/GET /api/registros/:id` (PUT é **parcial**) | coordenadora, educadora |
| `GET /api/turmas/:id/painel?ciclo_id=` | coordenadora, administrador |
| `GET /api/ciclos/:id/exportacao`, `POST …/exportacao/registro` | quem tem **permissão de exportar** (administrador sempre) |
| `/api/admin/*`: `overview`, `turmas`, `usuarios` (GET/POST/PATCH com `podeExportar`), `usuarios/:id/pin`, `ciclos/encerrar`, `backup`, `auditoria` | só administrador |

Códigos: 401 sem sessão/usuário desativado, 403 sem permissão, 409 duplicado/conflito, 429 login de administrador bloqueado, 400 validação.
`POST /api/sessoes/:id/concluir` exige a exposição do dia (no corpo ou antes) e ≥ 1 registro; devolve `registrados, ausentes, semRegistro, totalCriancas, novasAspiracoes, tempoTotalSegundos`.

## G. Armadilhas conhecidas (já custaram tempo)

- **`node:sqlite` é síncrono e diferente de `better-sqlite3`:** `db.prepare(sql).get/all/run`, sem `.transaction()`; use `db.exec('BEGIN')` … `COMMIT`/`ROLLBACK`. `lastInsertRowid` pode ser número ou BigInt: `Number()` ao devolver em JSON.
- **`npm run seed` apaga tudo.**
- **Nomes de categoria:** o front mostra `curto`/emoji mas envia `nome`. Mudou um vocabulário? Altere `vocabularios.js`, o `CHECK` do `schema.sql`, `seed.js` e `frontend/js/api.js` **juntos**.
- **Testes:** o servidor de teste roda em outro processo; se o teste abrir o banco direto, defina `process.env.CAMINHO_BANCO_TESTE` **no processo do teste também**. Há estado compartilhado dentro de cada arquivo (rodam em ordem; o de encerrar ciclo é o último de `teste-admin.js`). Como só há **uma sessão aberta por turma**, cada teste usa a sua turma (1 a 4) ou encerra a sessão antes de abrir outra. Portas/bancos distintos por arquivo (3099, 3098, 3097, 3096).
- **`node --check` não valida `<script>` inline** dos HTMLs. Use `testes/e2e-navegador.js` (navegador real) ou extraia o script.
- **Testes de navegador têm corridas clássicas:** o DOM é redesenhado depois de cada toque; espere o **efeito** (contagem de cartões, texto novo do aviso), não só "algum aviso" ou "a janela fechou". Evite clicar numa aba que recarrega a tabela no meio do clique.
- **Ao encerrar servidores,** use padrão ancorado (`pkill -f '^node backend/server.js'`); um padrão solto pode casar com o próprio shell. Se cada chamada de shell for isolada, inicie o servidor e faça as requisições **no mesmo comando**.
- **Datas:** `dataLocalISO()` no front (`toISOString()` usa UTC e vira o dia à noite no Brasil). `auditoria.criado_em` é UTC.
- **Estado do front** em `sessionStorage` (`turmaAtual`, `resumoConclusao`). A sessão de registro só é criada no **primeiro toque**.
- `exigirLogin` **reconsulta o banco a cada requisição** (é o que faz "desativar" e "quem exporta" valerem na hora). Não troque por cache.
- O aviso (toast) deve ter `pointer-events: none` e sumir ao abrir uma folha, senão cobre botões.

## H. Seed (depois de `npm run seed`)

Usuários: 1 Marli (coordenadora, exporta), 2 Educadora Voluntária (não exporta), 3 Administrador do Instituto (PIN provisório). 2 turmas × 30 crianças sintéticas; 3 ciclos (2 fechados, o atual com datas relativas a hoje). Casos propositais: Turma B/2025-2 com 3 registros (amostra insuficiente); Turma B **sem** sessões no ciclo atual (estado "sem dados" + alerta na Administração); Turma A com 6 dos últimos 8 sábados, com **ausências** em todos; uma sessão com pausa.

## I. Como alterar com segurança

1. `npm test` **antes** (linha de base) e **depois**. Mudança de tela: rode também `node testes/e2e-navegador.js` e **olhe** as capturas (`CAPTURAS=…`).
2. Mudança de comportamento exige teste novo; mudança de rota protegida exige teste de 401/403.
3. Mudou o esquema? Altere `schema.sql`, `seed.js`, `verificarVersao.js` e `docs/modelo-de-dados.md` juntos.
4. Mudou uma decisão relevante? Registre em `docs/decisoes-tecnicas.md`.
5. Comente em português, como o restante do código.

## J. O que está pronto × o que NÃO está

**Pronto e testado:** registro numa tela (cartões, folha, ausência, alterar/limpar, filtro de pendentes, encerrar sem registrar todo mundo), uma sessão aberta por turma, tempo ativo, painel (3 estados, cobertura de quem veio, percurso, estados observados, evolução com amplitude), exportação por permissão, Administração (KPIs, cobertura por sessão, pessoas e "quem exporta", turmas, encerrar ciclo, backup, auditoria), PIN com bloqueio. Verificado em Chromium real (44 checagens) e 28 testes de API. Vídeo demonstrativo gravado em dois takes (celular e administração).

**Não feito / não verificado:**
- **Ritmo de registro de uma pessoa real** nesta tela (o fluxo mudou em relação ao protótipo validado no Figma): falta teste de usabilidade cronometrado.
- Aparência em celulares e navegadores diferentes do Chromium usado nos testes.
- HTTPS, sessões persistentes, múltiplos processos.
- Cadastrar/remover turmas e crianças; associação educadora↔turma (depende de validação LGPD).
- "Dupla medição" (comparar duas medições da mesma turma com ~6 semanas de intervalo, risco H2 do pitch): o painel compara **ciclos**, não duas medições dentro de um ciclo.
- Vários programas (o slide 11 fala em expansão para mais 3): o modelo atual é de um programa só.

## K. Definição de "pronto" para qualquer alteração

`npm test` com todos os testes passando · nenhuma regra da seção D violada · teste de navegador passando e interface **vista** · documentação afetada atualizada · relatório final dizendo claramente o que foi executado e o que não foi verificado.
