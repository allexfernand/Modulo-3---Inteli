// Testes do papel Administrador: PIN, bloqueio, separação de papéis, gestão de pessoas,
// encerramento de ciclo, backup e auditoria. Roda contra um servidor e banco isolados.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BANCO_TESTE = path.join(__dirname, '..', 'backend', 'db', 'laboratorio.teste3.db');
const PASTA_BACKUPS = fs.mkdtempSync(path.join(os.tmpdir(), 'backups-teste-'));
const PORTA = 3097;
const BASE = `http://localhost:${PORTA}`;
let servidor;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(caminho, { metodo = 'GET', corpo, jar = {} } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jar.cookie) headers.Cookie = jar.cookie;
  const resp = await fetch(`${BASE}${caminho}`, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) jar.cookie = setCookie.split(';')[0];
  const dados = await resp.json().catch(() => ({}));
  return { status: resp.status, dados };
}
async function logarAdmin(id = 3, pin = '1234') {
  const jar = {};
  const r = await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: id, pin }, jar });
  assert.strictEqual(r.status, 200, 'login de administrador deveria funcionar');
  return jar;
}
async function logar(id) {
  const jar = {};
  const r = await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: id }, jar });
  assert.strictEqual(r.status, 200);
  return jar;
}

before(async () => {
  if (fs.existsSync(BANCO_TESTE)) fs.unlinkSync(BANCO_TESTE);
  servidor = spawn('node', [path.join(__dirname, 'helper-servidor-teste.js')], {
    env: { ...process.env, PORTA, CAMINHO_BANCO_TESTE: BANCO_TESTE, DIRETORIO_BACKUPS: PASTA_BACKUPS },
    stdio: 'pipe'
  });
  await esperar(1500);
});
after(() => {
  servidor.kill();
  if (fs.existsSync(BANCO_TESTE)) fs.unlinkSync(BANCO_TESTE);
  fs.rmSync(PASTA_BACKUPS, { recursive: true, force: true });
});

test('administrador exige PIN: sem PIN e PIN errado dão 401, PIN certo entra', async () => {
  let r = await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: 3 } });
  assert.strictEqual(r.status, 401);
  r = await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: 3, pin: '0000' } });
  assert.strictEqual(r.status, 401);
  const jar = await logarAdmin();
  const eu = await req('/api/auth/me', { jar });
  assert.strictEqual(eu.dados.papel, 'administrador');
});

test('5 PINs errados bloqueiam o login (429), inclusive com o PIN certo depois', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: 4, pin: '9999' } });
    assert.strictEqual(r.status, 401);
  }
  const r = await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: 4, pin: '5678' } });
  assert.strictEqual(r.status, 429);
});

test('rotas de dados exigem login (401) e administrador não registra (403)', async () => {
  assert.strictEqual((await req('/api/turmas')).status, 401, 'lista de turmas sem login');
  assert.strictEqual((await req('/api/turmas/1/criancas')).status, 401, 'lista de crianças sem login');
  assert.strictEqual((await req('/api/registros', { metodo: 'POST', corpo: {} })).status, 401, 'gravar registro sem login');
  const jar = await logarAdmin();
  const r = await req('/api/sessoes', { metodo: 'POST', corpo: { turmaId: 1, data: '2026-05-02' }, jar });
  assert.strictEqual(r.status, 403, 'quem governa não abre sessão de registro');
});

test('coordenadora não acessa a Administração (403); administrador acessa e recebe os KPIs', async () => {
  const coord = await logar(1);
  assert.strictEqual((await req('/api/admin/overview', { jar: coord })).status, 403);
  assert.strictEqual((await req('/api/admin/usuarios', { jar: coord })).status, 403);
  assert.strictEqual((await req('/api/admin/backup', { metodo: 'POST', jar: coord })).status, 403);

  const adm = await logarAdmin();
  const r = await req('/api/admin/overview', { jar: adm });
  assert.strictEqual(r.status, 200);
  assert.ok(r.dados.kpis && Array.isArray(r.dados.turmas) && Array.isArray(r.dados.alertas));
  assert.strictEqual(r.dados.pinProvisorio, true, 'PIN inicial deve aparecer como provisório');
  assert.ok(r.dados.alertas.some((a) => a.nivel === 'critico'), 'PIN provisório gera alerta crítico');
});

