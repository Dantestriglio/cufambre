/**
 * services/pedidosService.js — Lógica de negocio de los pedidos.
 */
const {
  platosController,
  pedidosController,
  ingredientesController,
  conTransaccion,
} = require('../controllers/controllers');
const { HttpError } = require('../utils/httpError');
const { MAX_ENTERO, esObjetoPlano, esEnteroEnRango, validarId } = require('../utils/validaciones');

// Flujo de estados: pendiente → aceptado → en camino → entregado
const TRANSICIONES = {
  aceptar: { desde: 'pendiente', hacia: 'aceptado' },
  comenzar: { desde: 'aceptado', hacia: 'en camino' },
  entregar: { desde: 'en camino', hacia: 'entregado' },
};

const LARGO_MAXIMO_ACLARACION = 140;
const MAXIMO_UNIDADES_EXTRA = 10;

/**
 * Valida la personalización opcional de un ítem:
 *   extras: [{ id, cantidad }] ingredientes agregados (cantidad por defecto 1)
 *   sin: [id] ingredientes quitados
 *   aclaracion: texto libre para la cocina
 * Devuelve los extras y los quitados ordenados por id, para comparar ítems iguales.
 */
function validarPersonalizacion(item, posicion) {
  let extras = [];
  if (item.extras !== undefined) {
    if (!Array.isArray(item.extras)) {
      throw new HttpError(400, `${posicion}.extras debe ser un array de objetos { id, cantidad }`);
    }
    const unidades = new Map();
    item.extras.forEach((extra, indice) => {
      const lugar = `${posicion}.extras[${indice}]`;
      if (!esObjetoPlano(extra) || !esEnteroEnRango(extra.id, 1)) {
        throw new HttpError(400, `${lugar} debe ser un objeto { id, cantidad } con un id entero positivo`);
      }
      const cantidad = extra.cantidad ?? 1;
      if (!esEnteroEnRango(cantidad, 1, MAXIMO_UNIDADES_EXTRA)) {
        throw new HttpError(400, `${lugar}.cantidad debe ser un número entero entre 1 y ${MAXIMO_UNIDADES_EXTRA}`);
      }
      unidades.set(extra.id, (unidades.get(extra.id) ?? 0) + cantidad);
    });
    extras = [...unidades].map(([id, cantidad]) => ({ id, cantidad })).sort((a, b) => a.id - b.id);
  }

  let sin = [];
  if (item.sin !== undefined) {
    if (!Array.isArray(item.sin) || !item.sin.every((id) => esEnteroEnRango(id, 1))) {
      throw new HttpError(400, `${posicion}.sin debe ser un array de ids de ingredientes`);
    }
    sin = [...new Set(item.sin)].sort((a, b) => a - b);
  }

  const repetido = extras.find((extra) => sin.includes(extra.id));
  if (repetido) {
    throw new HttpError(400, `${posicion}: no se puede agregar y quitar a la vez el ingrediente ${repetido.id}`);
  }

  let aclaracion = null;
  if (item.aclaracion !== undefined && item.aclaracion !== null) {
    if (typeof item.aclaracion !== 'string') {
      throw new HttpError(400, `${posicion}.aclaracion debe ser un texto`);
    }
    aclaracion = item.aclaracion.trim() || null;
    if (aclaracion && aclaracion.length > LARGO_MAXIMO_ACLARACION) {
      throw new HttpError(400, `${posicion}.aclaracion no puede superar los ${LARGO_MAXIMO_ACLARACION} caracteres`);
    }
  }
  return { extras, sin, aclaracion };
}

/**
 * Valida body.platos y devuelve los ítems [{ id, cantidad, extras, sin, aclaracion }].
 * Si un plato aparece varias veces con la misma personalización, sus cantidades
 * se suman en un solo ítem; con personalizaciones distintas quedan ítems separados.
 * Cualquier otro campo del cuerpo (id_usuario, fecha, estado...) se ignora:
 * el usuario sale del JWT y la fecha y el estado los asigna el servidor.
 */
function validarPlatosDelPedido(body) {
  if (!esObjetoPlano(body)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON con la propiedad "platos"');
  }
  const { platos } = body;
  if (platos === undefined) {
    throw new HttpError(400, 'Falta la propiedad "platos"');
  }
  if (!Array.isArray(platos)) {
    throw new HttpError(400, '"platos" debe ser un array de objetos { id, cantidad }');
  }
  if (platos.length === 0) {
    throw new HttpError(400, 'El pedido debe incluir al menos un plato');
  }

  const items = new Map(); // clave de la personalización → ítem
  platos.forEach((item, indice) => {
    const posicion = `platos[${indice}]`;
    if (!esObjetoPlano(item)) {
      throw new HttpError(400, `${posicion} debe ser un objeto { id, cantidad }`);
    }
    if (!esEnteroEnRango(item.id, 1)) {
      throw new HttpError(400, `${posicion}.id debe ser un número entero positivo`);
    }
    if (!esEnteroEnRango(item.cantidad, 1)) {
      throw new HttpError(400, `${posicion}.cantidad debe ser un número entero mayor que 0`);
    }
    const personalizacion = validarPersonalizacion(item, posicion);
    const clave = JSON.stringify([item.id, personalizacion.extras, personalizacion.sin, personalizacion.aclaracion]);
    const anterior = items.get(clave);
    const total = (anterior?.cantidad ?? 0) + item.cantidad;
    if (total > MAX_ENTERO) {
      throw new HttpError(400, `La cantidad total del plato ${item.id} es demasiado grande`);
    }
    items.set(clave, { id: item.id, cantidad: total, ...personalizacion });
  });

  return [...items.values()];
}

