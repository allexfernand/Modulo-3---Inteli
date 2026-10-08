// Conexão única com o banco SQLite, usando o módulo nativo node:sqlite.
// Requer Node >= 22.5 aproximadamente. Testado em Node 22.22.2 sem flag extra
// (emite um aviso de "recurso experimental" — é esperado, não é erro).

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const CAMINHO_BANCO = process.env.CAMINHO_BANCO_TESTE || path.join(__dirname, 'laboratorio.db');
const CAMINHO_SCHEMA = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(CAMINHO_BANCO);

// Aplica o schema sempre que o servidor sobe — CREATE TABLE IF NOT EXISTS é seguro para rodar repetido.
const schema = fs.readFileSync(CAMINHO_SCHEMA, 'utf-8');
db.exec(schema);

module.exports = db;
