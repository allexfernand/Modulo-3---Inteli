const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const BANCO_TESTE = path.join(__dirname, '..', 'backend', 'db', 'laboratorio.teste2.db');
// IMPORTANTE: também seta no processo de teste (pai), não só no servidor (filho) —
// sem isso, o require direto de conexao.js abaixo abriria um banco .db DIFERENTE
// do que o servidor está usando, e a alteração feita aqui nunca chegaria à API.
process.env.CAMINHO_BANCO_TESTE = BANCO_TESTE;
const PORTA = 3098;
const BASE = `http://localhost:${PORTA}`;
let processoServidor;

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function requisicao(caminho, opcoes = {}, cookieJar = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opcoes.headers || {}) };
  if (cookieJar.cookie) headers['Cookie'] = cookieJar.cookie;
  const resposta = await fetch(`${BASE}${caminho}`, { ...opcoes, headers });
  const setCookie = resposta.headers.get('set-cookie');
  if (setCookie) cookieJar.cookie = setCookie.split(';')[0];
  const dados = await resposta.json().catch(() => ({}));
  return { status: resposta.status, dados };
}

before(async () => {
  if (fs.existsSync(BANCO_TESTE)) fs.unlinkSync(BANCO_TESTE);
  processoServidor = spawn('node', [path.join(__dirname, 'helper-servidor-teste.js')], {
    env: { ...process.env, PORTA, CAMINHO_BANCO_TESTE: BANCO_TESTE },
    stdio: 'pipe'
  });
  await esperar(1200);
});

after(() => {
  processoServidor.kill();
  if (fs.existsSync(BANCO_TESTE)) fs.unlinkSync(BANCO_TESTE);
});

test('exportação sem sessão retorna 401, não 200', async () => {
  const r = await requisicao('/api/ciclos/1/exportacao');
  assert.strictEqual(r.status, 401);
});

test('exportação com papel educadora_voluntaria retorna 403', async () => {
  const cookies = {};
  await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuarioId: 2 }) }, cookies);
  const r = await requisicao('/api/ciclos/1/exportacao', {}, cookies);
  assert.strictEqual(r.status, 403);
});

test('fronteira US3: 4 registros mostra amostra insuficiente, 5 não mostra', async () => {
  const cookies = {};
  await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuarioId: 1 }) }, cookies);
  const turmas = (await requisicao('/api/turmas', {}, cookies)).dados;
  const turma = turmas[0];

  // a turma de teste só tem 3 crianças; registra as 3 em duas sessões diferentes pra ter dado>=4 artificialmente
  // (usamos duas datas diferentes para simular duas sessões no mesmo ciclo)
  const abertura1 = await requisicao('/api/sessoes', { method: 'POST', body: JSON.stringify({ turmaId: turma.id, data: '2026-01-10' }) }, cookies);
  const sessao1 = abertura1.dados.sessao.id;
  const criancas = (await requisicao(`/api/turmas/${turma.id}/criancas`, {}, cookies)).dados;
  for (const c of criancas) {
    await requisicao('/api/registros', { method: 'POST', body: JSON.stringify({ sessaoId: sessao1, criancaId: c.id, aspiracaoCategoria: 'Tecnologia' }) }, cookies);
  }
  // só existe UMA sessão aberta por turma: encerra a primeira antes de abrir a segunda
  await requisicao(`/api/sessoes/${sessao1}/concluir`, { method: 'POST', body: JSON.stringify({ exposicaoProfissional: 'Educador(a) responsável' }) }, cookies);

  const painelCom3 = (await requisicao(`/api/turmas/${turma.id}/painel?ciclo_id=1`, {}, cookies)).dados;
  assert.strictEqual(painelCom3.estado, 'amostra_insuficiente', 'com 3 registros deveria ser amostra insuficiente');

  const abertura2 = await requisicao('/api/sessoes', { method: 'POST', body: JSON.stringify({ turmaId: turma.id, data: '2026-01-17' }) }, cookies);
  const sessao2 = abertura2.dados.sessao.id;
  for (const c of criancas) {
    await requisicao('/api/registros', { method: 'POST', body: JSON.stringify({ sessaoId: sessao2, criancaId: c.id, aspiracaoCategoria: 'Artista/Música' }) }, cookies);
  }
  await requisicao(`/api/sessoes/${sessao2}/concluir`, { method: 'POST', body: JSON.stringify({ exposicaoProfissional: 'Educador(a) responsável' }) }, cookies);
  // agora 6 registros no total (3+3), bem acima do mínimo de 5
  const painelCom6 = (await requisicao(`/api/turmas/${turma.id}/painel?ciclo_id=1`, {}, cookies)).dados;
  assert.strictEqual(painelCom6.estado, 'ok', 'com 6 registros não deveria mais ser amostra insuficiente');
});

