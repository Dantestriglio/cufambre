// Panel de administración · Ingredientes: alta, edición, agotado/disponible y baja.
import { api } from './api.js';
import { obtenerToken } from './sesion.js';
import { esc, formatearPrecio, avisar } from './utilidades.js';

const $ = (id) => document.getElementById(id);

let lista = [];
let idEnEdicion = null;
let alCambiar = async () => {};

export function iniciar(opciones) {
  alCambiar = opciones.alCambiar;
  $('form-ingrediente').addEventListener('submit', guardar);
  $('cancelar-ingrediente').addEventListener('click', terminarEdicion);
  $('lista-ingredientes').addEventListener('click', manejarAccion);
  $('buscar-ingrediente').addEventListener('input', renderizar);
}

export function obtenerIngredientes() {
  return lista;
}

export async function cargar({ silencioso = false } = {}) {
  try {
    lista = await api.listarIngredientes();
    renderizar();
  } catch (error) {
    if (!silencioso) avisar(error.message, 'error');
  }
}

export function limpiar() {
  lista = [];
  $('lista-ingredientes').innerHTML = '';
  terminarEdicion();
}

function renderizar() {
  const texto = $('buscar-ingrediente').value.trim().toLowerCase();
  const visibles = lista.filter((ingrediente) => !texto || ingrediente.nombre.toLowerCase().includes(texto));
  $('lista-ingredientes').innerHTML = visibles.length
    ? visibles
        .map((ingrediente) => {
          const id = Number(ingrediente.id);
          const usos = `${Number(ingrediente.platos)} ${ingrediente.platos === 1 ? 'plato' : 'platos'}`;
          return `<div class="fila-plato fila-plato--sin-imagen${ingrediente.disponible ? '' : ' fila-plato--apagada'}">
            <div class="fila-plato__datos">
              <strong>${esc(ingrediente.nombre)} ${ingrediente.disponible ? '' : '<span class="insignia insignia--agotado">Agotado</span>'}</strong>
              <span>${ingrediente.precio > 0 ? `+ ${formatearPrecio(ingrediente.precio)} como extra` : 'Extra sin cargo'} · en ${usos}</span>
            </div>
            <div class="fila-plato__acciones">
              <button class="boton boton--crema boton--chico" type="button" data-alternar-ingrediente="${id}">${ingrediente.disponible ? 'Marcar agotado' : 'Reponer'}</button>
              <button class="boton boton--crema boton--chico" type="button" data-editar-ingrediente="${id}">Editar</button>
              <button class="boton boton--peligro boton--chico" type="button" data-eliminar-ingrediente="${id}">Eliminar</button>
            </div>
          </div>`;
        })
        .join('')
    : `<p class="estado-vacio">${lista.length ? 'Ningún ingrediente coincide con la búsqueda.' : 'Todavía no hay ingredientes.'}</p>`;
}

function mostrarError(mensaje) {
  const parrafo = $('error-form-ingrediente');
  parrafo.textContent = mensaje;
  parrafo.hidden = !mensaje;
}

function empezarEdicion(ingrediente) {
  idEnEdicion = ingrediente.id;
  const form = $('form-ingrediente');
  form.elements.nombre.value = ingrediente.nombre;
  form.elements.precio.value = ingrediente.precio;
  form.elements.disponible.checked = ingrediente.disponible;
  $('titulo-form-ingrediente').textContent = 'Editar ingrediente';
  $('guardar-ingrediente').textContent = 'Guardar cambios';
  $('cancelar-ingrediente').hidden = false;
  mostrarError('');
  form.elements.nombre.focus();
}

function terminarEdicion() {
  idEnEdicion = null;
  $('form-ingrediente').reset();
  $('titulo-form-ingrediente').textContent = 'Nuevo ingrediente';
  $('guardar-ingrediente').textContent = 'Crear ingrediente';
  $('cancelar-ingrediente').hidden = true;
  mostrarError('');
}

async function guardar(evento) {
  evento.preventDefault();
  const { elements } = evento.currentTarget;
  const textoPrecio = elements.precio.value.trim();
  const datos = {
    nombre: elements.nombre.value.trim(),
    precio: Number(textoPrecio),
    disponible: elements.disponible.checked,
  };
  if (!datos.nombre || textoPrecio === '' || !Number.isInteger(datos.precio) || datos.precio < 0) {
    mostrarError('Completá el nombre y un precio entero mayor o igual a 0 (0 = extra sin cargo).');
    return;
  }
  const boton = $('guardar-ingrediente');
  boton.disabled = true;
  try {
    const guardado = idEnEdicion
      ? await api.actualizarIngrediente(obtenerToken(), idEnEdicion, datos)
      : await api.crearIngrediente(obtenerToken(), datos);
    avisar(`Se guardó el ingrediente "${guardado.nombre}"`, 'exito');
    terminarEdicion();
    await cargar({ silencioso: true });
    await alCambiar();
  } catch (error) {
    if (error.status !== 401) mostrarError(error.message);
  } finally {
    boton.disabled = false;
  }
}

async function manejarAccion(evento) {
  const boton = evento.target.closest('button');
  if (!boton) return;
  const id = Number(boton.dataset.editarIngrediente ?? boton.dataset.alternarIngrediente ?? boton.dataset.eliminarIngrediente);
  const ingrediente = lista.find((item) => item.id === id);
  if (!ingrediente) return;

  if (boton.dataset.editarIngrediente) {
    empezarEdicion(ingrediente);
    return;
  }
  try {
    if (boton.dataset.alternarIngrediente) {
      boton.disabled = true;
      const { nombre, precio, disponible } = ingrediente;
      await api.actualizarIngrediente(obtenerToken(), id, { nombre, precio, disponible: !disponible });
      avisar(disponible ? `${nombre} quedó como agotado: no se ofrece como extra` : `${nombre} vuelve a estar disponible`, 'exito');
    } else {
      const aviso = ingrediente.platos > 0 ? ` Se quitará de ${ingrediente.platos} ${ingrediente.platos === 1 ? 'plato' : 'platos'}.` : '';
      if (!window.confirm(`¿Eliminar el ingrediente "${ingrediente.nombre}"?${aviso}`)) return;
      const respuesta = await api.eliminarIngrediente(obtenerToken(), id);
      avisar(respuesta.message, 'exito');
      if (idEnEdicion === id) terminarEdicion();
    }
    await cargar({ silencioso: true });
    await alCambiar();
  } catch (error) {
    // 409: el ingrediente figura en pedidos; se puede marcar como agotado
    if (error.status !== 401) avisar(error.message, 'error');
    boton.disabled = false;
  }
}
