// PIN do administrador: guardado com scrypt + salt (nunca em texto puro).
const crypto = require('node:crypto');

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verificarPin(pin, armazenado) {
  if (!armazenado) return false;
  const [salt, hash] = armazenado.split(':');
  const calculado = crypto.scryptSync(String(pin), salt, 32);
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

// PIN numérico de 4 a 8 dígitos (simples de digitar, mas bloqueado após 5 erros — ver auth.js)
function pinValido(pin) {
  return /^\d{4,8}$/.test(String(pin));
}

module.exports = { hashPin, verificarPin, pinValido };
