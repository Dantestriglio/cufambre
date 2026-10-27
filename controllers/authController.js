/**
 * controllers/authController.js — Acceso a datos de la tabla Usuarios.
 * Las consultas públicas nunca seleccionan la columna password.
 */
const { pool } = require('../dbconfig');

const COLUMNAS_PUBLICAS = 'id, nombre, apellido, email, admin';

/**
 * Busca por email sin distinguir mayúsculas. Incluye el hash de la contraseña
 * porque lo necesita el login para compararlo: el servicio nunca lo devuelve.
 */
async function buscarUsuarioPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_PUBLICAS}, password FROM Usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] ?? null;
}

async function buscarUsuarioPorId(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS_PUBLICAS} FROM Usuarios WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Crea el usuario SIEMPRE con admin = FALSE. Recibe la contraseña ya hasheada. */
async function crearUsuario({ nombre, apellido, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO Usuarios (nombre, apellido, email, password, admin)
     VALUES ($1, $2, $3, $4, FALSE)
     RETURNING ${COLUMNAS_PUBLICAS}`,
    [nombre, apellido, email, passwordHash]
  );
  return rows[0];
}

module.exports = { buscarUsuarioPorEmail, buscarUsuarioPorId, crearUsuario };
