// Recria o banco do zero com dados SINTÉTICOS. Rodar com: npm run seed
// ATENÇÃO: apaga tudo e recria as tabelas (inclusive se o banco for de uma versão anterior).
// Inclui de propósito:
//  - Turma B / Ciclo 2025-2 com só 3 registros   -> testa "amostra insuficiente" (US3)
//  - Turma B / Ciclo atual sem nenhuma sessão     -> testa "sem dados ainda" e o alerta da Administração
//  - Uma sessão da Turma A com pausa de 10 min    -> tempo registrado já descontado da pausa
//  - Sábados com crianças ausentes                -> a cobertura é calculada só sobre quem estava presente
//  - Turma A com 6 dos últimos 8 sábados          -> a Administração mostra regularidade real
// Datas do ciclo atual são relativas a HOJE, para os KPIs sempre fazerem sentido.

const fs = require('node:fs');
const path = require('node:path');
const db = require('./conexao');
const { hashPin } = require('../seguranca');

const NOMES_SINTETICOS = [
  'Ana', 'Bruno', 'Camila', 'Davi', 'Ester', 'Felipe', 'Giovanna', 'Heitor', 'Isadora', 'João',
  'Kauan', 'Larissa', 'Miguel', 'Nicole', 'Otávio', 'Paula', 'Quésia', 'Rafael', 'Sofia', 'Thiago',
  'Ubiratã', 'Valentina', 'Wesley', 'Yasmin', 'Zoé', 'Alice', 'Benício', 'Clara', 'Daniel', 'Elisa'
];
const CATEGORIAS_ASPIRACAO = [
  'Professor(a)', 'Profissional de saúde', 'Policial/Bombeiro(a)', 'Esporte profissional',
  'Artista/Música', 'Tecnologia', 'Empreendedor(a)/Comércio', 'Outra área de serviço público'
];
const ESTADOS_OBSERVADOS = ['Animada(o)', 'Concentrada(o)', 'Quieta(o)', 'Frustrada(o)', 'Não observado'];

// PIN inicial do administrador. É PROVISÓRIO: a tela de Administração avisa até ser trocado.
const PIN_INICIAL_ADMIN = process.env.ADMIN_PIN_INICIAL || '1234';

const sorteiaUm = (lista) => lista[Math.floor(Math.random() * lista.length)];
const dataISO = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function recriarTabelas() {
  db.exec(`
    DROP TABLE IF EXISTS ausencias; DROP TABLE IF EXISTS registros; DROP TABLE IF EXISTS pausas; DROP TABLE IF EXISTS sessoes;
    DROP TABLE IF EXISTS criancas; DROP TABLE IF EXISTS ciclos; DROP TABLE IF EXISTS turmas;
    DROP TABLE IF EXISTS auditoria; DROP TABLE IF EXISTS usuarios;
  `);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));
}

function criaUsuarios() {
  const inserir = db.prepare('INSERT INTO usuarios (nome, papel, pin_hash, pin_provisorio, pode_exportar) VALUES (?, ?, ?, ?, ?)');
  const marli = inserir.run('Marli', 'coordenadora', null, 0, 1);                      // coordenadora exporta
  const educadora = inserir.run('Educadora Voluntária', 'educadora_voluntaria', null, 0, 0); // voluntária não exporta
  const admin = inserir.run('Administrador do Instituto', 'administrador', hashPin(PIN_INICIAL_ADMIN), 1, 1);
  return { coordenadoraId: marli.lastInsertRowid, educadoraId: educadora.lastInsertRowid, adminId: admin.lastInsertRowid };
}

function criaTurmas() {
  const inserir = db.prepare('INSERT INTO turmas (nome, horario, tamanho_estimado) VALUES (?, ?, ?)');
  return { turmaAId: inserir.run('Turma A', '12h-14h', 30).lastInsertRowid, turmaBId: inserir.run('Turma B', '14h-16h', 30).lastInsertRowid };
}

function criaCriancas(turmaId, quantidade) {
  const inserir = db.prepare('INSERT INTO criancas (turma_id, nome_sintetico) VALUES (?, ?)');
  const ids = [];
  for (let i = 0; i < quantidade; i++) {
    const nome = NOMES_SINTETICOS[i % NOMES_SINTETICOS.length] + (i >= NOMES_SINTETICOS.length ? ` ${i}` : '');
    ids.push(inserir.run(turmaId, nome).lastInsertRowid);
  }
  return ids;
}

// Os últimos 8 sábados (o mais recente primeiro), contando hoje se for sábado
function ultimosSabados(quantidade) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
  const lista = [];
  for (let i = 0; i < quantidade; i++) {
    lista.push(new Date(d));
    d.setDate(d.getDate() - 7);
  }
  return lista;
}

function criaCiclos(sabados) {
  const inicioAtual = sabados[sabados.length - 1];
  const fimAnterior = new Date(inicioAtual);
  fimAnterior.setDate(fimAnterior.getDate() - 1);
  const inserir = db.prepare('INSERT INTO ciclos (nome, data_inicio, data_fim) VALUES (?, ?, ?)');
  return {
    ciclo1Id: inserir.run('Ciclo 2025-1', '2025-01-01', '2025-06-30').lastInsertRowid,
    ciclo2Id: inserir.run('Ciclo 2025-2', '2025-07-01', dataISO(fimAnterior)).lastInsertRowid,
    ciclo3Id: inserir.run('Ciclo atual', dataISO(inicioAtual), null).lastInsertRowid
  };
}

