# Prompt para Cursor / Claude — Protótipo Figma "Registro do Laboratório de Sonhos"

> Copie tudo abaixo e cole na conversa do Cursor/Claude já conectado ao seu arquivo Figma. Responda sempre em português.

---

## PAPEL

Você é um Product Designer sênior, especialista em UX para usuários não-técnicos em contexto operacional (uso em pé, no celular, sob pressão de tempo). Vai desenhar, no Figma, um protótipo navegável de **fidelidade alta** para o projeto abaixo, a partir de personas, jornadas e User Stories já validadas em um módulo de negócios. Não invente escopo novo: tudo que você desenhar precisa mapear para uma User Story ou uma tela do inventário abaixo. Onde este prompt marcar algo como "decisão assumida", trate como ponto de partida — pergunte antes de mudar, não mude silenciosamente.

## CONTEXTO DO PROJETO

Organização: **Instituto Ebenézer**, ONG que atende crianças e adolescentes. Programa: **Laboratório de Sonhos**, oficina de sábado com **60 crianças, em 2 turmas de ~30 cada** (o número "10 crianças" que aparece mais adiante é só o roteiro do teste de validação — a lista real de uma turma tem ~30).

Problema de negócio: a evolução socioemocional das crianças não tem instrumento nem série histórica. A coordenação sabe que algo muda nas crianças, mas não consegue provar — e o relatório anual para financiadores descreve isso com adjetivo, não com número.

Solução: um **indicador de programa leve** — não um prontuário clínico — que a coordenadora/educadora preenche em bloco, em pé, em menos de 2 minutos, ao fim da oficina. O sistema registra por criança, mas só exibe leitura agregada por turma (nunca visão individual).

Restrição de ritmo que deve guiar toda decisão de UI: **10 crianças em <2 minutos = ~12 segundos por criança**, incluindo o tempo de leitura do nome e o toque. Isso significa, no máximo, **2 toques por criança até salvar e avançar automaticamente** (ex.: tocar na categoria → toque em sim/não do percurso → avança sozinho). Qualquer tela que exija confirmação extra, rolagem para achar uma opção, ou digitação, está fora do orçamento de tempo e deve ser redesenhada.

Regras inegociáveis de desenho (vieram do bloco ético do artefato de negócios — **não podem ser quebradas em nenhuma tela**):
1. **Dados sintéticos sempre** — nenhum nome real, nenhuma foto real de criança.
2. **Nenhuma visão individual no painel** — o registro é por criança, a leitura é sempre agregada por turma.
3. **Nenhum campo de texto livre sobre comportamento** — todo campo é categórico/fechado (texto livre viraria registro clínico).
4. **Nenhuma foto de criança**, em nenhuma tela.
5. Nenhuma tela pede ação da **psicóloga** (tempo dela é clínico) nem da **criança** (todo o público é menor de idade — nenhum fluxo depende de ação dela).

## PERSONAS E PAPÉIS DE ACESSO

**Primária — Marli, 47 anos, coordenadora pedagógica.** Pedagoga, coordena o Laboratório de Sonhos há 6 anos, conduz duas turmas de sábado (12h–16h). Resolve tudo pelo celular; anota em papel durante a oficina e transcreve depois, quando lembra; recusa ferramenta que exija treinamento. Vai usar a solução **em pé, no fim da oficina, com crianças ainda na sala** — se o registro competir com a atenção à criança, a criança ganha. Necessidade central: registrar sem interromper, sem sentar, sem abrir computador. Frase-chave: ela sente que a criança mudou, mas não consegue provar.

**Secundária — educadora voluntária.** Registra quando a Marli não está, usa o mesmo fluxo de registro (Telas 01–06), **sem acesso à exportação (Tela 08)**.

**Não-usuários — não devem ter nenhuma tela ou ação própria no protótipo:**
- **Psicóloga** — tempo clínico, sigiloso, nenhuma tela pede ação dela.
- **A criança** — nenhum acesso ao sistema.
- **Diretoria** — não opera o sistema diretamente.

