// King Sciarra · Frontend principal: menú, personalización, carrito, ingreso/registro y "Mis pedidos".
import { api, configurarNoAutorizado } from './api.js';
import * as sesion from './sesion.js';
import * as carrito from './carrito.js';
import * as admin from './admin.js';
import { cargarOpciones, esPersonalizable, precioUnitario, depurarLinea, describirLinea } from './opciones.js';
import { iniciarPersonalizador, abrirPersonalizador } from './personalizar.js';
import { imagenDePlato } from './imagenes.js';
import { esc, formatearPrecio, avisar } from './utilidades.js';
import { etiquetaEstado, tarjetaPedido, detallePersonalizacion } from './vistas.js';

const TIPOS = { principal: 'Hamburguesa', combo: 'Combo', postre: 'Postre', bebida: 'Bebida' };
const INTERVALO_ACTUALIZACION = 30_000;
const $ = (id) => document.getElementById(id);

const estado = {
  platos: [], // menú completo (GET /platos)
  filtro: '', // tipo elegido en el menú
  visibles: [], // platos del filtro (GET /platos/tipo/:tipo)
  estadosConocidos: new Map(), // id de pedido → último estado visto
  volverAlCarrito: false,
};

const platoPorId = (id) => estado.platos.find((plato) => plato.id === id);

// ---------------- Menú ----------------
async function cargarMenu() {
  try {
    const [platos, opciones] = await Promise.all([
      api.listarPlatos(),
      // Sin opciones el menú igual funciona: solo no se puede personalizar
      api.opcionesDelMenu().catch(() => []),
    ]);
    estado.platos = platos;
    cargarOpciones(opciones);
    carrito.sincronizarCarrito(new Set(estado.platos.map((plato) => plato.id)), depurarLinea);
    await aplicarFiltro(estado.filtro);
    if (sesion.esAdmin()) admin.mostrarPlatos(estado.platos);
    renderizarCarrito();
  } catch (error) {
    $('grilla-platos').innerHTML = `<p class="estado-vacio">No pudimos cargar el menú. ${esc(error.message)}</p>`;
  } finally {
    $('grilla-platos').setAttribute('aria-busy', 'false');
  }
}

async function aplicarFiltro(tipo) {
  estado.filtro = tipo;
  for (const boton of document.querySelectorAll('#filtros-menu [data-tipo]')) {
    boton.setAttribute('aria-pressed', String(boton.dataset.tipo === tipo));
  }
  try {
    estado.visibles = tipo ? await api.listarPlatosPorTipo(tipo) : estado.platos;
  } catch (error) {
    avisar(error.message, 'error');
    estado.visibles = estado.platos.filter((plato) => !tipo || plato.tipo === tipo);
  }
  renderizarMenu();
}

/** Botones − cantidad + . `datos` son los atributos que identifican qué se suma o resta. */
function controlCantidad(nombre, cantidad, { sumar, restar }) {
  return `<div class="cantidad" role="group" aria-label="Cantidad de ${esc(nombre)}">
      <button type="button" ${restar} aria-label="Quitar uno">−</button>
      <output>${cantidad}</output>
      <button type="button" ${sumar} aria-label="Agregar uno" ${cantidad >= carrito.CANTIDAD_MAXIMA ? 'disabled' : ''}>+</button>
    </div>`;
}

// Hamburguesas y combos se arman en la ventana de personalización; postres y
// bebidas se agregan directo y, si admiten cambios, ofrecen además personalizarlos.
const SE_ARMAN = new Set(['principal', 'combo']);

function accionesDeTarjeta(plato) {
  const id = Number(plato.id);
  const personalizable = esPersonalizable(plato.id);
  if (personalizable && SE_ARMAN.has(plato.tipo)) {
    const enPedido = carrito.cantidadDe(plato.id);
    return `<div class="tarjeta__acciones">
        ${enPedido > 0 ? `<span class="en-pedido">${enPedido} en tu pedido</span>` : ''}
        <button class="boton boton--rojo" type="button" data-personalizar="${id}">Personalizar</button>
      </div>`;
  }
  const cantidad = carrito.cantidadSimpleDe(plato.id);
  const agregar =
    cantidad > 0
      ? controlCantidad(plato.nombre, cantidad, { sumar: `data-sumar="${id}"`, restar: `data-restar="${id}"` })
      : `<button class="boton boton--rojo" type="button" data-sumar="${id}">Agregar</button>`;
  if (!personalizable) return agregar;
  return `<div class="tarjeta__acciones">
      ${agregar}
      <button class="enlace" type="button" data-personalizar="${id}">Personalizar</button>
    </div>`;
}

