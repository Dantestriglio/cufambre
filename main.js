/**
 * main.js — Servidor de CUFAMBRE.
 *
 * Crea la aplicación Express, sirve el frontend, monta la API y centraliza el
 * manejo de errores. Al iniciar verifica la conexión a PostgreSQL y ejecuta
 * database/schema.sql (idempotente: no borra tablas ni datos).
 */
const path = require('node:path');
const express = require('express');
const rutas = require('./routes/routes');
const { rutaNoEncontrada, manejarErrores } = require('./middleware/errores');
const { verificarConexion } = require('./dbconfig');
const { inicializarBaseDeDatos } = require('./database/init');
const { platosController } = require('./controllers/controllers');
const { obtenerSecretoJwt } = require('./utils/jwt');

const app = express();
app.disable('x-powered-by');

// Frontend: HTML, CSS, JS e imágenes de public/
app.use(express.static(path.join(__dirname, 'public')));

// Registro breve de cada llamada a la API (sin cuerpos ni encabezados)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const inicio = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - inicio} ms)`);
    });
    next();
  });
}

// API REST. Sus respuestas no se guardan en caché: tienen datos privados o que cambian.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(rutas);

// Rutas inexistentes y errores: siempre JSON { message }
app.use(rutaNoEncontrada);
app.use(manejarErrores);

function escuchar(puerto) {
  return new Promise((resolve, reject) => {
    const servidor = app.listen(puerto, (error) => {
      if (!error) return resolve(servidor);
      if (error.code === 'EADDRINUSE') {
        return reject(new Error(`El puerto ${puerto} ya está en uso. Cambiá PORT en el archivo .env.`));
      }
      return reject(error);
    });
  });
}

async function iniciarServidor() {
  obtenerSecretoJwt(); // corta el inicio si falta JWT_SECRET

  const conexion = await verificarConexion();
  console.log(`✔ PostgreSQL ${conexion.version}: ${conexion.descripcion}`);

  await inicializarBaseDeDatos();
  console.log('✔ Tablas verificadas con database/schema.sql');

  const platos = await platosController.listarPlatos();
  if (platos.length === 0) {
    console.log('ℹ La tabla Platos está vacía. Cargá el menú de ejemplo con: npm run db:seed');
  }

  const puerto = Number(process.env.PORT) || 3000;
  await escuchar(puerto);
  console.log(`🍔 CUFAMBRE escuchando en http://localhost:${puerto}`);
}

if (require.main === module) {
  iniciarServidor().catch((error) => {
    console.error(`✖ No se pudo iniciar CUFAMBRE: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