### Correção de um conflito do material de origem (leia antes de desenhar a Tela 08)
A User Story 5 diz *"como diretoria, quero exportar"*, mas a diretoria está listada como não-usuária que só recebe o resultado pronto. **Decisão assumida para resolver isso:** quem aciona o botão "Exportar" na Tela 08 é a **coordenadora (Marli)**, exportando a página do ciclo *para* a diretoria/financiador. A diretoria nunca abre o sistema — ela só recebe o PDF/link gerado por fora do produto. Portanto:
- Login simples com dois papéis: **Coordenadora** (acesso total, inclui Tela 08) e **Educadora voluntária** (acesso só a Telas 01–06, sem botão de exportar visível).
- Adicione uma **Tela 00 — Login/seleção de perfil** antes da Tela 01, só com essa escolha de papel (sem senha complexa — um toque no nome/perfil já basta, coerente com "sem período de aprendizado").

## JORNADA — ANTES x DEPOIS

**Hoje (dor):** presença é conferida em papel → oficina acontece e a observação existe só na memória da Marli → fim da oficina, não há tempo nem lugar para registrar → semana seguinte, outra profissional começa do zero → fim do ano, relatório é escrito com adjetivo, sem número.

**Com a solução:** Marli abre a turma e vê o resumo do último encontro → conduz a oficina normalmente, sem nenhuma mudança → **no fim da oficina, registra a turma inteira em bloco, em menos de 2 minutos** → na semana seguinte, a colega abre a mesma turma e vê o agregado → no fim do ciclo, a página é exportada com número, não só adjetivo.

O ganho de UX que precisa ficar evidente no protótipo: **velocidade e ausência de fricção no momento de registrar**, não recursos ou telas bonitas.

## USER STORIES A REPRESENTAR (as 5, nenhuma pode ficar sem tela correspondente)

**US1 — Registrar aspiração declarada.** Como coordenadora, quero registrar a aspiração declarada de cada criança ao fim do sábado, para não depender da minha memória.
*Critério de aceite:* dado que estou na lista de uma turma com a oficina encerrada, quando seleciono uma criança e escolho uma categoria de aspiração, então o registro é salvo e a lista avança automaticamente para a próxima criança pendente.

**US2 — Registrar exposição do dia.** Como coordenadora, quero registrar a que profissional ou atividade a turma foi exposta, para relacionar exposição e mudança.
*Critério de aceite:* dado que estou fechando o registro de uma sessão, quando informo o profissional/atividade, então a exposição é gravada **uma única vez para a turma inteira**, não por criança.

**US3 — Ver indicador agregado.** Como coordenadora, quero ver o indicador agregado da turma, para levar evidência ao relatório sem expor nenhuma criança.
*Critério de aceite:* dado que abro o painel de uma turma, quando a turma tem menos de 5 registros no período, então o painel exibe **aviso de amostra insuficiente** e nenhum percentual.

**US4 — Registrar ausência de aspiração declarada.** Como coordenadora, quero registrar que a criança ainda não declarou aspiração, para que a ausência seja dado, não lacuna.
*Critério de aceite:* dado que uma criança não declarou o que quer ser, quando seleciono "ainda não declarou", então isso conta como **registro completo** e entra na cobertura da sessão — **e a pergunta de percurso (Tela 04) é pulada**, porque não há passo de formação a confirmar sem uma aspiração declarada.

**US5 — Exportar página do ciclo.** Como coordenadora, quero exportar a página do ciclo para a diretoria/financiador, para viabilizar a prestação de contas.
*Critério de aceite:* dado que o ciclo anual está encerrado, quando a coordenadora solicita a exportação, então o sistema gera uma página com **dados agregados por turma e nenhum nome de criança**.

Nota INVEST: as 5 histórias são independentes e testáveis isoladamente; US1 sozinha já produz série histórica; US3 só depende de US1 já ter rodado (dependência de dado, não de tela).

## CONTEÚDO FECHADO (use exatamente estas opções — não invente outras)

**Categorias de aspiração (Tela 03, vocabulário fechado, decisão assumida — ajuste se o Instituto já tiver uma lista oficial):**
Professor(a) · Profissional de saúde (médico/enfermeiro) · Policial/Bombeiro(a) · Esporte profissional · Artista/Música · Tecnologia · Empreendedor(a)/Comércio · Outra área de serviço público · Ainda não declarou

**Percurso — passo de formação (Tela 04, resposta binária, decisão assumida):**
Pergunta: *"A criança conseguiu nomear um passo necessário para chegar lá (ex.: estudar, treinar, um curso)?"* → Sim / Não.

