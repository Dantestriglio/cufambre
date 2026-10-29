/**
 * database/demo.js — Carga los datos de demostración (usuarios y pedidos).
 *
 *   npm run db:demo
 *
 * Ejecuta database/datos_demo.sql con la conexión del .env. Antes asegura las
 * tablas y el menú de ejemplo (igual que npm run db:seed), porque los pedidos
 * de demostración usan esos platos e ingredientes.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool, verificarConexion, cerrarConexiones } = require('../dbconfig');
const { sembrarMenu } = require('./seed');
const { inicializarBaseDeDatos } = require('./init');

async function main() {
  const cliente = { liberar: null };
  try {
    const conexion = await verificarConexion();
    console.log(`Conectado: ${conexion.descripcion}`);
    await inicializarBaseDeDatos();
    await sembrarMenu();

    const sql = await fs.readFile(path.join(__dirname, 'datos_demo.sql'), 'utf8');
    const db = await pool.connect();
    cliente.liberar = () => db.release();
    db.on('notice', (aviso) => console.log(`ℹ ${aviso.message}`));
    const resultados = await db.query(sql);
    const resumen = [].concat(resultados).at(-1).rows;
    console.log('✔ Pedidos de demostración por estado:');
    for (const fila of resumen) console.log(`  ${fila.estado}: ${fila.pedidos}`);
    console.log('  Usuarios @demo.kingsciarra.com, contraseña: clave123 (administradora: martina.sciarra@demo.kingsciarra.com)');
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  } finally {
    cliente.liberar?.();
    await cerrarConexiones();
  }
}

main();
