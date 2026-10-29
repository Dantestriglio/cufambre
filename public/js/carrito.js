// Carrito: guarda en el navegador cada línea del pedido como
// { id, cantidad, extras: [{ id, cantidad }], sin: [id], aclaracion }.
// Dos líneas del mismo plato con la misma personalización se suman en una sola.
// Los precios y nombres siempre se toman del menú que devuelve la API.

const CLAVE = 'kingsciarra.carrito';
export const CANTIDAD_MAXIMA = 20;

let lineas = [];
const oyentes = new Set();

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lineas));
  } catch {
    // Sin almacenamiento el carrito dura hasta recargar la página
  }
  for (const oyente of oyentes) oyente();
}

/** Deja la personalización en una forma única: extras y quitados ordenados por id, sin vacíos. */
export function normalizarLinea({ id, cantidad = 1, extras = [], sin = [], aclaracion = null }) {
  return {
    id,
    cantidad: Math.min(CANTIDAD_MAXIMA, Math.max(1, cantidad)),
    extras: extras.filter((extra) => extra.cantidad > 0).map(({ id: idExtra, cantidad: unidades }) => ({ id: idExtra, cantidad: unidades })).sort((a, b) => a.id - b.id),
    sin: [...new Set(sin)].sort((a, b) => a - b),
    aclaracion: aclaracion?.trim() || null,
  };
}

/** Identifica la personalización de una línea (sin la cantidad). */
export function claveDe(linea) {
  return JSON.stringify([linea.id, linea.extras, linea.sin, linea.aclaracion]);
}

const esEntero = (valor) => Number.isInteger(valor) && valor > 0;

export function alCambiarCarrito(funcion) {
  oyentes.add(funcion);
}

export function cargarCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (Array.isArray(guardado)) {
      lineas = guardado
        .filter((linea) => esEntero(linea?.id) && esEntero(linea?.cantidad))
        .map((linea) =>
          normalizarLinea({
            ...linea,
            extras: Array.isArray(linea.extras) ? linea.extras.filter((extra) => esEntero(extra?.id) && esEntero(extra?.cantidad)) : [],
            sin: Array.isArray(linea.sin) ? linea.sin.filter(esEntero) : [],
            aclaracion: typeof linea.aclaracion === 'string' ? linea.aclaracion : null,
          })
        );
    }
  } catch {
    lineas = [];
  }
}

export function lineasDelCarrito() {
  return lineas.map((linea) => structuredClone(linea));
}

/** Unidades de un plato sumando todas sus líneas. */
export function cantidadDe(id) {
  return lineas.filter((linea) => linea.id === id).reduce((total, linea) => total + linea.cantidad, 0);
}

/** Índice de la línea sin personalizar de un plato, o -1. */
function indiceSimple(id) {
  const clave = claveDe(normalizarLinea({ id }));
  return lineas.findIndex((linea) => claveDe(linea) === clave);
}

/** Cantidad de la línea sin personalizar (la que manejan los botones + y − del menú). */
export function cantidadSimpleDe(id) {
  return lineas[indiceSimple(id)]?.cantidad ?? 0;
}

/** Agrega una línea; si ya hay una igual, suma las cantidades. */
export function agregarLinea(datos, { notificar = true } = {}) {
  const nueva = normalizarLinea(datos);
  const existente = lineas.find((linea) => claveDe(linea) === claveDe(nueva));
  if (existente) existente.cantidad = Math.min(CANTIDAD_MAXIMA, existente.cantidad + nueva.cantidad);
  else lineas.push(nueva);
  if (notificar) guardar();
}

/** Reemplaza la línea de la posición `indice` (al editar una personalización desde el carrito). */
export function reemplazarLinea(indice, datos) {
  if (!lineas[indice]) return;
  lineas.splice(indice, 1);
  const nueva = normalizarLinea(datos);
  const existente = lineas.find((linea) => claveDe(linea) === claveDe(nueva));
  if (existente) existente.cantidad = Math.min(CANTIDAD_MAXIMA, existente.cantidad + nueva.cantidad);
  else lineas.splice(indice, 0, nueva);
  guardar();
}

export function cambiarCantidadLinea(indice, diferencia) {
  const linea = lineas[indice];
  if (!linea) return;
  const nueva = Math.min(CANTIDAD_MAXIMA, linea.cantidad + diferencia);
  if (nueva <= 0) lineas.splice(indice, 1);
  else linea.cantidad = nueva;
  guardar();
}

/** + y − del menú: actúan sobre la línea sin personalizar del plato. */
export function cambiarCantidadSimple(id, diferencia) {
  const indice = indiceSimple(id);
  if (indice === -1) {
    if (diferencia > 0) agregarLinea({ id, cantidad: diferencia });
    return;
  }
  cambiarCantidadLinea(indice, diferencia);
}

export function vaciarCarrito() {
  lineas = [];
  guardar();
}

/** Guarda varias líneas juntas y avisa una sola vez. */
export function agregarLineas(lista) {
  for (const datos of lista) agregarLinea(datos, { notificar: false });
  guardar();
}

/**
 * Quita los platos que ya no existen y depura cada personalización con
 * `depurar(linea)` (por ejemplo, extras que el plato ya no ofrece).
 */
export function sincronizarCarrito(idsExistentes, depurar = (linea) => linea) {
  const antes = JSON.stringify(lineas);
  const depuradas = lineas.filter((linea) => idsExistentes.has(linea.id)).map((linea) => normalizarLinea(depurar(linea)));
  lineas = [];
  for (const linea of depuradas) agregarLinea(linea, { notificar: false });
  if (JSON.stringify(lineas) !== antes) guardar();
}
