// Imagen de cada plato. La tabla Platos de la consigna no tiene columna de imagen,
// así que se asocia por nombre: "Clásica CUFAMBRE" → images/burgers/clasica-cufambre.svg.
// Los platos nuevos que cargue un administrador usan la ilustración genérica de su tipo.

const IMAGENES = {
  principal: {
    carpeta: 'burgers',
    generica: 'nueva-hamburguesa',
    disponibles: [
      'clasica-cufambre',
      'doble-cheddar-bacon',
      'la-picante',
      'crispy-chicken',
      'veggie-garden',
      'la-bestia',
      'azul-y-hongos',
      'la-argenta',
    ],
  },
  combo: {
    carpeta: 'combos',
    generica: 'nuevo-combo',
    disponibles: ['combo-clasico', 'combo-doble-bacon', 'combo-crispy', 'combo-familiar'],
  },
  postre: {
    carpeta: 'desserts',
    generica: 'nuevo-postre',
    disponibles: [
      'brownie-con-helado',
      'sundae-de-dulce-de-leche',
      'cheesecake-de-frutos-rojos',
      'churros-con-dulce-de-leche',
    ],
  },
};

/** "Clásica CUFAMBRE" → "clasica-cufambre" */
export function aSlug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function imagenDePlato(plato) {
  const grupo = IMAGENES[plato.tipo] ?? IMAGENES.principal;
  const slug = aSlug(plato.nombre);
  const archivo = grupo.disponibles.includes(slug) ? slug : grupo.generica;
  return `images/${grupo.carpeta}/${archivo}.svg`;
}
