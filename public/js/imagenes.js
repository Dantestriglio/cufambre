// Imagen de cada plato. La tabla Platos no tiene columna de imagen, así que se
// asocia por nombre: "Clásica King" → images/burgers/clasica-king.svg.
// Los platos nuevos que cargue un administrador usan la ilustración genérica de su tipo.

const IMAGENES = {
  principal: {
    carpeta: 'burgers',
    generica: 'nueva-hamburguesa',
    disponibles: [
      'clasica-king',
      'la-king-sciarra',
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
    disponibles: ['combo-clasico', 'combo-king', 'combo-doble-bacon', 'combo-crispy', 'combo-familiar'],
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
  bebida: {
    carpeta: 'drinks',
    generica: 'nueva-bebida',
    disponibles: [
      'gaseosa-cola-500-ml',
      'gaseosa-lima-limon-500-ml',
      'limonada-con-menta-y-jengibre',
      'agua-mineral-500-ml',
      'cerveza-artesanal-ipa',
      'milkshake-de-dulce-de-leche',
    ],
  },
};

// Nombres de la versión anterior (CUFAMBRE) que siguen mostrando su imagen
const ALIAS = { 'clasica-cufambre': 'clasica-king' };

/** "Clásica King" → "clasica-king" */
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
  const slug = ALIAS[aSlug(plato.nombre)] ?? aSlug(plato.nombre);
  const archivo = grupo.disponibles.includes(slug) ? slug : grupo.generica;
  return `images/${grupo.carpeta}/${archivo}.svg`;
}
