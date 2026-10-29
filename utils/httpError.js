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
  // PostgreSQL 18 informa con este código el borrado frenado por ON DELETE RESTRICT
  VIOLACION_RESTRICT: '23001',
};

/** true si el error es un borrado o inserción frenado por una clave foránea. */
function esErrorDeClaveForanea(error) {
  return error.code === CODIGOS_PG.VIOLACION_CLAVE_FORANEA || error.code === CODIGOS_PG.VIOLACION_RESTRICT;
}

module.exports = { HttpError, CODIGOS_PG, esErrorDeClaveForanea };
