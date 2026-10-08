// Controle de acesso. Aplicado no SERVIDOR em toda rota protegida — nunca confiar
// em parâmetro enviado pelo cliente para decidir permissão.
const db = require('../db/conexao');

// Exige sessão ativa E usuário ainda ativo. Reconsulta o banco a cada requisição, então
// desativar uma pessoa, mudar o papel ou tirar a permissão de exportar vale imediatamente.
function exigirLogin(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({ erro: 'Nenhuma sessão ativa. Faça login primeiro.' });
  }
  const usuario = db.prepare('SELECT id, nome, papel, ativo, pode_exportar FROM usuarios WHERE id = ?').get(req.session.usuarioId);
  if (!usuario || !usuario.ativo) {
    return req.session.destroy(() => res.status(401).json({ erro: 'Sessão encerrada: usuário inativo.' }));
  }
  req.session.nome = usuario.nome;
  req.session.papel = usuario.papel;
  // administrador sempre pode exportar; os demais dependem da permissão dada na Administração
  req.session.podeExportar = usuario.papel === 'administrador' || usuario.pode_exportar === 1;
  next();
}

// papeis: string ou lista de strings permitidas
function exigirPapel(papeis) {
  const permitidos = [].concat(papeis);
  return (req, res, next) => {
    exigirLogin(req, res, () => {
      if (!permitidos.includes(req.session.papel)) {
        return res.status(403).json({ erro: `Esta ação requer o papel: ${permitidos.join(' ou ')}.` });
      }
      next();
    });
  };
}

// Exportação: depende da PERMISSÃO da pessoa ("Gestão de permissões (quem exporta)", slide 11 do pitch)
function exigirExportacao(req, res, next) {
  exigirLogin(req, res, () => {
    if (!req.session.podeExportar) {
      return res.status(403).json({ erro: 'Você não tem permissão para exportar. Peça ao administrador.' });
    }
    next();
  });
}

module.exports = { exigirLogin, exigirPapel, exigirExportacao };
