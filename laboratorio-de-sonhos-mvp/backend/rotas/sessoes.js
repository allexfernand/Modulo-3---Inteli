// Sessão de registro de uma turma. Mudanças desta versão (alinhadas ao pitch e ao uso real):
//  - a pessoa NÃO fica presa: criança ausente é marcada como ausente e a sessão pode ser encerrada
//    mesmo sem registrar todo mundo;
//  - só existe UMA sessão aberta por turma (esquecer uma aberta não gera sessões "fantasmas");
//  - o tempo é "tempo ativo": intervalos longos de ociosidade não inflam a métrica.

const express = require('express');
const db = require('../db/conexao');
const { exigirPapel } = require('./middlewareAcesso');
const { EXPOSICOES } = require('../vocabularios');
const router = express.Router();

// Separação de papéis: quem governa (administrador) não registra.
router.use(exigirPapel(['coordenadora', 'educadora_voluntaria']));

const TETO_OCIOSIDADE_SEGUNDOS = 120; // um intervalo entre dois toques conta no máximo isso

function cicloAtual() {
  return db.prepare('SELECT id FROM ciclos WHERE data_fim IS NULL ORDER BY data_inicio DESC LIMIT 1').get();
}

// Aceita ISO ("...T...Z") e o formato do SQLite ("AAAA-MM-DD HH:MM:SS", em UTC)
function paraMs(texto) {
  if (!texto) return NaN;
  return new Date(texto.includes('T') ? texto : `${texto.replace(' ', 'T')}Z`).getTime();
}

// Tempo ATIVO: soma dos intervalos entre o início, cada toque (registro/edição/ausência) e o
// encerramento, limitando cada intervalo a 120s. Assim, sair e voltar mais tarde (ou travar o
// celular) não infla o "tempo por criança".
function calcularTempoAtivoSegundos(sessao, agora) {
  const eventos = [paraMs(sessao.hora_inicio)];
  db.prepare('SELECT criado_em, editado_em FROM registros WHERE sessao_id = ?').all(sessao.id)
    .forEach((r) => { eventos.push(paraMs(r.criado_em)); if (r.editado_em) eventos.push(paraMs(r.editado_em)); });
  db.prepare('SELECT criado_em FROM ausencias WHERE sessao_id = ?').all(sessao.id)
    .forEach((a) => eventos.push(paraMs(a.criado_em)));
  eventos.push(agora.getTime());

  const ordenados = eventos.filter(Number.isFinite).sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < ordenados.length; i++) {
    total += Math.min((ordenados[i] - ordenados[i - 1]) / 1000, TETO_OCIOSIDADE_SEGUNDOS);
  }
  return Math.round(total);
}

function contagens(sessao) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM criancas WHERE turma_id = ?').get(sessao.turma_id).n;
  const registrados = db.prepare('SELECT COUNT(*) AS n FROM registros WHERE sessao_id = ?').get(sessao.id).n;
  const ausentes = db.prepare('SELECT COUNT(*) AS n FROM ausencias WHERE sessao_id = ?').get(sessao.id).n;
  return { total, registrados, ausentes, semRegistro: Math.max(total - registrados - ausentes, 0) };
}

// POST /api/sessoes — abre a sessão da turma, ou devolve a que já está aberta (qualquer data)
router.post('/', (req, res) => {
  const { turmaId, data } = req.body || {};
  if (!db.prepare('SELECT id FROM turmas WHERE id = ?').get(Number(turmaId))) {
    return res.status(400).json({ erro: 'Turma inválida.' });
  }

  const aberta = db.prepare(`
    SELECT * FROM sessoes WHERE turma_id = ? AND status IN ('em_andamento', 'pausada') ORDER BY id DESC LIMIT 1
  `).get(Number(turmaId));
  if (aberta) return res.json({ sessao: aberta, retomada: true, daOutraData: aberta.data !== data });

  const ciclo = cicloAtual();
  if (!ciclo) return res.status(400).json({ erro: 'Nenhum ciclo em andamento cadastrado.' });

  const r = db.prepare(`
    INSERT INTO sessoes (turma_id, ciclo_id, usuario_id, data, status, hora_inicio)
    VALUES (?, ?, ?, ?, 'em_andamento', ?)
  `).run(Number(turmaId), ciclo.id, req.session.usuarioId, data, new Date().toISOString());
  res.json({ sessao: db.prepare('SELECT * FROM sessoes WHERE id = ?').get(r.lastInsertRowid), retomada: false, daOutraData: false });
});

router.get('/:id', (req, res) => {
  const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  res.json({ ...sessao, ...contagens(sessao) });
});

// Pausar/retomar continuam na API (informativos e idempotentes), mas a tela nova não depende deles:
// o tempo ativo já ignora ociosidade.
router.post('/:id/pausar', (req, res) => {
  const sessao = db.prepare('SELECT id, status FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  if (sessao.status === 'em_andamento') {
    const agora = new Date().toISOString();
    db.prepare("UPDATE sessoes SET status = 'pausada' WHERE id = ?").run(sessao.id);
    db.prepare('INSERT INTO pausas (sessao_id, pausada_em) VALUES (?, ?)').run(sessao.id, agora);
  }
  res.json({ ok: true });
});