function criaSessaoComRegistros({ turmaId, cicloId, usuarioId, data, criancaIds, quantidadeRegistros, quantidadeAusentes = 0, comPausa }) {
  const horaInicio = new Date(`${data}T16:00:00`);
  const sessaoId = db.prepare(`
    INSERT INTO sessoes (turma_id, ciclo_id, usuario_id, data, status, exposicao_profissional, hora_inicio)
    VALUES (?, ?, ?, ?, 'concluida', 'Educador(a) responsável', ?)
  `).run(turmaId, cicloId, usuarioId, data, horaInicio.toISOString()).lastInsertRowid;

  let segundosPausados = 0;
  if (comPausa) {
    const pausadaEm = new Date(horaInicio.getTime() + 30_000);
    const retomadaEm = new Date(pausadaEm.getTime() + 10 * 60_000);
    db.prepare('INSERT INTO pausas (sessao_id, pausada_em, retomada_em) VALUES (?, ?, ?)')
      .run(sessaoId, pausadaEm.toISOString(), retomadaEm.toISOString());
    segundosPausados = 600;
  }

  const inserirRegistro = db.prepare(`
    INSERT INTO registros (sessao_id, crianca_id, aspiracao_categoria, percurso_sim_nao, estado_observado)
    VALUES (?, ?, ?, ?, ?)
  `);
  const segundosPorCrianca = 9 + Math.floor(Math.random() * 7); // 9 a 15s: algumas sessões ficam acima da meta de 12s
  let segundosDecorridos = comPausa ? 30 + 600 : 0;

  for (const criancaId of criancaIds.slice(0, quantidadeRegistros)) {
    const aindaNaoDeclarou = Math.random() < 0.12;
    inserirRegistro.run(
      sessaoId, criancaId,
      aindaNaoDeclarou ? 'Ainda não declarou' : sorteiaUm(CATEGORIAS_ASPIRACAO),
      aindaNaoDeclarou ? null : (Math.random() < 0.7 ? 1 : 0),
      sorteiaUm(ESTADOS_OBSERVADOS)
    );
    segundosDecorridos += segundosPorCrianca;
  }

  // crianças que não vieram naquele sábado (as que sobram depois das registradas)
  const inserirAusencia = db.prepare('INSERT INTO ausencias (sessao_id, crianca_id) VALUES (?, ?)');
  criancaIds.slice(quantidadeRegistros, quantidadeRegistros + quantidadeAusentes).forEach((id) => inserirAusencia.run(sessaoId, id));

  db.prepare('UPDATE sessoes SET hora_fim = ?, segundos_pausados = ?, tempo_total_segundos = ? WHERE id = ?')
    .run(new Date(horaInicio.getTime() + segundosDecorridos * 1000).toISOString(), segundosPausados, segundosDecorridos - segundosPausados, sessaoId);
}

function rodarSeed() {
  recriarTabelas();
  const { coordenadoraId, educadoraId } = criaUsuarios();
  const { turmaAId, turmaBId } = criaTurmas();
  const criancasA = criaCriancas(turmaAId, 30);
  const criancasB = criaCriancas(turmaBId, 30);
  const sabados = ultimosSabados(8);
  const { ciclo1Id, ciclo2Id, ciclo3Id } = criaCiclos(sabados);

  // Ciclos antigos (fechados)
  criaSessaoComRegistros({ turmaId: turmaAId, cicloId: ciclo1Id, usuarioId: coordenadoraId, data: '2025-03-08', criancaIds: criancasA, quantidadeRegistros: 27, quantidadeAusentes: 3, comPausa: false });
  criaSessaoComRegistros({ turmaId: turmaAId, cicloId: ciclo2Id, usuarioId: educadoraId, data: '2025-09-13', criancaIds: criancasA, quantidadeRegistros: 28, quantidadeAusentes: 2, comPausa: false });
  // Turma B / ciclo 2: só 3 registros -> amostra insuficiente
  criaSessaoComRegistros({ turmaId: turmaBId, cicloId: ciclo2Id, usuarioId: coordenadoraId, data: '2025-09-13', criancaIds: criancasB, quantidadeRegistros: 3, comPausa: false });

  // Ciclo atual, Turma A: 6 dos últimos 8 sábados (faltam os índices 3 e 6); o índice 2 tem pausa
  [0, 1, 2, 4, 5, 7].forEach((i) => {
    const registradas = 23 + (i % 5);                 // 23 a 27 registradas...
    criaSessaoComRegistros({
      turmaId: turmaAId, cicloId: ciclo3Id, usuarioId: i % 2 === 0 ? coordenadoraId : educadoraId,
      data: dataISO(sabados[i]), criancaIds: criancasA, quantidadeRegistros: registradas,
      quantidadeAusentes: 30 - registradas - (i % 2),  // ...o resto ausente (e às vezes 1 sem registro)
      comPausa: i === 2
    });
  });
  // Turma B no ciclo atual: nenhuma sessão de propósito (estado "sem dados" + alerta na Administração)

  console.log('Seed concluído.');
  console.log(`Usuários: coordenadora=${coordenadoraId}, educadora=${educadoraId} (administrador com PIN provisório "${PIN_INICIAL_ADMIN}" — troque no primeiro acesso)`);
  console.log(`Turmas: A=${turmaAId}, B=${turmaBId} (30 crianças sintéticas cada)`);
  console.log('Casos de borda: Turma B/2025-2 com 3 registros; Turma B sem sessões no ciclo atual; sessão da Turma A com pausa de 10min; sábados com crianças ausentes.');
}

rodarSeed();
