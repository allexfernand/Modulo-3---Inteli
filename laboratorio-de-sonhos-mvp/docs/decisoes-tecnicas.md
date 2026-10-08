# Decisões Técnicas — Registro do Laboratório de Sonhos

## Versão do Node e `node:sqlite`

Testado e validado em **Node v22.22.2**, rodando `node:sqlite` sem a flag `--experimental-sqlite` (o módulo já funciona nessa versão, emitindo apenas um `ExperimentalWarning` — isso é esperado, não é erro). Antes de rodar em outra máquina, confirme `node -v`; se a versão for muito mais antiga, pode ser necessário atualizar o Node ou adicionar a flag.

## Hospedagem: Vercel pago, serviço no ar

O Pitch Executivo original previa Opex R$0/mês num tier gratuito de nuvem. A pesquisa confirmou o problema: Render, Railway e Fly.io, no gratuito, ou não oferecem mais um tier real, ou apagam o arquivo do banco quando a instância dorme. Um sábado registrado some antes do seguinte.

**Decisão: pagar a Vercel, US$ 20/mês, para o serviço permanecer no ar.** O que foi registrado fica num Postgres (Neon) ligado ao projeto, e não num arquivo dentro da função. Reiniciar o serviço não apaga o sábado anterior. Os dois backends publicados:

- Vercel, plano pago: https://laboratorio-sonhos.vercel.app. Esta é a operação. O plano de US$ 20/mês é o que mantém o serviço de pé.
- Render, plano gratuito: https://laboratorio-de-sonhos-mvp.onrender.com. É o backend Express deste repositório, útil para avaliar o fluxo. Esse plano dorme em cerca de 15 minutos e, ao acordar, recria o SQLite a partir do seed. Não é onde o registro do sábado fica.

Rodar num computador do Instituto continua possível (Parte 1 do README) e custa R$0, para a rede do sábado. Deixou de ser a hospedagem escolhida, porque o acesso fora dessa rede e a continuidade entre sábados dependem do serviço pago.

O `npm run start:nuvem` existe para o Render: `backend/db/prepararSeNecessario.js` semeia o banco só quando ele está vazio, senão o processo encerra na verificação de versão e o contêiner reinicia em ciclo. O `render.yaml`, na raiz do repositório, descreve esse serviço.

## Sessão e controle de papel

Login é só escolha de papel (Coordenadora / Educadora voluntária), sem senha — coerente com a persona, que "recusa ferramenta que exija treinamento". Mas o papel escolhido é gravado numa **sessão de servidor** (`express-session`, cookie assinado), e toda rota sensível (`/api/ciclos/:id/exportacao`, `/api/admin/overview`) usa o middleware `exigirPapel()` para checar isso no servidor — nunca confia em um parâmetro que o próprio navegador poderia enviar. Testado: sem sessão retorna 401; com papel errado retorna 403.

## Tempo de registro: "tempo ativo" (substitui o desconto de pausas)

O requisito central é o ritmo por criança. Para a pessoa **não ficar presa** à tela, ela pode sair e voltar, travar o celular ou encerrar mais tarde, e isso não pode inflar a métrica. O servidor calcula o **tempo ativo**: soma dos intervalos entre o início, cada toque (registro, alteração, ausência) e o encerramento, **limitando cada intervalo a 120 s**. Testado com uma sessão de 40 minutos parada no meio: conta ~140 s, não 2.400 s. As rotas de pausar/retomar continuam (idempotentes e informativas), mas a tela não depende delas.

## Campo "Estado observado" em vez de texto livre

O professor pediu um campo aberto sobre como a criança se sentiu durante a atividade. Isso entraria em conflito direto com a Regra 3 do projeto (nenhum texto livre sobre comportamento/emoção da criança — isso transformaria o produto num registro clínico, fora do escopo e da base legal pretendida). **Decisão: implementar como campo categórico fechado** (`Animada(o)` · `Concentrada(o)` · `Quieta(o)` · `Frustrada(o)` · `Não observado`), coletado por criança e **agregado tanto no Painel quanto na Exportação** — para que o pedido do professor de "aumentar a entrega de valor" seja atendido de verdade (o dado aparece em algum lugar), sem abrir a porta que a Regra 3 existe para fechar.

## Edição de registro travada por ciclo fechado

A Tela 02d permite corrigir um registro feito por engano. Mas se isso fosse permitido para qualquer registro, de qualquer ciclo, a série histórica que alimenta o Painel e a Exportação (o argumento central do produto: "prova de mudança ao longo do tempo") perderia integridade — dados de um relatório já entregue a um financiador poderiam mudar depois. Por isso, `PUT /api/registros/:id` verifica se o ciclo do registro já tem `data_fim` preenchida, e bloqueia com 403 nesse caso. Testado.

