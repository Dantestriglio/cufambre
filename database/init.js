/**
 * database/init.js — Crea las tablas ejecutando database/schema.sql con pg.
 *
 * - Lo usa main.js al iniciar el servidor.
 * - También se puede ejecutar a mano: npm run db:init
 *
 * No borra tablas ni datos: el script solo usa CREATE ... IF NOT EXISTS y
 * migraciones con IF EXISTS / IF NOT EXISTS.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool, conTransaccion, verificarConexion, cerrarConexiones } = require('../dbconfig');

const RUTA_SCHEMA = path.join(__dirname, 'schema.sql');
const TABLAS = [
  'platos',
  'usuarios',
  'pedidos',
  'platosxpedidos',
  'ingredientes',
  'ingredientesxplatos',
  'personalizaciones',
];

/** Ejecuta schema.sql dentro de una transacción (o se crea todo, o no se crea nada). */
async function inicializarBaseDeDatos() {
  const sql = await fs.readFile(RUTA_SCHEMA, 'utf8');
  await conTransaccion(async (cliente) => {
    // Evita que dos instancias del servidor ejecuten el script al mismo tiempo
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('kingsciarra:schema'))");
    await cliente.query(sql);
  });
}

/** Devuelve cuáles de las tablas del proyecto existen en la base conectada. */
async function listarTablasExistentes() {
  const { rows } = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name`,
    [TABLAS]
  );
  return rows.map((fila) => fila.table_name);
}

async function main() {
  try {
    const conexion = await verificarConexion();
    console.log(`Conectado a PostgreSQL ${conexion.version}: ${conexion.descripcion}`);
    await inicializarBaseDeDatos();
    const existentes = await listarTablasExistentes();
    for (const tabla of TABLAS) {
      console.log(`  ${existentes.includes(tabla) ? '✔' : '✖'} ${tabla}`);
    }
    if (existentes.length !== TABLAS.length) process.exitCode = 1;
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await cerrarConexiones();
  }
}

if (require.main === module) {
  main();
}

module.exports = { inicializarBaseDeDatos, listarTablasExistentes, TABLAS };
