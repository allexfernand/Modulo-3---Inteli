// Registro flexível: criança ausente, encerrar sem registrar todo mundo, uma sessão aberta por turma,
// campos opcionais e validação de vocabulário. Cada teste usa a sua própria turma (1 a 4).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const BANCO_TESTE = path.join(__dirname, '..', 'backend', 'db', 'laboratorio.teste4.db');
process.env.CAMINHO_BANCO_TESTE = BANCO_TESTE; // o processo de teste também abre o mesmo arquivo
const PORTA = 3096;
const BASE = `http://localhost:${PORTA}`;
let servidor;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const EXPO = 'Educador(a) responsável';

async function req(caminho, { metodo = 'GET', corpo, jar = {} } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jar.cookie) headers.Cookie = jar.cookie;
  const resp = await fetch(`${BASE}${caminho}`, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const sc = resp.headers.get('set-cookie'); if (sc) jar.cookie = sc.split(';')[0];
  return { status: resp.status, dados: await resp.json().catch(() => ({})) };
}
async function logar(id) {
  const jar = {};
  assert.strictEqual((await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: id }, jar })).status, 200);
  return jar;
}
const abrir = async (jar, turmaId, data = '2026-05-02') => (await req('/api/sessoes', { metodo: 'POST', corpo: { turmaId, data }, jar })).dados;
const criancas = async (jar, turmaId, sessaoId) => (await req(`/api/turmas/${turmaId}/criancas?sessao_id=${sessaoId}`, { jar })).dados;

before(async () => {
  if (fs.existsSync(BANCO_TESTE)) fs.unlinkSync(BANCO_TESTE);
  servidor = spawn('node', [path.join(__dirname, 'helper-servidor-teste.js')], { env: { ...process.env, PORTA, CAMINHO_BANCO_TESTE: BANCO_TESTE }, stdio: 'pipe' });
  await esperar(1500);
});
after(() => { servidor.kill(); if (fs.existsSync(BANCO_TESTE)) fs.unlinkSync(BANCO_TESTE); });

test('as 9 categorias válidas gravam; a variante antiga "(médico/enfermeiro)" é recusada com mensagem clara', async () => {
  const jar = await logar(1);
  const { sessao } = await abrir(jar, 1);
  const [c0, c1] = await criancas(jar, 1, sessao.id);
  const r0 = await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: c0.id, aspiracaoCategoria: 'Profissional de saúde' }, jar });
  assert.strictEqual(r0.status, 200, 'o BUG antigo: esta categoria era rejeitada pela tela');

  const ruim = await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: c1.id, aspiracaoCategoria: 'Profissional de saúde (médico/enfermeiro)' }, jar });
  assert.strictEqual(ruim.status, 400);
  assert.match(ruim.dados.erro, /Categoria inválida/, 'a mensagem não pode mais mentir "já tem um registro"');

  for (const cat of ['Professor(a)', 'Profissional de saúde', 'Policial/Bombeiro(a)', 'Esporte profissional', 'Artista/Música',
    'Tecnologia', 'Empreendedor(a)/Comércio', 'Outra área de serviço público', 'Ainda não declarou']) {
    assert.strictEqual((await req(`/api/registros/${r0.dados.registroId}`, { metodo: 'PUT', corpo: { aspiracaoCategoria: cat }, jar })).status, 200, cat);
  }
  const dup = await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: c0.id, aspiracaoCategoria: 'Tecnologia' }, jar });
  assert.strictEqual(dup.status, 409, 'duplicado é 409 com mensagem própria');
});

