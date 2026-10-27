/**
 * controllers/platosController.js — Acceso a datos de la tabla Platos.
 * SQL explícito ejecutado con pg; los valores siempre van como parámetros $1, $2...
 */
const { pool } = require('../dbconfig');

const COLUMNAS = 'id, tipo, nombre, precio, descripcion';

async function listarPlatos() {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM Platos ORDER BY id`);
  return rows;
}

async function buscarPlatoPorId(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM Platos WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function listarPlatosPorTipo(tipo) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM Platos WHERE tipo = $1 ORDER BY id`, [tipo]);
  return rows;
}

async function crearPlato({ tipo, nombre, precio, descripcion }) {
  const { rows } = await pool.query(
    `INSERT INTO Platos (tipo, nombre, precio, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS}`,
    [tipo, nombre, precio, descripcion]
  );
  return rows[0];
}

/** Devuelve el plato actualizado, o null si no existe. */
async function actualizarPlato(id, { tipo, nombre, precio, descripcion }) {
  const { rows } = await pool.query(
    `UPDATE Platos
        SET tipo = $1, nombre = $2, precio = $3, descripcion = $4
      WHERE id = $5
      RETURNING ${COLUMNAS}`,
    [tipo, nombre, precio, descripcion, id]
  );
  return rows[0] ?? null;
}

/** Devuelve true si se eliminó. Lanza el error 23503 si el plato está en algún pedido. */
async function eliminarPlato(id) {
  const { rowCount } = await pool.query('DELETE FROM Platos WHERE id = $1', [id]);
  return rowCount > 0;
}

/** De una lista de ids, devuelve los que existen en Platos. Acepta un cliente de transacción. */
async function buscarIdsExistentes(ids, db = pool) {
  const { rows } = await db.query('SELECT id FROM Platos WHERE id = ANY($1::int[])', [ids]);
  return rows.map((fila) => fila.id);
}

module.exports = {
  listarPlatos,
  buscarPlatoPorId,
  listarPlatosPorTipo,
  crearPlato,
  actualizarPlato,
  eliminarPlato,
  buscarIdsExistentes,
};
