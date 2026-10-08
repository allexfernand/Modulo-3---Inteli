// Tela "Turma" (escolha da turma) e dados da tela de registro.

const express = require('express');
const db = require('../db/conexao');
const router = express.Router();

// GET /api/turmas
router.get('/', (req, res) => {
  const turmas = db.prepare(`
    SELECT t.id, t.nome, t.horario, t.tamanho_estimado,
           (SELECT COUNT(*) FROM criancas c WHERE c.turma_id = t.id) AS criancas
    FROM turmas t ORDER BY t.nome
  `).all();
  res.json(turmas);
});

// GET /api/turmas/:id/resumo-ultimo-encontro — bloco "Último encontro" (jornada futura do pitch)
router.get('/:id/resumo-ultimo-encontro', (req, res) => {
  const id = Number(req.params.id);
  const sessao = db.prepare("SELECT id, data FROM sessoes WHERE turma_id = ? AND status = 'concluida' ORDER BY data DESC LIMIT 1").get(id);
  if (!sessao) return res.json({ existe: false });

  const registrados = db.prepare('SELECT COUNT(*) AS n FROM registros WHERE sessao_id = ?').get(sessao.id).n;
  const ausentes = db.prepare('SELECT COUNT(*) AS n FROM ausencias WHERE sessao_id = ?').get(sessao.id).n;
  const novasAspiracoes = db.prepare("SELECT COUNT(*) AS n FROM registros WHERE sessao_id = ? AND aspiracao_categoria != 'Ainda não declarou'").get(sessao.id).n;
  res.json({ existe: true, data: sessao.data, registrados, ausentes, novasAspiracoes });
});

// GET /api/turmas/:id/sessao-aberta — há sessão em andamento nesta turma? (a tela usa para "continuar")
router.get('/:id/sessao-aberta', (req, res) => {
  const id = Number(req.params.id);
  const sessao = db.prepare("SELECT * FROM sessoes WHERE turma_id = ? AND status IN ('em_andamento', 'pausada') ORDER BY id DESC LIMIT 1").get(id);
  if (!sessao) return res.json({ existe: false });
  const total = db.prepare('SELECT COUNT(*) AS n FROM criancas WHERE turma_id = ?').get(id).n;
  const registrados = db.prepare('SELECT COUNT(*) AS n FROM registros WHERE sessao_id = ?').get(sessao.id).n;
  const ausentes = db.prepare('SELECT COUNT(*) AS n FROM ausencias WHERE sessao_id = ?').get(sessao.id).n;
  res.json({ existe: true, sessao, total, registrados, ausentes });
});

// GET /api/turmas/:id/criancas?sessao_id= — lista com situação de cada criança nesta sessão:
// 'registrado' | 'ausente' | 'pendente'
router.get('/:id/criancas', (req, res) => {
  const id = Number(req.params.id);
  const sessaoId = Number(req.query.sessao_id) || -1;
  const linhas = db.prepare(`
    SELECT c.id, c.nome_sintetico, r.id AS registro_id, r.aspiracao_categoria, r.percurso_sim_nao,
           r.estado_observado, a.id AS ausencia_id
    FROM criancas c
    LEFT JOIN registros r ON r.crianca_id = c.id AND r.sessao_id = ?
    LEFT JOIN ausencias a ON a.crianca_id = c.id AND a.sessao_id = ?
    WHERE c.turma_id = ? ORDER BY c.nome_sintetico
  `).all(sessaoId, sessaoId, id);

  res.json(linhas.map((l) => ({
    id: l.id,
    nome_sintetico: l.nome_sintetico,
    status: l.registro_id ? 'registrado' : (l.ausencia_id ? 'ausente' : 'pendente'),
    registroId: l.registro_id || null,
    aspiracao: l.aspiracao_categoria || null,
    percurso: l.percurso_sim_nao === null || l.percurso_sim_nao === undefined ? null : l.percurso_sim_nao === 1,
    estado: l.estado_observado || null
  })));
});

module.exports = router;