test('lista de pessoas nunca expõe o hash do PIN', async () => {
  const adm = await logarAdmin();
  const r = await req('/api/admin/usuarios', { jar: adm });
  assert.strictEqual(r.status, 200);
  assert.ok(r.dados.length >= 4);
  assert.ok(!JSON.stringify(r.dados).includes('pin_hash'));
  assert.ok(!/[0-9a-f]{32}:[0-9a-f]{64}/.test(JSON.stringify(r.dados)), 'nenhum salt:hash vazando');
});

test('pessoa desativada perde o acesso imediatamente (sem esperar a sessão expirar)', async () => {
  const adm = await logarAdmin();
  const criada = await req('/api/admin/usuarios', { metodo: 'POST', corpo: { nome: 'Educadora Temporária', papel: 'educadora_voluntaria' }, jar: adm });
  assert.strictEqual(criada.status, 201);
  const id = criada.dados.id;

  const jarEducadora = await logar(id);
  assert.strictEqual((await req('/api/turmas', { jar: jarEducadora })).status, 200);

  assert.strictEqual((await req(`/api/admin/usuarios/${id}`, { metodo: 'PATCH', corpo: { ativo: false }, jar: adm })).status, 200);
  assert.strictEqual((await req('/api/turmas', { jar: jarEducadora })).status, 401, 'sessão antiga deve cair na hora');
  assert.strictEqual((await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: id } })).status, 400, 'nem consegue logar de novo');
});

test('salvaguardas: não desativa a si mesmo, não muda papel de admin, admin exige PIN válido', async () => {
  const adm = await logarAdmin();
  assert.strictEqual((await req('/api/admin/usuarios/3', { metodo: 'PATCH', corpo: { ativo: false }, jar: adm })).status, 400);
  assert.strictEqual((await req('/api/admin/usuarios/3', { metodo: 'PATCH', corpo: { papel: 'coordenadora' }, jar: adm })).status, 400);
  assert.strictEqual((await req('/api/admin/usuarios/1', { metodo: 'PATCH', corpo: { papel: 'administrador' }, jar: adm })).status, 400);
  assert.strictEqual((await req('/api/admin/usuarios', { metodo: 'POST', corpo: { nome: 'Novo Admin', papel: 'administrador' }, jar: adm })).status, 400, 'sem PIN');
  assert.strictEqual((await req('/api/admin/usuarios', { metodo: 'POST', corpo: { nome: 'Novo Admin', papel: 'administrador', pin: '12' }, jar: adm })).status, 400, 'PIN curto');
  assert.strictEqual((await req('/api/admin/usuarios', { metodo: 'POST', corpo: { nome: 'Novo Admin', papel: 'administrador', pin: '2468' }, jar: adm })).status, 201);
});

test('trocar o próprio PIN exige o PIN atual; o novo PIN passa a valer e o provisório some', async () => {
  const adm = await logarAdmin();
  assert.strictEqual((await req('/api/admin/usuarios/3/pin', { metodo: 'POST', corpo: { pin: '4321', pinAtual: '9999' }, jar: adm })).status, 403);
  assert.strictEqual((await req('/api/admin/usuarios/3/pin', { metodo: 'POST', corpo: { pin: 'abc', pinAtual: '1234' }, jar: adm })).status, 400);
  assert.strictEqual((await req('/api/admin/usuarios/3/pin', { metodo: 'POST', corpo: { pin: '4321', pinAtual: '1234' }, jar: adm })).status, 200);

  assert.strictEqual((await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: 3, pin: '1234' } })).status, 401, 'PIN antigo não vale mais');
  const novo = await logarAdmin(3, '4321');
  const visao = await req('/api/admin/overview', { jar: novo });
  assert.strictEqual(visao.dados.pinProvisorio, false);
});

