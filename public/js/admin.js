// Panel de administración: gestión de pedidos (estados y bajas) y del catálogo de platos.
// Solo se muestra a administradores; igualmente la API valida el rol en cada operación.
import { api } from './api.js';
import { obtenerToken } from './sesion.js';
import { esc, formatearPrecio, avisar } from './utilidades.js';
import { imagenDePlato } from './imagenes.js';
import { ESTADOS, etiquetaEstado, tarjetaPedido } from './vistas.js';

const TIPOS = { principal: 'Hamburguesa', combo: 'Combo', postre: 'Postre' };
const $ = (id) => document.getElementById(id);

let pedidos = [];
let filtroEstado = '';
let platos = [];
let idEnEdicion = null;
let recargarMenu = async () => {};

export function iniciarAdmin(opciones) {
  recargarMenu = opciones.recargarMenu;

  for (const pestana of document.querySelectorAll('[data-panel]')) {
    pestana.addEventListener('click', () => mostrarPanel(pestana.dataset.panel));
  }
  $('actualizar-pedidos').addEventListener('click', () => cargarPedidos());
  $('filtros-estado').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-estado]');
    if (!boton) return;
    filtroEstado = boton.dataset.estado;
    renderizarPedidos();
  });
  $('lista-pedidos-admin').addEventListener('click', manejarAccionPedido);
  $('form-plato').addEventListener('submit', guardarPlato);
  $('cancelar-edicion').addEventListener('click', terminarEdicion);
  $('tabla-platos').addEventListener('click', manejarAccionPlato);
}

function mostrarPanel(nombre) {
  for (const pestana of document.querySelectorAll('[data-panel]')) {
    const activa = pestana.dataset.panel === nombre;
    pestana.setAttribute('aria-selected', String(activa));
    $(`panel-${pestana.dataset.panel}`).hidden = !activa;
  }
}

export function limpiarAdmin() {
  pedidos = [];
  $('lista-pedidos-admin').innerHTML = '';
  $('filtros-estado').innerHTML = '';
  terminarEdicion();
}

// ---------- Pedidos ----------
export async function cargarPedidos({ silencioso = false } = {}) {
  try {
    pedidos = await api.todosLosPedidos(obtenerToken());
    renderizarPedidos();
  } catch (error) {
    if (!silencioso && error.status !== 401) avisar(error.message, 'error');
  }
}

function renderizarPedidos() {
  const cantidad = (clave) => pedidos.filter((pedido) => !clave || pedido.estado === clave).length;
  $('filtros-estado').innerHTML = [{ clave: '', etiqueta: 'Todos' }, ...ESTADOS]
    .map(
      (item) =>
        `<button type="button" class="filtro" data-estado="${item.clave}" aria-pressed="${filtroEstado === item.clave}">${item.etiqueta}<span class="filtro__cantidad">${cantidad(item.clave)}</span></button>`
    )
    .join('');

  const visibles = pedidos.filter((pedido) => !filtroEstado || pedido.estado === filtroEstado);
  $('lista-pedidos-admin').innerHTML = visibles.length
    ? visibles.map((pedido) => tarjetaPedido(pedido, { admin: true })).join('')
    : `<p class="estado-vacio">${pedidos.length ? 'No hay pedidos en este estado.' : 'Todavía no hay pedidos.'}</p>`;
}

async function manejarAccionPedido(evento) {
  const botonEstado = evento.target.closest('[data-accion]');
  const botonEliminar = evento.target.closest('[data-eliminar-pedido]');

  if (botonEstado) {
    botonEstado.disabled = true;
    try {
      const pedido = await api.cambiarEstado(obtenerToken(), Number(botonEstado.dataset.id), botonEstado.dataset.accion);
      avisar(`Pedido #${pedido.id}: ${etiquetaEstado(pedido.estado).toLowerCase()}`, 'exito');
    } catch (error) {
      if (error.status !== 401) avisar(error.message, 'error');
    }
    await cargarPedidos({ silencioso: true });
  }

  if (botonEliminar) {
    const id = Number(botonEliminar.dataset.eliminarPedido);
    if (!window.confirm(`¿Eliminar el pedido #${id}? Esta acción no se puede deshacer.`)) return;
    try {
      const respuesta = await api.eliminarPedido(obtenerToken(), id);
      avisar(respuesta.message, 'exito');
    } catch (error) {
      if (error.status !== 401) avisar(error.message, 'error');
    }
    await cargarPedidos({ silencioso: true });
  }
}

