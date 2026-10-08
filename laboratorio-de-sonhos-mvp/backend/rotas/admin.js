// Administração — papel "administrador" (domínio do Instituto, separado de quem registra).
// Mitiga o risco H5 do Pitch Executivo ("ninguém opera depois da semana 10"):
// KPIs de operação, gestão de pessoas, encerramento de ciclo, backup e auditoria.
// REGRA 2 preservada: tudo aqui é agregado ou sobre equipe; nunca lista criança individual.

const express = require('express');
const path = require('node:path');
const db = require('../db/conexao');
const { exigirPapel } = require('./middlewareAcesso');
const { hashPin, verificarPin, pinValido } = require('../seguranca');
const { registrarAuditoria } = require('../auditoria');
const { criarBackup, ultimoBackupEm } = require('../backup');
const router = express.Router();

router.use(exigirPapel('administrador')); // TODAS as rotas deste arquivo

const META_SEGUNDOS_POR_CRIANCA = 12; // meta oficial do produto
const PAPEIS_REGISTRO = ['coordenadora', 'educadora_voluntaria'];

// ---------- utilidades de data ----------
function dataLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Quantos sábados existem entre início e fim (inclusive). Usa meio-dia para fugir de horário de verão.
function contarSabados(inicioISO, fim) {
  const d = new Date(`${inicioISO}T12:00:00`);
  let total = 0;
  while (d <= fim) {
    if (d.getDay() === 6) total += 1;
    d.setDate(d.getDate() + 1);
  }
  return total;
}

function diasDesde(dataISO) {
  if (!dataISO) return null;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.floor((hoje - new Date(`${dataISO}T12:00:00`)) / 86400000);
}

function nomeValido(nome) {
  return typeof nome === 'string' && nome.trim().length >= 2 && nome.trim().length <= 60;
}

