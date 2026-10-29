/**
 * services/platosService.js — Lógica de negocio del catálogo de platos.
 */
const { platosController } = require('../controllers/controllers');
const { HttpError, esErrorDeClaveForanea } = require('../utils/httpError');
const {
  esObjetoPlano,
  esEnteroEnRango,
  validarId,
  validarTexto,
  lanzarSiHayErrores,
} = require('../utils/validaciones');

const TIPOS_VALIDOS = ['principal', 'combo', 'postre', 'bebida'];

function normalizarTipo(tipo) {
  return typeof tipo === 'string' ? tipo.trim().toLowerCase() : tipo;
}

/** Valida el cuerpo de POST y PUT: tipo, nombre, precio y descripcion son obligatorios. */
function validarDatosPlato(body) {
  if (!esObjetoPlano(body)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con tipo, nombre, precio y descripcion');
  }
  const errores = [];

  const tipo = normalizarTipo(body.tipo);
  if (!TIPOS_VALIDOS.includes(tipo)) {
    errores.push(`tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  const nombre = validarTexto(body.nombre, 'nombre', 70, errores);
  if (!esEnteroEnRango(body.precio, 0)) {
    errores.push('precio debe ser un número entero mayor o igual a 0');
  }
  const descripcion = validarTexto(body.descripcion, 'descripcion', 400, errores);

  lanzarSiHayErrores(errores);
  // El id nunca se toma del cuerpo: lo genera la base o viene en la URL
  return { tipo, nombre, precio: body.precio, descripcion };
}

async function listarPlatos() {
  return platosController.listarPlatos();
}

async function obtenerPlato(idParametro) {
  const id = validarId(idParametro, 'plato');
  const plato = await platosController.buscarPlatoPorId(id);
  if (!plato) {
    throw new HttpError(404, `No existe un plato con id ${id}`);
  }
  return plato;
}

async function listarPlatosPorTipo(tipoParametro) {
  const tipo = normalizarTipo(tipoParametro);
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new HttpError(400, `Tipo de plato inválido. Los tipos válidos son: ${TIPOS_VALIDOS.join(', ')}`);
  }
  return platosController.listarPlatosPorTipo(tipo);
}

async function crearPlato(body) {
  const datos = validarDatosPlato(body);
  return platosController.crearPlato(datos);
}

async function actualizarPlato(idParametro, body) {
  const plato = await obtenerPlato(idParametro); // 400 si el id es inválido, 404 si no existe
  const datos = validarDatosPlato(body); // 400 si faltan datos o son inválidos
  const actualizado = await platosController.actualizarPlato(plato.id, datos);
  if (!actualizado) {
    throw new HttpError(404, `No existe un plato con id ${plato.id}`);
  }
  return actualizado;
}

async function eliminarPlato(idParametro) {
  const id = validarId(idParametro, 'plato');
  let eliminado;
  try {
    eliminado = await platosController.eliminarPlato(id);
  } catch (error) {
    // La clave foránea de PlatosXPedidos impide borrar un plato que ya se pidió
    if (esErrorDeClaveForanea(error)) {
      throw new HttpError(409, 'No se puede eliminar el plato porque forma parte de uno o más pedidos');
    }
    throw error;
  }
  if (!eliminado) {
    throw new HttpError(404, `No existe un plato con id ${id}`);
  }
  return { message: 'Plato eliminado correctamente' };
}

module.exports = {
  TIPOS_VALIDOS,
  listarPlatos,
  obtenerPlato,
  listarPlatosPorTipo,
  crearPlato,
  actualizarPlato,
  eliminarPlato,
};
