/**
 * tests/helpers.js — Utilidades compartidas por las pruebas automáticas.
 *
 * Las pruebas se conectan a TEST_DATABASE_URL (nunca a la base de producción),
 * levantan la API en un puerto libre y al terminar borran SOLO los datos que
 * crearon: usuarios con email @test.cufambre, sus pedidos y platos "TEST ...".
 */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'Definí TEST_DATABASE_URL (en .env o en la terminal) con una base de datos SOLO para pruebas. Ver README.'
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET || /^\*+$/.test(process.env.JWT_SECRET.trim())) {
  process.env.JWT_SECRET = 'clave-solo-para-las-pruebas-automaticas-de-cufambre';
}

const app = require('../main');
const { pool, cerrarConexiones } = require('../dbconfig');
const { inicializarBaseDeDatos } = require('../database/init');

const DOMINIO_DE_PRUEBA = '@test.cufambre';
const PREFIJO_DE_PLATOS = 'TEST ';

/** Levanta la API en un puerto libre y devuelve una función para llamarla. */
async function iniciarApi() {
  await inicializarBaseDeDatos();
  const servidor = await new Promise((resolve, reject) => {
    const instancia = app.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve(instancia)));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function api(metodo, ruta, { token, body, crudo, encabezados = {} } = {}) {
    const headers = { ...encabezados };
    if (token) headers.Authorization = `Bearer ${token}`;
    let cuerpo;
    if (crudo !== undefined) {
      cuerpo = crudo;
      headers['Content-Type'] ??= 'application/json';
    } else if (body !== undefined) {
      cuerpo = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    const respuesta = await fetch(base + ruta, { method: metodo, headers, body: cuerpo });
    const texto = await respuesta.text();
    let datos = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = texto;
    }
    return { status: respuesta.status, body: datos, texto, headers: respuesta.headers };
  }

  async function cerrar() {
    await new Promise((resolve) => servidor.close(resolve));
    await limpiarDatosDePrueba();
    await cerrarConexiones();
  }

  return { api, cerrar };
}

function emailDePrueba(prefijo = 'cliente') {
  return `${prefijo}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}${DOMINIO_DE_PRUEBA}`;
}

/**
 * Registra un usuario por la API e inicia sesión. Si admin es true, le da el
 * rol modificando la base directamente, que es lo que indica la consigna.
 */
async function crearUsuario(api, { admin = false, nombre = 'Ana', apellido = 'Prueba' } = {}) {
  const datos = { nombre, apellido, email: emailDePrueba(admin ? 'admin' : 'cliente'), password: 'clave-segura-123' };
  const registro = await api('POST', '/auth/register', { body: datos });
  assert.equal(registro.status, 201, JSON.stringify(registro.body));
  if (admin) {
    await pool.query('UPDATE Usuarios SET admin = TRUE WHERE id = $1', [registro.body.id]);
  }
  const login = await api('POST', '/auth/login', { body: { email: datos.email, password: datos.password } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { ...registro.body, admin, password: datos.password, token: login.body.token };
}

/** Inserta un plato directamente en la base (nombre con prefijo "TEST "). */
async function crearPlatoDePrueba({ tipo = 'principal', nombre = 'Hamburguesa', precio = 1000, descripcion = 'Plato creado por las pruebas' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO Platos (tipo, nombre, precio, descripcion) VALUES ($1, $2, $3, $4)
     RETURNING id, tipo, nombre, precio, descripcion`,
    [tipo, `${PREFIJO_DE_PLATOS}${nombre}`, precio, descripcion]
  );
  return rows[0];
}

async function limpiarDatosDePrueba() {
  // Los pedidos arrastran sus filas de PlatosXPedidos (ON DELETE CASCADE)
  await pool.query(
    `DELETE FROM Pedidos WHERE id_usuario IN (SELECT id FROM Usuarios WHERE email LIKE '%' || $1)`,
    [DOMINIO_DE_PRUEBA]
  );
  await pool.query(`DELETE FROM Usuarios WHERE email LIKE '%' || $1`, [DOMINIO_DE_PRUEBA]);
  await pool.query(
    `DELETE FROM Platos WHERE nombre LIKE $1 || '%' AND id NOT IN (SELECT id_plato FROM PlatosXPedidos)`,
    [PREFIJO_DE_PLATOS]
  );
}

/** Fecha de hoy en la zona horaria del negocio, con formato AAAA-MM-DD. */
function fechaDeHoyEnArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

module.exports = {
  pool,
  iniciarApi,
  crearUsuario,
  crearPlatoDePrueba,
  emailDePrueba,
  fechaDeHoyEnArgentina,
  inicializarBaseDeDatos,
};
