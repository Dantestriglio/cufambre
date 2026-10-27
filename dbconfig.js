/**
 * dbconfig.js — Conexión a PostgreSQL (Neon) con pg.
 *
 * Origen de la configuración, en este orden:
 *   1. DATABASE_URL (la cadena de conexión que entrega Neon).
 *   2. PGHOST, PGUSER, PGDATABASE y PGPASSWORD (+ PGPORT opcional, 5432 por defecto).
 *
 * SSL: Neon exige conexiones cifradas. Siempre se verifica el certificado del
 * servidor y que corresponda al host (rejectUnauthorized: true, equivalente a
 * sslmode=verify-full). Solo se permite sslmode=disable con un PostgreSQL local.
 */
require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const { Pool, types } = require('pg');

// Las columnas DATE se devuelven como texto 'AAAA-MM-DD', sin convertirlas a
// Date: así no hay corrimientos por zona horaria y el formato coincide con la consigna.
types.setTypeParser(types.builtins.DATE, (valor) => valor);

const PUERTO_POR_DEFECTO = 5432;
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1']);
const MODOS_SSL_CON_VERIFICACION = new Set(['allow', 'prefer', 'require', 'verify-ca', 'verify-full']);

class ErrorDeConfiguracion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDeConfiguracion';
  }
}

/** Devuelve el valor de la variable, o undefined si está vacía o sigue siendo un marcador (****). */
function leerVariable(env, nombre) {
  const valor = (env[nombre] ?? '').trim();
  return valor === '' || /^\*+$/.test(valor) ? undefined : valor;
}

function datosDesdeUrl(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new ErrorDeConfiguracion(
      'DATABASE_URL no es una URL válida. Copiá la cadena de conexión de Neon, con la forma ' +
        'postgresql://usuario:contraseña@host/base?sslmode=require'
    );
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new ErrorDeConfiguracion('DATABASE_URL debe comenzar con postgresql:// o postgres://');
  }

  let datos;
  try {
    datos = {
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port ? Number(url.port) : PUERTO_POR_DEFECTO,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
  } catch {
    throw new ErrorDeConfiguracion('DATABASE_URL tiene caracteres mal codificados en el usuario, la contraseña o la base.');
  }

  const nombres = { host: 'el host', user: 'el usuario', password: 'la contraseña', database: 'el nombre de la base' };
  const faltantes = Object.keys(nombres).filter((campo) => !datos[campo]);
  if (faltantes.length > 0) {
    throw new ErrorDeConfiguracion(`A DATABASE_URL le falta ${faltantes.map((campo) => nombres[campo]).join(', ')}.`);
  }

  return {
    ...datos,
    sslmode: url.searchParams.get('sslmode') ?? undefined,
    sslrootcert: url.searchParams.get('sslrootcert') ?? undefined,
    channelBinding: url.searchParams.get('channel_binding') ?? undefined,
  };
}

function datosDesdeVariables(env) {
  const requeridas = ['PGHOST', 'PGUSER', 'PGDATABASE', 'PGPASSWORD'];
  const faltantes = requeridas.filter((nombre) => leerVariable(env, nombre) === undefined);
  if (faltantes.length === requeridas.length) {
    throw new ErrorDeConfiguracion(
      'Falta configurar la conexión a PostgreSQL. Definí DATABASE_URL (recomendado) o PGHOST, PGUSER, ' +
        'PGDATABASE y PGPASSWORD en el archivo .env, reemplazando los asteriscos por los datos reales de Neon ' +
        '(usá .env.example como modelo).'
    );
  }
  if (faltantes.length > 0) {
    throw new ErrorDeConfiguracion(
      `Sin DATABASE_URL, la conexión se arma con variables sueltas y faltan: ${faltantes.join(', ')}.`
    );
  }

  const puerto = leerVariable(env, 'PGPORT');
  const numeroDePuerto = puerto === undefined ? PUERTO_POR_DEFECTO : Number(puerto);
  if (!Number.isInteger(numeroDePuerto) || numeroDePuerto < 1 || numeroDePuerto > 65535) {
    throw new ErrorDeConfiguracion('PGPORT debe ser un número de puerto válido (por ejemplo 5432).');
  }

  return {
    host: leerVariable(env, 'PGHOST'),
    port: numeroDePuerto,
    user: leerVariable(env, 'PGUSER'),
    password: leerVariable(env, 'PGPASSWORD'),
    database: leerVariable(env, 'PGDATABASE'),
    sslmode: leerVariable(env, 'PGSSLMODE'),
    sslrootcert: leerVariable(env, 'PGSSLROOTCERT'),
    channelBinding: leerVariable(env, 'PGCHANNELBINDING'),
  };
}

