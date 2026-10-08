// Servidor principal — Registro do Laboratório de Sonhos
// Roda localmente, na rede do Instituto. Escuta em 0.0.0.0 para o celular
// da coordenadora/educadora acessar pelo IP da máquina na mesma rede Wi-Fi.

const express = require('express');
const session = require('express-session');
const path = require('node:path');
const os = require('node:os');

const rotasAuth = require('./rotas/auth');
const { exigirLogin } = require('./rotas/middlewareAcesso');
const { verificarVersaoDoBanco } = require('./db/verificarVersao');
const backup = require('./backup');
const rotasTurmas = require('./rotas/turmas');
const rotasCiclos = require('./rotas/ciclos');
const rotasSessoes = require('./rotas/sessoes');
const rotasRegistros = require('./rotas/registros');
const rotasPainel = require('./rotas/painel');
const rotasExportacao = require('./rotas/exportacao');
const rotasAdmin = require('./rotas/admin');

try {
  verificarVersaoDoBanco();
} catch (erro) {
  console.error('\nERRO: ' + erro.message + '\n');
  process.exit(1);
}

const app = express();
// PORTA é a variável usada localmente; PORT é a que plataformas de hospedagem injetam.
const PORTA = process.env.PORTA || process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  // Segredo da sessão: definido por variável de ambiente ou gerado a cada inicialização.
  // (As sessões ficam em memória, então reiniciar o servidor já desloga todo mundo de qualquer forma.)
  secret: process.env.SEGREDO_SESSAO || require('node:crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8, httpOnly: true, sameSite: 'lax' } // 8 horas, cobre um sábado inteiro
}));

// Arquivos estáticos do front-end
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rotas da API. Só /api/auth é pública; todo o resto exige sessão ativa (e cada rota
// ainda confere o papel). Antes desta versão, rotas de escrita aceitavam requisições sem login.
app.use('/api/auth', rotasAuth);
app.use('/api', exigirLogin);
app.use('/api/turmas', rotasTurmas);
app.use('/api/ciclos', rotasCiclos);
app.use('/api/sessoes', rotasSessoes);
app.use('/api/registros', rotasRegistros);
app.use('/api/turmas', rotasPainel); // GET /api/turmas/:id/painel
app.use('/api/ciclos', rotasExportacao); // GET /api/ciclos/:id/exportacao
app.use('/api/admin', rotasAdmin);

function descobrirIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const nome of Object.keys(interfaces)) {
    for (const info of interfaces[nome]) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return 'não encontrado — verifique sua conexão de rede';
}

app.listen(PORTA, '0.0.0.0', () => {
  if (!process.env.CAMINHO_BANCO_TESTE) backup.iniciarBackupAutomatico(); // 1 backup por dia, guarda os 14 mais recentes
  const ip = descobrirIpLocal();
  console.log('========================================');
  console.log('Registro do Laboratório de Sonhos — rodando');
  console.log(`Nesta máquina:        http://localhost:${PORTA}`);
  console.log(`Na rede local (celular): http://${ip}:${PORTA}`);
  console.log('========================================');
});