test('estado observado e percurso são OPCIONAIS, salvam e voltam na lista; "ainda não declarou" zera o percurso', async () => {
  const jar = await logar(1);
  const { sessao } = await abrir(jar, 1);
  let [c0] = await criancas(jar, 1, sessao.id);
  const id = c0.registroId;

  assert.strictEqual(c0.percurso, null, 'sem resposta = vazio, não "não"');
  assert.strictEqual(c0.estado, 'Não observado');

  await req(`/api/registros/${id}`, { metodo: 'PUT', corpo: { aspiracaoCategoria: 'Tecnologia', estadoObservado: 'Concentrada(o)', percursoSimNao: true }, jar });
  [c0] = await criancas(jar, 1, sessao.id);
  assert.strictEqual(c0.estado, 'Concentrada(o)');
  assert.strictEqual(c0.percurso, true);

  await req(`/api/registros/${id}`, { metodo: 'PUT', corpo: { estadoObservado: 'Quieta(o)' }, jar }); // alteração parcial
  [c0] = await criancas(jar, 1, sessao.id);
  assert.strictEqual(c0.estado, 'Quieta(o)');
  assert.strictEqual(c0.aspiracao, 'Tecnologia', 'campo não enviado não pode ser apagado');
  assert.strictEqual(c0.percurso, true);

  assert.strictEqual((await req(`/api/registros/${id}`, { metodo: 'PUT', corpo: { estadoObservado: 'Agitado demais' }, jar })).status, 400);
  await req(`/api/registros/${id}`, { metodo: 'PUT', corpo: { aspiracaoCategoria: 'Ainda não declarou' }, jar });
  [c0] = await criancas(jar, 1, sessao.id);
  assert.strictEqual(c0.percurso, null, 'sem aspiração declarada não há percurso');
});

test('criança AUSENTE: marca, desmarca, e registrar depois remove a ausência; registrada não vira ausente sem limpar', async () => {
  const jar = await logar(1);
  const { sessao } = await abrir(jar, 1);
  const lista = await criancas(jar, 1, sessao.id);
  const livre = lista.find((c) => c.status === 'pendente');

  assert.strictEqual((await req(`/api/sessoes/${sessao.id}/ausencias`, { metodo: 'POST', corpo: { criancaId: livre.id }, jar })).status, 200);
  assert.strictEqual((await criancas(jar, 1, sessao.id)).find((c) => c.id === livre.id).status, 'ausente');

  await req(`/api/sessoes/${sessao.id}/ausencias/${livre.id}`, { metodo: 'DELETE', jar });
  assert.strictEqual((await criancas(jar, 1, sessao.id)).find((c) => c.id === livre.id).status, 'pendente');

  await req(`/api/sessoes/${sessao.id}/ausencias`, { metodo: 'POST', corpo: { criancaId: livre.id }, jar });
  await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: livre.id, aspiracaoCategoria: 'Tecnologia' }, jar });
  assert.strictEqual((await criancas(jar, 1, sessao.id)).find((c) => c.id === livre.id).status, 'registrado', 'veio afinal: registro substitui a ausência');

  const jaRegistrada = lista.find((c) => c.status === 'registrado');
  const conflito = await req(`/api/sessoes/${sessao.id}/ausencias`, { metodo: 'POST', corpo: { criancaId: jaRegistrada.id }, jar });
  assert.strictEqual(conflito.status, 409);

  // "limpar" devolve a criança a pendente (registro feito na criança errada)
  await req(`/api/registros/${jaRegistrada.registroId}`, { metodo: 'DELETE', jar });
  assert.strictEqual((await criancas(jar, 1, sessao.id)).find((c) => c.id === jaRegistrada.id).status, 'pendente');
});

test('NÃO FICA PRESO: encerra sem registrar todo mundo; "marcar o resto como ausente" em um toque', async () => {
  const jar = await logar(1);
  const { sessao } = await abrir(jar, 2);
  const [c0] = await criancas(jar, 2, sessao.id);
  await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: c0.id, aspiracaoCategoria: 'Artista/Música' }, jar });

  const semExpo = await req(`/api/sessoes/${sessao.id}/concluir`, { metodo: 'POST', corpo: {}, jar });
  assert.strictEqual(semExpo.status, 400, 'exige quem conduziu a oficina');
  assert.strictEqual((await req(`/api/sessoes/${sessao.id}/concluir`, { metodo: 'POST', corpo: { exposicaoProfissional: 'qualquer coisa' }, jar })).status, 400);

  const lote = await req(`/api/sessoes/${sessao.id}/ausencias`, { metodo: 'POST', corpo: { todosPendentes: true }, jar });
  assert.strictEqual(lote.dados.marcadas, 2, 'as 2 crianças pendentes viram ausentes de uma vez');

  const fim = await req(`/api/sessoes/${sessao.id}/concluir`, { metodo: 'POST', corpo: { exposicaoProfissional: EXPO }, jar });
  assert.strictEqual(fim.status, 200);
  assert.deepStrictEqual([fim.dados.registrados, fim.dados.ausentes, fim.dados.semRegistro, fim.dados.totalCriancas], [1, 2, 0, 3]);

  const de_novo = await req(`/api/sessoes/${sessao.id}/concluir`, { metodo: 'POST', corpo: { exposicaoProfissional: EXPO }, jar });
  assert.strictEqual(de_novo.status, 400, 'não encerra duas vezes');
});

