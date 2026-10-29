// Panel de administración · Usuarios: buscar, dar o quitar el rol de
// administrador, corregir datos y eliminar cuentas.
import { api } from './api.js';
import * as sesion from './sesion.js';
import { esc, avisar } from './utilidades.js';

const $ = (id) => document.getElementById(id);

let lista = [];
let filtroRol = '';
let idEnEdicion = null;
let alCambiar = () => {};

export function iniciar(opciones) {
  alCambiar = opciones.alCambiar;
  $('actualizar-usuarios').addEventListener('click', () => cargar());
  $('buscar-usuario').addEventListener('input', renderizar);
  $('filtros-usuarios').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-rol]');
    if (!boton) return;
    filtroRol = boton.dataset.rol;
    renderizar();
  });
  $('lista-usuarios').addEventListener('click', manejarAccion);
  $('form-usuario').addEventListener('submit', guardar);
}

export function obtenerUsuarios() {
  return lista;
}

export async function cargar({ silencioso = false } = {}) {
  try {
    lista = await api.listarUsuarios(sesion.obtenerToken());
    renderizar();
    alCambiar();
  } catch (error) {
    if (!silencioso && error.status !== 401) avisar(error.message, 'error');
  }
}

export function limpiar() {
  lista = [];
  $('lista-usuarios').innerHTML = '';
  $('filtros-usuarios').innerHTML = '';
}

const iniciales = (usuario) => `${usuario.nombre[0] ?? ''}${usuario.apellido[0] ?? ''}`.toUpperCase();

function renderizar() {
  const cuantos = (rol) => lista.filter((usuario) => !rol || String(usuario.admin) === rol).length;
  $('filtros-usuarios').innerHTML = [
    { rol: '', etiqueta: 'Todos' },
    { rol: 'true', etiqueta: 'Administradores' },
    { rol: 'false', etiqueta: 'Clientes' },
  ]
    .map(
      (item) =>
        `<button type="button" class="filtro" data-rol="${item.rol}" aria-pressed="${filtroRol === item.rol}">${item.etiqueta}<span class="filtro__cantidad">${cuantos(item.rol)}</span></button>`
    )
    .join('');

  const texto = $('buscar-usuario').value.trim().toLowerCase();
  const idPropio = sesion.obtenerSesion()?.usuario?.id;
  const visibles = lista.filter(
    (usuario) =>
      (!filtroRol || String(usuario.admin) === filtroRol) &&
      (!texto || `${usuario.nombre} ${usuario.apellido} ${usuario.email}`.toLowerCase().includes(texto))
  );

  $('lista-usuarios').innerHTML = visibles.length
    ? visibles
        .map((usuario) => {
          const id = Number(usuario.id);
          const propio = id === idPropio;
          const bloqueo = propio ? 'disabled title="No podés hacerlo con tu propia cuenta"' : '';
          return `<div class="fila-usuario">
            <span class="avatar${usuario.admin ? ' avatar--admin' : ''}" aria-hidden="true">${esc(iniciales(usuario))}</span>
            <div class="fila-usuario__datos">
              <strong>${esc(usuario.nombre)} ${esc(usuario.apellido)}
                ${propio ? '<span class="insignia">Vos</span>' : ''}
                ${usuario.admin ? '<span class="insignia insignia--admin">Admin</span>' : ''}</strong>
              <span>${esc(usuario.email)} · #${id} · ${Number(usuario.pedidos)} ${usuario.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
            </div>
            <div class="fila-plato__acciones">
              <button class="boton ${usuario.admin ? 'boton--crema' : 'boton--amarillo'} boton--chico" type="button" data-rol-usuario="${id}" data-admin="${!usuario.admin}" ${bloqueo}>${usuario.admin ? 'Quitar admin' : 'Hacer admin'}</button>
              <button class="boton boton--crema boton--chico" type="button" data-editar-usuario="${id}">Editar</button>
              <button class="boton boton--peligro boton--chico" type="button" data-eliminar-usuario="${id}" ${bloqueo}>Eliminar</button>
            </div>
          </div>`;
        })
        .join('')
    : `<p class="estado-vacio">${lista.length ? 'Ningún usuario coincide con la búsqueda.' : 'Todavía no hay usuarios.'}</p>`;
}

async function manejarAccion(evento) {
  const boton = evento.target.closest('button');
  if (!boton || boton.disabled) return;
  const id = Number(boton.dataset.rolUsuario ?? boton.dataset.editarUsuario ?? boton.dataset.eliminarUsuario);
  const usuario = lista.find((item) => item.id === id);
  if (!usuario) return;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;

  if (boton.dataset.editarUsuario) {
    abrirEdicion(usuario);
    return;
  }
  try {
    if (boton.dataset.rolUsuario) {
      const admin = boton.dataset.admin === 'true';
      const pregunta = admin
        ? `¿Darle permisos de administrador a ${nombre}? Va a poder gestionar pedidos, el menú y los usuarios.`
        : `¿Quitarle los permisos de administrador a ${nombre}?`;
      if (!window.confirm(pregunta)) return;
      boton.disabled = true;
      await api.cambiarRol(sesion.obtenerToken(), id, admin);
      avisar(admin ? `${nombre} ahora es administrador` : `${nombre} ya no es administrador`, 'exito');
    } else {
      const pedidos = usuario.pedidos > 0 ? ` También se borrarán sus ${usuario.pedidos} pedidos.` : '';
      if (!window.confirm(`¿Eliminar la cuenta de ${nombre} (${usuario.email})?${pedidos} Esta acción no se puede deshacer.`)) return;
      boton.disabled = true;
      const respuesta = await api.eliminarUsuario(sesion.obtenerToken(), id);
      avisar(respuesta.message, 'exito');
    }
  } catch (error) {
    if (error.status !== 401) avisar(error.message, 'error');
  }
  await cargar({ silencioso: true });
}

// ---------- Edición de datos ----------
function mostrarError(mensaje) {
  const parrafo = $('error-form-usuario');
  parrafo.textContent = mensaje;
  parrafo.hidden = !mensaje;
}

function abrirEdicion(usuario) {
  idEnEdicion = usuario.id;
  const form = $('form-usuario');
  form.elements.nombre.value = usuario.nombre;
  form.elements.apellido.value = usuario.apellido;
  form.elements.email.value = usuario.email;
  $('titulo-usuario').textContent = `Editar a ${usuario.nombre}`;
  mostrarError('');
  $('modal-usuario').showModal();
  form.elements.nombre.focus();
}

async function guardar(evento) {
  evento.preventDefault();
  const { elements } = evento.currentTarget;
  const datos = {
    nombre: elements.nombre.value.trim(),
    apellido: elements.apellido.value.trim(),
    email: elements.email.value.trim(),
  };
  if (!datos.nombre || !datos.apellido || !datos.email) {
    mostrarError('Completá nombre, apellido y email.');
    return;
  }
  const boton = evento.currentTarget.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    const actualizado = await api.actualizarUsuario(sesion.obtenerToken(), idEnEdicion, datos);
    if (actualizado.id === sesion.obtenerSesion()?.usuario?.id) sesion.actualizarUsuario(actualizado);
    $('modal-usuario').close();
    avisar(`Se guardaron los datos de ${actualizado.nombre}`, 'exito');
    await cargar({ silencioso: true });
  } catch (error) {
    if (error.status !== 401) mostrarError(error.message);
  } finally {
    boton.disabled = false;
  }
}