**Exposição do dia (Tela 05, escolha única por sessão, decisão assumida):**
Lista curta e fechada dos profissionais/atividades que normalmente conduzem a oficina (ex.: Educador(a) responsável · Oficina externa convidada · Atividade em dupla de educadores) — confirme os nomes reais com o Instituto antes de finalizar o texto desta tela.

## INVENTÁRIO DE TELAS (construa exatamente estas 9, nesta função)

| # | Tela | Função | Restrição de desenho |
|---|------|--------|----------------------|
| 00 | Login/perfil | Escolher papel: coordenadora ou educadora voluntária | Um toque, sem senha complexa |
| 01 | Entrada | Seleção de turma e data | Sem cadastro individual de criança |
| 02 | Lista da turma | Chamada + status de registro | Mostra visualmente quem falta registrar; permite reabrir um registro já feito para corrigir |
| 03 | Aspiração | Categoria declarada pela criança | Vocabulário fechado (chips/botões, lista acima), sem campo de texto livre |
| 04 | Percurso | Passo de formação nomeado (ver pergunta acima) | Resposta binária: sim ou não; pulada se a criança ainda não declarou aspiração (US4) |
| 05 | Exposição | Profissional ou atividade do dia | Preenchido **uma vez por sessão**, não por criança |
| 06 | Confirmação | Resumo do que foi registrado | Exibe o tempo que o registro levou (reforço positivo de velocidade) |
| 07 | Painel | Indicadores agregados da turma | Nenhuma linha individual, em nenhum perfil de usuário; só visível a partir do login de coordenadora |
| 08 | Exportação | Página do ciclo para o relatório | Só dado agregado, sem nome de criança; botão só aparece para o papel Coordenadora, nunca para Educadora voluntária |

### Fluxo de navegação (implemente exatamente esta lógica)

1. **Login (Tela 00):** usuária escolhe o papel. Isso define, a partir daqui, se o botão de exportar (Tela 08) aparece ou não.
2. **Início:** abre a turma do sábado → app lista as ~30 crianças daquela turma, com data já preenchida (Tela 01 → Tela 02).
3. **Loop por criança (a partir da Tela 02):**
   - Toca em uma criança pendente → pergunta se ela declarou aspiração.
   - **Não** → marca "ainda não declarou" (US4) → registro salvo → **pula direto a Tela 04** → volta para a Tela 02 já avançada para a próxima criança pendente.
   - **Sim** → Tela 03 (categoria) → Tela 04 (percurso, sim/não) → registro salvo → volta para a Tela 02, avançada para a próxima criança pendente.
   - Cada criança já registrada pode ser **reaberta a partir da Tela 02** para correção (ex.: toque longo ou ícone de editar ao lado do nome) — sem isso, um erro de toque não tem conserto dentro do fluxo.
4. **Sessão interrompida:** se a usuária sair no meio (ex.: chamada por uma criança), o progresso já salvo por criança **permanece salvo individualmente** — ao reabrir a mesma turma/data, a Tela 02 mostra exatamente quem já foi registrado e retoma dali. Não existe estado "perder tudo e recomeçar".
5. **Ao fim da lista** (todas as crianças com status "registrado"): sistema pede a exposição do dia, uma vez só (Tela 05).
6. **Fim do registro do dia:** Tela 06 de confirmação mostra o tempo total gasto → painel agregado (Tela 07) atualiza. Nenhuma tela em nenhum momento mostra o histórico de uma criança específica.
7. **Exportação (Tela 08):** acessada a partir de um ponto de navegação global (ex.: menu/aba fixa "Painel e exportação", visível só para o papel Coordenadora) — não faz parte do fluxo semanal de sábado, é usada no fim do ciclo.

Estados adicionais a desenhar: turma sem crianças pendentes ("tudo registrado, só falta a exposição" ou "sessão concluída"), painel com amostra insuficiente (US3), confirmação de registro salvo, e o estado de retomada de sessão interrompida (passo 4 acima).

## SISTEMA VISUAL / MARCA (Instituto Ebenézer / Inteli)