function renderizarMenu() {
  const grilla = $('grilla-platos');
  if (estado.visibles.length === 0) {
    grilla.innerHTML = '<p class="estado-vacio">Por ahora no hay platos en esta categoría.</p>';
    return;
  }
  grilla.innerHTML = estado.visibles
    .map((plato) => {
      const tipo = esc(plato.tipo);
      const personalizable = esPersonalizable(plato.id);
      return `<article class="tarjeta tarjeta--${tipo}">
        <div class="tarjeta__imagen">
          <img src="${imagenDePlato(plato)}" alt="${esc(plato.nombre)}" width="400" height="300" loading="lazy">
          ${personalizable ? '<span class="sello">Personalizable</span>' : ''}
        </div>
        <div class="tarjeta__cuerpo">
          <span class="chip chip--${tipo}">${TIPOS[plato.tipo] ?? tipo}</span>
          <h3>${esc(plato.nombre)}</h3>
          <p>${esc(plato.descripcion)}</p>
          <div class="tarjeta__pie">
            <span class="precio">${personalizable ? '<small>desde</small>' : ''}${formatearPrecio(plato.precio)}</span>
            ${accionesDeTarjeta(plato)}
          </div>
        </div>
      </article>`;
    })
    .join('');
}

// ---------------- Carrito ----------------
function lineasConDatos() {
  return carrito
    .lineasDelCarrito()
    .map((linea, indice) => ({ linea, indice, plato: platoPorId(linea.id) }))
    .filter((item) => item.plato);
}

function renderizarCarrito() {
  const items = lineasConDatos();
  const unidades = items.reduce((total, { linea }) => total + linea.cantidad, 0);
  $('contador-carrito').textContent = unidades;
  $('boton-carrito').setAttribute('aria-label', `Abrir el carrito (${unidades} ${unidades === 1 ? 'producto' : 'productos'})`);

  $('items-carrito').innerHTML = items.length
    ? items
        .map(({ linea, indice, plato }) => {
          const editar = esPersonalizable(plato.id)
            ? `<button class="enlace" type="button" data-editar-linea="${indice}">Editar</button>`
            : '';
          return `<div class="item-carrito">
            <img src="${imagenDePlato(plato)}" alt="" width="68" height="52">
            <div class="item-carrito__nombre">${esc(plato.nombre)} ${editar}</div>
            ${detallePersonalizacion(describirLinea(linea))}
            <div class="item-carrito__fila">
              ${controlCantidad(plato.nombre, linea.cantidad, {
                sumar: `data-sumar-linea="${indice}"`,
                restar: `data-restar-linea="${indice}"`,
              })}
              <span class="item-carrito__subtotal">${formatearPrecio(precioUnitario(plato, linea) * linea.cantidad)}</span>
            </div>
          </div>`;
        })
        .join('')
    : `<div class="carrito-vacio">
        <img src="images/burgers/nueva-hamburguesa.svg" alt="" width="160" height="120">
        <p>Tu carrito está vacío.<br>¡Elegí algo rico del menú!</p>
      </div>`;

  const total = items.reduce((suma, { linea, plato }) => suma + precioUnitario(plato, linea) * linea.cantidad, 0);
  $('total-carrito').textContent = formatearPrecio(total);

  const conSesion = Boolean(sesion.obtenerToken());
  const boton = $('confirmar-pedido');
  boton.disabled = items.length === 0;
  boton.textContent = conSesion ? 'Confirmar pedido' : 'Ingresá para confirmar';
  const aviso = $('aviso-carrito');
  aviso.hidden = conSesion || items.length === 0;
  aviso.textContent = 'Para pedir necesitás una cuenta: es gratis y tarda un minuto.';
}