test('encerrar também funciona deixando crianças SEM registro (não deu tempo)', async () => {
  const jar = await logar(1);
  const { sessao } = await abrir(jar, 4);
  const [c0] = await criancas(jar, 4, sessao.id);
  await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: c0.id, aspiracaoCategoria: 'Esporte profissional' }, jar });
  const fim = await req(`/api/sessoes/${sessao.id}/concluir`, { metodo: 'POST', corpo: { exposicaoProfissional: EXPO }, jar });
  assert.strictEqual(fim.status, 200);
  assert.strictEqual(fim.dados.semRegistro, 2);
});

test('uma sessão aberta por turma: abrir de novo (mesmo em outra data) devolve a mesma, sem duplicar', async () => {
  const jar = await logar(1);
  const a = await abrir(jar, 3, '2026-05-02');
  const b = await abrir(jar, 3, '2026-05-09');
  assert.strictEqual(b.sessao.id, a.sessao.id);
  assert.strictEqual(b.retomada, true);
  assert.strictEqual(b.daOutraData, true, 'a tela usa isto para avisar "sessão de outra data"');
  const info = await req('/api/turmas/3/sessao-aberta', { jar });
  assert.strictEqual(info.dados.existe, true);

  // encerrar sem nenhum registro não é permitido (evita sessão vazia)
  const vazia = await req(`/api/sessoes/${a.sessao.id}/concluir`, { metodo: 'POST', corpo: { exposicaoProfissional: EXPO }, jar });
  assert.strictEqual(vazia.status, 400);
  assert.match(vazia.dados.erro, /pelo menos uma criança/);
});

test('a cobertura da Administração desconsidera quem faltou (ausente não entra na conta)', async () => {
  const jar = await logar(1);
  const { sessao } = await abrir(jar, 1);
  const lista = await criancas(jar, 1, sessao.id);
  // estado atual da turma 1 (testes anteriores): garante 2 registradas + 1 ausente
  for (const c of lista) {
    if (c.status === 'pendente') await req('/api/registros', { metodo: 'POST', corpo: { sessaoId: sessao.id, criancaId: c.id, aspiracaoCategoria: 'Tecnologia' }, jar });
  }
  const atual = await criancas(jar, 1, sessao.id);
  const ultima = atual.filter((c) => c.status === 'registrado').pop();
  await req(`/api/registros/${ultima.registroId}`, { metodo: 'DELETE', jar });
  await req(`/api/sessoes/${sessao.id}/ausencias`, { metodo: 'POST', corpo: { criancaId: ultima.id }, jar });
  const fim = await req(`/api/sessoes/${sessao.id}/concluir`, { metodo: 'POST', corpo: { exposicaoProfissional: EXPO }, jar });
  assert.strictEqual(fim.status, 200);
  assert.strictEqual(fim.dados.ausentes, 1);

  const admJar = {};
  await req('/api/auth/login', { metodo: 'POST', corpo: { usuarioId: 3, pin: '1234' }, jar: admJar });
  const visao = await req('/api/admin/overview', { jar: admJar });
  const linha = visao.dados.sessoesRecentes.find((s) => s.turma === 'Turma Teste' && s.ausentes === 1);
  assert.ok(linha, 'sessão aparece em "cobertura por sessão"');
  assert.strictEqual(linha.coberturaPct, 100, '2 registradas de 2 presentes = 100% (e não 2 de 3 = 67%)');
});