router.post('/:id/retomar', (req, res) => {
  const sessao = db.prepare('SELECT id, status FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  if (sessao.status === 'pausada') {
    const agora = new Date().toISOString();
    const aberta = db.prepare('SELECT * FROM pausas WHERE sessao_id = ? AND retomada_em IS NULL ORDER BY id DESC LIMIT 1').get(sessao.id);
    if (aberta) {
      db.prepare('UPDATE pausas SET retomada_em = ? WHERE id = ?').run(agora, aberta.id);
      db.prepare('UPDATE sessoes SET segundos_pausados = segundos_pausados + ? WHERE id = ?')
        .run(Math.round((new Date(agora) - new Date(aberta.pausada_em)) / 1000), sessao.id);
    }
    db.prepare("UPDATE sessoes SET status = 'em_andamento' WHERE id = ?").run(sessao.id);
  }
  res.json({ ok: true });
});

// POST /api/sessoes/:id/exposicao — uma vez por sessão, irreversível (a tela nova envia isto junto com o encerramento)
router.post('/:id/exposicao', (req, res) => {
  const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  const { exposicaoProfissional } = req.body || {};
  if (!EXPOSICOES.includes(exposicaoProfissional)) return res.status(400).json({ erro: 'Exposição inválida.' });
  if (sessao.exposicao_profissional) {
    return res.status(400).json({ erro: 'A exposição desta sessão já foi registrada e não pode ser alterada.' });
  }
  db.prepare('UPDATE sessoes SET exposicao_profissional = ? WHERE id = ?').run(exposicaoProfissional, sessao.id);
  res.json({ ok: true });
});

// POST /api/sessoes/:id/ausencias — marca ausente: {criancaId} | {criancaIds:[...]} | {todosPendentes:true}
router.post('/:id/ausencias', (req, res) => {
  const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  if (sessao.status === 'concluida') return res.status(400).json({ erro: 'Esta sessão já foi encerrada.' });

  const corpo = req.body || {};
  let ids;
  if (corpo.todosPendentes === true) {
    ids = db.prepare(`
      SELECT c.id FROM criancas c WHERE c.turma_id = ?
        AND NOT EXISTS (SELECT 1 FROM registros r WHERE r.sessao_id = ? AND r.crianca_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM ausencias a WHERE a.sessao_id = ? AND a.crianca_id = c.id)
    `).all(sessao.turma_id, sessao.id, sessao.id).map((l) => l.id);
  } else {
    ids = [].concat(corpo.criancaIds ?? corpo.criancaId ?? []).map(Number);
  }
  if (!ids.length) return res.json({ ok: true, marcadas: 0 });

  for (const id of ids) {
    const c = db.prepare('SELECT turma_id FROM criancas WHERE id = ?').get(id);
    if (!c || c.turma_id !== sessao.turma_id) return res.status(400).json({ erro: 'Criança não pertence à turma desta sessão.' });
    if (db.prepare('SELECT 1 FROM registros WHERE sessao_id = ? AND crianca_id = ?').get(sessao.id, id)) {
      return res.status(409).json({ erro: 'Esta criança já foi registrada. Limpe o registro antes de marcá-la como ausente.' });
    }
  }

  const agora = new Date().toISOString();
  const inserir = db.prepare('INSERT OR IGNORE INTO ausencias (sessao_id, crianca_id, criado_em) VALUES (?, ?, ?)');
  db.exec('BEGIN');
  try { ids.forEach((id) => inserir.run(sessao.id, id, agora)); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); return res.status(500).json({ erro: e.message }); }
  res.json({ ok: true, marcadas: ids.length });
});

router.delete('/:id/ausencias/:criancaId', (req, res) => {
  const sessao = db.prepare('SELECT status FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  if (sessao.status === 'concluida') return res.status(400).json({ erro: 'Esta sessão já foi encerrada.' });
  db.prepare('DELETE FROM ausencias WHERE sessao_id = ? AND crianca_id = ?').run(Number(req.params.id), Number(req.params.criancaId));
  res.json({ ok: true });
});

// POST /api/sessoes/:id/concluir — pode encerrar sem registrar todo mundo.
// Exige ao menos 1 registro e a exposição do dia (enviada aqui ou antes).
router.post('/:id/concluir', (req, res) => {
  const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(Number(req.params.id));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  if (sessao.status === 'concluida') return res.status(400).json({ erro: 'Esta sessão já foi encerrada.' });

  const { exposicaoProfissional } = req.body || {};
  if (exposicaoProfissional !== undefined) {
    if (!EXPOSICOES.includes(exposicaoProfissional)) return res.status(400).json({ erro: 'Exposição inválida.' });
    if (!sessao.exposicao_profissional) {
      db.prepare('UPDATE sessoes SET exposicao_profissional = ? WHERE id = ?').run(exposicaoProfissional, sessao.id);
      sessao.exposicao_profissional = exposicaoProfissional;
    }
  }
  if (!sessao.exposicao_profissional) {
    return res.status(400).json({ erro: 'Informe quem conduziu a oficina hoje antes de encerrar.' });
  }
  if (contagens(sessao).registrados === 0) {
    return res.status(400).json({ erro: 'Registre pelo menos uma criança antes de encerrar a sessão.' });
  }

  const agora = new Date();
  const tempo = calcularTempoAtivoSegundos(sessao, agora);
  db.prepare("UPDATE sessoes SET status = 'concluida', hora_fim = ?, tempo_total_segundos = ? WHERE id = ?")
    .run(agora.toISOString(), tempo, sessao.id);

  const c = contagens(sessao);
  const novasAspiracoes = db.prepare("SELECT COUNT(*) AS n FROM registros WHERE sessao_id = ? AND aspiracao_categoria != 'Ainda não declarou'").get(sessao.id).n;
  res.json({
    ok: true, tempoTotalSegundos: tempo, registrados: c.registrados, ausentes: c.ausentes,
    semRegistro: c.semRegistro, totalCriancas: c.total, novasAspiracoes
  });
});

module.exports = router;
