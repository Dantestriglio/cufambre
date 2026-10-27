/**
 * Error con código de estado HTTP. Los servicios lo lanzan y el middleware
 * de errores lo convierte en una respuesta { message } con ese código.
 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Códigos de error de PostgreSQL que la API trata de forma específica. */
const CODIGOS_PG = {
  VIOLACION_UNICA: '23505',
  VIOLACION_CLAVE_FORANEA: '23503',
};

module.exports = { HttpError, CODIGOS_PG };
