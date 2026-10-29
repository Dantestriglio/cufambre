/**
 * controllers/ingredientesController.js — Acceso a datos de Ingredientes e
 * IngredientesXPlatos (qué ingredientes trae cada plato y cuáles se pueden agregar).
 *
 * Las funciones que forman parte de una transacción reciben el cliente `db`
 * que entrega conTransaccion(); el resto usa el pool.
 */
const { pool } = require('../dbconfig');

// platos = en cuántos platos se ofrece el ingrediente (útil para el panel de administración)
const SELECT_INGREDIENTES = `
  SELECT i.id, i.nombre, i.precio, i.disponible,
         (SELECT COUNT(*)::int FROM IngredientesXPlatos ixp WHERE ixp.id_ingrediente = i.id) AS platos
    FROM Ingredientes i`;

const SELECT_OPCIONES = `
  SELECT ixp.id_plato, i.id, i.nombre, i.precio, i.disponible, ixp.incluido, ixp.maximo
    FROM IngredientesXPlatos ixp
    JOIN Ingredientes i ON i.id = ixp.id_ingrediente`;

// Primero lo que viene incluido y después los extras, cada grupo por nombre
const ORDEN_OPCIONES = 'ORDER BY ixp.id_plato, ixp.incluido DESC, i.nombre';

async function listarIngredientes() {
  const { rows } = await pool.query(`${SELECT_INGREDIENTES} ORDER BY i.nombre`);
  return rows;
}

async function buscarIngredientePorId(id) {
  const { rows } = await pool.query(`${SELECT_INGREDIENTES} WHERE i.id = $1`, [id]);
  return rows[0] ?? null;
}

async function crearIngrediente({ nombre, precio, disponible }) {
  const { rows } = await pool.query(
    `INSERT INTO Ingredientes (nombre, precio, disponible) VALUES ($1, $2, $3) RETURNING id`,
    [nombre, precio, disponible]
  );
  return buscarIngredientePorId(rows[0].id);
}

/** Devuelve el ingrediente actualizado, o null si no existe. */
async function actualizarIngrediente(id, { nombre, precio, disponible }) {
  const { rowCount } = await pool.query(
    'UPDATE Ingredientes SET nombre = $1, precio = $2, disponible = $3 WHERE id = $4',
    [nombre, precio, disponible, id]
  );
  return rowCount > 0 ? buscarIngredientePorId(id) : null;
}

/** Devuelve true si se eliminó. Lanza el error 23503 si el ingrediente figura en algún pedido. */
async function eliminarIngrediente(id) {
  const { rowCount } = await pool.query('DELETE FROM Ingredientes WHERE id = $1', [id]);
  return rowCount > 0;
}

/** De una lista de ids, devuelve los que existen en Ingredientes. */
async function buscarIdsExistentes(ids, db = pool) {
  const { rows } = await db.query('SELECT id FROM Ingredientes WHERE id = ANY($1::int[])', [ids]);
  return rows.map((fila) => fila.id);
}

/** Opciones de todos los platos. Con soloDisponibles se omiten los ingredientes agotados. */
async function listarOpciones({ soloDisponibles = false } = {}) {
  const filtro = soloDisponibles ? 'WHERE i.disponible' : '';
  const { rows } = await pool.query(`${SELECT_OPCIONES} ${filtro} ${ORDEN_OPCIONES}`);
  return rows;
}

/** Opciones (incluidos los agotados) de una lista de platos. Acepta un cliente de transacción. */
async function listarOpcionesDePlatos(idsPlatos, db = pool) {
  const { rows } = await db.query(`${SELECT_OPCIONES} WHERE ixp.id_plato = ANY($1::int[]) ${ORDEN_OPCIONES}`, [
    idsPlatos,
  ]);
  return rows;
}

/** Reemplaza todas las opciones de un plato por la lista recibida [{ id, incluido, maximo }]. */
async function reemplazarOpcionesDePlato(idPlato, opciones, db) {
  await db.query('DELETE FROM IngredientesXPlatos WHERE id_plato = $1', [idPlato]);
  for (const opcion of opciones) {
    await db.query(
      'INSERT INTO IngredientesXPlatos (id_plato, id_ingrediente, incluido, maximo) VALUES ($1, $2, $3, $4)',
      [idPlato, opcion.id, opcion.incluido, opcion.maximo]
    );
  }
}

module.exports = {
  listarIngredientes,
  buscarIngredientePorId,
  crearIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
  buscarIdsExistentes,
  listarOpciones,
  listarOpcionesDePlatos,
  reemplazarOpcionesDePlato,
};
