// Tela de Exportação — página do ciclo para o relatório. Exige a PERMISSÃO de exportar (gerida na
// Administração, slide 11 do pitch: "Gestão de permissões (quem exporta)"), lida da sessão do servidor.
// NUNCA inclui nome de criança — só dado agregado por turma.

const express = require('express');
const db = require('../db/conexao');
const { exigirExportacao } = require('./middlewareAcesso');
const { registrarAuditoria } = require('../auditoria');
const router = express.Router();

router.get('/:id/exportacao', exigirExportacao, (req, res) => {
  const { id } = req.params; // id do ciclo

  const ciclo = db.prepare('SELECT * FROM ciclos WHERE id = ?').get(id);
  if (!ciclo) return res.status(404).json({ erro: 'Ciclo não encontrado.' });

  const turmas = db.prepare('SELECT id, nome FROM turmas').all();

  const porTurma = turmas.map((turma) => {
    const porCategoria = db.prepare(`
      SELECT aspiracao_categoria AS categoria, COUNT(*) AS quantidade
      FROM registros r JOIN sessoes s ON s.id = r.sessao_id
      WHERE s.turma_id = ? AND s.ciclo_id = ?
      GROUP BY aspiracao_categoria
    `).all(turma.id, id);

    const porEstadoObservado = db.prepare(`
      SELECT estado_observado AS estado, COUNT(*) AS quantidade
      FROM registros r JOIN sessoes s ON s.id = r.sessao_id
      WHERE s.turma_id = ? AND s.ciclo_id = ?
      GROUP BY estado_observado
    `).all(turma.id, id);

    const totalRegistros = porCategoria.reduce((soma, c) => soma + c.quantidade, 0);

    return { turma: turma.nome, totalRegistros, porCategoria, porEstadoObservado };
  });

  const evolucaoGeral = db.prepare(`
    SELECT c.id AS cicloId, c.nome AS cicloNome, COUNT(r.id) AS totalRegistros,
           COUNT(DISTINCT CASE WHEN r.aspiracao_categoria != 'Ainda não declarou' THEN r.aspiracao_categoria END) AS amplitude
    FROM ciclos c
    LEFT JOIN sessoes s ON s.ciclo_id = c.id
    LEFT JOIN registros r ON r.sessao_id = s.id
    GROUP BY c.id
    ORDER BY c.data_inicio ASC
  `).all();

  res.json({
    ciclo: ciclo.nome,
    geradoEm: new Date().toISOString(),
    porTurma,
    evolucaoGeral,
    observacao: 'Dados agregados por turma. Nenhum nome de criança é exibido.'
  });
});

// POST /api/ciclos/:id/exportacao/registro — chamado quando a pessoa clica em "Baixar PDF".
// Alimenta o KPI "exportações geradas" da Administração (ver a página não conta como exportar).
router.post('/:id/exportacao/registro', exigirExportacao, (req, res) => {
  registrarAuditoria(req.session.usuarioId, 'exportacao', `ciclo_id=${Number(req.params.id)}`);
  res.json({ ok: true });
});

module.exports = router;
