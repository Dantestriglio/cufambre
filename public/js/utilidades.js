// Utilidades de la interfaz: escape de HTML, formatos y avisos.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo en HTML (los datos de la API nunca se insertan sin escapar). */
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ENTIDADES[caracter]);
}

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatearPrecio(valor) {
  return formatoPrecio.format(valor);
}

/** '2026-10-26' → '26/10/2026' (sin pasar por Date para evitar corrimientos de zona horaria). */
export function formatearFecha(fechaIso) {
  const [anio, mes, dia] = String(fechaIso).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : String(fechaIso);
}

/**
 * Muestra un aviso temporal. Si hay un diálogo abierto, el aviso se ubica
 * dentro de él para que no quede tapado por el fondo del modal.
 */
export function avisar(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('avisos');
  const dialogoAbierto = document.querySelector('dialog[open]');
  const destino = dialogoAbierto ?? document.body;
  if (contenedor.parentElement !== destino) destino.append(contenedor);

  const aviso = document.createElement('div');
  aviso.className = `aviso aviso--${tipo}`;
  aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  aviso.textContent = mensaje;
  contenedor.append(aviso);
  while (contenedor.children.length > 3) contenedor.firstElementChild.remove();
  setTimeout(() => aviso.remove(), tipo === 'error' ? 6000 : 4000);
}

/** Calcula el total de un pedido o carrito: suma de precio × cantidad. */
export function calcularTotal(items) {
  return items.reduce((total, item) => total + (item.precio ?? 0) * item.cantidad, 0);
}
