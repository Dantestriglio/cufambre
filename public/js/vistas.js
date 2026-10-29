// Piezas de interfaz compartidas entre "Mis pedidos" y el panel de administración.
import { esc, formatearFecha, formatearPrecio, calcularTotal } from './utilidades.js';

export const ESTADOS = [
  { clave: 'pendiente', etiqueta: 'Pendiente' },
  { clave: 'aceptado', etiqueta: 'Aceptado' },
  { clave: 'en camino', etiqueta: 'En camino' },
  { clave: 'entregado', etiqueta: 'Entregado' },
];

// Acción de la API que lleva cada estado al siguiente
export const SIGUIENTE_ACCION = {
  pendiente: { accion: 'aceptar', texto: 'Aceptar pedido' },
  aceptado: { accion: 'comenzar', texto: 'Salió en camino' },
  'en camino': { accion: 'entregar', texto: 'Marcar entregado' },
};

export function etiquetaEstado(estado) {
  return ESTADOS.find((item) => item.clave === estado)?.etiqueta ?? estado;
}

/**
 * Resumen de la personalización de un ítem: "+2 Cheddar · sin Cebolla · “bien cocida”".
 * Recibe { extras: [{ nombre, cantidad }], sin: [nombre o { nombre }], aclaracion }.
 */
export function detallePersonalizacion({ extras = [], sin = [], aclaracion = null }) {
  const partes = [
    ...extras.map((extra) => `<span class="detalle__extra">+${extra.cantidad > 1 ? `${Number(extra.cantidad)} ` : ''}${esc(extra.nombre)}</span>`),
    ...sin.map((quitado) => `<span class="detalle__sin">sin ${esc(quitado.nombre ?? quitado)}</span>`),
  ];
  if (aclaracion) partes.push(`<span class="detalle__nota">“${esc(aclaracion)}”</span>`);
  return partes.length ? `<p class="detalle">${partes.join(' ')}</p>` : '';
}

export function tarjetaPedido(pedido, { admin = false } = {}) {
  const id = Number(pedido.id);
  const indice = ESTADOS.findIndex((item) => item.clave === pedido.estado);
  const etiqueta = esc(etiquetaEstado(pedido.estado));
  const pasos = ESTADOS.map((item, i) => {
    const clases = [i <= indice ? 'hecho' : '', i === indice ? 'actual' : ''].join(' ').trim();
    return `<li class="${clases}">${item.etiqueta}</li>`;
  }).join('');
  const items = pedido.platos
    .map(
      (plato) =>
        `<li><div><span>${Number(plato.cantidad)} × ${esc(plato.nombre)}</span>${detallePersonalizacion(plato)}</div><span>${formatearPrecio(plato.precio * plato.cantidad)}</span></li>`
    )
    .join('');

  let cliente = '';
  let acciones = '';
  if (admin) {
    const usuario = pedido.usuario ?? {};
    cliente = `<p class="pedido__cliente">${esc(usuario.nombre)} ${esc(usuario.apellido)} · ${esc(usuario.email)}</p>`;
    const siguiente = SIGUIENTE_ACCION[pedido.estado];
    acciones = `<div class="pedido__acciones">
        ${siguiente ? `<button class="boton boton--rojo boton--chico" type="button" data-accion="${siguiente.accion}" data-id="${id}">${siguiente.texto}</button>` : ''}
        <button class="boton boton--peligro boton--chico" type="button" data-eliminar-pedido="${id}">Eliminar</button>
      </div>`;
  }

  return `<article class="pedido">
      <header class="pedido__encabezado">
        <div>
          <h3 class="pedido__numero">Pedido #${id}</h3>
          <p class="pedido__fecha">${esc(formatearFecha(pedido.fecha))}</p>
          ${cliente}
        </div>
        <span class="estado estado--${esc(pedido.estado.replace(/\s+/g, '-'))}">${etiqueta}</span>
      </header>
      <ol class="progreso" aria-label="Estado: ${etiqueta}, paso ${indice + 1} de ${ESTADOS.length}">${pasos}</ol>
      <ul class="pedido__items">${items}</ul>
      <div class="pedido__total"><span>Total</span><span>${formatearPrecio(calcularTotal(pedido.platos))}</span></div>
      ${acciones}
    </article>`;
}