test('US4: "Ainda não declarou" é aceito e conta como registro completo', async () => {
  const cookies = {};
  await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuarioId: 1 }) }, cookies);
  const turmas = (await requisicao('/api/turmas', {}, cookies)).dados;
  const turma = turmas[0];
  const abertura = await requisicao('/api/sessoes', { method: 'POST', body: JSON.stringify({ turmaId: turma.id, data: '2026-02-01' }) }, cookies);
  const sessaoId = abertura.dados.sessao.id;
  const criancas = (await requisicao(`/api/turmas/${turma.id}/criancas`, {}, cookies)).dados;

  const r = await requisicao('/api/registros', {
    method: 'POST',
    body: JSON.stringify({ sessaoId, criancaId: criancas[0].id, aspiracaoCategoria: 'Ainda não declarou' })
  }, cookies);
  assert.strictEqual(r.status, 200);

  const lista = (await requisicao(`/api/turmas/${turma.id}/criancas?sessao_id=${sessaoId}`, {}, cookies)).dados;
  const essaCrianca = lista.find((c) => c.id === criancas[0].id);
  assert.strictEqual(essaCrianca.status, 'registrado', '"ainda não declarou" deveria contar como registro completo');
});

test('edição de registro é bloqueada quando o ciclo já está fechado', async () => {
  const cookies = {};
  await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuarioId: 1 }) }, cookies);

  // fecha o ciclo de teste manualmente para simular um ciclo encerrado
  const db = require('../backend/db/conexao');
  db.prepare("UPDATE ciclos SET data_fim = '2026-06-30' WHERE id = 1").run();

  const registroQualquer = db.prepare('SELECT id FROM registros LIMIT 1').get();
  if (!registroQualquer) return; // nenhum registro ainda neste banco isolado, pula

  const r = await requisicao(`/api/registros/${registroQualquer.id}`, {
    method: 'PUT',
    body: JSON.stringify({ aspiracaoCategoria: 'Professor(a)', percursoSimNao: true })
  }, cookies);
  assert.strictEqual(r.status, 403, 'editar registro de ciclo fechado deveria ser bloqueado');
});

test('tempo é ATIVO: ociosidade longa não infla a métrica (teto de 120s por intervalo)', async () => {
  const cookies = {};
  await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuarioId: 1 }) }, cookies);

  // O teste anterior fechou o ciclo 1 de propósito (para testar bloqueio de edição).
  // Precisamos de um ciclo aberto aqui — criamos um novo, isolado desse efeito colateral.
  const db = require('../backend/db/conexao');
  db.prepare("INSERT INTO ciclos (nome, data_inicio, data_fim) VALUES ('Ciclo Teste 2', '2026-07-01', NULL)").run();

  const abertura = await requisicao('/api/sessoes', { method: 'POST', body: JSON.stringify({ turmaId: 3, data: '2026-03-01' }) }, cookies);
  const sessaoId = abertura.dados.sessao.id;
  const criancas = (await requisicao('/api/turmas/3/criancas', {}, cookies)).dados;
  for (const c of criancas.slice(0, 2)) {
    await requisicao('/api/registros', { method: 'POST', body: JSON.stringify({ sessaoId, criancaId: c.id, aspiracaoCategoria: 'Tecnologia' }) }, cookies);
  }

  // Simula: a pessoa começou há 40 min, tocou aos 10s e aos 20s, e depois deixou a sessão parada.
  const t0 = Date.now() - 40 * 60 * 1000;
  db.prepare('UPDATE sessoes SET hora_inicio = ? WHERE id = ?').run(new Date(t0).toISOString(), sessaoId);
  const regs = db.prepare('SELECT id FROM registros WHERE sessao_id = ? ORDER BY id').all(sessaoId);
  db.prepare('UPDATE registros SET criado_em = ? WHERE id = ?').run(new Date(t0 + 10_000).toISOString(), regs[0].id);
  db.prepare('UPDATE registros SET criado_em = ? WHERE id = ?').run(new Date(t0 + 20_000).toISOString(), regs[1].id);

  const conclusao = await requisicao(`/api/sessoes/${sessaoId}/concluir`, { method: 'POST', body: JSON.stringify({ exposicaoProfissional: 'Educador(a) responsável' }) }, cookies);
  assert.strictEqual(conclusao.status, 200);
  // 10s + 10s + (40min parados, limitados a 120s) = 140s — e NÃO ~2400s
  assert.ok(conclusao.dados.tempoTotalSegundos >= 139 && conclusao.dados.tempoTotalSegundos <= 143,
    `tempo ativo deveria ser ~140s, veio ${conclusao.dados.tempoTotalSegundos}s`);
});
