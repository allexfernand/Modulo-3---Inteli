// Helper compartilhado por todas as telas para falar com a API.
// Guarda estado mínimo de navegação em sessionStorage (turma/sessão atual),
// porque cada tela é um HTML separado (sem framework de rotas de front-end).

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`/api${caminho}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opcoes
  });
  const dados = await resposta.json().catch(() => ({}));
  // sessão expirou ou pessoa foi desativada: volta ao login (exceto na própria tentativa de login)
  if (resposta.status === 401 && !caminho.startsWith('/auth/login')) {
    window.location.href = window.__LOGIN__ || '00-login.html';
  }
  if (!resposta.ok) {
    const erro = new Error(dados.erro || 'Erro na requisição');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

const estado = {
  get(chave) { return JSON.parse(sessionStorage.getItem(chave) || 'null'); },
  set(chave, valor) { sessionStorage.setItem(chave, JSON.stringify(valor)); },
  limpar() { sessionStorage.clear(); }
};

function irPara(tela) {
  window.location.href = tela;
}

function formatarSegundos(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}min ${seg}s`;
}

// Escapa texto vindo do banco antes de colocar em innerHTML (nomes de equipe são digitados na Administração)
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Data local no formato AAAA-MM-DD (toISOString usaria UTC e viraria o dia à noite no Brasil)
function dataLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- Vocabulário visual (os NOMES são exatamente os aceitos pelo banco) ----------
const SEM_DECLARACAO = 'Ainda não declarou';
const CATEGORIAS = [
  { nome: 'Professor(a)', emoji: '👩‍🏫', curto: 'Professor(a)' },
  { nome: 'Profissional de saúde', emoji: '🩺', curto: 'Saúde', sub: 'médico, enfermeiro' },
  { nome: 'Policial/Bombeiro(a)', emoji: '🚒', curto: 'Policial / Bombeiro(a)' },
  { nome: 'Esporte profissional', emoji: '⚽', curto: 'Esporte' },
  { nome: 'Artista/Música', emoji: '🎨', curto: 'Arte e música' },
  { nome: 'Tecnologia', emoji: '💻', curto: 'Tecnologia' },
  { nome: 'Empreendedor(a)/Comércio', emoji: '🛍️', curto: 'Empreender, comércio' },
  { nome: 'Outra área de serviço público', emoji: '🏛️', curto: 'Serviço público' }
];
const ESTADOS = [
  { nome: 'Animada(o)', emoji: '😄', curto: 'Animada' }, { nome: 'Concentrada(o)', emoji: '🎯', curto: 'Concentrada' },
  { nome: 'Quieta(o)', emoji: '🤫', curto: 'Quieta' }, { nome: 'Frustrada(o)', emoji: '😣', curto: 'Frustrada' }
];
const EXPOSICOES = [
  { nome: 'Educador(a) responsável', emoji: '🧑‍🏫' },
  { nome: 'Oficina externa convidada', emoji: '🎤' },
  { nome: 'Atividade em dupla de educadores', emoji: '🤝' }
];
function infoCategoria(nome) {
  if (nome === SEM_DECLARACAO) return { nome, emoji: '🤔', curto: 'Ainda não declarou' };
  return CATEGORIAS.find((c) => c.nome === nome) || { nome, emoji: '•', curto: nome };
}
function infoEstado(nome) { return ESTADOS.find((e) => e.nome === nome) || null; }

// Avatar com inicial e cor estável por nome (NUNCA foto de criança — Regra 4)
const CORES_AVATAR = ['#066D73', '#6C4AB6', '#C2410C', '#1D6FA5', '#B0366B', '#4D7C0F', '#8A5A00', '#2E2640'];
function corAvatar(nome) { let h = 0; for (const ch of String(nome)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CORES_AVATAR[h % CORES_AVATAR.length]; }
function inicial(nome) { return esc(String(nome).trim().charAt(0).toUpperCase()); }
