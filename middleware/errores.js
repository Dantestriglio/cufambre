/**
 * middleware/errores.js — Respuestas de error centralizadas.
 * Todas las respuestas son JSON { message } y nunca exponen trazas, SQL ni credenciales.
 */
const { HttpError } = require('../utils/httpError');

// Errores de PostgreSQL que pueden llegar sin que un servicio los haya tratado
const ERRORES_POSTGRES = {
  '23505': [409, 'El dato ya existe y debe ser único'],
  '23503': [409, 'La operación entra en conflicto con datos relacionados'],
  '23001': [409, 'La operación entra en conflicto con datos relacionados'],
  '23502': [400, 'Falta un dato obligatorio'],
  '23514': [400, 'Algún dato no cumple las restricciones de la base de datos'],
  '22P02': [400, 'Algún dato tiene un formato inválido'],
  '22001': [400, 'Algún texto supera la longitud máxima permitida'],
  '22003': [400, 'Algún número está fuera del rango permitido'],
};

// Base de datos inaccesible (caída, en reposo o sin red)
const ERRORES_DE_CONEXION = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P03', '53300']);

function rutaNoEncontrada(req, res) {
  res.status(404).json({ message: `No existe la ruta ${req.method} ${req.path}` });
}

// Express reconoce un middleware de errores por sus cuatro parámetros (next incluido)
function manejarErrores(error, req, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  // Errores de express.json() al leer el cuerpo
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la solicitud no es un JSON válido' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'El cuerpo de la solicitud es demasiado grande' });
  }
  if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
    return res.status(415).json({ message: 'Codificación del cuerpo no soportada: usá JSON en UTF-8' });
  }

  if (ERRORES_POSTGRES[error.code]) {
    const [status, message] = ERRORES_POSTGRES[error.code];
    return res.status(status).json({ message });
  }

  // El detalle queda solo en el registro del servidor (sin cuerpo ni encabezados de la solicitud)
  console.error(`[error] ${req.method} ${req.path}:`, error);

  if (ERRORES_DE_CONEXION.has(error.code) || /timeout exceeded when trying to connect/i.test(error.message)) {
    return res.status(503).json({ message: 'La base de datos no está disponible. Intentá de nuevo en unos segundos' });
  }
  return res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = { rutaNoEncontrada, manejarErrores };
