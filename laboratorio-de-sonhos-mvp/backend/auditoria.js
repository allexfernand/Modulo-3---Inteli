// Registro de auditoria. NUNCA colocar nome de criança em "detalhe".
const db = require('./db/conexao');

function registrarAuditoria(usuarioId, acao, detalhe = null) {
  db.prepare('INSERT INTO auditoria (usuario_id, acao, detalhe) VALUES (?, ?, ?)')
    .run(usuarioId ?? null, acao, detalhe);
}

module.exports = { registrarAuditoria };
