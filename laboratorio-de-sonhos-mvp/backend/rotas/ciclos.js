const express = require('express');
const db = require('../db/conexao');
const router = express.Router();

router.get('/', (req, res) => {
  const ciclos = db.prepare('SELECT id, nome, data_inicio, data_fim FROM ciclos ORDER BY data_inicio DESC').all();
  res.json(ciclos);
});

module.exports = router;
