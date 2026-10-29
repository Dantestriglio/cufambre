/**
 * services/usuariosService.js — Administración de usuarios: listar, dar o quitar
 * el rol de administrador, corregir datos y eliminar cuentas.
 *
 * Reglas para no dejar el local sin administradores ni perder la sesión propia:
 *   - un administrador no puede quitarse su propio rol;
 *   - un administrador no puede eliminar su propia cuenta.
 * Como solo otro administrador puede quitarle el rol a alguien, siempre queda al menos uno.
 */
const { usuariosController, authController, conTransaccion } = require('../controllers/controllers');
const { HttpError, CODIGOS_PG } = require('../utils/httpError');
const { esObjetoPlano, validarId, lanzarSiHayErrores } = require('../utils/validaciones');
const { validarDatosPersonales } = require('./authService');

const MENSAJE_EMAIL_DUPLICADO = 'Ya existe otro usuario registrado con ese email';

async function buscarOFallar(id) {
  const usuario = await authController.buscarUsuarioPorId(id);
  if (!usuario) {
    throw new HttpError(404, `No existe un usuario con id ${id}`);
  }
  return usuario;
}

async function listarUsuarios() {
  return usuariosController.listarUsuarios();
}

/** body = { admin: true | false }. idActor es el administrador que hace el cambio. */
async function cambiarRol(idActor, idParametro, body) {
  const id = validarId(idParametro, 'usuario');
  if (!esObjetoPlano(body) || typeof body.admin !== 'boolean') {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con "admin": true o false');
  }
  await buscarOFallar(id);
  if (id === idActor && body.admin === false) {
    throw new HttpError(409, 'No podés quitarte tus propios permisos de administrador: pedíselo a otro administrador');
  }
  return usuariosController.actualizarRol(id, body.admin);
}

/** Corrige nombre, apellido y email. El rol y la contraseña no se tocan acá. */
async function actualizarUsuario(idParametro, body) {
  const id = validarId(idParametro, 'usuario');
  if (!esObjetoPlano(body)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con nombre, apellido y email');
  }
  const errores = [];
  const datos = validarDatosPersonales(body, errores);
  lanzarSiHayErrores(errores);

  await buscarOFallar(id);
  if (await usuariosController.emailEnUso(datos.email, id)) {
    throw new HttpError(409, MENSAJE_EMAIL_DUPLICADO);
  }
  try {
    return await usuariosController.actualizarDatos(id, datos);
  } catch (error) {
    if (error.code === CODIGOS_PG.VIOLACION_UNICA) throw new HttpError(409, MENSAJE_EMAIL_DUPLICADO);
    throw error;
  }
}

/** Elimina la cuenta y, en la misma transacción, todos sus pedidos. */
async function eliminarUsuario(idActor, idParametro) {
  const id = validarId(idParametro, 'usuario');
  if (id === idActor) {
    throw new HttpError(409, 'No podés eliminar tu propia cuenta mientras la estás usando');
  }
  const pedidosEliminados = await conTransaccion(async (cliente) => {
    const cantidad = await usuariosController.eliminarPedidosDelUsuario(id, cliente);
    const eliminado = await usuariosController.eliminarUsuario(id, cliente);
    if (!eliminado) {
      throw new HttpError(404, `No existe un usuario con id ${id}`);
    }
    return cantidad;
  });
  return { message: 'Usuario eliminado correctamente', pedidos_eliminados: pedidosEliminados };
}

module.exports = { listarUsuarios, cambiarRol, actualizarUsuario, eliminarUsuario };
