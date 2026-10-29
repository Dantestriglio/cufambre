// Opciones de personalización del menú (GET /platos/opciones): qué trae cada
// plato y qué extras admite. Acá solo se calcula el precio para mostrarlo;
// el precio que vale es el que calcula el servidor al crear el pedido.

let porPlato = new Map(); // id del plato → [{ id, nombre, precio, incluido, maximo }]

export function cargarOpciones(lista) {
  porPlato = new Map();
  for (const opcion of lista) {
    if (!porPlato.has(opcion.id_plato)) porPlato.set(opcion.id_plato, []);
    porPlato.get(opcion.id_plato).push(opcion);
  }
}

export function opcionesDe(idPlato) {
  return porPlato.get(idPlato) ?? [];
}

export function esPersonalizable(idPlato) {
  return opcionesDe(idPlato).length > 0;
}

/** Precio de una unidad: precio del plato + extras. Quitar ingredientes no descuenta. */
export function precioUnitario(plato, linea) {
  const opciones = opcionesDe(plato.id);
  return linea.extras.reduce((total, extra) => {
    const opcion = opciones.find((item) => item.id === extra.id);
    return total + (opcion ? opcion.precio * extra.cantidad : 0);
  }, plato.precio);
}

/** Quita de la línea los extras y quitados que el plato ya no ofrece. */
export function depurarLinea(linea) {
  const opciones = opcionesDe(linea.id);
  const buscar = (id) => opciones.find((opcion) => opcion.id === id);
  return {
    ...linea,
    extras: linea.extras
      .filter((extra) => buscar(extra.id)?.maximo > 0)
      .map((extra) => ({ ...extra, cantidad: Math.min(extra.cantidad, buscar(extra.id).maximo) })),
    sin: linea.sin.filter((id) => buscar(id)?.incluido),
  };
}

/** Nombres para mostrar la personalización de una línea del carrito. */
export function describirLinea(linea) {
  const opciones = opcionesDe(linea.id);
  const nombre = (id) => opciones.find((opcion) => opcion.id === id)?.nombre ?? `Ingrediente ${id}`;
  return {
    extras: linea.extras.map((extra) => ({ nombre: nombre(extra.id), cantidad: extra.cantidad })),
    sin: linea.sin.map(nombre),
    aclaracion: linea.aclaracion,
  };
}