// ---------- KPIs ----------
router.get('/overview', (req, res) => {
  const ciclos = db.prepare('SELECT id, nome, data_inicio, data_fim FROM ciclos ORDER BY data_inicio DESC').all();
  const cicloPadrao = ciclos.find((c) => c.data_fim === null) || ciclos[0];
  const cicloId = Number(req.query.ciclo_id) || (cicloPadrao && cicloPadrao.id);
  const ciclo = ciclos.find((c) => c.id === cicloId);
  if (!ciclo) return res.status(404).json({ erro: 'Ciclo não encontrado.' });

  const cicloAtual = ciclo.data_fim === null;
  const fimPeriodo = new Date();
  fimPeriodo.setHours(23, 59, 59, 0);
  if (ciclo.data_fim) {
    const fimCiclo = new Date(`${ciclo.data_fim}T23:59:59`);
    if (fimCiclo < fimPeriodo) fimPeriodo.setTime(fimCiclo.getTime());
  }
  const sabadosEsperados = contarSabados(ciclo.data_inicio, fimPeriodo);

  const turmas = db.prepare('SELECT id, nome FROM turmas ORDER BY nome').all();
  const alertas = [];
  const sessoesRecentes = [];

  let totalTempo = 0, totalRegistros = 0, sessoesComRitmo = 0, sessoesAcima = 0;
  let somaCobertura = 0, nSessoes = 0, sabadosRegistradosTotal = 0, sabadosEsperadosTotal = 0;

  const porTurma = turmas.map((turma) => {
    const totalCriancas = db.prepare('SELECT COUNT(*) AS n FROM criancas WHERE turma_id = ?').get(turma.id).n;
    const sessoes = db.prepare(`
      SELECT s.data, s.tempo_total_segundos AS tempo,
             (SELECT COUNT(*) FROM registros r WHERE r.sessao_id = s.id) AS regs,
             (SELECT COUNT(*) FROM ausencias a WHERE a.sessao_id = s.id) AS aus
      FROM sessoes s
      WHERE s.turma_id = ? AND s.ciclo_id = ? AND s.status = 'concluida'
    `).all(turma.id, ciclo.id);

    let tempoTurma = 0, regsTurma = 0, cobTurma = 0;
    for (const s of sessoes) {
      const presentes = Math.max(totalCriancas - s.aus, 0);   // ausente não entra na cobertura
      const cobertura = presentes > 0 ? s.regs / presentes : null;
      if (s.tempo != null && s.regs > 0) {
        tempoTurma += s.tempo;
        regsTurma += s.regs;
        sessoesComRitmo += 1;
        if (s.tempo / s.regs > META_SEGUNDOS_POR_CRIANCA) sessoesAcima += 1;
      }
      if (cobertura !== null) cobTurma += cobertura;
      sessoesRecentes.push({
        data: s.data, turma: turma.nome, registradas: s.regs, ausentes: s.aus,
        coberturaPct: cobertura === null ? null : Math.round(cobertura * 100),
        tempoTotalSegundos: s.tempo,
        ritmoSegundosPorCrianca: s.tempo != null && s.regs > 0 ? Math.round(s.tempo / s.regs) : null
      });
    }
    totalTempo += tempoTurma;
    totalRegistros += regsTurma;
    somaCobertura += cobTurma;
    nSessoes += sessoes.length;

    const sabadosRegistrados = new Set(sessoes.map((s) => s.data)).size;
    sabadosRegistradosTotal += sabadosRegistrados;
    sabadosEsperadosTotal += sabadosEsperados;

    const ultima = db.prepare("SELECT MAX(data) AS d FROM sessoes WHERE turma_id = ? AND status = 'concluida'").get(turma.id).d;
    const dias = diasDesde(ultima);

    if (cicloAtual && sabadosEsperados > 0) {
      if (dias === null) alertas.push({ nivel: 'atencao', mensagem: `${turma.nome}: nenhuma sessão registrada ainda.` });
      else if (dias > 8) alertas.push({ nivel: 'atencao', mensagem: `${turma.nome}: sem registro há ${dias} dias (esperado: 1 por sábado).` });
    }

    return {
      id: turma.id,
      nome: turma.nome,
      sessoesConcluidas: sessoes.length,
      sabadosRegistrados,
      sabadosEsperados,
      diasDesdeUltimoRegistro: dias,
      coberturaMediaPct: sessoes.length ? Math.round((cobTurma / sessoes.length) * 100) : null,
      ritmoSegundosPorCrianca: regsTurma ? Math.round(tempoTurma / regsTurma) : null
    };
  });

  const tempoMedio = totalRegistros ? Math.round(totalTempo / totalRegistros) : null;
  if (tempoMedio !== null && tempoMedio > META_SEGUNDOS_POR_CRIANCA) {
    alertas.push({ nivel: 'atencao', mensagem: `Tempo médio por criança (${tempoMedio}s) está acima da meta de ${META_SEGUNDOS_POR_CRIANCA}s.` });
  }

  const totais = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN r.aspiracao_categoria = 'Ainda não declarou' THEN 1 ELSE 0 END) AS nao_declarou
    FROM registros r JOIN sessoes s ON s.id = r.sessao_id WHERE s.ciclo_id = ?
  `).get(ciclo.id);

  const exportacoes = db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE acao = 'exportacao' AND detalhe = ?").get(`ciclo_id=${ciclo.id}`).n;

  const dataBackup = ultimoBackupEm();
  const ultimoBackup = dataBackup ? dataBackup.toISOString() : null;
  const diasBackup = ultimoBackup ? Math.floor((Date.now() - new Date(ultimoBackup).getTime()) / 86400000) : null;
  if (diasBackup === null) alertas.push({ nivel: 'atencao', mensagem: 'Nenhum backup do banco foi feito ainda.' });
  else if (diasBackup > 7) alertas.push({ nivel: 'atencao', mensagem: `Último backup há ${diasBackup} dias.` });

  const eu = db.prepare('SELECT pin_provisorio FROM usuarios WHERE id = ?').get(req.session.usuarioId);
  const pinProvisorio = eu.pin_provisorio === 1;
  if (pinProvisorio) alertas.unshift({ nivel: 'critico', mensagem: 'Seu PIN é provisório. Troque-o agora na aba Pessoas.' });

  const amplitudePorCiclo = db.prepare(`
    SELECT c.id AS cicloId, c.nome AS cicloNome, COUNT(DISTINCT r.aspiracao_categoria) AS amplitude
    FROM ciclos c
    LEFT JOIN sessoes s ON s.ciclo_id = c.id
    LEFT JOIN registros r ON r.sessao_id = s.id AND r.aspiracao_categoria != 'Ainda não declarou'
    GROUP BY c.id ORDER BY c.data_inicio ASC
  `).all();

  res.json({
    ciclo: { id: ciclo.id, nome: ciclo.nome, atual: cicloAtual },
    ciclos,
    metaSegundosPorCrianca: META_SEGUNDOS_POR_CRIANCA,
    kpis: {
      tempoMedioPorCriancaSegundos: tempoMedio,
      pctSessoesAcimaDaMeta: sessoesComRitmo ? Math.round((sessoesAcima / sessoesComRitmo) * 100) : null,
      coberturaMediaPct: nSessoes ? Math.round((somaCobertura / nSessoes) * 100) : null,
      sabadosRegistrados: sabadosRegistradosTotal,
      sabadosEsperados: sabadosEsperadosTotal,
      regularidadePct: sabadosEsperadosTotal ? Math.round((sabadosRegistradosTotal / sabadosEsperadosTotal) * 100) : null,
      pctAindaNaoDeclarou: totais.total ? Math.round((totais.nao_declarou / totais.total) * 100) : null,
      exportacoes,
      ultimoBackup,
      diasDesdeUltimoBackup: diasBackup
    },
    turmas: porTurma,
    sessoesRecentes: sessoesRecentes.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 10),
    amplitudePorCiclo,
    alertas,
    pinProvisorio
  });
});

// ---------- turmas ----------
// Somente leitura neste MVP: criar/remover turma e criança fica para depois da validação LGPD (H3).
router.get('/turmas', (req, res) => {
  res.json(db.prepare(`
    SELECT t.id, t.nome, t.horario, t.tamanho_estimado,
           (SELECT COUNT(*) FROM criancas c WHERE c.turma_id = t.id) AS criancas
    FROM turmas t ORDER BY t.nome
  `).all());
});

// ---------- pessoas e acessos ----------
router.get('/usuarios', (req, res) => {
  // nunca devolve pin_hash
  const linhas = db.prepare('SELECT id, nome, papel, ativo, pin_provisorio, pode_exportar FROM usuarios ORDER BY ativo DESC, papel, nome').all();
  // administrador sempre pode exportar (não é configurável)
  res.json(linhas.map((l) => ({ ...l, pode_exportar: l.papel === 'administrador' ? 1 : l.pode_exportar })));
});

router.post('/usuarios', (req, res) => {
  const { nome, papel, pin, podeExportar } = req.body || {};
  if (!nomeValido(nome)) return res.status(400).json({ erro: 'Informe um nome de 2 a 60 caracteres.' });
  if (![...PAPEIS_REGISTRO, 'administrador'].includes(papel)) return res.status(400).json({ erro: 'Papel inválido.' });

  let pinHash = null;
  let provisorio = 0;
  if (papel === 'administrador') {
    if (!pinValido(pin)) return res.status(400).json({ erro: 'Administrador exige um PIN numérico de 4 a 8 dígitos.' });
    pinHash = hashPin(pin);
    provisorio = 1; // quem recebe a conta deve trocar no primeiro acesso
  }

  // padrão: coordenadora exporta, educadora não (o administrador muda depois, por pessoa)
  const exporta = papel === 'administrador' ? 1 : (podeExportar === undefined ? (papel === 'coordenadora' ? 1 : 0) : (podeExportar ? 1 : 0));
  const resultado = db.prepare('INSERT INTO usuarios (nome, papel, pin_hash, pin_provisorio, pode_exportar) VALUES (?, ?, ?, ?, ?)')
    .run(nome.trim(), papel, pinHash, provisorio, exporta);
  registrarAuditoria(req.session.usuarioId, 'usuario_criado', `${nome.trim()} (${papel}, exporta=${exporta})`);
  res.status(201).json({ ok: true, id: Number(resultado.lastInsertRowid) });
});

router.patch('/usuarios/:id', (req, res) => {
  const id = Number(req.params.id);
  const alvo = db.prepare('SELECT id, nome, papel, ativo, pode_exportar FROM usuarios WHERE id = ?').get(id);
  if (!alvo) return res.status(404).json({ erro: 'Pessoa não encontrada.' });

  const { nome, papel, ativo, podeExportar } = req.body || {};
  const ehEuMesmo = id === req.session.usuarioId;

  if (ativo === false && ehEuMesmo) {
    return res.status(400).json({ erro: 'Você não pode desativar a própria conta.' });
  }
  if (papel !== undefined && papel !== alvo.papel) {
    if (alvo.papel === 'administrador') return res.status(400).json({ erro: 'O papel de um administrador não pode ser alterado. Crie outra conta ou desative esta.' });
    if (!PAPEIS_REGISTRO.includes(papel)) return res.status(400).json({ erro: 'Para criar um administrador, use "Nova pessoa" com PIN.' });
  }
  if (nome !== undefined && !nomeValido(nome)) return res.status(400).json({ erro: 'Nome inválido.' });

  const novoNome = nome !== undefined ? nome.trim() : alvo.nome;
  const novoPapel = papel !== undefined ? papel : alvo.papel;
  const novoAtivo = ativo !== undefined ? (ativo ? 1 : 0) : alvo.ativo;

  const novoExporta = podeExportar !== undefined ? (podeExportar ? 1 : 0) : alvo.pode_exportar;

  db.prepare('UPDATE usuarios SET nome = ?, papel = ?, ativo = ?, pode_exportar = ? WHERE id = ?').run(novoNome, novoPapel, novoAtivo, novoExporta, id);
  registrarAuditoria(req.session.usuarioId, 'usuario_alterado', `${alvo.nome}: papel=${novoPapel}, ativo=${novoAtivo}, exporta=${novoExporta}`);
  res.json({ ok: true });
});

// Definir/trocar PIN de um administrador. Trocar o próprio PIN exige o PIN atual.
// Redefinir o PIN de OUTRO administrador o deixa como provisório para ele.
router.post('/usuarios/:id/pin', (req, res) => {
  const id = Number(req.params.id);
  const alvo = db.prepare('SELECT id, nome, papel, pin_hash FROM usuarios WHERE id = ?').get(id);
  if (!alvo || alvo.papel !== 'administrador') return res.status(404).json({ erro: 'Administrador não encontrado.' });

  const { pin, pinAtual } = req.body || {};
  if (!pinValido(pin)) return res.status(400).json({ erro: 'O novo PIN deve ter de 4 a 8 dígitos numéricos.' });

  const ehEuMesmo = id === req.session.usuarioId;
  if (ehEuMesmo && !verificarPin(pinAtual, alvo.pin_hash)) {
    return res.status(403).json({ erro: 'PIN atual incorreto.' });
  }

  db.prepare('UPDATE usuarios SET pin_hash = ?, pin_provisorio = ? WHERE id = ?').run(hashPin(pin), ehEuMesmo ? 0 : 1, id);
  registrarAuditoria(req.session.usuarioId, 'pin_alterado', alvo.nome);
  res.json({ ok: true });
});

// ---------- ciclos ----------
// Encerrar o ciclo atual e abrir o próximo numa operação só (nunca fica sem ciclo atual).
// Efeito: registros do ciclo encerrado ficam travados para edição (preserva a série histórica).
router.post('/ciclos/encerrar', (req, res) => {
  const { novoNome, confirmar } = req.body || {};
  if (confirmar !== true) return res.status(400).json({ erro: 'Confirmação obrigatória: o encerramento não pode ser desfeito.' });
  if (!nomeValido(novoNome)) return res.status(400).json({ erro: 'Informe o nome do novo ciclo (2 a 60 caracteres).' });

  const atual = db.prepare('SELECT id, nome FROM ciclos WHERE data_fim IS NULL ORDER BY data_inicio DESC LIMIT 1').get();
  if (!atual) return res.status(400).json({ erro: 'Não há ciclo em andamento para encerrar.' });

  const abertas = db.prepare("SELECT COUNT(*) AS n FROM sessoes WHERE ciclo_id = ? AND status IN ('em_andamento', 'pausada')").get(atual.id).n;
  if (abertas > 0) {
    return res.status(400).json({ erro: `Há ${abertas} sessão(ões) em andamento ou pausada(s). Conclua ou finalize antes de encerrar o ciclo.` });
  }

  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 86400000);
  try {
    db.exec('BEGIN');
    db.prepare('UPDATE ciclos SET data_fim = ? WHERE id = ?').run(dataLocalISO(hoje), atual.id);
    db.prepare('INSERT INTO ciclos (nome, data_inicio) VALUES (?, ?)').run(novoNome.trim(), dataLocalISO(amanha));
    db.exec('COMMIT');
  } catch (erro) {
    db.exec('ROLLBACK');
    return res.status(500).json({ erro: 'Falha ao encerrar o ciclo: ' + erro.message });
  }

  registrarAuditoria(req.session.usuarioId, 'ciclo_encerrado', `${atual.nome} -> novo: ${novoNome.trim()}`);
  res.json({ ok: true, cicloEncerrado: atual.nome, cicloNovo: novoNome.trim() });
});

// ---------- sistema ----------
router.post('/backup', (req, res) => {
  try {
    const arquivo = criarBackup('manual');
    registrarAuditoria(req.session.usuarioId, 'backup_manual', path.basename(arquivo));
    res.download(arquivo, path.basename(arquivo));
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao gerar o backup: ' + erro.message });
  }
});

router.get('/auditoria', (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 50, 200);
  const linhas = db.prepare(`
    SELECT a.id, a.acao, a.detalhe, a.criado_em AS criadoEm, u.nome AS usuario
    FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
    ORDER BY a.id DESC LIMIT ?
  `).all(limite);
  res.json(linhas);
});

module.exports = router;
