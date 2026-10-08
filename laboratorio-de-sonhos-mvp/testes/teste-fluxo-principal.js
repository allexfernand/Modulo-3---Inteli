// Teste do fluxo principal: login -> abrir sessão -> registrar todas as crianças
// de uma turma pequena de teste -> exposição -> concluir -> conferir painel.
// Roda contra um banco de teste isolado (não mexe no banco de desenvolvimento).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const BANCO_TESTE = path.join(__dirname, '..', 'backend', 'db', 'laboratorio.teste.db');
const PORTA = 3099;
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
  process.env.PORTA = PORTA;
  process.env.CAMINHO_BANCO_TESTE = BANCO_TESTE;

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

test('fluxo principal: registrar uma turma inteira e ver o painel agregado', async () => {
  const cookies = {};

  const login = await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuarioId: 1 }) }, cookies);
  assert.strictEqual(login.status, 200);

  const turmas = (await requisicao('/api/turmas', {}, cookies)).dados;
  const turma = turmas[0];

  const abertura = await requisicao('/api/sessoes', { method: 'POST', body: JSON.stringify({ turmaId: turma.id, data: '2026-10-10' }) }, cookies);
  assert.strictEqual(abertura.status, 200);
  const sessaoId = abertura.dados.sessao.id;

  const criancas = (await requisicao(`/api/turmas/${turma.id}/criancas`, {}, cookies)).dados;
  assert.ok(criancas.length > 0, 'a turma de teste precisa ter crianças cadastradas');

  for (let i = 0; i < criancas.length; i++) {
    const categoria = i === 0 ? 'Ainda não declarou' : 'Tecnologia';
    const r = await requisicao('/api/registros', {
      method: 'POST',
      body: JSON.stringify({ sessaoId, criancaId: criancas[i].id, aspiracaoCategoria: categoria, percursoSimNao: true })
    }, cookies);
    assert.strictEqual(r.status, 200, `registro da criança ${i} deveria funcionar`);
  }

  const listaFinal = (await requisicao(`/api/turmas/${turma.id}/criancas?sessao_id=${sessaoId}`, {}, cookies)).dados;
  assert.ok(listaFinal.every((c) => c.status === 'registrado'), 'todas as crianças deveriam estar registradas');

  const exposicao = await requisicao(`/api/sessoes/${sessaoId}/exposicao`, { method: 'POST', body: JSON.stringify({ exposicaoProfissional: 'Educador(a) responsável' }) }, cookies);
  assert.strictEqual(exposicao.status, 200);

  const conclusao = await requisicao(`/api/sessoes/${sessaoId}/concluir`, { method: 'POST' }, cookies);
  assert.strictEqual(conclusao.status, 200);
  assert.strictEqual(conclusao.dados.registrados, criancas.length);
});
