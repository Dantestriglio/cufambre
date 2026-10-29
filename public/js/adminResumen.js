// Panel de administración · Resumen: números clave del local calculados con
// los pedidos y usuarios que ya cargó el panel (no hace llamadas propias).
import { esc, formatearPrecio, calcularTotal } from './utilidades.js';

const hoyEnArgentina = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

/** Los `cantidad` nombres que más unidades suman. */
function ranking(items, cantidad = 5) {
  const totales = new Map();
  for (const { nombre, unidades } of items) totales.set(nombre, (totales.get(nombre) ?? 0) + unidades);
  return [...totales].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, cantidad);
}

function tile(etiqueta, valor, detalle = '') {
  return `<div class="dato">
      <span class="dato__etiqueta">${etiqueta}</span>
      <strong class="dato__valor">${valor}</strong>
      ${detalle ? `<span class="dato__detalle">${detalle}</span>` : ''}
    </div>`;
}

function listaRanking(titulo, filas, unidad, vacio) {
  const cuerpo = filas.length
    ? `<ol class="ranking">${filas
        .map(([nombre, unidades]) => `<li><span>${esc(nombre)}</span><strong>${unidades} ${unidad}</strong></li>`)
        .join('')}</ol>`
    : `<p class="ayuda">${vacio}</p>`;
  return `<section class="tarjeta-resumen"><h3>${titulo}</h3>${cuerpo}</section>`;
}

export function renderizarResumen(contenedor, { pedidos, usuarios }) {
  const hoy = hoyEnArgentina();
  const totales = pedidos.map((pedido) => calcularTotal(pedido.platos));
  const ventas = totales.reduce((suma, total) => suma + total, 0);
  const deHoy = pedidos.filter((pedido) => pedido.fecha === hoy);
  const pendientes = pedidos.filter((pedido) => pedido.estado === 'pendiente').length;
  const enCurso = pedidos.filter((pedido) => pedido.estado === 'aceptado' || pedido.estado === 'en camino').length;
  const admins = usuarios.filter((usuario) => usuario.admin).length;
  const items = pedidos.flatMap((pedido) => pedido.platos);

  const masPedidos = ranking(items.map((item) => ({ nombre: item.nombre, unidades: item.cantidad })));
  const extras = ranking(
    items.flatMap((item) => (item.extras ?? []).map((extra) => ({ nombre: extra.nombre, unidades: extra.cantidad * item.cantidad })))
  );
  const bebidas = ranking(
    items.filter((item) => item.tipo === 'bebida').map((item) => ({ nombre: item.nombre, unidades: item.cantidad })),
    3
  );

  contenedor.innerHTML = `
    <div class="datos">
      ${tile('Pedidos de hoy', deHoy.length, formatearPrecio(deHoy.reduce((suma, pedido) => suma + calcularTotal(pedido.platos), 0)))}
      ${tile('Por aceptar', pendientes, pendientes === 1 ? 'pedido pendiente' : 'pedidos pendientes')}
      ${tile('En curso', enCurso, 'aceptados o en camino')}
      ${tile('Ventas totales', formatearPrecio(ventas), `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}`)}
      ${tile('Ticket promedio', pedidos.length ? formatearPrecio(Math.round(ventas / pedidos.length)) : '—', 'por pedido')}
      ${tile('Usuarios', usuarios.length, `${admins} ${admins === 1 ? 'administrador' : 'administradores'}`)}
    </div>
    <div class="rankings">
      ${listaRanking('Lo más pedido', masPedidos, 'u.', 'Todavía no hay pedidos.')}
      ${listaRanking('Extras favoritos', extras, 'u.', 'Nadie agregó extras todavía.')}
      ${listaRanking('Bebidas', bebidas, 'u.', 'Todavía no se pidieron bebidas.')}
    </div>`;
}
