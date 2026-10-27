// Sesión del usuario: guarda el JWT y lo da por terminado cuando vence (30 minutos).
// El rol que se usa acá solo decide qué se muestra: la API vuelve a verificar todo.

const CLAVE = 'cufambre.sesion';
let sesion = null;
let temporizador = null;
const oyentes = new Set();

/** Lee el vencimiento (exp) del payload del JWT, sin verificar la firma. */
function vencimientoDe(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function avisarCambio(motivo) {
  for (const oyente of oyentes) oyente(sesion, motivo);
}

function programarVencimiento() {
  clearTimeout(temporizador);
  const vence = vencimientoDe(sesion.token);
  if (vence) temporizador = setTimeout(() => cerrarSesion('vencida'), Math.max(0, vence - Date.now()));
}

export function alCambiarSesion(funcion) {
  oyentes.add(funcion);
}

export function obtenerSesion() {
  return sesion;
}

export function obtenerToken() {
  return sesion?.token ?? null;
}

export function esAdmin() {
  return sesion?.usuario?.admin === true;
}

export function iniciarSesion({ token, usuario }) {
  sesion = { token, usuario };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento disponible la sesión dura hasta recargar la página
  }
  programarVencimiento();
  avisarCambio('inicio');
}

export function cerrarSesion(motivo = 'salida') {
  if (!sesion) return;
  sesion = null;
  clearTimeout(temporizador);
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que limpiar
  }
  avisarCambio(motivo);
}

/** Recupera la sesión guardada si el token todavía no venció. */
export function restaurarSesion() {
  let guardada = null;
  try {
    guardada = JSON.parse(localStorage.getItem(CLAVE));
  } catch {
    guardada = null;
  }
  const vence = guardada?.token ? vencimientoDe(guardada.token) : null;
  if (!guardada?.usuario || !vence || vence - Date.now() < 5000) {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // nada que limpiar
    }
    return;
  }
  sesion = guardada;
  programarVencimiento();
}
