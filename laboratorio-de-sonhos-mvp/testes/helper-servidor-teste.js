// Sobe o servidor apontando para um banco de teste isolado, já com dado mínimo semeado
// (não usa o seed.js de desenvolvimento, que é maior).
// Ids criados: turmas 1 a 4; 1 = coordenadora, 2 = educadora, 3 = administrador (PIN 1234, provisório),
//              4 = segundo administrador (PIN 5678) usado só no teste de bloqueio por tentativas.

process.env.CAMINHO_BANCO_TESTE = process.env.CAMINHO_BANCO_TESTE;
const db = require('../backend/db/conexao');
const { hashPin } = require('../backend/seguranca');

function semear() {
  db.prepare("INSERT INTO usuarios (nome, papel, pode_exportar) VALUES ('Marli', 'coordenadora', 1)").run();
  db.prepare("INSERT INTO usuarios (nome, papel, pode_exportar) VALUES ('Educadora Voluntária', 'educadora_voluntaria', 0)").run();
  db.prepare("INSERT INTO usuarios (nome, papel, pin_hash, pin_provisorio) VALUES ('Administrador', 'administrador', ?, 1)").run(hashPin('1234'));
  db.prepare("INSERT INTO usuarios (nome, papel, pin_hash, pin_provisorio) VALUES ('Admin Bloqueio', 'administrador', ?, 0)").run(hashPin('5678'));
  // 4 turmas de 3 crianças: assim cada teste usa a sua e não depende da sessão aberta dos outros
  ['Turma Teste', 'Turma Teste 2', 'Turma Teste 3', 'Turma Teste 4'].forEach((nome) => {
    const turma = db.prepare("INSERT INTO turmas (nome, horario, tamanho_estimado) VALUES (?, '12h-14h', 3)").run(nome);
    for (let i = 0; i < 3; i++) {
      db.prepare('INSERT INTO criancas (turma_id, nome_sintetico) VALUES (?, ?)').run(turma.lastInsertRowid, `Criança ${i + 1}`);
    }
  });
  db.prepare("INSERT INTO ciclos (nome, data_inicio, data_fim) VALUES ('Ciclo Teste', '2026-01-01', NULL)").run();
}

semear();
require('../backend/server');
