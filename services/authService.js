/**
 * services/authService.js — Registro e inicio de sesión de usuarios.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authController } = require('../controllers/controllers');
const { HttpError, CODIGOS_PG } = require('../utils/httpError');
const { esObjetoPlano, validarTexto, lanzarSiHayErrores } = require('../utils/validaciones');
const { ALGORITMO_JWT, DURACION_TOKEN, obtenerSecretoJwt } = require('../utils/jwt');

const RONDAS_BCRYPT = 10;
const LARGO_MINIMO_PASSWORD = 6;
const BYTES_MAXIMOS_PASSWORD = 72; // bcrypt ignora todo lo que supere los 72 bytes
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hash de una contraseña inventada. Si el email no existe se compara igual
// contra este hash, así la respuesta tarda lo mismo y no revela qué emails existen.
const HASH_FICTICIO = '$2b$10$6JKJpMz2QDUaMfqbAO8xs.3jWWOxg7Lk9Eb9T.wa75JuWrZd125LO';

/** Política única para los emails: sin espacios externos y en minúsculas. */
function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

function validarRegistro(body) {
  if (!esObjetoPlano(body)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con nombre, apellido, email y password');
  }
  const errores = [];
  const nombre = validarTexto(body.nombre, 'nombre', 50, errores);
  const apellido = validarTexto(body.apellido, 'apellido', 50, errores);

  const email = normalizarEmail(body.email);
  if (typeof email !== 'string' || !FORMATO_EMAIL.test(email)) {
    errores.push('email debe tener un formato válido (por ejemplo nombre@dominio.com)');
  } else if (email.length > 256) {
    errores.push('email no puede superar los 256 caracteres');
  }

  const { password } = body;
  if (typeof password !== 'string' || password.length < LARGO_MINIMO_PASSWORD) {
    errores.push(`password debe ser un texto de al menos ${LARGO_MINIMO_PASSWORD} caracteres`);
  } else if (Buffer.byteLength(password, 'utf8') > BYTES_MAXIMOS_PASSWORD) {
    errores.push(`password no puede superar los ${BYTES_MAXIMOS_PASSWORD} caracteres`);
  }

  lanzarSiHayErrores(errores);
  return { nombre, apellido, email, password };
}

function validarLogin(body) {
  if (!esObjetoPlano(body)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con email y password');
  }
  const errores = [];
  const email = normalizarEmail(body.email);
  if (typeof email !== 'string' || email === '') errores.push('email es obligatorio');
  if (typeof body.password !== 'string' || body.password === '') errores.push('password es obligatorio');
  lanzarSiHayErrores(errores);
  return { email, password: body.password };
}

/** JWT con el payload exigido { id } y vencimiento de 30 minutos. */
function generarToken(idUsuario) {
  return jwt.sign({ id: idUsuario }, obtenerSecretoJwt(), {
    algorithm: ALGORITMO_JWT,
    expiresIn: DURACION_TOKEN,
  });
}

async function registrarUsuario(body) {
  // Solo se leen estos cuatro campos: si el cliente manda "admin" se ignora.
  const { nombre, apellido, email, password } = validarRegistro(body);

  if (await authController.buscarUsuarioPorEmail(email)) {
    throw new HttpError(409, 'Ya existe un usuario registrado con ese email');
  }

  const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
  try {
    return await authController.crearUsuario({ nombre, apellido, email, passwordHash });
  } catch (error) {
    // Dos registros simultáneos con el mismo email: lo frena la restricción UNIQUE
    if (error.code === CODIGOS_PG.VIOLACION_UNICA) {
      throw new HttpError(409, 'Ya existe un usuario registrado con ese email');
    }
    throw error;
  }
}

async function iniciarSesion(body) {
  const { email, password } = validarLogin(body);
  const usuario = await authController.buscarUsuarioPorEmail(email);

  const coincide = await bcrypt.compare(password, usuario ? usuario.password : HASH_FICTICIO);
  if (!usuario || !coincide) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }

  const { password: _hash, ...usuarioPublico } = usuario;
  return { token: generarToken(usuario.id), usuario: usuarioPublico };
}

module.exports = { registrarUsuario, iniciarSesion, generarToken, normalizarEmail };
