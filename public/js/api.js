// Cliente de la API REST de CUFAMBRE (mismo origen que el frontend).

export class ErrorApi extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
  }
}

let alNoAutorizado = null;

/** Registra qué hacer cuando una llamada con token recibe 401 (token vencido o inválido). */
export function configurarNoAutorizado(funcion) {
  alNoAutorizado = funcion;
}

async function pedir(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = new ErrorApi(respuesta.status, datos?.message ?? `Error ${respuesta.status}`);
    if (respuesta.status === 401 && token && alNoAutorizado) alNoAutorizado(error);
    throw error;
  }
  return datos;
}

export const api = {
  // Platos
  listarPlatos: () => pedir('/platos'),
  listarPlatosPorTipo: (tipo) => pedir(`/platos/tipo/${encodeURIComponent(tipo)}`),
  crearPlato: (token, plato) => pedir('/platos', { metodo: 'POST', cuerpo: plato, token }),
  actualizarPlato: (token, id, plato) => pedir(`/platos/${id}`, { metodo: 'PUT', cuerpo: plato, token }),
  eliminarPlato: (token, id) => pedir(`/platos/${id}`, { metodo: 'DELETE', token }),

  // Autenticación
  registrar: (datos) => pedir('/auth/register', { metodo: 'POST', cuerpo: datos }),
  ingresar: (credenciales) => pedir('/auth/login', { metodo: 'POST', cuerpo: credenciales }),

  // Pedidos
  misPedidos: (token) => pedir('/pedidos/usuario', { token }),
  todosLosPedidos: (token) => pedir('/pedidos', { token }),
  crearPedido: (token, platos) => pedir('/pedidos', { metodo: 'POST', cuerpo: { platos }, token }),
  cambiarEstado: (token, id, accion) => pedir(`/pedidos/${id}/${accion}`, { metodo: 'PUT', token }),
  eliminarPedido: (token, id) => pedir(`/pedidos/${id}`, { metodo: 'DELETE', token }),
};