// ---------- Platos ----------
export function mostrarPlatos(lista) {
  platos = lista;
  $('tabla-platos').innerHTML = platos.length
    ? platos
        .map(
          (plato) => `<div class="fila-plato">
            <img src="${imagenDePlato(plato)}" alt="" width="64" height="48" loading="lazy">
            <div class="fila-plato__datos">
              <strong>${esc(plato.nombre)}</strong>
              <span>#${Number(plato.id)} · ${TIPOS[plato.tipo] ?? esc(plato.tipo)} · ${formatearPrecio(plato.precio)}</span>
            </div>
            <div class="fila-plato__acciones">
              <button class="boton boton--crema boton--chico" type="button" data-editar="${Number(plato.id)}">Editar</button>
              <button class="boton boton--peligro boton--chico" type="button" data-eliminar-plato="${Number(plato.id)}">Eliminar</button>
            </div>
          </div>`
        )
        .join('')
    : '<p class="estado-vacio">No hay platos cargados.</p>';
}

function manejarAccionPlato(evento) {
  const editar = evento.target.closest('[data-editar]');
  const eliminar = evento.target.closest('[data-eliminar-plato]');
  if (editar) empezarEdicion(Number(editar.dataset.editar));
  if (eliminar) eliminarPlato(Number(eliminar.dataset.eliminarPlato));
}

function mostrarError(mensaje) {
  const parrafo = $('error-form-plato');
  parrafo.textContent = mensaje;
  parrafo.hidden = !mensaje;
}

function empezarEdicion(id) {
  const plato = platos.find((item) => item.id === id);
  if (!plato) return;
  idEnEdicion = id;
  const form = $('form-plato');
  form.elements.tipo.value = plato.tipo;
  form.elements.nombre.value = plato.nombre;
  form.elements.precio.value = plato.precio;
  form.elements.descripcion.value = plato.descripcion;
  $('titulo-form-plato').textContent = `Editar plato #${id}`;
  $('guardar-plato').textContent = 'Guardar cambios';
  $('cancelar-edicion').hidden = false;
  mostrarError('');
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.nombre.focus({ preventScroll: true });
}

function terminarEdicion() {
  idEnEdicion = null;
  $('form-plato').reset();
  $('titulo-form-plato').textContent = 'Nuevo plato';
  $('guardar-plato').textContent = 'Crear plato';
  $('cancelar-edicion').hidden = true;
  mostrarError('');
}

async function guardarPlato(evento) {
  evento.preventDefault();
  const { elements } = evento.currentTarget;
  const textoPrecio = elements.precio.value.trim();
  const plato = {
    tipo: elements.tipo.value,
    nombre: elements.nombre.value.trim(),
    precio: Number(textoPrecio),
    descripcion: elements.descripcion.value.trim(),
  };
  if (!plato.nombre || !plato.descripcion || textoPrecio === '' || !Number.isInteger(plato.precio) || plato.precio < 0) {
    mostrarError('Completá el nombre, la descripción y un precio entero mayor o igual a 0.');
    return;
  }

  const boton = $('guardar-plato');
  boton.disabled = true;
  try {
    if (idEnEdicion) {
      const actualizado = await api.actualizarPlato(obtenerToken(), idEnEdicion, plato);
      avisar(`Se guardaron los cambios de "${actualizado.nombre}"`, 'exito');
    } else {
      const creado = await api.crearPlato(obtenerToken(), plato);
      avisar(`Se agregó "${creado.nombre}" al menú`, 'exito');
    }
    terminarEdicion();
    await recargarMenu();
  } catch (error) {
    if (error.status !== 401) mostrarError(error.message);
  } finally {
    boton.disabled = false;
  }
}

async function eliminarPlato(id) {
  const plato = platos.find((item) => item.id === id);
  if (!plato || !window.confirm(`¿Eliminar "${plato.nombre}" del menú?`)) return;
  try {
    const respuesta = await api.eliminarPlato(obtenerToken(), id);
    avisar(respuesta.message, 'exito');
    if (idEnEdicion === id) terminarEdicion();
    await recargarMenu();
  } catch (error) {
    // 409: el plato forma parte de pedidos y la base no permite borrarlo
    if (error.status !== 401) avisar(error.message, 'error');
  }
}