Cores extraídas da documentação oficial da marca:
- **Roxo escuro (primária):** `#2E2640` — fundos escuros, títulos, elementos de destaque
- **Verde-petróleo (secundária/ação):** `#066D73` — botões primários, estados ativos, indicadores positivos
- **Vermelho de alerta:** `#FF4545` — usar **só** para alertas reais (ex.: amostra insuficiente), nunca decorativo
- **Neutros:** `#E6EAEB` e `#CACED6` — fundos claros, divisores, estados desabilitados
- **Branco:** `#FFFFFF`
- Logo Inteli: versão roxa em fundo claro, versão branca em fundo escuro; nunca preto e branco puro, nunca monocromática fora de restrição real de impressão.
- **Tipografia:** não há fonte de marca definida neste material — use **Inter** como decisão assumida (boa legibilidade em telas pequenas, gratuita, comum em produtos com essa identidade). Confirme com o time de marketing do Instituto se existe fonte oficial antes de finalizar.

Diretrizes de UI (derivadas da persona e do orçamento de tempo, não são "gosto"):
- **Mobile-first**, viewport de referência 375×812px (tamanho comum de celular), otimizado para uso **em pé, com uma mão**.
- Alvos de toque grandes (mín. 44×44px), pouco texto por tela, sem necessidade de digitar em nenhuma tela do fluxo de registro (Telas 00–06) — tudo é seleção/toque.
- Máximo 2 toques por criança até avançar automaticamente (ver orçamento de tempo no início do documento).
- Sem período de aprendizado: nenhuma tela deve exigir tutorial ou ícone ambíguo sem rótulo escrito.
- Feedback de progresso sempre visível (ex.: "18 de 30 crianças registradas") para dar sensação de avanço rápido.
- Nunca exibir nome completo de criança nem foto — use nomes sintéticos curtos (ex.: primeiro nome fictício) e evite qualquer elemento fotográfico.
- Painel (Tela 07) e Exportação (Tela 08) podem assumir layout mais denso/desktop-friendly já que são consultados fora do momento de pressa em pé — as demais telas (00–06) devem seguir mobile estrito.

## O QUE VOCÊ DEVE ENTREGAR NO FIGMA

1. Um frame por tela do inventário (9 telas principais) + os estados adicionais listados na seção de fluxo (reaberto/edição, sessão retomada, tudo registrado, amostra insuficiente).
2. Protótipo **navegável/clicável** ligando as telas exatamente na lógica de fluxo descrita acima, incluindo os dois papéis de login (teste o caminho da educadora voluntária e confirme que a Tela 08 não é alcançável por esse papel).
3. Um pequeno design system (cores, tipografia Inter, componentes reutilizáveis de botão/chip/card/barra de progresso) — organizado em componentes de Figma (não cópias soltas), o suficiente para o protótipo parecer um produto único.
4. Organize o arquivo em páginas do Figma: uma página **"Protótipo"** (os frames navegáveis, usando Auto Layout) e uma página **"Documentação de suporte"**.
5. Nomeie os frames exatamente como no inventário (ex.: "00 Login", "01 Entrada", "02 Lista da turma"...).
6. Na página "Documentação de suporte", inclua: persona (primária e secundária), jornada atual x futura, as 5 User Stories, o fluxo de navegação, e um bloco de **ficha de validação com usuário real com os campos em branco marcados como `[A PREENCHER]`** — quem validou, como foi feito, o que foi medido, principais aprendizados. Não invente nomes, datas ou resultados nesses campos; essa parte é preenchida por mim depois de rodar o teste com uma pessoa real.

## RESTRIÇÕES FINAIS (não negociáveis)

- Não crie nenhuma tela, campo ou fluxo fora do que está listado acima (ex.: sem chat, sem foto, sem texto livre, sem perfil da criança, sem tela para a psicóloga, sem acesso da diretoria ao sistema).
- Não invente User Story nova — atenha-se às 5 listadas.
- Não preencha a ficha de validação com dados fictícios — deixe os campos marcados como pendentes.
- Priorize velocidade de uso sobre estética — qualquer decisão visual que aumente o número de toques ou o tempo de registro está errada, mesmo que "bonita".
- Onde este prompt fez uma "decisão assumida" (categorias de aspiração, texto da exposição, fonte, papéis de login), sinalize isso de volta para mim ao final, em vez de tratar como definitivo.
