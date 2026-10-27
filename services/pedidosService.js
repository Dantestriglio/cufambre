/**
 * services/pedidosService.js — Lógica de negocio de los pedidos.
 */
const { platosController, pedidosController, conTransaccion } = require('../controllers/controllers');
const { HttpError } = require('../utils/httpError');
const { MAX_ENTERO, esObjetoPlano, esEnteroEnRango, validarId } = require('../utils/validaciones');

// Flujo de estados: pendiente → aceptado → en camino → entregado
const TRANSICIONES = {
  aceptar: { desde: 'pendiente', hacia: 'aceptado' },
  comenzar: { desde: 'aceptado', hacia: 'en camino' },
  entregar: { desde: 'en camino', hacia: 'entregado' },
};

/**
 * Valida body.platos y devuelve [{ id, cantidad }] sin repetidos: si un plato
 * aparece varias veces, sus cantidades se suman en una sola fila.
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

  const cantidades = new Map();
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
    const total = (cantidades.get(item.id) ?? 0) + item.cantidad;
    if (total > MAX_ENTERO) {
      throw new HttpError(400, `La cantidad total del plato ${item.id} es demasiado grande`);
    }
    cantidades.set(item.id, total);
  });

  return [...cantidades].map(([id, cantidad]) => ({ id, cantidad }));
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

  // Pedido y relaciones se guardan juntos: si algo falla, ROLLBACK de todo.
  const idPedido = await conTransaccion(async (cliente) => {
    const idsExistentes = await platosController.buscarIdsExistentes(items.map((item) => item.id), cliente);
    const inexistentes = items.filter((item) => !idsExistentes.includes(item.id)).map((item) => item.id);
    if (inexistentes.length > 0) {
      const lista = inexistentes.join(', ');
      throw new HttpError(
        404,
        inexistentes.length === 1 ? `No existe un plato con id ${lista}` : `No existen platos con id ${lista}`
      );
    }

    const id = await pedidosController.crearPedido(idUsuario, cliente);
    for (const item of items) {
      await pedidosController.agregarPlatoAlPedido(id, item.id, item.cantidad, cliente);
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
