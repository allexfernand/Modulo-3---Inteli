// Backup do banco. Rodando localmente, o risco deixou de ser "a nuvem apagar"
// e passou a ser "o disco da máquina falhar" — por isso há backup diário automático
// e botão de backup manual na tela de Administração.
// Usa VACUUM INTO: gera uma cópia consistente mesmo com o servidor em uso.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db/conexao');
const { registrarAuditoria } = require('./auditoria');

function diretorio() {
  return process.env.DIRETORIO_BACKUPS || path.join(__dirname, '..', 'backups');
}

function carimbo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function podar(prefixo, manter = 14) {
  const dir = diretorio();
  const arquivos = fs.readdirSync(dir).filter((n) => n.startsWith(`${prefixo}-`) && n.endsWith('.db')).sort();
  arquivos.slice(0, Math.max(0, arquivos.length - manter)).forEach((n) => fs.unlinkSync(path.join(dir, n)));
}

function criarBackup(prefixo) {
  const dir = diretorio();
  fs.mkdirSync(dir, { recursive: true });
  const arquivo = path.join(dir, `${prefixo}-${carimbo()}.db`);
  db.exec(`VACUUM INTO '${arquivo.replace(/'/g, "''")}'`);
  podar(prefixo);
  return arquivo;
}

function garantirBackupDoDia() {
  const dir = diretorio();
  fs.mkdirSync(dir, { recursive: true });
  const hoje = carimbo().slice(0, 10);
  const jaExiste = fs.readdirSync(dir).some((n) => n.startsWith(`automatico-${hoje}`));
  if (jaExiste) return;
  try {
    const arquivo = criarBackup('automatico');
    registrarAuditoria(null, 'backup_automatico', path.basename(arquivo));
    console.log(`Backup automático criado: ${arquivo}`);
  } catch (erro) {
    console.error('Falha no backup automático:', erro.message);
  }
}

function iniciarBackupAutomatico() {
  garantirBackupDoDia();
  setInterval(garantirBackupDoDia, 6 * 60 * 60 * 1000); // confere a cada 6h; cria no máximo 1 por dia
}

// Data do backup mais recente que existe NA PASTA de backups (fonte de verdade: os arquivos,
// não a auditoria — assim continua correto mesmo se o banco for recriado ou restaurado).
function ultimoBackupEm() {
  const dir = diretorio();
  if (!fs.existsSync(dir)) return null;
  let maisRecente = 0;
  for (const nome of fs.readdirSync(dir)) {
    if (!/^(manual|automatico)-.*\.db$/.test(nome)) continue;
    maisRecente = Math.max(maisRecente, fs.statSync(path.join(dir, nome)).mtimeMs);
  }
  return maisRecente ? new Date(maisRecente) : null;
}

module.exports = { criarBackup, iniciarBackupAutomatico, ultimoBackupEm };
