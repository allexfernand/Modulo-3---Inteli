// TESTE PONTA A PONTA EM NAVEGADOR REAL (opcional; não faz parte do `npm test`).
// Sobe o servidor com um banco temporário (seed completo), abre um Chromium de verdade e CLICA
// como uma pessoa faria: login, registrar crianças, marcar ausente, alterar, encerrar, painel,
// Administração (inclusive a janela de troca de PIN). Falha se qualquer erro de JavaScript aparecer.
//
// Como rodar (na raiz do projeto):
//   npm install --no-save puppeteer-core @sparticuz/chromium
//   node testes/e2e-navegador.js
// Variáveis:  CHROME_PATH=/caminho/do/chrome  (usa o Chrome já instalado, em vez do @sparticuz/chromium)
//             CAPTURAS=pasta                   (salva PNGs das telas nessa pasta)

const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const RAIZ = path.join(__dirname, '..');
const PORTA = process.env.PORTA_E2E || (3100 + Math.floor(Math.random() * 800)); // porta aleatória: rodadas seguidas não colidem
const BASE = `http://localhost:${PORTA}`;
const BANCO = path.join(os.tmpdir(), `lab-e2e-${process.pid}.db`);
const CAPTURAS = process.env.CAPTURAS || null;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0, servidor, navegador, paginaAtual;
const errosJs = [];
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA ') + msg); if (!cond) falhas++; };

async function abrirNavegador() {
  const puppeteer = require('puppeteer-core');
  if (process.env.CHROME_PATH) return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'shell', args: ['--no-sandbox'] });
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

async function novaPagina(mobile = true) {
  const page = await navegador.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1100, height: 900, deviceScaleFactor: 1 });
  paginaAtual = page;
  page.on('pageerror', (e) => errosJs.push(`${e.message}`));
  page.on('dialog', (d) => d.accept());   // confirm() de "Limpar registro"
  return page;
}
async function foto(page, nome, opcoes = {}) {
  if (!CAPTURAS) return;
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await esperar(250);
  await page.screenshot({ path: path.join(CAPTURAS, `${nome}.png`), ...opcoes });
}
const pronto = (page, fn, arg) => page.waitForFunction(fn, { timeout: 8000 }, arg);
const textoDe = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
const contar = (page, sel) => page.$$eval(sel, (l) => l.length);

async function clicarCard(page, id) {
  await page.$eval(`.card-crianca[data-id="${id}"]`, (e) => e.scrollIntoView({ block: 'center' }));
  await page.click(`.card-crianca[data-id="${id}"]`);
  await pronto(page, () => document.querySelector('.folha'));
}
async function tocarTile(page, nomeCategoria) {
  // o aviso do cartão anterior pode ainda estar na tela: espera um aviso com texto NOVO
  const antes = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  await page.click(`.folha [data-cat="${nomeCategoria}"]`);
  await pronto(page, () => !document.querySelector('.folha'));
  await page.waitForFunction((a) => { const t = document.querySelector('.toast'); return t && t.textContent !== a; }, { timeout: 8000 }, antes);
}
const idsCards = (page, classe) => page.$$eval(`.card-crianca.${classe}`, (l) => l.map((e) => Number(e.dataset.id)));

