/**
 * services/ingredientesService.js — Catálogo de ingredientes y qué ingredientes
 * admite cada plato (los que trae y se pueden quitar, y los extras con su máximo).
 */
const { ingredientesController, platosController, conTransaccion } = require('../controllers/controllers');
const { HttpError, CODIGOS_PG, esErrorDeClaveForanea } = require('../utils/httpError');
const {
  esObjetoPlano,
  esEnteroEnRango,
  validarId,
  validarTexto,
  lanzarSiHayErrores,
} = require('../utils/validaciones');

const MAXIMO_EXTRA = 10;
const MENSAJE_NOMBRE_DUPLICADO = 'Ya existe un ingrediente con ese nombre';

function validarDatosIngrediente(body) {
  if (!esObjetoPlano(body)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con nombre y precio');
  }
  const errores = [];
  const nombre = validarTexto(body.nombre, 'nombre', 60, errores);
  if (!esEnteroEnRango(body.precio, 0)) {
    errores.push('precio debe ser un número entero mayor o igual a 0');
  }
  if (body.disponible !== undefined && typeof body.disponible !== 'boolean') {
    errores.push('disponible debe ser true o false');
  }
  lanzarSiHayErrores(errores);
  return { nombre, precio: body.precio, disponible: body.disponible ?? true };
}

/** Traduce el error de nombre repetido (índice único sobre LOWER(nombre)) a un 409. */
async function conNombreUnico(operacion) {
  try {
    return await operacion();
  } catch (error) {
    if (error.code === CODIGOS_PG.VIOLACION_UNICA) throw new HttpError(409, MENSAJE_NOMBRE_DUPLICADO);
    throw error;
  }
}

async function listarIngredientes() {
  return ingredientesController.listarIngredientes();
}

async function crearIngrediente(body) {
  const datos = validarDatosIngrediente(body);
  return conNombreUnico(() => ingredientesController.crearIngrediente(datos));
}

async function actualizarIngrediente(idParametro, body) {
  const id = validarId(idParametro, 'ingrediente');
  const datos = validarDatosIngrediente(body);
  const actualizado = await conNombreUnico(() => ingredientesController.actualizarIngrediente(id, datos));
  if (!actualizado) {
    throw new HttpError(404, `No existe un ingrediente con id ${id}`);
  }
  return actualizado;
}

async function eliminarIngrediente(idParametro) {
  const id = validarId(idParametro, 'ingrediente');
  let eliminado;
  try {
    eliminado = await ingredientesController.eliminarIngrediente(id);
  } catch (error) {
    // Personalizaciones impide borrar un ingrediente que ya se pidió
    if (esErrorDeClaveForanea(error)) {
      throw new HttpError(
        409,
        'No se puede eliminar el ingrediente porque figura en pedidos. Podés marcarlo como no disponible.'
      );
    }
    throw error;
  }
  if (!eliminado) {
    throw new HttpError(404, `No existe un ingrediente con id ${id}`);
  }
  return { message: 'Ingrediente eliminado correctamente' };
}

// ---------- Opciones de cada plato ----------

/** Opciones de todos los platos para el menú (sin ingredientes agotados). */
async function listarOpcionesDelMenu() {
  return ingredientesController.listarOpciones({ soloDisponibles: true });
}

async function obtenerPlatoOFallar(idParametro) {
  const id = validarId(idParametro, 'plato');
  const plato = await platosController.buscarPlatoPorId(id);
  if (!plato) {
    throw new HttpError(404, `No existe un plato con id ${id}`);
  }
  return plato;
}

/** Opciones de un plato, incluidos los ingredientes agotados (campo disponible). */
async function listarOpcionesDePlato(idParametro) {
  const plato = await obtenerPlatoOFallar(idParametro);
  const opciones = await ingredientesController.listarOpcionesDePlatos([plato.id]);
  return opciones.map(({ id_plato: _idPlato, ...opcion }) => opcion);
}

/** body = { ingredientes: [{ id, incluido, maximo }] }. Devuelve [{ id, incluido, maximo }] sin repetidos. */
function validarOpciones(body) {
  if (!esObjetoPlano(body) || !Array.isArray(body.ingredientes)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con "ingredientes": [{ id, incluido, maximo }]');
  }
  const vistos = new Set();
  return body.ingredientes.map((opcion, indice) => {
    const posicion = `ingredientes[${indice}]`;
    if (!esObjetoPlano(opcion)) {
      throw new HttpError(400, `${posicion} debe ser un objeto { id, incluido, maximo }`);
    }
    if (!esEnteroEnRango(opcion.id, 1)) {
      throw new HttpError(400, `${posicion}.id debe ser un número entero positivo`);
    }
    if (vistos.has(opcion.id)) {
      throw new HttpError(400, `El ingrediente ${opcion.id} está repetido`);
    }
    vistos.add(opcion.id);
    const incluido = opcion.incluido ?? false;
    const maximo = opcion.maximo ?? 0;
    if (typeof incluido !== 'boolean') {
      throw new HttpError(400, `${posicion}.incluido debe ser true o false`);
    }
    if (!esEnteroEnRango(maximo, 0, MAXIMO_EXTRA)) {
      throw new HttpError(400, `${posicion}.maximo debe ser un número entero entre 0 y ${MAXIMO_EXTRA}`);
    }
    if (!incluido && maximo === 0) {
      throw new HttpError(400, `${posicion}: un ingrediente que no viene incluido necesita un máximo de extras mayor que 0`);
    }
    return { id: opcion.id, incluido, maximo };
  });
}

async function reemplazarOpcionesDePlato(idParametro, body) {
  const plato = await obtenerPlatoOFallar(idParametro);
  const opciones = validarOpciones(body);
  await conTransaccion(async (cliente) => {
    const existentes = await ingredientesController.buscarIdsExistentes(opciones.map((opcion) => opcion.id), cliente);
    const inexistentes = opciones.filter((opcion) => !existentes.includes(opcion.id)).map((opcion) => opcion.id);
    if (inexistentes.length > 0) {
      throw new HttpError(404, `No existen ingredientes con id ${inexistentes.join(', ')}`);
    }
    await ingredientesController.reemplazarOpcionesDePlato(plato.id, opciones, cliente);
  });
  return listarOpcionesDePlato(plato.id);
}

module.exports = {
  MAXIMO_EXTRA,
  listarIngredientes,
  crearIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
  listarOpcionesDelMenu,
  listarOpcionesDePlato,
  reemplazarOpcionesDePlato,
};
