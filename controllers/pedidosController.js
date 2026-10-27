/**
 * controllers/pedidosController.js — Acceso a datos de Pedidos y PlatosXPedidos.
 *
 * Las funciones que forman parte de una transacción reciben el cliente `db`
 * que entrega conTransaccion(); el resto usa el pool.
 */
const { pool } = require('../dbconfig');

// La fecha del pedido es el día actual en la hora local del negocio (Argentina),
// aunque el servidor de la base (Neon) trabaje en UTC.
const ZONA_HORARIA_NEGOCIO = 'America/Argentina/Buenos_Aires';

// Un pedido con su cliente y sus platos (id, cantidad y datos descriptivos)
// armados en una sola consulta con json_agg.
const SELECT_PEDIDOS = `
  SELECT p.id, p.id_usuario, p.fecha, p.estado,
         json_build_object('nombre', u.nombre, 'apellido', u.apellido, 'email', u.email) AS usuario,
         COALESCE(
           json_agg(
             json_build_object('id', pl.id, 'cantidad', pp.cantidad, 'nombre', pl.nombre, 'precio', pl.precio)
             ORDER BY pp.id
           ) FILTER (WHERE pp.id IS NOT NULL),
           '[]'::json
         ) AS platos
    FROM Pedidos p
    JOIN Usuarios u ON u.id = p.id_usuario
    LEFT JOIN PlatosXPedidos pp ON pp.id_pedido = p.id
    LEFT JOIN Platos pl ON pl.id = pp.id_plato`;

const AGRUPAR = 'GROUP BY p.id, u.id';

async function listarPedidos() {
  const { rows } = await pool.query(`${SELECT_PEDIDOS} ${AGRUPAR} ORDER BY p.id DESC`);
  return rows;
}

async function listarPedidosPorUsuario(idUsuario) {
  const { rows } = await pool.query(
    `${SELECT_PEDIDOS} WHERE p.id_usuario = $1 ${AGRUPAR} ORDER BY p.id DESC`,
    [idUsuario]
  );
  return rows;
}

async function buscarPedidoPorId(id) {
  const { rows } = await pool.query(`${SELECT_PEDIDOS} WHERE p.id = $1 ${AGRUPAR}`, [id]);
  return rows[0] ?? null;
}

/** Devuelve el estado actual del pedido, o null si no existe. */
async function obtenerEstado(id) {
  const { rows } = await pool.query('SELECT estado FROM Pedidos WHERE id = $1', [id]);
  return rows[0]?.estado ?? null;
}

/** Inserta el pedido con la fecha del servidor y estado 'pendiente'. Devuelve su id. */
async function crearPedido(idUsuario, db) {
  const { rows } = await db.query(
    `INSERT INTO Pedidos (id_usuario, fecha, estado)
     VALUES ($1, (now() AT TIME ZONE $2)::date, 'pendiente')
     RETURNING id`,
    [idUsuario, ZONA_HORARIA_NEGOCIO]
  );
  return rows[0].id;
}

async function agregarPlatoAlPedido(idPedido, idPlato, cantidad, db) {
  await db.query(
    'INSERT INTO PlatosXPedidos (id_pedido, id_plato, cantidad) VALUES ($1, $2, $3)',
    [idPedido, idPlato, cantidad]
  );
}

/**
 * Cambia el estado solo si el pedido sigue en `estadoActual`. Al hacerlo en un
 * único UPDATE, dos administradores no pueden aplicar la misma transición a la vez.
 */
async function actualizarEstado(id, estadoActual, estadoNuevo) {
  const { rowCount } = await pool.query(
    'UPDATE Pedidos SET estado = $1 WHERE id = $2 AND estado = $3',
    [estadoNuevo, id, estadoActual]
  );
  return rowCount > 0;
}

async function eliminarPlatosDelPedido(idPedido, db) {
  await db.query('DELETE FROM PlatosXPedidos WHERE id_pedido = $1', [idPedido]);
}

/** Devuelve true si se eliminó el pedido. */
async function eliminarPedido(id, db) {
  const { rowCount } = await db.query('DELETE FROM Pedidos WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  listarPedidos,
  listarPedidosPorUsuario,
  buscarPedidoPorId,
  obtenerEstado,
  crearPedido,
  agregarPlatoAlPedido,
  actualizarEstado,
  eliminarPlatosDelPedido,
  eliminarPedido,
};