async function main() {
  // ---------- servidor com banco temporário e seed completo ----------
  const env = { ...process.env, CAMINHO_BANCO_TESTE: BANCO, PORTA };
  execFileSync('node', [path.join(RAIZ, 'backend/db/seed.js')], { env, stdio: 'ignore' });
  servidor = spawn('node', [path.join(RAIZ, 'backend/server.js')], { env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {            // espera o servidor responder (em vez de um tempo fixo)
    try { if ((await fetch(`${BASE}/api/auth/usuarios`)).ok) break; } catch {}
    await esperar(200);
  }
  navegador = await abrirNavegador();

  // ============================== COORDENADORA ==============================
  console.log('== Login e escolha da turma ==');
  let page = await novaPagina();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  ok(page.url().endsWith('00-login.html'), 'a raiz leva à tela de login');
  ok((await contar(page, '#lista-usuarios .cartao')) === 2, 'login: 2 cartões de pessoa (administrador não aparece)');
  await foto(page, '01-perfil');

  await page.click('#lista-usuarios [data-id="1"]');
  await pronto(page, () => location.pathname.endsWith('01-entrada.html') && document.querySelectorAll('#lista-turmas .cartao').length === 2);
  ok(/Marli/.test(await textoDe(page, '#saudacao')), 'turma: saudação usa o nome da sessão');
  ok((await contar(page, '#lista-turmas .cartao')) === 2, 'turma: 2 turmas');
  await page.click('#lista-turmas [data-id="2"]');                    // Turma B (sem sessões no ciclo atual)
  await pronto(page, () => /Abrir turma/.test(document.querySelector('#btn-abrir').textContent));
  await foto(page, '02-turma');
  await page.click('#btn-abrir');

  console.log('== Registro: uma tela só ==');
  await pronto(page, () => document.querySelectorAll('.card-crianca').length === 30);
  ok(/0\/30/.test(await textoDe(page, '#anel-num')), 'registro: 30 crianças, nenhuma resolvida');
  ok((await contar(page, '.card-crianca.pendente')) === 30, 'todas começam pendentes');
  ok((await page.$eval('#btn-encerrar', (b) => b.disabled)) === true, 'encerrar fica desativado até existir 1 registro');

  const pendentes = await idsCards(page, 'pendente');

  // 1ª criança: o caso que ANTES falhava (categoria de saúde) — e mede a velocidade (2 toques)
  const t0 = Date.now();
  await clicarCard(page, pendentes[0]);
  await foto(page, '04-folha-nova');
  await tocarTile(page, 'Profissional de saúde');
  const ms1 = Date.now() - t0;
  ok((await contar(page, '.card-crianca.registrado')) === 1, 'categoria "Profissional de saúde" agora grava (bug anterior)');
  ok(/🩺/.test(await page.$eval(`.card-crianca[data-id="${pendentes[0]}"]`, (e) => e.textContent)), 'o cartão mostra o ícone da categoria');
  ok(await page.$eval('.toast', (t) => /Saúde/.test(t.textContent)), 'aparece o aviso de confirmação ("salva sozinho")');

  // demais registros: 2 toques cada, variando as categorias; um deles com "como estava" (estado observado)
  const cats = ['Tecnologia', 'Professor(a)', 'Esporte profissional', 'Artista/Música', 'Policial/Bombeiro(a)', 'Empreendedor(a)/Comércio',
    'Outra área de serviço público', 'Tecnologia', 'Ainda não declarou', 'Professor(a)', 'Tecnologia'];
  const tInicio = Date.now();
  for (let i = 0; i < cats.length; i++) {
    await clicarCard(page, pendentes[i + 1]);
    if (i === 2) await page.click('.folha [data-estado="Concentrada(o)"]');       // opcional, antes de salvar
    await tocarTile(page, cats[i]);
  }
  const porCrianca = Math.round((Date.now() - tInicio) / cats.length);
  console.log(`   (medição técnica no navegador: ~${porCrianca} ms por criança, 2 toques — NÃO é o tempo de uma pessoa)`);
  ok((await contar(page, '.card-crianca.registrado')) === 12, '12 crianças registradas');
  ok(await page.$eval(`.card-crianca[data-id="${pendentes[3]}"]`, (e) => /🎯/.test(e.textContent)), '"como estava" opcional salvo junto e exibido no cartão');
  ok((await page.$eval(`.card-crianca[data-id="${pendentes[9]}"]`, (e) => /Ainda não declarou/.test(e.textContent))), '"Ainda não declarou" conta como registrado');

  console.log('== Criança que não veio: a pessoa não fica presa ==');
  for (let i = 12; i < 15; i++) {
    await clicarCard(page, pendentes[i]);
    await page.click('.folha [data-acao="ausente"]');
    await page.waitForFunction((n) => !document.querySelector('.folha') && document.querySelectorAll('.card-crianca.ausente').length === n, { timeout: 8000 }, i - 11);
  }
  ok((await contar(page, '.card-crianca.ausente')) === 3, '3 crianças marcadas como "não veio hoje"');
  ok(/15\/30/.test(await textoDe(page, '#anel-num')), 'o anel de progresso conta registradas + ausentes (15/30)');

  console.log('== Alterar um registro e filtro de pendentes ==');
  await clicarCard(page, pendentes[0]);                                // já registrada: abre em modo "alterar"
  ok(/Alterar o registro/.test(await textoDe(page, '.folha h2')), 'tocar numa registrada abre "Alterar o registro"');
  await page.click('.folha [data-perc="sim"]');                        // percurso agora é opcional e fica aqui
  await pronto(page, () => document.querySelector('.folha [data-perc="sim"].sel'));
  await foto(page, '05-folha-alterar');
  await tocarTile(page, 'Tecnologia');
  ok(await page.$eval(`.card-crianca[data-id="${pendentes[0]}"]`, (e) => /💻/.test(e.textContent)), 'alteração salva e o cartão muda para 💻');
  await page.click('#f-pendentes');
  ok((await contar(page, '.card-crianca')) === 15, 'filtro "Pendentes" mostra só as 15 que faltam');
  await page.click('#f-todas');

  console.log('== Sair e voltar: nada se perde ==');
  await page.goto(`${BASE}/telas/01-entrada.html`, { waitUntil: 'networkidle0' });
  await pronto(page, () => /Em andamento/.test(document.querySelector('#lista-turmas').textContent));
  ok(/12 registradas/.test(await textoDe(page, '#lista-turmas')), 'a tela de turmas mostra a sessão em andamento (12 registradas)');
  ok(/Continuar registro/.test(await textoDe(page, '#btn-abrir')), 'o botão vira "Continuar registro"');
  await foto(page, '03-turma-em-andamento');
  await page.click('#btn-abrir');
  await pronto(page, () => document.querySelectorAll('.card-crianca').length === 30);
  ok((await contar(page, '.card-crianca.registrado')) === 12 && (await contar(page, '.card-crianca.ausente')) === 3, 'ao voltar, tudo continua salvo');
  ok(/Continuando de onde você parou/.test(await textoDe(page, '#faixa')), 'banner "continuando de onde você parou"');
  await foto(page, '06-registro');

  console.log('== Encerrar SEM registrar todo mundo ==');
  await page.click('#btn-encerrar');
  await pronto(page, () => document.querySelector('.folha'));
  const chips = await page.$$eval('.resumo-chip b', (l) => l.map((e) => e.textContent));
  ok(chips.join(',') === '12,3,15', 'resumo ao encerrar: 12 registradas, 3 ausentes, 15 pendentes');
  ok((await page.$eval('#btn-confirmar', (b) => b.disabled)) === true, 'confirmar só habilita depois de escolher quem conduziu');
  await foto(page, '07-encerrar');
  await page.click('.folha [data-expo="Educador(a) responsável"]');
  ok((await page.$eval('#btn-confirmar', (b) => b.disabled)) === true, 'com pendentes, também exige dizer o que aconteceu com elas (decisão irreversível, sem pré-seleção)');
  await page.click('.folha [data-pend="ausentes"]');
  await pronto(page, () => !document.querySelector('#btn-confirmar').disabled);
  await page.click('#btn-confirmar');
  await pronto(page, () => location.pathname.endsWith('06-confirmacao.html') && document.querySelector('#v-reg').textContent !== '–');
  ok((await textoDe(page, '#v-reg')) === '12' && (await textoDe(page, '#v-aus')) === '18', 'confirmação: 12 registradas e 18 ausentes (as 15 pendentes viraram ausentes)');
  ok(/s por criança/.test(await textoDe(page, '#v-ritmo')), 'mostra o ritmo por criança');
  await foto(page, '08-confirmacao');

  console.log('== Painel (dados reais da sessão) ==');
  await page.click('#btn-painel');
  await pronto(page, () => location.pathname.endsWith('07-painel.html') && document.querySelector('#corpo .kpi-pequeno'));
  await page.select('#select-turma', '2');
  await pronto(page, () => document.querySelectorAll('#corpo .barra-emoji').length >= 4);
  ok(/\d+%/.test(await textoDe(page, '#corpo .kpi-pequeno')), 'painel: cobertura em % (sobre quem veio)');
  ok((await page.$eval('#corpo', (e) => e.textContent)).includes('Tecnologia'), 'painel: categorias com ícone');
  ok((await contar(page, '#btn-exportar')) === 1 && (await page.$eval('#btn-exportar', (b) => b.style.display)) === 'block', 'coordenadora com permissão vê "Exportar"');
  await foto(page, '09-painel', { fullPage: true });
  await page.goto(`${BASE}/telas/08-exportacao.html`, { waitUntil: 'networkidle0' });
  await pronto(page, () => document.querySelector('#btn-pdf'));
  ok(!/Ana|Bruno|Camila/.test(await textoDe(page, '#conteudo')), 'exportação sem nome de criança');
  await foto(page, '10-exportacao', { fullPage: true });
  await page.close();

  // ============================== EDUCADORA ==============================
  console.log('== Educadora voluntária: registra, mas não vê painel ==');
  page = await novaPagina();
  await page.goto(`${BASE}/telas/00-login.html`, { waitUntil: 'networkidle0' });
  await page.click('#lista-usuarios [data-id="2"]');
  await pronto(page, () => document.querySelectorAll('#lista-turmas .cartao').length === 2);
  ok((await page.$eval('#btn-painel', (b) => getComputedStyle(b).display)) === 'none', 'educadora não vê "Painel e exportação"');
  await page.click('#btn-abrir');
  await pronto(page, () => document.querySelectorAll('.card-crianca').length === 30);
  const pend = await idsCards(page, 'pendente');
  await clicarCard(page, pend[0]);
  await tocarTile(page, 'Artista/Música');
  ok((await contar(page, '.card-crianca.registrado')) >= 1, 'educadora consegue registrar');
  await page.goto(`${BASE}/telas/07-painel.html`, { waitUntil: 'networkidle0' });
  ok(/só para Coordenadora/.test(await textoDe(page, '.conteudo')), 'painel bloqueado para educadora');
  await page.close();

  // ============================== ADMINISTRADOR ==============================
  console.log('== Administração (computador) ==');
  page = await novaPagina(false);
  await page.goto(`${BASE}/telas/00-login.html`, { waitUntil: 'networkidle0' });
  await page.click('a[href="00b-admin-login.html"]');
  await pronto(page, () => document.querySelectorAll('#sel-admin option').length === 1);
  await page.type('#pin', '0000'); await page.click('#btn-entrar');
  await pronto(page, () => /PIN incorreto/.test(document.querySelector('#mensagem').textContent));
  ok(true, 'PIN errado mostra "PIN incorreto" na tela');
  await page.type('#pin', '1234'); await page.click('#btn-entrar');
  await pronto(page, () => location.pathname.endsWith('admin.html') && document.querySelectorAll('#kpis .kpi').length === 7);
  ok((await contar(page, '#kpis .kpi')) === 7, 'Administração: 7 indicadores');
  ok((await contar(page, '#alertas .alerta.critico')) === 1, 'alerta de PIN provisório');
  ok((await contar(page, '#tab-sessoes tr')) >= 3, '"Cobertura de registro por sessão (%)": tabela por sessão (slide 11)');
  ok(/Turma B/.test(await textoDe(page, '#tab-sessoes')), 'a sessão que acabou de ser encerrada aparece na lista');
  await foto(page, '11-admin-visao', { fullPage: true });

  await page.click('[data-aba="pessoas"]');
  await pronto(page, () => document.querySelectorAll('#tab-pessoas tr').length === 4);
  ok(/Pode exportar/.test(await textoDe(page, '#tab-pessoas')), 'Pessoas: coluna "Pode exportar" (slide 11: quem exporta)');
  ok((await contar(page, '#tab-turmas-cad tr')) === 3, 'Pessoas: turmas cadastradas (slide 11)');
  const linhaEducadora = await page.evaluateHandle(() => [...document.querySelectorAll('#tab-pessoas tr')].find((r) => /Educadora Volunt/.test(r.textContent)));
  await (await linhaEducadora.asElement().$('input[type=checkbox]')).click();
  await pronto(page, () => [...document.querySelectorAll('#tab-pessoas tr')].find((r) => /Educadora Volunt/.test(r.textContent)).textContent.includes('Sim'));
  ok(true, 'administrador liberou a exportação para a educadora (vale na hora)');
  await foto(page, '12-admin-pessoas', { fullPage: true });

  // (já estamos na aba Pessoas; clicar na aba de novo recarregaria a tabela no meio do clique)
  await page.evaluate(() => [...document.querySelectorAll('#tab-pessoas button')].find((b) => /Trocar meu PIN/.test(b.textContent)).click());
  await pronto(page, () => document.querySelector('#dlg-pin[open]'));
  await page.type('#dlg-atual', '1234'); await page.type('#dlg-novo', '482913'); await page.type('#dlg-conf', '482913');
  await foto(page, '13-admin-trocar-pin');
  await page.evaluate(() => salvarPin());
  await pronto(page, () => !document.querySelector('#dlg-pin[open]'));
  await page.click('[data-aba="visao"]');
  await pronto(page, () => document.querySelectorAll('#alertas .alerta.critico').length === 0);
  ok(true, 'janela de troca de PIN funciona e o alerta crítico some');
  await page.close();

  // ============================== resultado ==============================
  ok(errosJs.length === 0, `nenhum erro de JavaScript em nenhuma tela ${errosJs.length ? '→ ' + errosJs.join(' | ') : ''}`);
  console.log(falhas === 0 ? '\nTODAS AS VERIFICAÇÕES NO NAVEGADOR PASSARAM' : `\n${falhas} VERIFICAÇÃO(ÕES) FALHARAM`);
}

main().catch(async (e) => {
  console.error('ERRO NO TESTE:', e.message); falhas++;
  // diagnóstico: guarda a tela e o que estava aberto no momento da falha
  try {
    if (paginaAtual) {
      fs.mkdirSync(CAPTURAS || os.tmpdir(), { recursive: true });
      await paginaAtual.screenshot({ path: path.join(CAPTURAS || os.tmpdir(), 'erro.png') });
      console.error('   URL:', paginaAtual.url(), '| folha aberta?', await paginaAtual.evaluate(() => !!document.querySelector('.folha')));
    }
  } catch {}
})
  .finally(async () => {
    if (navegador) await navegador.close();
    if (servidor) servidor.kill();
    for (const f of [BANCO, `${BANCO}-journal`]) { try { fs.unlinkSync(f); } catch {} }
    process.exit(falhas === 0 ? 0 : 1);
  });