/**
 * Comprueba la personalización de cada ítem contra las opciones del plato y
 * calcula su precio unitario: precio del plato + extras. Quitar no descuenta.
 * Devuelve los ítems con precioUnitario y el precio de cada extra.
 */
function cotizarItems(items, platosPorId, opciones) {
  return items.map((item) => {
    const plato = platosPorId.get(item.id);
    const delPlato = new Map(opciones.filter((opcion) => opcion.id_plato === item.id).map((opcion) => [opcion.id, opcion]));
    let precioUnitario = plato.precio;

    const extras = item.extras.map((extra) => {
      const opcion = delPlato.get(extra.id);
      if (!opcion || opcion.maximo === 0) {
        throw new HttpError(400, `"${plato.nombre}" no admite el ingrediente ${extra.id} como extra`);
      }
      if (!opcion.disponible) {
        throw new HttpError(400, `${opcion.nombre} no está disponible en este momento`);
      }
      if (extra.cantidad > opcion.maximo) {
        throw new HttpError(
          400,
          `A "${plato.nombre}" se le pueden agregar como máximo ${opcion.maximo} de ${opcion.nombre}`
        );
      }
      precioUnitario += opcion.precio * extra.cantidad;
      return { ...extra, precio: opcion.precio };
    });

    for (const idIngrediente of item.sin) {
      if (!delPlato.get(idIngrediente)?.incluido) {
        throw new HttpError(400, `"${plato.nombre}" no lleva el ingrediente ${idIngrediente}, así que no se puede quitar`);
      }
    }
    if (precioUnitario > MAX_ENTERO) {
      throw new HttpError(400, `El precio de "${plato.nombre}" con sus extras es demasiado grande`);
    }
    return { ...item, extras, precioUnitario };
  });
}

async function listarPedidos() {
  return pedidosController.listarPedidos();
}

/** El id llega del JWT verificado, nunca del cliente. */
async function listarPedidosDelUsuario(idUsuario) {
  return pedidosController.listarPedidosPorUsuario(idUsuario);
}

async function obtenerPedido(idParametro) {
  const id = validarId(idParametro, 'pedido');
  const pedido = await pedidosController.buscarPedidoPorId(id);
  if (!pedido) {
    throw new HttpError(404, `No existe un pedido con id ${id}`);
  }
  return pedido;
}

async function crearPedido(idUsuario, body) {
  const items = validarPlatosDelPedido(body);

  // Pedido, ítems y personalizaciones se guardan juntos: si algo falla, ROLLBACK de todo.
  const idPedido = await conTransaccion(async (cliente) => {
    const ids = [...new Set(items.map((item) => item.id))];
    const platos = await platosController.buscarPlatosPorIds(ids, cliente);
    const platosPorId = new Map(platos.map((plato) => [plato.id, plato]));
    const inexistentes = ids.filter((id) => !platosPorId.has(id));
    if (inexistentes.length > 0) {
      const lista = inexistentes.join(', ');
      throw new HttpError(
        404,
        inexistentes.length === 1 ? `No existe un plato con id ${lista}` : `No existen platos con id ${lista}`
      );
    }

    // El precio lo calcula siempre el servidor: el cliente solo elige qué quiere
    const opciones = await ingredientesController.listarOpcionesDePlatos(ids, cliente);
    const cotizados = cotizarItems(items, platosPorId, opciones);

    const id = await pedidosController.crearPedido(idUsuario, cliente);
    for (const item of cotizados) {
      const idItem = await pedidosController.agregarPlatoAlPedido(id, item, cliente);
      for (const extra of item.extras) {
        await pedidosController.agregarPersonalizacion(
          idItem,
          { idIngrediente: extra.id, accion: 'agregar', cantidad: extra.cantidad, precio: extra.precio },
          cliente
        );
      }
      for (const idIngrediente of item.sin) {
        await pedidosController.agregarPersonalizacion(
          idItem,
          { idIngrediente, accion: 'quitar', cantidad: 1, precio: 0 },
          cliente
        );
      }
    }
    return id;
  });

  return pedidosController.buscarPedidoPorId(idPedido);
}

async function cambiarEstado(idParametro, accion) {
  const id = validarId(idParametro, 'pedido');
  const { desde, hacia } = TRANSICIONES[accion];

  const actualizado = await pedidosController.actualizarEstado(id, desde, hacia);
  if (!actualizado) {
    const estadoActual = await pedidosController.obtenerEstado(id);
    if (estadoActual === null) {
      throw new HttpError(404, `No existe un pedido con id ${id}`);
    }
    throw new HttpError(
      409,
      `No se puede pasar el pedido ${id} a «${hacia}»: está «${estadoActual}» y debe estar «${desde}»`
    );
  }
  return pedidosController.buscarPedidoPorId(id);
}

const aceptarPedido = (idParametro) => cambiarEstado(idParametro, 'aceptar');
const comenzarPedido = (idParametro) => cambiarEstado(idParametro, 'comenzar');
const entregarPedido = (idParametro) => cambiarEstado(idParametro, 'entregar');

async function eliminarPedido(idParametro) {
  const id = validarId(idParametro, 'pedido');
  await conTransaccion(async (cliente) => {
    // Primero las filas de PlatosXPedidos y después el pedido, en la misma transacción
    await pedidosController.eliminarPlatosDelPedido(id, cliente);
    const eliminado = await pedidosController.eliminarPedido(id, cliente);
    if (!eliminado) {
      throw new HttpError(404, `No existe un pedido con id ${id}`);
    }
  });
  return { message: 'Pedido eliminado correctamente' };
}

module.exports = {
  listarPedidos,
  listarPedidosDelUsuario,
  obtenerPedido,
  crearPedido,
  aceptarPedido,
  comenzarPedido,
  entregarPedido,
  eliminarPedido,
};
