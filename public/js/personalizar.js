// Ventana para armar un plato a gusto: quitar ingredientes, sumar extras,
// dejar una aclaración, elegir la cantidad y (en las hamburguesas) sumar bebidas.
import * as carrito from './carrito.js';
import { opcionesDe, precioUnitario } from './opciones.js';
import { imagenDePlato } from './imagenes.js';
import { esc, formatearPrecio } from './utilidades.js';

const TIPOS = { principal: 'Hamburguesa', combo: 'Combo', postre: 'Postre', bebida: 'Bebida' };
const $ = (id) => document.getElementById(id);

let obtenerBebidas = () => [];
let alConfirmar = () => {};

const estado = {
  plato: null,
  opciones: [],
  sin: new Set(),
  extras: new Map(), // id del ingrediente → unidades extra
  cantidad: 1,
  bebidas: new Set(),
  indice: null, // posición de la línea del carrito que se está editando
};

export function iniciarPersonalizador(opciones) {
  obtenerBebidas = opciones.obtenerBebidas;
  alConfirmar = opciones.alConfirmar;

  const formulario = $('form-personalizar');
  formulario.addEventListener('click', manejarClic);
  formulario.addEventListener('change', (evento) => {
    const casilla = evento.target.closest('[data-incluido]');
    if (!casilla) return;
    const id = Number(casilla.dataset.incluido);
    if (casilla.checked) estado.sin.delete(id);
    else {
      estado.sin.add(id);
      estado.extras.delete(id); // no se puede quitar y agregar el mismo ingrediente
    }
    actualizar();
  });
  formulario.addEventListener('submit', confirmar);
}

/** Abre la ventana para un plato. Con `indice` edita esa línea del carrito. */
export function abrirPersonalizador(plato, { indice = null, linea = null } = {}) {
  Object.assign(estado, {
    plato,
    opciones: opcionesDe(plato.id),
    sin: new Set(linea?.sin ?? []),
    extras: new Map((linea?.extras ?? []).map((extra) => [extra.id, extra.cantidad])),
    cantidad: linea?.cantidad ?? 1,
    bebidas: new Set(),
    indice,
  });
  renderizar();
  $('form-personalizar').elements.aclaracion.value = linea?.aclaracion ?? '';
  actualizar();
  const dialogo = $('modal-personalizar');
  if (!dialogo.open) dialogo.showModal();
  dialogo.querySelector('.personalizar__cuerpo').scrollTop = 0;
}

function stepper(atributo, id, nombre) {
  return `<div class="cantidad cantidad--chica" role="group" aria-label="Extra de ${esc(nombre)}">
      <button type="button" data-${atributo}-menos="${id}" aria-label="Quitar un extra de ${esc(nombre)}">−</button>
      <output data-${atributo}-valor="${id}">0</output>
      <button type="button" data-${atributo}-mas="${id}" aria-label="Agregar un extra de ${esc(nombre)}">+</button>
    </div>`;
}

function filaExtra(opcion) {
  const precio = opcion.precio > 0 ? `+ ${formatearPrecio(opcion.precio)}` : 'Sin cargo';
  return `<div class="opcion opcion--extra" data-fila-extra="${Number(opcion.id)}">
      <span class="opcion__nombre">${esc(opcion.nombre)}<small>${precio}${opcion.maximo > 1 ? ` · hasta ${Number(opcion.maximo)}` : ''}</small></span>
      ${stepper('extra', Number(opcion.id), opcion.nombre)}
    </div>`;
}

function renderizar() {
  const { plato, opciones } = estado;
  $('imagen-personalizar').src = imagenDePlato(plato);
  $('imagen-personalizar').alt = plato.nombre;
  $('tipo-personalizar').textContent = TIPOS[plato.tipo] ?? plato.tipo;
  $('tipo-personalizar').className = `chip chip--${plato.tipo}`;
  $('titulo-personalizar').textContent = plato.nombre;
  $('descripcion-personalizar').textContent = plato.descripcion;
  $('precio-base-personalizar').textContent = formatearPrecio(plato.precio);

  const incluidos = opciones.filter((opcion) => opcion.incluido);
  $('grupo-incluidos').hidden = incluidos.length === 0;
  $('lista-incluidos').innerHTML = incluidos
    .map(
      (opcion) => `<div class="opcion">
        <label class="opcion__casilla">
          <input type="checkbox" data-incluido="${Number(opcion.id)}">
          <span>${esc(opcion.nombre)}</span>
        </label>
        ${opcion.maximo > 0 ? `<span class="opcion__doble">${stepper('extra', Number(opcion.id), opcion.nombre)}<small>+ ${formatearPrecio(opcion.precio)} c/u</small></span>` : ''}
      </div>`
    )
    .join('');

  const extras = opciones.filter((opcion) => !opcion.incluido && opcion.maximo > 0);
  $('grupo-extras').hidden = extras.length === 0;
  $('lista-extras').innerHTML = extras.map(filaExtra).join('');

  // Solo al armar una hamburguesa nueva se ofrece sumar bebidas
  const bebidas = estado.indice === null && plato.tipo === 'principal' ? obtenerBebidas() : [];
  $('grupo-bebidas').hidden = bebidas.length === 0;
  $('lista-bebidas').innerHTML = bebidas
    .map(
      (bebida) => `<button type="button" class="chip-bebida" data-bebida="${Number(bebida.id)}" aria-pressed="false">
        <span>${esc(bebida.nombre)}</span><strong>+ ${formatearPrecio(bebida.precio)}</strong>
      </button>`
    )
    .join('');

  $('confirmar-personalizar-texto').textContent = estado.indice === null ? 'Agregar al pedido' : 'Guardar cambios';
}

