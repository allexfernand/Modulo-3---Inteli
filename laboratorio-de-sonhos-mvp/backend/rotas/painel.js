// Painel agregado por turma (US3). Regra 2: NUNCA devolve linha individual de criança.

const express = require('express');
const db = require('../db/conexao');
const { exigirPapel } = require('./middlewareAcesso');
const router = express.Router();

const MINIMO_REGISTROS = 5;

router.get('/:id/painel', exigirPapel(['coordenadora', 'administrador']), (req, res) => {
  const id = Number(req.params.id);
  const cicloId = Number(req.query.ciclo_id);
  if (!cicloId) return res.status(400).json({ erro: 'Informe ciclo_id.' });

  const totalRegistros = db.prepare(`
    SELECT COUNT(*) AS n FROM registros r JOIN sessoes s ON s.id = r.sessao_id WHERE s.turma_id = ? AND s.ciclo_id = ?
  `).get(id, cicloId).n;

  if (totalRegistros === 0) return res.json({ estado: 'sem_dados' });
  if (totalRegistros < MINIMO_REGISTROS) return res.json({ estado: 'amostra_insuficiente', totalRegistros, minimo: MINIMO_REGISTROS });

  const porCategoria = db.prepare(`
    SELECT aspiracao_categoria AS categoria, COUNT(*) AS quantidade
    FROM registros r JOIN sessoes s ON s.id = r.sessao_id
    WHERE s.turma_id = ? AND s.ciclo_id = ? GROUP BY aspiracao_categoria ORDER BY quantidade DESC
  `).all(id, cicloId);

  const porEstadoObservado = db.prepare(`
    SELECT estado_observado AS estado, COUNT(*) AS quantidade
    FROM registros r JOIN sessoes s ON s.id = r.sessao_id
    WHERE s.turma_id = ? AND s.ciclo_id = ? GROUP BY estado_observado ORDER BY quantidade DESC
  `).all(id, cicloId);

  // "Citou um passo para chegar lá?" — antes era coletado e não aparecia em lugar nenhum.
  const percurso = db.prepare(`
    SELECT SUM(CASE WHEN r.percurso_sim_nao IS NOT NULL THEN 1 ELSE 0 END) AS respondidas,
           SUM(CASE WHEN r.percurso_sim_nao = 1 THEN 1 ELSE 0 END) AS citaram
    FROM registros r JOIN sessoes s ON s.id = r.sessao_id WHERE s.turma_id = ? AND s.ciclo_id = ?
  `).get(id, cicloId);

  // Cobertura REAL: registradas ÷ presentes (quem faltou não entra na conta)
  const turmaTotal = db.prepare('SELECT COUNT(*) AS n FROM criancas WHERE turma_id = ?').get(id).n;
  const sessoes = db.prepare(`
    SELECT (SELECT COUNT(*) FROM registros r WHERE r.sessao_id = s.id) AS regs,
           (SELECT COUNT(*) FROM ausencias a WHERE a.sessao_id = s.id) AS aus
    FROM sessoes s WHERE s.turma_id = ? AND s.ciclo_id = ? AND s.status = 'concluida'
  `).all(id, cicloId);
  const regs = sessoes.reduce((t, s) => t + s.regs, 0);
  const presentes = sessoes.reduce((t, s) => t + Math.max(turmaTotal - s.aus, 0), 0);

  const aindaNao = porCategoria.find((c) => c.categoria === 'Ainda não declarou');

  // Evolução entre ciclos: volume e AMPLITUDE (quantas categorias diferentes apareceram) — é o
  // argumento do relatório ("de 4 para 9 categorias"), não só a contagem de registros.
  const evolucaoPorCiclo = db.prepare(`
    SELECT c.id AS cicloId, c.nome AS cicloNome, COUNT(r.id) AS totalRegistros,
           COUNT(DISTINCT CASE WHEN r.aspiracao_categoria != 'Ainda não declarou' THEN r.aspiracao_categoria END) AS amplitude
    FROM ciclos c
    LEFT JOIN sessoes s ON s.ciclo_id = c.id AND s.turma_id = ?
    LEFT JOIN registros r ON r.sessao_id = s.id
    GROUP BY c.id ORDER BY c.data_inicio ASC
  `).all(id);

  res.json({
    estado: 'ok',
    totalRegistros,
    coberturaPct: presentes ? Math.round((regs / presentes) * 100) : null,
    aspiracoesDeclaradas: totalRegistros - (aindaNao ? aindaNao.quantidade : 0),
    aindaNaoDeclararam: aindaNao ? aindaNao.quantidade : 0,
    percurso: { respondidas: percurso.respondidas || 0, citaram: percurso.citaram || 0 },
    porCategoria,
    porEstadoObservado,
    evolucaoPorCiclo
  });
});

module.exports = router;