test('"quem exporta" é permissão por pessoa, gerida pelo administrador (slide 11 do pitch)', async () => {
  const adm = await logarAdmin(3, '4321');
  const educadora = await logar(2);
  const coord = await logar(1);

  assert.strictEqual((await req('/api/ciclos/1/exportacao', { jar: educadora })).status, 403, 'educadora começa sem permissão');
  assert.strictEqual((await req('/api/auth/me', { jar: educadora })).dados.podeExportar, false);

  assert.strictEqual((await req('/api/admin/usuarios/2', { metodo: 'PATCH', corpo: { podeExportar: true }, jar: adm })).status, 200);
  assert.strictEqual((await req('/api/ciclos/1/exportacao', { jar: educadora })).status, 200, 'permissão vale na hora, sem novo login');

  assert.strictEqual((await req('/api/admin/usuarios/1', { metodo: 'PATCH', corpo: { podeExportar: false }, jar: adm })).status, 200);
  assert.strictEqual((await req('/api/ciclos/1/exportacao', { jar: coord })).status, 403, 'coordenadora também pode perder a permissão');
  assert.strictEqual((await req('/api/ciclos/1/exportacao', { jar: adm })).status, 200, 'administrador sempre exporta');

  const lista = (await req('/api/admin/usuarios', { jar: adm })).dados;
  assert.strictEqual(lista.find((u) => u.id === 1).pode_exportar, 0);
  assert.strictEqual(lista.find((u) => u.id === 2).pode_exportar, 1);

  // restaura o estado inicial para não afetar os demais testes
  await req('/api/admin/usuarios/1', { metodo: 'PATCH', corpo: { podeExportar: true }, jar: adm });
  await req('/api/admin/usuarios/2', { metodo: 'PATCH', corpo: { podeExportar: false }, jar: adm });
});

test('a visão geral lista as turmas cadastradas e a cobertura por sessão', async () => {
  const adm = await logarAdmin(3, '4321');
  const turmas = await req('/api/admin/turmas', { jar: adm });
  assert.strictEqual(turmas.status, 200);
  assert.ok(turmas.dados.length >= 1 && typeof turmas.dados[0].criancas === 'number');
  const visao = await req('/api/admin/overview', { jar: adm });
  assert.ok(Array.isArray(visao.dados.sessoesRecentes), 'cobertura de registro POR SESSÃO (slide 11)');
});

test('backup manual devolve um arquivo SQLite válido', async () => {
  const adm = await logarAdmin(3, '4321');
  const resp = await fetch(`${BASE}/api/admin/backup`, { method: 'POST', headers: { Cookie: adm.cookie } });
  assert.strictEqual(resp.status, 200);
  const bytes = Buffer.from(await resp.arrayBuffer());
  assert.strictEqual(bytes.subarray(0, 15).toString(), 'SQLite format 3', 'precisa ser um banco SQLite de verdade');
  assert.ok(fs.readdirSync(PASTA_BACKUPS).some((n) => n.startsWith('manual-')), 'cópia também fica na pasta de backups');
  const visao = await req('/api/admin/overview', { jar: adm });
  assert.ok(visao.dados.kpis.ultimoBackup, 'o KPI "último backup" lê da pasta de backups');
  assert.strictEqual(visao.dados.kpis.diasDesdeUltimoBackup, 0);
});

test('exportar a página do ciclo é contado no KPI de exportações', async () => {
  const coord = await logar(1);
  assert.strictEqual((await req('/api/ciclos/1/exportacao/registro', { metodo: 'POST', jar: coord })).status, 200);
  const adm = await logarAdmin(3, '4321');
  const r = await req('/api/admin/overview?ciclo_id=1', { jar: adm });
  assert.ok(r.dados.kpis.exportacoes >= 1);
});