## Por que vocabulários fechados estão no banco, não só no front-end

Os `CHECK constraints` do `schema.sql` garantem que mesmo uma chamada direta à API (sem passar pela interface) não consegue gravar uma categoria fora da lista fechada — reforça a Regra 3 (nenhum texto livre) na camada mais baixa possível, não só na tela.

## Revisão de UX alinhada ao pitch (3 telas, "um toque por criança")

O slide 5 do pitch promete **3 telas** (Perfil, Turma, Registro) e "um toque por criança, salva sozinho". A versão anterior tinha ~14 telas e 2+ toques por criança (categoria + percurso), numa sequência da qual a pessoa não saía até registrar todo mundo. Mudanças:
- **Registro numa tela só:** cartões de criança (inicial colorida, nunca foto), folha deslizante com ícones grandes; tocar na categoria **já salva** e fecha. Caminho principal = 2 toques, sem trocar de página. Alterar = tocar no cartão de novo.
- **A pessoa não fica presa:** "Não veio hoje" por criança; ao encerrar, escolhe-se o que fazer com as pendentes (marcar ausentes, em lote, ou deixar sem registro). Encerrar é possível a qualquer momento com ≥ 1 registro e a exposição do dia. A escolha sobre as pendentes **não vem pré-selecionada** porque é irreversível e altera os indicadores.
- **Uma sessão aberta por turma**, criada só no **primeiro toque** (abrir a tela sem registrar não deixa sessão vazia). Sessão esquecida de outro dia aparece com aviso e pode ser continuada ou encerrada.
- **Percurso e "como estava" são opcionais.** Antes o percurso era um toque obrigatório cujo dado não aparecia em nenhum indicador. Agora fica na folha de alteração e aparece no Painel ("% citaram um passo"); "como estava" aparece no Painel só a partir de 5 observações, e "Não observado" não entra nas barras.
- **Cobertura** passou a ser registradas ÷ **presentes** (ausente não entra na conta).
- Mudou o que foi validado com usuário real no Figma (14 telas). **O novo fluxo ainda não foi cronometrado com uma pessoa**; o teste de usabilidade precisa ser refeito antes de afirmar o ritmo.

## Defeitos encontrados na própria entrega anterior e corrigidos

Ao confrontar o código com o pitch e abrir o app num navegador de verdade:
1. A tela enviava "Profissional de saúde (médico/enfermeiro)", texto que o banco **rejeitava** (e o erro mostrado, "já tem um registro", era enganoso). Os testes não pegaram porque só usavam "Tecnologia". Agora o servidor valida os vocabulários (`backend/vocabularios.js`) com mensagem correta, há teste das 9 categorias e a tela exibe nomes curtos mas envia o valor oficial.
2. **Nenhuma tela enviava "Estado observado"** (o campo criado para atender o professor): o dado existia no banco e no painel, mas era sempre "Não observado". Agora há uma linha opcional na folha de registro.
3. O "percurso" era coletado sem aparecer em indicador algum (ver acima).
4. O aviso de confirmação (toast) podia cobrir botões da folha seguinte em uso rápido; agora some ao abrir a folha e nunca intercepta toques.

## Administração: alinhamento ao slide 11

O slide lista: turmas e educadores cadastrados; cobertura de registro **por sessão (%)**; tempo médio de preenchimento; exportação da página do ciclo; gestão de permissões (**quem exporta**). Implementado: tabela de cobertura **por sessão** (antes só havia média por turma); permissão de exportar **por pessoa** (antes era fixa por papel); lista de turmas cadastradas (somente leitura). Divergência assumida: o slide diz "Dono: a coordenação pedagógica", e a decisão do time foi um papel Administrador separado (domínio do Instituto). Os slides precisam ser ajustados, ou a coordenadora pode ter também uma conta de administrador.

## Papel Administrador separado (domínio do Instituto)

Decisão do time: o administrador é um papel **separado** de Coordenadora, porque a Administração serve ao Instituto como organização (governança, continuidade), não à rotina de registro de sábado. Isso evita concentrar tudo na Marli (risco H5 do Pitch: "ninguém opera depois da semana 10"). Consequências implementadas e testadas:
- O administrador **governa, não registra**: `POST /api/sessoes` e `POST /api/registros` retornam 403 para ele. Ele pode **ver** Painel e Exportação (dado agregado).
- Toda rota `/api/admin/*` usa `exigirPapel('administrador')`, aplicado no servidor.

