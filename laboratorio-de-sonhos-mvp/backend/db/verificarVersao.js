// Falha cedo e com mensagem clara se o banco for de uma versão anterior.
const db = require('./conexao');

function verificarVersaoDoBanco() {
  const colunas = db.prepare('PRAGMA table_info(usuarios)').all().map((c) => c.name);
  const temAusencias = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ausencias'").get();
  if (!colunas.includes('ativo') || !colunas.includes('pin_hash') || !colunas.includes('pode_exportar') || !temAusencias) {
    throw new Error('Banco de dados desatualizado (versão anterior). Rode "npm run seed" para recriá-lo com dados sintéticos.');
  }
}

module.exports = { verificarVersaoDoBanco };
