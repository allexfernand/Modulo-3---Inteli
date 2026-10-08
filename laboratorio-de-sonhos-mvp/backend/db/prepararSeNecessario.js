// Prepara o banco antes do servidor subir. Pensado para contêiner na nuvem, onde o
// disco é recriado a cada reinício: no primeiro boot o arquivo do banco não existe e
// o servidor encerraria na verificação de versão, sem nunca atender uma requisição.
//
// Rodando localmente isto é inofensivo — se já houver dados, não faz nada.

const db = require('./conexao'); // o require já aplica o schema (CREATE TABLE IF NOT EXISTS)

function bancoEstaPronto() {
  const colunas = db.prepare('PRAGMA table_info(usuarios)').all().map((c) => c.name);
  const temAusencias = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ausencias'").get();
  const schemaAtual = colunas.includes('ativo') && colunas.includes('pin_hash') && colunas.includes('pode_exportar') && temAusencias;
  if (!schemaAtual) return false;
  return db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total > 0;
}

if (bancoEstaPronto()) {
  console.log('Banco já preparado — seed não foi executado.');
} else {
  console.log('Banco vazio ou de versão anterior — recriando com dados sintéticos.');
  require('./seed');
}
