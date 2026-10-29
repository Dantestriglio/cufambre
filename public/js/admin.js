// Panel de administración: resumen, pedidos (estados y bajas), platos con sus
// ingredientes, catálogo de ingredientes y usuarios.
// Solo se muestra a administradores; igualmente la API valida el rol en cada operación.
import { api } from './api.js';
import { obtenerToken } from './sesion.js';
import { esc, formatearPrecio, avisar } from './utilidades.js';
import { imagenDePlato } from './imagenes.js';
import { ESTADOS, etiquetaEstado, tarjetaPedido } from './vistas.js';
import * as ingredientes from './adminIngredientes.js';
import * as usuarios from './adminUsuarios.js';
import { renderizarResumen } from './adminResumen.js';

const TIPOS = { principal: 'Hamburguesa', combo: 'Combo', postre: 'Postre', bebida: 'Bebida' };
const MAXIMO_EXTRA = 10;
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
  $('buscar-opcion').addEventListener('input', filtrarOpciones);
  // Resalta los ingredientes que el plato usa a medida que se marcan
  $('lista-opciones-plato').addEventListener('input', (evento) => {
    const fila = evento.target.closest('.fila-opcion');
    fila?.classList.toggle('fila-opcion--usada', opcionDeFila(fila) !== null);
  });

  ingredientes.iniciar({
    alCambiar: async () => {
      await recargarMenu();
      renderizarEditorOpciones(leerOpcionesDelEditor());
    },
  });
  usuarios.iniciar({ alCambiar: actualizarResumen });
}

function mostrarPanel(nombre) {
  for (const pestana of document.querySelectorAll('[data-panel]')) {
    const activa = pestana.dataset.panel === nombre;
    pestana.setAttribute('aria-selected', String(activa));
    $(`panel-${pestana.dataset.panel}`).hidden = !activa;
  }
}

/** Carga todo lo que usa el panel. */
export async function cargarTodo() {
  await Promise.all([
    cargarPedidos({ silencioso: true }),
    usuarios.cargar({ silencioso: true }),
    ingredientes.cargar({ silencioso: true }),
  ]);
  if (idEnEdicion === null) renderizarEditorOpciones([]);
}

export function limpiarAdmin() {
  pedidos = [];
  $('lista-pedidos-admin').innerHTML = '';
  $('filtros-estado').innerHTML = '';
  $('resumen-admin').innerHTML = '';
  usuarios.limpiar();
  ingredientes.limpiar();
  terminarEdicion();
}

function actualizarResumen() {
  renderizarResumen($('resumen-admin'), { pedidos, usuarios: usuarios.obtenerUsuarios() });
}

// ---------- Pedidos ----------
export async function cargarPedidos({ silencioso = false } = {}) {
  try {
    pedidos = await api.todosLosPedidos(obtenerToken());
    renderizarPedidos();
    actualizarResumen();
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

// ----- Editor de ingredientes del plato -----

/** Dibuja una fila por ingrediente del catálogo, con lo que ya tiene asignado el plato. */
function renderizarEditorOpciones(asignadas) {
  const catalogo = ingredientes.obtenerIngredientes();
  const porId = new Map(asignadas.map((opcion) => [opcion.id, opcion]));
  const ordenados = [...catalogo].sort(
    (a, b) => Number(porId.has(b.id)) - Number(porId.has(a.id)) || a.nombre.localeCompare(b.nombre, 'es')
  );
  $('lista-opciones-plato').innerHTML = ordenados.length
    ? ordenados
        .map((ingrediente) => {
          const opcion = porId.get(ingrediente.id);
          const id = Number(ingrediente.id);
          return `<div class="fila-opcion${opcion ? ' fila-opcion--usada' : ''}" data-opcion="${id}" data-nombre="${esc(ingrediente.nombre.toLowerCase())}">
            <span class="fila-opcion__nombre">${esc(ingrediente.nombre)}
              <small>${ingrediente.precio > 0 ? `+ ${formatearPrecio(ingrediente.precio)}` : 'sin cargo'}${ingrediente.disponible ? '' : ' · agotado'}</small>
            </span>
            <label class="fila-opcion__control"><input type="checkbox" data-incluye ${opcion?.incluido ? 'checked' : ''}> Viene</label>
            <label class="fila-opcion__control">Extra máx.
              <input type="number" min="0" max="${MAXIMO_EXTRA}" step="1" inputmode="numeric" data-maximo value="${Number(opcion?.maximo ?? 0)}">
            </label>
          </div>`;
        })
        .join('')
    : '<p class="ayuda">Todavía no hay ingredientes. Cargalos en la pestaña Ingredientes.</p>';
  filtrarOpciones();
}

function filtrarOpciones() {
  const texto = $('buscar-opcion').value.trim().toLowerCase();
  for (const fila of $('lista-opciones-plato').querySelectorAll('[data-opcion]')) {
    fila.hidden = Boolean(texto) && !fila.dataset.nombre.includes(texto);
  }
}

/** { id, incluido, maximo } de una fila, o null si el ingrediente no se usa en el plato. */
function opcionDeFila(fila) {
  const incluido = fila.querySelector('[data-incluye]').checked;
  const maximo = Math.min(MAXIMO_EXTRA, Math.max(0, Math.trunc(Number(fila.querySelector('[data-maximo]').value) || 0)));
  return incluido || maximo > 0 ? { id: Number(fila.dataset.opcion), incluido, maximo } : null;
}

function leerOpcionesDelEditor() {
  return [...$('lista-opciones-plato').querySelectorAll('[data-opcion]')].map(opcionDeFila).filter(Boolean);
}

async function empezarEdicion(id) {
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
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.nombre.focus({ preventScroll: true });
  $('lista-opciones-plato').innerHTML = '<p class="ayuda">Cargando ingredientes…</p>';
  try {
    const asignadas = await api.opcionesDePlato(id);
    if (idEnEdicion === id) renderizarEditorOpciones(asignadas);
  } catch (error) {
    mostrarError(`No se pudieron cargar los ingredientes del plato: ${error.message}`);
  }
}

function terminarEdicion() {
  idEnEdicion = null;
  $('form-plato').reset();
  $('titulo-form-plato').textContent = 'Nuevo plato';
  $('guardar-plato').textContent = 'Crear plato';
  $('cancelar-edicion').hidden = true;
  mostrarError('');
  renderizarEditorOpciones([]);
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
  const opciones = leerOpcionesDelEditor();

  const boton = $('guardar-plato');
  boton.disabled = true;
  try {
    const guardado = idEnEdicion
      ? await api.actualizarPlato(obtenerToken(), idEnEdicion, plato)
      : await api.crearPlato(obtenerToken(), plato);
    // Si el plato se creó pero fallan los ingredientes, queda en edición para reintentar
    idEnEdicion = guardado.id;
    await api.guardarOpcionesDePlato(obtenerToken(), guardado.id, opciones);
    avisar(`Se guardó "${guardado.nombre}" con ${opciones.length} ${opciones.length === 1 ? 'ingrediente' : 'ingredientes'}`, 'exito');
    terminarEdicion();
    await Promise.all([recargarMenu(), ingredientes.cargar({ silencioso: true })]);
  } catch (error) {
    if (error.status !== 401) mostrarError(error.message);
    if (idEnEdicion) {
      $('titulo-form-plato').textContent = `Editar plato #${idEnEdicion}`;
      $('guardar-plato').textContent = 'Guardar cambios';
      $('cancelar-edicion').hidden = false;
      await recargarMenu();
    }
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
