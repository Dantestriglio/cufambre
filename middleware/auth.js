/**
 * middleware/auth.js — Autenticación con JWT y control de administrador.
 *
 *   verificarToken: exige "Authorization: Bearer <token>", verifica firma y
 *                   vencimiento, y carga el usuario desde la base en req.usuario.
 *   verificarAdmin: exige que ese usuario tenga admin = true en la base.
 */
const jwt = require('jsonwebtoken');
const { authController } = require('../controllers/controllers');
const { ALGORITMO_JWT, obtenerSecretoJwt } = require('../utils/jwt');

function responderNoAutorizado(res, message) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({ message });
}

async function verificarToken(req, res, next) {
  const encabezado = req.get('Authorization');
  if (!encabezado) {
    return responderNoAutorizado(res, 'Falta el token. Enviá el encabezado Authorization: Bearer <token>');
  }

  const [esquema, token, ...sobrante] = encabezado.trim().split(/\s+/);
  if (!/^Bearer$/i.test(esquema) || !token || sobrante.length > 0) {
    return responderNoAutorizado(res, 'Formato de token inválido. Usá: Authorization: Bearer <token>');
  }

  let payload;
  try {
    // Se fija el algoritmo para no aceptar tokens firmados de otra forma (ni "none")
    payload = jwt.verify(token, obtenerSecretoJwt(), { algorithms: [ALGORITMO_JWT] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return responderNoAutorizado(res, 'Token vencido. Iniciá sesión nuevamente');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return responderNoAutorizado(res, 'Token inválido');
    }
    throw error;
  }

  if (!Number.isSafeInteger(payload.id) || payload.id <= 0) {
    return responderNoAutorizado(res, 'Token inválido');
  }

  // Los datos (incluido el rol) se leen de la base, no del token ni del cliente
  const usuario = await authController.buscarUsuarioPorId(payload.id);
  if (!usuario) {
    return responderNoAutorizado(res, 'El usuario del token ya no existe');
  }

  req.usuario = usuario; // { id, nombre, apellido, email, admin }
  return next();
}

function verificarAdmin(req, res, next) {
  if (!req.usuario) {
    return responderNoAutorizado(res, 'Se requiere iniciar sesión');
  }
  if (req.usuario.admin !== true) {
    return res.status(403).json({ message: 'Acceso denegado: se requieren permisos de administrador' });
  }
  return next();
}

module.exports = { verificarToken, verificarAdmin };