/** Vuelve a dibujar sin perder el foco del teclado en los botones + y −. */
function redibujarConFoco() {
  const activo = document.activeElement;
  const atributo = ['sumar', 'restar', 'sumarLinea', 'restarLinea'].find((clave) => activo?.dataset?.[clave] !== undefined);
  const contenedor = activo?.closest?.('#carrito') ? $('carrito') : $('grilla-platos');
  const valor = atributo ? activo.dataset[atributo] : null;
  renderizarMenu();
  renderizarCarrito();
  if (!atributo) return;
  const nombre = `data-${atributo.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)}`;
  const otro = nombre.includes('sumar') ? nombre.replace('sumar', 'restar') : nombre.replace('restar', 'sumar');
  (contenedor.querySelector(`[${nombre}="${valor}"]`) ?? contenedor.querySelector(`[${otro}="${valor}"]`))?.focus();
}

function abrirCarrito() {
  renderizarCarrito();
  if (!$('carrito').open) $('carrito').showModal();
}

function animarCarrito() {
  const icono = $('boton-carrito');
  icono.classList.remove('rebote');
  requestAnimationFrame(() => icono.classList.add('rebote'));
}

async function confirmarPedido() {
  const token = sesion.obtenerToken();
  if (!token) {
    abrirAuth('login', { volverAlCarrito: true });
    return;
  }
  const platos = carrito.lineasDelCarrito().map(({ id, cantidad, extras, sin, aclaracion }) => ({
    id,
    cantidad,
    extras,
    sin,
    aclaracion,
  }));
  if (platos.length === 0) return;

  const boton = $('confirmar-pedido');
  boton.disabled = true;
  boton.textContent = 'Enviando…';
  try {
    const pedido = await api.crearPedido(token, platos);
    carrito.vaciarCarrito();
    $('carrito').close();
    avisar(`¡Pedido #${pedido.id} recibido! Te avisamos cuando cambie su estado.`, 'exito');
    await cargarMisPedidos();
    $('mis-pedidos').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    // 404: algún plato ya no existe · 400: algún extra dejó de estar disponible
    if (error.status === 404 || error.status === 400) await cargarMenu();
    if (error.status !== 401) avisar(error.message, 'error');
  } finally {
    renderizarCarrito();
  }
}

// ---------------- Ingreso y registro ----------------
function cambiarModoAuth(modo) {
  for (const pestana of document.querySelectorAll('[data-auth]')) {
    pestana.setAttribute('aria-selected', String(pestana.dataset.auth === modo));
  }
  $('form-login').hidden = modo !== 'login';
  $('form-registro').hidden = modo !== 'registro';
  $('titulo-auth').textContent = modo === 'login' ? '¡Hola de nuevo!' : 'Creá tu cuenta';
  for (const error of document.querySelectorAll('#modal-auth .formulario__error')) error.hidden = true;
}

function abrirAuth(modo = 'login', { volverAlCarrito = false } = {}) {
  estado.volverAlCarrito = volverAlCarrito;
  if ($('carrito').open) $('carrito').close();
  cambiarModoAuth(modo);
  if (!$('modal-auth').open) $('modal-auth').showModal();
  $(modo === 'login' ? 'form-login' : 'form-registro').querySelector('input').focus();
}

function mostrarErrorFormulario(formulario, mensaje) {
  const parrafo = formulario.querySelector('.formulario__error');
  parrafo.textContent = mensaje;
  parrafo.hidden = !mensaje;
}

async function enviarFormulario(formulario, accion) {
  const boton = formulario.querySelector('[type="submit"]');
  boton.disabled = true;
  mostrarErrorFormulario(formulario, '');
  try {
    await accion();
  } catch (error) {
    mostrarErrorFormulario(formulario, error.message);
  } finally {
    boton.disabled = false;
  }
}

function entrar(respuesta, mensaje) {
  sesion.iniciarSesion(respuesta);
  $('modal-auth').close();
  $('form-login').reset();
  $('form-registro').reset();
  avisar(mensaje, 'exito');
  if (estado.volverAlCarrito) {
    estado.volverAlCarrito = false;
    abrirCarrito();
  }
}

async function ingresar(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const credenciales = { email: formulario.elements.email.value.trim(), password: formulario.elements.password.value };
  if (!credenciales.email || !credenciales.password) {
    mostrarErrorFormulario(formulario, 'Completá tu email y tu contraseña.');
    return;
  }
  await enviarFormulario(formulario, async () => {
    const respuesta = await api.ingresar(credenciales);
    entrar(respuesta, `¡Hola, ${respuesta.usuario.nombre}!`);
  });
}

