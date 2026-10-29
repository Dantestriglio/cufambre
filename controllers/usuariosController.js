/**
 * controllers/usuariosController.js — Consultas de administración de la tabla Usuarios.
 * Igual que en authController, nunca se selecciona la columna password.
 */
const { pool } = require('../dbconfig');

const COLUMNAS_PUBLICAS = 'id, nombre, apellido, email, admin';

/** Todos los usuarios con la cantidad de pedidos que hicieron. */
async function listarUsuarios() {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.admin, COUNT(p.id)::int AS pedidos
       FROM Usuarios u
       LEFT JOIN Pedidos p ON p.id_usuario = u.id
      GROUP BY u.id
      ORDER BY u.id`
  );
  return rows;
}

/** Devuelve el usuario actualizado, o null si no existe. */
async function actualizarRol(id, admin) {
  const { rows } = await pool.query(`UPDATE Usuarios SET admin = $1 WHERE id = $2 RETURNING ${COLUMNAS_PUBLICAS}`, [
    admin,
    id,
  ]);
  return rows[0] ?? null;
}

/** Devuelve el usuario actualizado, o null si no existe. Lanza 23505 si el email ya está en uso. */
async function actualizarDatos(id, { nombre, apellido, email }) {
  const { rows } = await pool.query(
    `UPDATE Usuarios SET nombre = $1, apellido = $2, email = $3 WHERE id = $4 RETURNING ${COLUMNAS_PUBLICAS}`,
    [nombre, apellido, email, id]
  );
  return rows[0] ?? null;
}

/** true si otro usuario (distinto de idExcluido) ya usa ese email. */
async function emailEnUso(email, idExcluido) {
  const { rows } = await pool.query('SELECT 1 FROM Usuarios WHERE LOWER(email) = LOWER($1) AND id <> $2', [
    email,
    idExcluido,
  ]);
  return rows.length > 0;
}

/** Borra los pedidos del usuario (sus ítems y personalizaciones caen en cascada). Devuelve cuántos borró. */
async function eliminarPedidosDelUsuario(id, db) {
  const { rowCount } = await db.query('DELETE FROM Pedidos WHERE id_usuario = $1', [id]);
  return rowCount;
}

/** Devuelve true si se eliminó el usuario. */
async function eliminarUsuario(id, db) {
  const { rowCount } = await db.query('DELETE FROM Usuarios WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  listarUsuarios,
  actualizarRol,
  actualizarDatos,
  emailEnUso,
  eliminarPedidosDelUsuario,
  eliminarUsuario,
};