function lineaActual() {
  return carrito.normalizarLinea({
    id: estado.plato.id,
    cantidad: estado.cantidad,
    extras: [...estado.extras].map(([id, cantidad]) => ({ id, cantidad })),
    sin: [...estado.sin],
    aclaracion: $('form-personalizar').elements.aclaracion.value,
  });
}

/** Refleja el estado en los controles y recalcula el total. */
function actualizar() {
  const formulario = $('form-personalizar');
  for (const opcion of estado.opciones) {
    const unidades = estado.extras.get(opcion.id) ?? 0;
    const quitado = estado.sin.has(opcion.id);
    const salida = formulario.querySelector(`[data-extra-valor="${opcion.id}"]`);
    if (salida) {
      salida.textContent = unidades;
      formulario.querySelector(`[data-extra-menos="${opcion.id}"]`).disabled = unidades === 0;
      formulario.querySelector(`[data-extra-mas="${opcion.id}"]`).disabled = quitado || unidades >= opcion.maximo;
      salida.closest('.opcion').classList.toggle('opcion--activa', unidades > 0);
    }
    const casilla = formulario.querySelector(`[data-incluido="${opcion.id}"]`);
    if (casilla) {
      casilla.checked = !quitado;
      casilla.closest('.opcion').classList.toggle('opcion--quitada', quitado);
    }
  }
  for (const boton of formulario.querySelectorAll('[data-bebida]')) {
    boton.setAttribute('aria-pressed', String(estado.bebidas.has(Number(boton.dataset.bebida))));
  }

  $('cantidad-personalizar').textContent = estado.cantidad;
  $('restar-personalizar').disabled = estado.cantidad <= 1;
  $('sumar-personalizar').disabled = estado.cantidad >= carrito.CANTIDAD_MAXIMA;

  const unitario = precioUnitario(estado.plato, lineaActual());
  const bebidas = obtenerBebidas().filter((bebida) => estado.bebidas.has(bebida.id));
  const total = unitario * estado.cantidad + bebidas.reduce((suma, bebida) => suma + bebida.precio, 0);
  $('unitario-personalizar').textContent =
    unitario === estado.plato.precio ? '' : `Con tus extras: ${formatearPrecio(unitario)} c/u`;
  $('total-personalizar').textContent = formatearPrecio(total);
}

function manejarClic(evento) {
  const objetivo = evento.target.closest('button');
  if (!objetivo) return;
  const { dataset } = objetivo;
  if (dataset.extraMas || dataset.extraMenos) {
    const id = Number(dataset.extraMas ?? dataset.extraMenos);
    const opcion = estado.opciones.find((item) => item.id === id);
    const actual = estado.extras.get(id) ?? 0;
    const nueva = Math.min(opcion.maximo, Math.max(0, actual + (dataset.extraMas ? 1 : -1)));
    if (nueva === 0) estado.extras.delete(id);
    else estado.extras.set(id, nueva);
  } else if (dataset.bebida) {
    const id = Number(dataset.bebida);
    if (estado.bebidas.has(id)) estado.bebidas.delete(id);
    else estado.bebidas.add(id);
  } else if (objetivo.id === 'sumar-personalizar') {
    estado.cantidad = Math.min(carrito.CANTIDAD_MAXIMA, estado.cantidad + 1);
  } else if (objetivo.id === 'restar-personalizar') {
    estado.cantidad = Math.max(1, estado.cantidad - 1);
  } else {
    return;
  }
  actualizar();
}

function confirmar(evento) {
  evento.preventDefault();
  const linea = lineaActual();
  const editando = estado.indice !== null;
  if (editando) carrito.reemplazarLinea(estado.indice, linea);
  else carrito.agregarLineas([linea, ...[...estado.bebidas].map((id) => ({ id, cantidad: 1 }))]);
  $('modal-personalizar').close();
  alConfirmar({ editando, plato: estado.plato, bebidas: estado.bebidas.size });
}
