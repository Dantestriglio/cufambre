// Carrito: guarda { id, cantidad } de cada plato en el navegador.
// Los precios y nombres siempre se toman del menú que devuelve la API.

const CLAVE = 'cufambre.carrito';
export const CANTIDAD_MAXIMA = 20;

let items = [];
const oyentes = new Set();

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    // Sin almacenamiento el carrito dura hasta recargar la página
  }
  for (const oyente of oyentes) oyente();
}

export function alCambiarCarrito(funcion) {
  oyentes.add(funcion);
}

export function cargarCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (Array.isArray(guardado)) {
      items = guardado.filter(
        (item) => Number.isInteger(item?.id) && Number.isInteger(item?.cantidad) && item.cantidad > 0
      );
    }
  } catch {
    items = [];
  }
}

export function itemsDelCarrito() {
  return items.map((item) => ({ ...item }));
}

export function cantidadDe(id) {
  return items.find((item) => item.id === id)?.cantidad ?? 0;
}

export function totalDeUnidades() {
  return items.reduce((total, item) => total + item.cantidad, 0);
}

export function cambiarCantidad(id, diferencia) {
  const actual = cantidadDe(id);
  const nueva = Math.min(CANTIDAD_MAXIMA, Math.max(0, actual + diferencia));
  if (nueva === 0) {
    items = items.filter((item) => item.id !== id);
  } else if (actual === 0) {
    items.push({ id, cantidad: nueva });
  } else {
    items = items.map((item) => (item.id === id ? { ...item, cantidad: nueva } : item));
  }
  guardar();
}

export function quitarDelCarrito(id) {
  items = items.filter((item) => item.id !== id);
  guardar();
}

export function vaciarCarrito() {
  items = [];
  guardar();
}

/** Quita los platos que ya no existen en el menú. */
export function sincronizarCarrito(idsExistentes) {
  const antes = items.length;
  items = items.filter((item) => idsExistentes.has(item.id));
  if (items.length !== antes) guardar();
}