function configurarSsl(host, sslmode = 'verify-full', sslrootcert) {
  const modo = sslmode.toLowerCase();

  if (modo === 'disable') {
    if (HOSTS_LOCALES.has(host)) return false;
    throw new ErrorDeConfiguracion(
      `sslmode=disable solo se admite con un PostgreSQL local. El host ${host} (Neon) requiere SSL.`
    );
  }
  if (!MODOS_SSL_CON_VERIFICACION.has(modo)) {
    throw new ErrorDeConfiguracion(
      `sslmode=${sslmode} no está permitido: CUFAMBRE siempre verifica el certificado del servidor. ` +
        'Usá sslmode=require (o verify-full).'
    );
  }

  // Cualquier modo con SSL se trata como verify-full: se valida la cadena de
  // certificados y el nombre del host. Nunca se desactiva la verificación.
  const ssl = { rejectUnauthorized: true };
  if (sslrootcert && sslrootcert !== 'system') {
    try {
      ssl.ca = fs.readFileSync(sslrootcert, 'utf8');
    } catch {
      throw new ErrorDeConfiguracion(`No se pudo leer el certificado raíz indicado en sslrootcert (${sslrootcert}).`);
    }
  }
  return ssl;
}

/** Arma la configuración del Pool a partir de las variables de entorno. Lanza ErrorDeConfiguracion. */
function construirConfiguracion(env = process.env) {
  const databaseUrl = leerVariable(env, 'DATABASE_URL');
  const datos = databaseUrl ? datosDesdeUrl(databaseUrl) : datosDesdeVariables(env);
  const ssl = configurarSsl(datos.host, datos.sslmode, datos.sslrootcert);

  return {
    host: datos.host,
    port: datos.port,
    user: datos.user,
    password: datos.password,
    database: datos.database,
    ssl,
    // channel_binding=require (incluido en las cadenas de Neon): usa SCRAM-SHA-256-PLUS sobre TLS.
    enableChannelBinding: Boolean(ssl) && ['require', 'prefer'].includes(datos.channelBinding),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  };
}

// Si la configuración es inválida no se corta la carga del módulo: el error se
// informa con un mensaje claro al iniciar (verificarConexion), sin trazas largas.
let configuracion = null;
let errorDeConfiguracion = null;
try {
  configuracion = construirConfiguracion(process.env);
} catch (error) {
  if (!(error instanceof ErrorDeConfiguracion)) throw error;
  errorDeConfiguracion = error;
}

const pool = new Pool(configuracion ?? {});

// Neon puede cerrar conexiones inactivas (por ejemplo al suspender el cómputo).
// Sin este manejador, ese error tiraría abajo todo el proceso.
pool.on('error', (error) => {
  console.error(`[db] Se cerró una conexión inactiva del pool: ${error.message}`);
});

/** Descripción segura de la conexión para los registros (sin usuario ni contraseña). */
function describirConexion() {
  if (!configuracion) return 'sin configurar';
  const ssl = configuracion.ssl ? 'SSL con certificado verificado' : 'sin SSL, solo para uso local';
  return `base "${configuracion.database}" en ${configuracion.host}:${configuracion.port} (${ssl})`;
}

/** Traduce los errores de conexión más comunes a un mensaje entendible. */
function explicarErrorDeConexion(error) {
  const mensaje = String(error.message || '');
  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') return 'No se encontró el host de la base de datos. Revisá PGHOST o DATABASE_URL.';
  if (error.code === 'ECONNREFUSED') return 'El servidor de PostgreSQL rechazó la conexión. ¿Está encendido y en ese puerto?';
  if (error.code === '28P01' || error.code === '28000') return 'Usuario o contraseña de PostgreSQL incorrectos.';
  if (error.code === '3D000') return `La base de datos "${configuracion?.database}" no existe.`;
  if (/does not support SSL/i.test(mensaje)) return 'El servidor no acepta SSL. Para un PostgreSQL local agregá sslmode=disable.';
  if (/certificate|self[- ]signed|altnames/i.test(mensaje)) return `No se pudo verificar el certificado SSL del servidor (${mensaje}).`;
  if (/timeout/i.test(mensaje)) return 'Se agotó el tiempo de espera al conectar con la base de datos.';
  return mensaje;
}

/** Verifica que la configuración sea válida y que la base responda. */
async function verificarConexion() {
  if (errorDeConfiguracion) throw errorDeConfiguracion;
  try {
    const { rows } = await pool.query("SELECT current_database() AS base, current_setting('server_version') AS version");
    return { base: rows[0].base, version: rows[0].version, descripcion: describirConexion() };
  } catch (error) {
    const errorClaro = new Error(`No se pudo conectar a PostgreSQL: ${explicarErrorDeConexion(error)}`);
    errorClaro.cause = error;
    throw errorClaro;
  }
}

/**
 * Ejecuta `operacion(cliente)` dentro de una transacción con un cliente dedicado.
 * Si la operación lanza un error se hace ROLLBACK, así no quedan datos a medias.
 */
async function conTransaccion(operacion) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await operacion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function cerrarConexiones() {
  await pool.end();
}

module.exports = {
  pool,
  verificarConexion,
  conTransaccion,
  cerrarConexiones,
  describirConexion,
  construirConfiguracion,
  ErrorDeConfiguracion,
};