test('encerrar ciclo: exige confirmação, bloqueia com sessão aberta, depois funciona e trava a edição', async () => {
  const coord = await logar(1);
  const adm = await logarAdmin(3, '4321');

  const sessao = await req('/api/sessoes', { metodo: 'POST', corpo: { turmaId: 1, data: '2026-05-02' }, jar: coord });
  const sessaoId = sessao.dados.sessao.id;
  const criancas = (await req('/api/turmas/1/criancas', { jar: coord })).dados;
  const reg = await req('/api/registros', { metodo: 'POST', corpo: { sessaoId, criancaId: criancas[0].id, aspiracaoCategoria: 'Tecnologia', percursoSimNao: true }, jar: coord });
  assert.strictEqual(reg.status, 200);

  assert.strictEqual((await req('/api/admin/ciclos/encerrar', { metodo: 'POST', corpo: { novoNome: 'Ciclo B', confirmar: true }, jar: adm })).status, 400, 'sessão em andamento bloqueia');

  await req(`/api/sessoes/${sessaoId}/exposicao`, { metodo: 'POST', corpo: { exposicaoProfissional: 'Educador(a) responsável' }, jar: coord });
  await req(`/api/sessoes/${sessaoId}/concluir`, { metodo: 'POST', jar: coord });

  assert.strictEqual((await req('/api/admin/ciclos/encerrar', { metodo: 'POST', corpo: { novoNome: 'Ciclo B' }, jar: adm })).status, 400, 'sem confirmação');
  assert.strictEqual((await req('/api/admin/ciclos/encerrar', { metodo: 'POST', corpo: { novoNome: 'a', confirmar: true }, jar: adm })).status, 400, 'nome inválido');
  const ok = await req('/api/admin/ciclos/encerrar', { metodo: 'POST', corpo: { novoNome: 'Ciclo B', confirmar: true }, jar: adm });
  assert.strictEqual(ok.status, 200);

  const ciclos = (await req('/api/ciclos', { jar: adm })).dados;
  const antigo = ciclos.find((c) => c.nome === 'Ciclo Teste');
  const novo = ciclos.find((c) => c.nome === 'Ciclo B');
  assert.ok(antigo.data_fim, 'ciclo antigo precisa ter data de fim');
  assert.strictEqual(novo.data_fim, null, 'novo ciclo fica em andamento');

  const edicao = await req(`/api/registros/${reg.dados.registroId}`, { metodo: 'PUT', corpo: { aspiracaoCategoria: 'Professor(a)', percursoSimNao: true }, jar: coord });
  assert.strictEqual(edicao.status, 403, 'registro do ciclo encerrado fica travado');

  const nova = await req('/api/sessoes', { metodo: 'POST', corpo: { turmaId: 1, data: '2026-05-09' }, jar: coord });
  assert.strictEqual(nova.dados.sessao.ciclo_id, novo.id, 'novas sessões entram no ciclo novo');
});

test('a trilha de auditoria registra as ações administrativas (sem dado de criança)', async () => {
  const adm = await logarAdmin(3, '4321');
  const r = await req('/api/admin/auditoria?limite=200', { jar: adm });
  assert.strictEqual(r.status, 200);
  const acoes = new Set(r.dados.map((l) => l.acao));
  for (const esperada of ['login_admin', 'login_admin_falhou', 'login_admin_bloqueado', 'usuario_criado', 'usuario_alterado', 'pin_alterado', 'backup_manual', 'exportacao', 'ciclo_encerrado']) {
    assert.ok(acoes.has(esperada), `auditoria deveria conter "${esperada}"`);
  }
  assert.ok(!JSON.stringify(r.dados).includes('Criança 1'), 'nome de criança nunca vai para a auditoria');
});