## PIN do administrador

Coordenadora/Educadora continuam entrando com um toque (coerente com a persona). Administrador exige **PIN numérico de 4 a 8 dígitos**, guardado com `scrypt` + salt (nunca em texto), com **bloqueio de 5 minutos após 5 erros**. O PIN criado pelo seed é provisório (`1234`) e a tela alerta até ser trocado; trocar o próprio PIN exige o PIN atual; redefinir o PIN de outro administrador o deixa provisório para ele. Limite honesto: sem HTTPS na rede local, o PIN trafega sem criptografia — mitigado pelo bloqueio por tentativas e por usar rede confiável.

## Correção de segurança feita nesta rodada: rotas de escrita sem login

Na versão anterior, `POST /api/registros` e `POST /api/sessoes` não verificavam sessão — qualquer pessoa na rede conseguia gravar dados. Agora **todo** `/api/*` (exceto `/api/auth`) passa por `exigirLogin`, e cada grupo de rotas confere o papel. Testado (401 sem login, 403 com papel errado).

## Desativar vale na hora

`exigirLogin` reconsulta o banco a cada requisição (usuário ativo? qual papel?). Assim, desativar uma pessoa ou mudar o papel dela tem efeito imediato — não espera a sessão de 8h expirar. Pessoas são desativadas, nunca excluídas, para o histórico de sessões continuar íntegro.

## Encerrar ciclo

Uma única operação em transação: fecha o ciclo atual (`data_fim = hoje`) e abre o próximo (`data_inicio = amanhã`), então nunca há um instante sem "ciclo atual". Exige confirmação explícita e **bloqueia se houver sessão em andamento/pausada**. Efeito: registros do ciclo encerrado ficam travados para edição. A Exportação ganhou seletor de ciclo justamente para que a versão final do ciclo encerrado continue acessível depois que o "atual" passa a ser o novo (vazio).

## Backup

Na instalação local, o risco é o disco falhar. `VACUUM INTO` gera uma cópia **consistente** mesmo com o servidor em uso. Há backup automático diário (14 mais recentes) e botão manual. O "último backup" exibido vem dos **arquivos da pasta** (não da auditoria), para continuar correto mesmo se o banco for recriado — inconsistência encontrada na verificação das telas e corrigida. Recomenda-se uma cópia fora da máquina.

## Auditoria

Tabela `auditoria` registra login/falha/bloqueio de administrador, pessoas criadas/alteradas, troca de PIN, encerramento de ciclo, backups e exportações. Nunca grava nome de criança (Regra 2/1 preservadas). Também alimenta o KPI "exportações" (contado no clique de "Baixar PDF", não ao apenas ver a página).

## KPIs da Administração e o risco que cada um monitora

Tempo médio por criança e % de sessões acima de 12s → **H1**; regularidade (sábados registrados ÷ esperados), dias desde o último registro e cobertura → **H5**; exportações → **H4**; amplitude de categorias por ciclo → **H2/H4**; % "Ainda não declarou" → sinal de dúvida na tela (achado do teste de usabilidade). Os alertas disparam com: turma sem registro há mais de 8 dias, ritmo médio acima da meta, backup ausente ou com mais de 7 dias, PIN provisório.

## Segredo da sessão

Antes estava fixo no código. Agora vem de `SEGREDO_SESSAO` ou é gerado aleatoriamente a cada inicialização (sessões em memória já se perdem ao reiniciar, então não há custo). Cookie `httpOnly` e `sameSite=lax`.

## Extensão de governança (User Stories 6–8)

A Administração vai além das 5 User Stories originais, porque o Pitch Executivo já se comprometeu com uma tela de admin (mitigação do risco H5). Registrada como extensão, não escondida no código:
- **US6** — Como administradora, quero acompanhar KPIs e alertas de operação, para saber se o registro está acontecendo sem depender de uma pessoa específica.
- **US7** — Como administradora, quero cadastrar, mudar papel e desativar pessoas, para controlar quem acessa.
- **US8** — Como administradora, quero encerrar o ciclo e gerar backup, para preservar a série histórica e a continuidade.

## O que não foi implementado neste MVP (e por quê)

- **Gestão de lista de crianças (adicionar/remover) e associação educadora↔turma:** fora do escopo das 5 User Stories; na Administração é a próxima evolução natural, mas exige validação LGPD com a psicóloga (H3) antes de lidar com dado de criança fora do seed.
- **HTTPS, múltiplos servidores, sessão persistente:** fora do porte do piloto; ver "Limitações conhecidas" no README.
