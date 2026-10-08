// Registro de aspiração por criança (US1/US4). Tudo salva no toque: não há botão "salvar".
// O percurso ("citou um passo?") e o estado observado são OPCIONAIS — o caminho principal é 1 escolha.

const express = require('express');
const db = require('../db/conexao');
const { exigirPapel } = require('./middlewareAcesso');
const { CATEGORIAS, ESTADOS, SEM_DECLARACAO } = require('../vocabularios');
const router = express.Router();

// Separação de papéis: quem governa (administrador) não registra.
router.use(exigirPapel(['coordenadora', 'educadora_voluntaria']));

// percurso só faz sentido com aspiração declarada; ausência de resposta fica NULL (não é "não")
function normalizarPercurso(categoria, valor) {
  if (categoria === SEM_DECLARACAO) return null;
  if (valor === undefined || valor === null) return null;
  return valor ? 1 : 0;
}

function cicloEstaAberto(sessaoId) {
  const c = db.prepare('SELECT c.data_fim FROM sessoes s JOIN ciclos c ON c.id = s.ciclo_id WHERE s.id = ?').get(sessaoId);
  return c && c.data_fim === null;
}

// POST /api/registros — cria o registro (e, se a criança estava marcada como ausente, remove a ausência)
router.post('/', (req, res) => {
  const { sessaoId, criancaId, aspiracaoCategoria, percursoSimNao, estadoObservado } = req.body || {};
  if (!CATEGORIAS.includes(aspiracaoCategoria)) {
    return res.status(400).json({ erro: `Categoria inválida: "${aspiracaoCategoria}".` });
  }
  const estado = estadoObservado ?? 'Não observado';
  if (!ESTADOS.includes(estado)) return res.status(400).json({ erro: `Estado observado inválido: "${estado}".` });

  const sessao = db.prepare('SELECT id, turma_id, status FROM sessoes WHERE id = ?').get(Number(sessaoId));
  if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });
  if (sessao.status === 'concluida') return res.status(400).json({ erro: 'Esta sessão já foi encerrada.' });
  const crianca = db.prepare('SELECT id, turma_id FROM criancas WHERE id = ?').get(Number(criancaId));
  if (!crianca || crianca.turma_id !== sessao.turma_id) {
    return res.status(400).json({ erro: 'Criança não pertence à turma desta sessão.' });
  }

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM ausencias WHERE sessao_id = ? AND crianca_id = ?').run(sessao.id, crianca.id);
    const r = db.prepare(`
      INSERT INTO registros (sessao_id, crianca_id, aspiracao_categoria, percurso_sim_nao, estado_observado, criado_em)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessao.id, crianca.id, aspiracaoCategoria, normalizarPercurso(aspiracaoCategoria, percursoSimNao), estado, new Date().toISOString());
    db.exec('COMMIT');
    res.json({ ok: true, registroId: Number(r.lastInsertRowid) });
  } catch (erro) {
    db.exec('ROLLBACK');
    if (/UNIQUE/i.test(erro.message)) {
      return res.status(409).json({ erro: 'Esta criança já tem registro nesta sessão. Toque nela para alterar.' });
    }
    res.status(500).json({ erro: 'Falha ao gravar o registro: ' + erro.message });
  }
});

// PUT /api/registros/:id — alteração PARCIAL (só o que vier no corpo). Só em ciclo em andamento.
router.put('/:id', (req, res) => {
  const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(Number(req.params.id));
  if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });
  if (!cicloEstaAberto(registro.sessao_id)) {
    return res.status(403).json({ erro: 'Este registro pertence a um ciclo já encerrado e não pode ser editado.' });
  }

  const corpo = req.body || {};
  const categoria = corpo.aspiracaoCategoria !== undefined ? corpo.aspiracaoCategoria : registro.aspiracao_categoria;
  if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ erro: `Categoria inválida: "${categoria}".` });
  const estado = corpo.estadoObservado !== undefined ? corpo.estadoObservado : registro.estado_observado;
  if (!ESTADOS.includes(estado)) return res.status(400).json({ erro: `Estado observado inválido: "${estado}".` });

  const percursoBruto = 'percursoSimNao' in corpo ? corpo.percursoSimNao : registro.percurso_sim_nao;
  const percurso = normalizarPercurso(categoria, percursoBruto);

  db.prepare('UPDATE registros SET aspiracao_categoria = ?, percurso_sim_nao = ?, estado_observado = ?, editado_em = ? WHERE id = ?')
    .run(categoria, percurso, estado, new Date().toISOString(), registro.id);
  res.json({ ok: true });
});

// DELETE /api/registros/:id — "limpar" um registro feito na criança errada (volta a ficar pendente)
router.delete('/:id', (req, res) => {
  const registro = db.prepare('SELECT id, sessao_id FROM registros WHERE id = ?').get(Number(req.params.id));
  if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });
  if (!cicloEstaAberto(registro.sessao_id)) {
    return res.status(403).json({ erro: 'Este registro pertence a um ciclo já encerrado e não pode ser alterado.' });
  }
  db.prepare('DELETE FROM registros WHERE id = ?').run(registro.id);
  res.json({ ok: true });
});

router.get('/:id', (req, res) => {
  const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(Number(req.params.id));
  if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });
  res.json(registro);
});

module.exports = router;
