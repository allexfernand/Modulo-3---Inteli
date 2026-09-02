# Validação com usuário real — Laboratório de Sonhos

Ficha de campo. Imprima ou deixe aberta no celular durante a sessão.
As anotações daqui preenchem, campo a campo, a seção 5 da documentação no Figma.

---

## Antes de começar

**App:** https://laboratorio-sonhos.vercel.app

**Use a Turma B.** A Turma A já está com as 10 crianças registradas hoje, então
ela cairia direto na tela de "tudo registrado" e não daria para cronometrar.

**Não ajude.** Nem com o olhar. Se a pessoa travar, conte quantos segundos ela
fica parada e só intervenha se ela pedir — e anote que pediu.

**Papel a escolher no login:** Coordenadora (dá acesso ao painel, que é a tarefa 2).

Se precisar refazer o teste com outra pessoa no mesmo dia, o banco precisa ser
limpo antes, porque os registros são gravados por turma e por data:

```bash
cd Code/laboratorio-sonhos
RESEED=1 npx prisma db seed   # exige DATABASE_URL de produção no ambiente
```

---

## Roteiro — 3 tarefas

### Tarefa 1 · Registrar a turma inteira (cronometrada)

> "Chegou o sábado e você vai conduzir a oficina. Registre a Turma B inteira:
> as 10 crianças e a exposição do dia."

Dispare o cronômetro quando ela tocar em "Coordenadora" na tela de login.
Pare quando aparecer a tela de confirmação.

**Critério de sucesso definido no protocolo:** abaixo de 2 minutos, sem dúvida
sobre o significado das categorias.

### Tarefa 2 · Encontrar o dado no painel

> "Quantas crianças dessa turma ainda não declararam uma aspiração?"

O que se testa aqui é se ela acha o painel sozinha, não se ela lê o número.

### Tarefa 3 · Corrigir um registro

> "Uma criança mudou de ideia depois que você registrou. Corrija o registro dela."

---

## Anotações durante a sessão

### Quem validou

| | |
|---|---|
| Nome | |
| Função na organização | |
| Há quanto tempo atua no Laboratório de Sonhos | |

### Como foi feito

| | |
|---|---|
| Data | |
| Duração total da sessão | |
| Presencial ou remoto | |
| O que foi usado | App publicado (versão de 02/09) |
| Dispositivo | celular próprio / celular emprestado / notebook |

### O que foi medido

| | |
|---|---|
| Tempo da tarefa 1 (10 crianças + exposição) | |
| Hesitações acima de 3 segundos | |
| Vezes que pediu ajuda | |
| Tarefas concluídas sem ajuda | ___ de 3 |

Onde cada hesitação aconteceu (tela e o que ela estava tentando fazer):

-
-
-

### Frases literais

Anote com as palavras dela, não resumidas. São o que dá credibilidade à ficha.

-
-
-

---

## Perguntas ao final

1. Teve alguma categoria de aspiração que você não soube onde encaixar?
2. Faltou alguma coisa que você registra hoje no papel?
3. Você usaria isso no sábado que vem? Se não, o que impediria?
4. O que te deixou insegura em algum momento?

### Principais aprendizados

O que travou:

O que muda no protótipo por causa deste teste:

O que fica para a semana 10:

---

## Anexo — telas do Figma e as rotas equivalentes no app

Para quem quiser conferir a paridade entre protótipo e aplicação.
Login como Coordenadora é necessário para as duas últimas.

| Tela no Figma | Rota no app |
|---|---|
| 00 Login | `/login` |
| 01 Entrada | `/inicio` |
| 02 Lista da turma | `/turma/turma-b` |
| 02b Lista · tudo registrado | `/turma/turma-a` |
| 03 Aspiração | `/turma/turma-b/crianca/turma-b-c1` |
| 04 Percurso | `/turma/turma-b/crianca/turma-b-c1/percurso?aspiration=Tecnologia` |
| 05 Exposição | `/turma/turma-a/exposicao` |
| 06 Confirmação | `/turma/turma-a/confirmacao` |
| 07 Painel | `/turma/turma-a/painel` |
| 07b Painel · amostra insuficiente | `/turma/turma-b/painel` (enquanto a turma tiver menos de 5 registros) |
| 08 Exportação | `/turma/turma-a/exportar` |

A tela 04 só existe para crianças que declararam uma aspiração — é isso que a
US4 descreve, quando a resposta é "ainda não declarou" o fluxo pula essa etapa.
Por isso o link acima carrega a aspiração na URL. Sem ela, o app manda de volta
para a tela 03.
