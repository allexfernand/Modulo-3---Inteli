// Tela 00 — login. Coordenadora e Educadora: um toque, sem senha (coerente com a persona).
// Administrador: exige PIN, com bloqueio após 5 erros. Em todos os casos o papel fica
// gravado na SESSÃO DO SERVIDOR; rotas protegidas leem dali, nunca do cliente.

const express = require('express');
const db = require('../db/conexao');
const { exigirLogin } = require('./middlewareAcesso');
const { verificarPin } = require('../seguranca');
const { registrarAuditoria } = require('../auditoria');
const router = express.Router();

const MAX_FALHAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;
const tentativas = new Map(); // usuarioId -> { falhas, bloqueadoAte }

// Cartões da Tela 00: só pessoas ativas que registram (administradores entram por outra porta)
router.get('/usuarios', (req, res) => {
  const linhas = db.prepare("SELECT id, nome, papel FROM usuarios WHERE ativo = 1 AND papel != 'administrador' ORDER BY papel, nome").all();
  res.json(linhas);
});

// Tela de acesso administrativo: só id e nome (nunca hash/PIN)
router.get('/administradores', (req, res) => {
  const linhas = db.prepare("SELECT id, nome FROM usuarios WHERE ativo = 1 AND papel = 'administrador' ORDER BY nome").all();
  res.json(linhas);
});

router.post('/login', (req, res) => {
  const { usuarioId, pin } = req.body || {};
  const usuario = db.prepare('SELECT id, nome, papel, ativo, pin_hash FROM usuarios WHERE id = ?').get(usuarioId);
  if (!usuario || !usuario.ativo) {
    return res.status(400).json({ erro: 'Usuário não encontrado ou inativo.' });
  }

  if (usuario.papel === 'administrador') {
    const estado = tentativas.get(usuario.id) || { falhas: 0, bloqueadoAte: 0 };
    if (estado.bloqueadoAte > Date.now()) {
      const minutos = Math.ceil((estado.bloqueadoAte - Date.now()) / 60000);
      return res.status(429).json({ erro: `Muitas tentativas incorretas. Tente de novo em ${minutos} min.` });
    }
    if (!pin || !verificarPin(pin, usuario.pin_hash)) {
      estado.falhas += 1;
      if (estado.falhas >= MAX_FALHAS) {
        estado.bloqueadoAte = Date.now() + BLOQUEIO_MS;
        estado.falhas = 0;
        registrarAuditoria(usuario.id, 'login_admin_bloqueado');
      } else {
        registrarAuditoria(usuario.id, 'login_admin_falhou');
      }
      tentativas.set(usuario.id, estado);
      return res.status(401).json({ erro: 'PIN incorreto.' });
    }
    tentativas.delete(usuario.id);
  }

  // regenerate: nova sessão a cada login (evita reaproveitar sessão anterior)
  req.session.regenerate((erro) => {
    if (erro) return res.status(500).json({ erro: 'Falha ao iniciar a sessão.' });
    req.session.usuarioId = usuario.id;
    req.session.nome = usuario.nome;
    req.session.papel = usuario.papel;
    if (usuario.papel === 'administrador') registrarAuditoria(usuario.id, 'login_admin');
    res.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel } });
  });
});

// Quem está logado (a Tela 01 usa isso para a saudação, em vez de nome fixo)
router.get('/me', exigirLogin, (req, res) => {
  res.json({ id: req.session.usuarioId, nome: req.session.nome, papel: req.session.papel, podeExportar: req.session.podeExportar });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
