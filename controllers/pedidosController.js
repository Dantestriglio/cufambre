/**
 * controllers/pedidosController.js — Acceso a datos de Pedidos, PlatosXPedidos
 * y Personalizaciones.
 *
 * Las funciones que forman parte de una transacción reciben el cliente `db`
 * que entrega conTransaccion(); el resto usa el pool.
 */
const { pool } = require('../dbconfig');

// La fecha del pedido es el día actual en la hora local del negocio (Argentina),
// aunque el servidor de la base (Neon) trabaje en UTC.
const ZONA_HORARIA_NEGOCIO = 'America/Argentina/Buenos_Aires';

// Extras agregados o ingredientes quitados de un ítem (pp), como array JSON
const personalizacion = (accion, campos) => `(
  SELECT COALESCE(json_agg(json_build_object(${campos}) ORDER BY pz.id), '[]'::json)
    FROM Personalizaciones pz
    JOIN Ingredientes i ON i.id = pz.id_ingrediente
   WHERE pz.id_item = pp.id AND pz.accion = '${accion}'
)`;

// Un pedido con su cliente y sus platos armados en una sola consulta con json_agg.
// precio es el de una unidad con sus extras; los ítems anteriores a la
// personalización no tienen precio_unitario y usan el precio actual del plato.
const SELECT_PEDIDOS = `
  SELECT p.id, p.id_usuario, p.fecha, p.estado,
         json_build_object('nombre', u.nombre, 'apellido', u.apellido, 'email', u.email) AS usuario,
         COALESCE(
           json_agg(
             json_build_object(
               'id', pl.id,
               'cantidad', pp.cantidad,
               'nombre', pl.nombre,
               'tipo', pl.tipo,
               'precio', COALESCE(pp.precio_unitario, pl.precio),
               'extras', ${personalizacion('agregar', "'id', i.id, 'nombre', i.nombre, 'cantidad', pz.cantidad, 'precio', pz.precio")},
               'sin', ${personalizacion('quitar', "'id', i.id, 'nombre', i.nombre")},
               'aclaracion', pp.aclaracion
             )
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

/** Inserta un ítem { id, cantidad, precioUnitario, aclaracion } del pedido. Devuelve el id del ítem. */
async function agregarPlatoAlPedido(idPedido, item, db) {
  const { rows } = await db.query(
    `INSERT INTO PlatosXPedidos (id_pedido, id_plato, cantidad, precio_unitario, aclaracion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [idPedido, item.id, item.cantidad, item.precioUnitario, item.aclaracion]
  );
  return rows[0].id;
}

/** Guarda un extra agregado o un ingrediente quitado de un ítem. */
async function agregarPersonalizacion(idItem, { idIngrediente, accion, cantidad, precio }, db) {
  await db.query(
    `INSERT INTO Personalizaciones (id_item, id_ingrediente, accion, cantidad, precio)
     VALUES ($1, $2, $3, $4, $5)`,
    [idItem, idIngrediente, accion, cantidad, precio]
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
  agregarPersonalizacion,
  actualizarEstado,
  eliminarPlatosDelPedido,
  eliminarPedido,
};
