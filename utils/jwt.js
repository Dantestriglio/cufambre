/**
 * Configuración común de los JWT: la usan authService (para firmarlos) y
 * middleware/auth.js (para verificarlos).
 */
const ALGORITMO_JWT = 'HS256';
const DURACION_TOKEN = '30m';

/** Devuelve JWT_SECRET o lanza un error si no está configurada. */
function obtenerSecretoJwt() {
  const secreto = (process.env.JWT_SECRET ?? '').trim();
  if (secreto === '' || /^\*+$/.test(secreto)) {
    throw new Error('Falta configurar JWT_SECRET en el archivo .env (usá un valor largo y aleatorio).');
  }
  return secreto;
}

module.exports = { ALGORITMO_JWT, DURACION_TOKEN, obtenerSecretoJwt };