async function registrarse(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const { elements } = formulario;
  const datos = {
    nombre: elements.nombre.value.trim(),
    apellido: elements.apellido.value.trim(),
    email: elements.email.value.trim(),
    password: elements.password.value,
  };
  if (!datos.nombre || !datos.apellido || !datos.email || !datos.password) {
    mostrarErrorFormulario(formulario, 'Completá todos los campos.');
    return;
  }
  if (datos.password.length < 6) {
    mostrarErrorFormulario(formulario, 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  await enviarFormulario(formulario, async () => {
    await api.registrar(datos);
    const respuesta = await api.ingresar({ email: datos.email, password: datos.password });
    entrar(respuesta, `¡Cuenta creada! Ya podés pedir, ${respuesta.usuario.nombre}.`);
  });
}

// ---------------- Sesión y "Mis pedidos" ----------------
function renderizarCabecera() {
  const actual = sesion.obtenerSesion();
  const esAdmin = sesion.esAdmin();
  $('boton-ingresar').hidden = Boolean(actual);
  $('menu-usuario').hidden = !actual;
  $('nombre-usuario').textContent = actual ? actual.usuario.nombre : '';
  for (const elemento of document.querySelectorAll('[data-solo-sesion]')) elemento.hidden = !actual;
  for (const elemento of document.querySelectorAll('[data-solo-admin]')) elemento.hidden = !esAdmin;
  $('mis-pedidos').hidden = !actual;
  $('admin').hidden = !esAdmin;
  renderizarCarrito();
}

async function cargarMisPedidos({ silencioso = false } = {}) {
  const token = sesion.obtenerToken();
  if (!token) return;
  try {
    const pedidos = await api.misPedidos(token);
    if (silencioso) {
      for (const pedido of pedidos) {
        const anterior = estado.estadosConocidos.get(pedido.id);
        if (anterior && anterior !== pedido.estado) {
          avisar(`Tu pedido #${pedido.id} ahora está: ${etiquetaEstado(pedido.estado).toLowerCase()}`, 'exito');
        }
      }
    }
    estado.estadosConocidos = new Map(pedidos.map((pedido) => [pedido.id, pedido.estado]));
    $('lista-mis-pedidos').innerHTML = pedidos.length
      ? pedidos.map((pedido) => tarjetaPedido(pedido)).join('')
      : '<p class="estado-vacio">Todavía no hiciste pedidos. ¡El menú te espera!</p>';
  } catch (error) {
    if (!silencioso && error.status !== 401) avisar(error.message, 'error');
  }
}

/** Trae de la API los datos actuales del usuario: otro administrador pudo cambiarle el rol. */
async function refrescarPerfil() {
  const token = sesion.obtenerToken();
  if (!token) return;
  try {
    sesion.actualizarUsuario(await api.perfil(token));
  } catch {
    // 401 ya cierra la sesión; ante otros errores se mantiene lo que había
  }
}

function cargarDatosDeAdmin() {
  admin.mostrarPlatos(estado.platos);
  admin.cargarTodo();
}

function alCambiarSesion(actual, motivo, anterior) {
  renderizarCabecera();
  if (motivo === 'actualizacion') {
    const eraAdmin = anterior?.usuario?.admin === true;
    if (sesion.esAdmin() && !eraAdmin) {
      avisar('Ahora tenés permisos de administrador.', 'exito');
      cargarDatosDeAdmin();
    } else if (!sesion.esAdmin() && eraAdmin) {
      admin.limpiarAdmin();
      avisar('Ya no tenés permisos de administrador.');
    }
    return;
  }
  if (actual) {
    cargarMisPedidos();
    if (sesion.esAdmin()) cargarDatosDeAdmin();
    return;
  }
  // Sin sesión: no deben quedar a la vista datos del usuario anterior
  estado.estadosConocidos.clear();
  $('lista-mis-pedidos').innerHTML = '';
  admin.limpiarAdmin();
  if (motivo === 'vencida') {
    abrirAuth('login');
    avisar('Tu sesión venció (dura 30 minutos). Ingresá de nuevo para seguir.', 'error');
  } else {
    avisar('Cerraste sesión. ¡Volvé pronto!');
  }
}

// ---------------- Eventos ----------------
function conectarEventos() {
  $('filtros-menu').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-tipo]');
    if (boton) aplicarFiltro(boton.dataset.tipo);
  });

  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button');
    if (!boton) return;
    const { dataset } = boton;
    if (dataset.sumar) {
      carrito.cambiarCantidadSimple(Number(dataset.sumar), 1);
      animarCarrito();
    } else if (dataset.restar) {
      carrito.cambiarCantidadSimple(Number(dataset.restar), -1);
    } else if (dataset.sumarLinea) {
      carrito.cambiarCantidadLinea(Number(dataset.sumarLinea), 1);
    } else if (dataset.restarLinea) {
      carrito.cambiarCantidadLinea(Number(dataset.restarLinea), -1);
    } else if (dataset.personalizar) {
      const plato = platoPorId(Number(dataset.personalizar));
      if (plato) abrirPersonalizador(plato);
    } else if (dataset.editarLinea) {
      const indice = Number(dataset.editarLinea);
      const linea = carrito.lineasDelCarrito()[indice];
      const plato = linea && platoPorId(linea.id);
      if (!plato) return;
      $('carrito').close();
      abrirPersonalizador(plato, { indice, linea });
    }
  });
  carrito.alCambiarCarrito(redibujarConFoco);

  iniciarPersonalizador({
    obtenerBebidas: () => estado.platos.filter((plato) => plato.tipo === 'bebida'),
    alConfirmar: ({ editando, plato, bebidas }) => {
      if (editando) {
        abrirCarrito();
        return;
      }
      animarCarrito();
      const extra = bebidas > 0 ? ` y ${bebidas === 1 ? 'una bebida' : `${bebidas} bebidas`}` : '';
      avisar(`Agregaste ${plato.nombre}${extra} a tu pedido.`, 'exito');
    },
  });

  $('boton-carrito').addEventListener('click', abrirCarrito);
  $('confirmar-pedido').addEventListener('click', confirmarPedido);
  $('boton-ingresar').addEventListener('click', () => abrirAuth('login'));
  $('boton-salir').addEventListener('click', () => sesion.cerrarSesion('salida'));
  $('hero-mis-pedidos').addEventListener('click', () => {
    if (sesion.obtenerToken()) $('mis-pedidos').scrollIntoView({ behavior: 'smooth' });
    else abrirAuth('login');
  });
  $('actualizar-mis-pedidos').addEventListener('click', () => cargarMisPedidos());

  for (const pestana of document.querySelectorAll('[data-auth]')) {
    pestana.addEventListener('click', () => cambiarModoAuth(pestana.dataset.auth));
  }
  $('form-login').addEventListener('submit', ingresar);
  $('form-registro').addEventListener('submit', registrarse);

  for (const dialogo of document.querySelectorAll('dialog')) {
    // Cerrar con la ✕ o haciendo clic en el fondo oscuro
    for (const boton of dialogo.querySelectorAll('[data-cerrar]')) boton.addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('click', (evento) => {
      if (evento.target === dialogo) dialogo.close();
    });
    dialogo.addEventListener('close', () => document.body.append($('avisos')));
  }
}

function iniciar() {
  configurarNoAutorizado(() => sesion.cerrarSesion('vencida'));
  sesion.restaurarSesion();
  carrito.cargarCarrito();
  admin.iniciarAdmin({ recargarMenu: cargarMenu });
  conectarEventos();
  sesion.alCambiarSesion(alCambiarSesion);

  renderizarCabecera();
  cargarMenu();
  if (sesion.obtenerToken()) {
    cargarMisPedidos();
    if (sesion.esAdmin()) admin.cargarTodo();
    refrescarPerfil();
  }

  // Seguimiento del pedido y del rol: se consultan cada 30 segundos
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !sesion.obtenerToken()) return;
    cargarMisPedidos({ silencioso: true });
    refrescarPerfil();
    if (sesion.esAdmin()) admin.cargarPedidos({ silencioso: true });
  }, INTERVALO_ACTUALIZACION);
}

iniciar();
