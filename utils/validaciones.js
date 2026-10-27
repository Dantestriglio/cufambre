/**
 * Funciones de validación compartidas por los servicios.
 */
const { HttpError } = require('./httpError');

/** Máximo valor de una columna INTEGER en PostgreSQL. */
const MAX_ENTERO = 2147483647;

function esObjetoPlano(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** true si es un número entero (no texto) dentro de [minimo, maximo]. */
function esEnteroEnRango(valor, minimo, maximo = MAX_ENTERO) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

/**
 * Valida un id recibido en la URL: solo dígitos, mayor que 0 y dentro del
 * rango de INTEGER. Devuelve el número o lanza 400.
 */
function validarId(valor, entidad) {
  const texto = String(valor);
  const id = /^\d+$/.test(texto) ? Number(texto) : NaN;
  if (!esEnteroEnRango(id, 1)) {
    throw new HttpError(400, `El id del ${entidad} debe ser un número entero positivo`);
  }
  return id;
}

/**
 * Valida un texto obligatorio. Devuelve el texto sin espacios externos o
 * agrega el problema a la lista de errores.
 */
function validarTexto(valor, campo, maximo, errores) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    errores.push(`${campo} es obligatorio y debe ser un texto`);
    return undefined;
  }
  const texto = valor.trim();
  if (texto.length > maximo) {
    errores.push(`${campo} no puede superar los ${maximo} caracteres`);
  }
  return texto;
}

/** Lanza 400 con todos los problemas encontrados, si hay alguno. */
function lanzarSiHayErrores(errores) {
  if (errores.length > 0) {
    throw new HttpError(400, `Datos inválidos: ${errores.join('; ')}`);
  }
}

module.exports = {
  MAX_ENTERO,
  esObjetoPlano,
  esEnteroEnRango,
  validarId,
  validarTexto,
  lanzarSiHayErrores,
};
