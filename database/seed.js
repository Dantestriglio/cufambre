/**
 * database/seed.js — Carga el menú de ejemplo de King Sciarra.
 *
 *   npm run db:seed
 *
 * Crea las tablas si no existen y agrega SOLO lo que falta, sin borrar ni
 * duplicar nada, así que se puede ejecutar sobre una base que ya tiene datos:
 *   - platos: se insertan los que no existen (se compara por nombre);
 *   - ingredientes: se insertan los que no existen (por nombre);
 *   - opciones de cada plato: se cargan solo en los platos que todavía no
 *     tienen ninguna, para no pisar lo que haya configurado un administrador.
 * Además renombra los platos de la versión anterior (CUFAMBRE).
 */
const { conTransaccion, verificarConexion, cerrarConexiones } = require('../dbconfig');
const { inicializarBaseDeDatos } = require('./init');

// precio = costo de cada unidad agregada como extra · maximo = unidades extra por plato (0 = no se ofrece)
const INGREDIENTES = [
  // Hamburguesas
  { nombre: 'Medallón de carne', precio: 3200, maximo: 2 },
  { nombre: 'Medallón de garbanzos', precio: 2800, maximo: 2 },
  { nombre: 'Pollo crispy', precio: 3400, maximo: 1 },
  { nombre: 'Cerdo desmechado', precio: 3000, maximo: 1 },
  { nombre: 'Cheddar', precio: 900, maximo: 3 },
  { nombre: 'Queso azul', precio: 1100, maximo: 2 },
  { nombre: 'Pepper jack', precio: 1000, maximo: 2 },
  { nombre: 'Provoleta', precio: 1400, maximo: 1 },
  { nombre: 'Panceta crocante', precio: 1300, maximo: 3 },
  { nombre: 'Huevo frito', precio: 900, maximo: 2 },
  { nombre: 'Cebolla caramelizada', precio: 700, maximo: 2 },
  { nombre: 'Cebolla crispy', precio: 800, maximo: 2 },
  { nombre: 'Cebolla morada', precio: 400, maximo: 2 },
  { nombre: 'Lechuga', precio: 300, maximo: 2 },
  { nombre: 'Tomate', precio: 300, maximo: 2 },
  { nombre: 'Pepinos', precio: 300, maximo: 2 },
  { nombre: 'Jalapeños', precio: 600, maximo: 2 },
  { nombre: 'Palta', precio: 1200, maximo: 2 },
  { nombre: 'Hongos salteados', precio: 1000, maximo: 2 },
  { nombre: 'Rúcula', precio: 400, maximo: 2 },
  { nombre: 'Coleslaw', precio: 700, maximo: 2 },
  { nombre: 'Salsa secreta', precio: 400, maximo: 2 },
  { nombre: 'Salsa King', precio: 400, maximo: 2 },
  { nombre: 'Mayonesa chipotle', precio: 400, maximo: 2 },
  { nombre: 'Mayonesa de miel y mostaza', precio: 400, maximo: 2 },
  { nombre: 'Salsa barbacoa', precio: 400, maximo: 2 },
  { nombre: 'Chimichurri', precio: 400, maximo: 2 },
  { nombre: 'Alioli de limón', precio: 400, maximo: 2 },
  { nombre: 'Pan sin TACC', precio: 1500, maximo: 1 },
  // Combos
  { nombre: 'Agrandar papas', precio: 2200, maximo: 1 },
  { nombre: 'Agrandar bebida', precio: 1500, maximo: 1 },
  { nombre: 'Cheddar y verdeo en las papas', precio: 1600, maximo: 1 },
  { nombre: 'Aros de cebolla', precio: 2900, maximo: 1 },
  // Bebidas
  { nombre: 'Hielo', precio: 0, maximo: 0 },
  { nombre: 'Rodaja de limón', precio: 0, maximo: 1 },
  { nombre: 'Tamaño grande (1 L)', precio: 1800, maximo: 1 },
  { nombre: 'Menta fresca', precio: 300, maximo: 1 },
  { nombre: 'Jengibre', precio: 300, maximo: 1 },
  // Postres y milkshakes
  { nombre: 'Bocha de helado', precio: 1800, maximo: 2 },
  { nombre: 'Dulce de leche', precio: 700, maximo: 2 },
  { nombre: 'Crema batida', precio: 600, maximo: 2 },
  { nombre: 'Salsa de chocolate', precio: 500, maximo: 2 },
  { nombre: 'Maní caramelizado', precio: 500, maximo: 2 },
  { nombre: 'Frutos rojos', precio: 900, maximo: 2 },
];

const SALSAS = ['Salsa secreta', 'Salsa King', 'Mayonesa chipotle', 'Salsa barbacoa', 'Alioli de limón'];
const EXTRAS_DE_HAMBURGUESA = ['Medallón de carne', 'Cheddar', 'Panceta crocante', 'Huevo frito', 'Cebolla crispy', 'Palta', 'Pan sin TACC'];
const EXTRAS_DE_COMBO = ['Agrandar papas', 'Agrandar bebida', 'Cheddar y verdeo en las papas'];
const EXTRAS_DE_POSTRE = ['Bocha de helado', 'Dulce de leche', 'Crema batida', 'Salsa de chocolate'];
const EXTRAS_DE_GASEOSA = ['Rodaja de limón', 'Tamaño grande (1 L)'];

// incluye = viene en el plato (se puede quitar) · extras = se pueden agregar pagando
const PLATOS = [
  // ---- principal: hamburguesas ----
  {
    tipo: 'principal',
    nombre: 'Clásica King',
    precio: 9900,
    descripcion: 'Medallón smash de 120 g, cheddar fundido, lechuga, tomate, pepinos y nuestra salsa secreta en pan de papa.',
    incluye: ['Medallón de carne', 'Cheddar', 'Lechuga', 'Tomate', 'Pepinos', 'Salsa secreta'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Cebolla caramelizada', 'Jalapeños', ...SALSAS],
  },
  {
    tipo: 'principal',
    nombre: 'La King Sciarra',
    precio: 14900,
    descripcion: 'La de la casa: doble medallón smash, doble cheddar, panceta crocante, cebolla crispy, pepinos y salsa King en pan brioche con corona de sésamo.',
    incluye: ['Medallón de carne', 'Cheddar', 'Panceta crocante', 'Cebolla crispy', 'Pepinos', 'Salsa King'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Jalapeños', 'Provoleta', ...SALSAS],
  },
  {
    tipo: 'principal',
    nombre: 'Doble Cheddar Bacon',
    precio: 12900,
    descripcion: 'Doble medallón smash, doble cheddar, panceta crocante y cebolla caramelizada en pan brioche con sésamo.',
    incluye: ['Medallón de carne', 'Cheddar', 'Panceta crocante', 'Cebolla caramelizada'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Pepinos', ...SALSAS],
  },
  {
    tipo: 'principal',
    nombre: 'La Picante',
    precio: 11900,
    descripcion: 'Medallón de carne, queso pepper jack, jalapeños, cebolla morada y mayonesa chipotle. Para valientes.',
    incluye: ['Medallón de carne', 'Pepper jack', 'Jalapeños', 'Cebolla morada', 'Mayonesa chipotle'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Lechuga', 'Tomate'],
  },
  {
    tipo: 'principal',
    nombre: 'Crispy Chicken',
    precio: 11500,
    descripcion: 'Pechuga de pollo rebozada y crocante, lechuga, pepinos y mayonesa de miel y mostaza en pan brioche.',
    incluye: ['Pollo crispy', 'Lechuga', 'Pepinos', 'Mayonesa de miel y mostaza'],
    extras: ['Pollo crispy', 'Cheddar', 'Panceta crocante', 'Tomate', 'Palta', 'Jalapeños', 'Pan sin TACC', ...SALSAS],
  },
  {
    tipo: 'principal',
    nombre: 'Veggie Garden',
    precio: 10900,
    descripcion: 'Medallón de garbanzos y espinaca, palta, rúcula, tomate y alioli de limón en pan integral. 100 % vegetariana.',
    incluye: ['Medallón de garbanzos', 'Palta', 'Rúcula', 'Tomate', 'Alioli de limón'],
    extras: ['Medallón de garbanzos', 'Cheddar', 'Hongos salteados', 'Huevo frito', 'Cebolla caramelizada', 'Pan sin TACC'],
  },
  {
    tipo: 'principal',
    nombre: 'La Bestia',
    precio: 15900,
    descripcion: 'Triple medallón, triple cheddar, panceta, huevo frito y salsa barbacoa ahumada. Solo para hambre de verdad.',
    incluye: ['Medallón de carne', 'Cheddar', 'Panceta crocante', 'Huevo frito', 'Salsa barbacoa'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Cebolla caramelizada', 'Jalapeños'],
  },
  {
    tipo: 'principal',
    nombre: 'Azul y Hongos',
    precio: 12500,
    descripcion: 'Medallón de carne, queso azul, hongos salteados al ajo y rúcula fresca en pan negro con sésamo.',
    incluye: ['Medallón de carne', 'Queso azul', 'Hongos salteados', 'Rúcula'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Cebolla caramelizada'],
  },
  {
    tipo: 'principal',
    nombre: 'La Argenta',
    precio: 12300,
    descripcion: 'Medallón de carne, provoleta grillada, chimichurri casero, tomate y lechuga en pan brioche.',
    incluye: ['Medallón de carne', 'Provoleta', 'Chimichurri', 'Tomate', 'Lechuga'],
    extras: [...EXTRAS_DE_HAMBURGUESA, 'Cebolla morada'],
  },
  {
    tipo: 'principal',
    nombre: 'Pulled Pork BBQ',
    precio: 13500,
    descripcion: 'Cerdo desmechado cocido 12 horas, salsa barbacoa, coleslaw cremoso y pepinos encurtidos en pan de papa.',
    incluye: ['Cerdo desmechado', 'Salsa barbacoa', 'Coleslaw', 'Pepinos'],
    extras: ['Cerdo desmechado', 'Cheddar', 'Panceta crocante', 'Cebolla crispy', 'Jalapeños', 'Pan sin TACC'],
  },
  // ---- combo ----
  {
    tipo: 'combo',
    nombre: 'Combo Clásico',
    precio: 13900,
    descripcion: 'Clásica King + papas fritas medianas + gaseosa de 500 ml.',
    incluye: ['Hielo'],
    extras: [...EXTRAS_DE_COMBO, 'Medallón de carne', 'Cheddar', 'Panceta crocante'],
  },
  {
    tipo: 'combo',
    nombre: 'Combo King',
    precio: 18900,
    descripcion: 'La King Sciarra + papas con cheddar y verdeo + aros de cebolla + gaseosa de 500 ml. El combo de la corona.',
    incluye: ['Hielo'],
    extras: [...EXTRAS_DE_COMBO, 'Medallón de carne', 'Panceta crocante'],
  },
  {
    tipo: 'combo',
    nombre: 'Combo Doble Bacon',
    precio: 17500,
    descripcion: 'Doble Cheddar Bacon + papas con cheddar y verdeo + gaseosa de 500 ml.',
    incluye: ['Hielo'],
    extras: [...EXTRAS_DE_COMBO, 'Medallón de carne', 'Huevo frito'],
  },
  {
    tipo: 'combo',
    nombre: 'Combo Crispy',
    precio: 15900,
    descripcion: 'Crispy Chicken + aros de cebolla + limonada con menta y jengibre.',
    incluye: ['Hielo', 'Menta fresca', 'Jengibre'],
    extras: ['Agrandar papas', 'Agrandar bebida', 'Aros de cebolla', 'Pollo crispy', 'Cheddar'],
  },
  {
    tipo: 'combo',
    nombre: 'Combo Familiar',
    precio: 44900,
    descripcion: '4 Clásicas King + 2 papas fritas grandes + 4 gaseosas de 500 ml. Para compartir (o no).',
    incluye: ['Hielo'],
    extras: ['Aros de cebolla', 'Cheddar y verdeo en las papas', 'Medallón de carne', 'Cheddar', 'Panceta crocante'],
  },
  // ---- postre ----
  {
    tipo: 'postre',
    nombre: 'Brownie con Helado',
    precio: 6900,
    descripcion: 'Brownie tibio de chocolate semiamargo con una bocha de helado de crema americana y salsa de chocolate.',
    incluye: ['Bocha de helado', 'Salsa de chocolate'],
    extras: [...EXTRAS_DE_POSTRE, 'Frutos rojos'],
  },
  {
    tipo: 'postre',
    nombre: 'Sundae de Dulce de Leche',
    precio: 6500,
    descripcion: 'Helado de vainilla con dulce de leche, maní caramelizado, crema batida y una cereza.',
    incluye: ['Dulce de leche', 'Maní caramelizado', 'Crema batida'],
    extras: [...EXTRAS_DE_POSTRE, 'Maní caramelizado'],
  },
  {
    tipo: 'postre',
    nombre: 'Cheesecake de Frutos Rojos',
    precio: 7200,
    descripcion: 'Porción de cheesecake cremoso sobre base de galletitas, con salsa casera de frutos rojos.',
    incluye: ['Frutos rojos'],
    extras: ['Frutos rojos', 'Bocha de helado', 'Crema batida'],
  },
  {
    tipo: 'postre',
    nombre: 'Churros con Dulce de Leche',
    precio: 5900,
    descripcion: 'Cuatro churros recién hechos con azúcar y canela, acompañados de dulce de leche para mojar.',
    incluye: ['Dulce de leche'],
    extras: ['Dulce de leche', 'Salsa de chocolate', 'Bocha de helado'],
  },
  // ---- bebida ----
  {
    tipo: 'bebida',
    nombre: 'Gaseosa Cola 500 ml',
    precio: 2800,
    descripcion: 'Bien fría, con hielo. Pedila grande si la hamburguesa viene con todo.',
    incluye: ['Hielo'],
    extras: EXTRAS_DE_GASEOSA,
  },
  {
    tipo: 'bebida',
    nombre: 'Gaseosa Lima-Limón 500 ml',
    precio: 2800,
    descripcion: 'Refrescante y con burbujas, ideal para cortar lo picante.',
    incluye: ['Hielo'],
    extras: EXTRAS_DE_GASEOSA,
  },
  {
    tipo: 'bebida',
    nombre: 'Limonada con Menta y Jengibre',
    precio: 3900,
    descripcion: 'Limonada exprimida en el momento con menta fresca y jengibre. Sin conservantes.',
    incluye: ['Hielo', 'Menta fresca', 'Jengibre'],
    extras: ['Tamaño grande (1 L)'],
  },
  {
    tipo: 'bebida',
    nombre: 'Agua Mineral 500 ml',
    precio: 2200,
    descripcion: 'Agua mineral sin gas. También la tenemos con gas: dejalo en la aclaración.',
    incluye: [],
    extras: ['Rodaja de limón', 'Hielo'],
  },
  {
    tipo: 'bebida',
    nombre: 'Cerveza Artesanal IPA',
    precio: 4900,
    descripcion: 'Pinta de 473 ml de IPA artesanal, amarga y aromática. Solo para mayores de 18 años.',
    incluye: [],
    extras: ['Rodaja de limón'],
  },
  {
    tipo: 'bebida',
    nombre: 'Milkshake de Dulce de Leche',
    precio: 5900,
    descripcion: 'Batido espeso de helado de dulce de leche, coronado con crema batida.',
    incluye: ['Crema batida'],
    extras: ['Crema batida', 'Dulce de leche', 'Salsa de chocolate', 'Bocha de helado'],
  },
];

// Platos de la versión anterior que cambiaron de nombre
const RENOMBRES = [['Clásica CUFAMBRE', 'Clásica King']];

/** Opciones de un plato listas para insertar: [{ nombre, incluido, maximo }]. */
function opcionesDe(plato, ingredientesPorNombre) {
  const opciones = new Map();
  for (const nombre of plato.incluye) {
    opciones.set(nombre, { nombre, incluido: true, maximo: 0 });
  }
  for (const nombre of plato.extras) {
    const maximo = Math.max(1, ingredientesPorNombre.get(nombre).maximo);
    opciones.set(nombre, { nombre, incluido: opciones.get(nombre)?.incluido ?? false, maximo });
  }
  return [...opciones.values()];
}

/** Inserta lo que falte del menú de ejemplo. Devuelve cuántos platos, ingredientes y opciones agregó. */
async function sembrarMenu() {
  const ingredientesPorNombre = new Map(INGREDIENTES.map((ingrediente) => [ingrediente.nombre, ingrediente]));

  return conTransaccion(async (cliente) => {
    const resultado = { platos: 0, ingredientes: 0, platosConOpciones: 0, renombrados: 0 };

    for (const [anterior, nuevo] of RENOMBRES) {
      const { rowCount } = await cliente.query(
        `UPDATE Platos SET nombre = $2::varchar
          WHERE nombre = $1::varchar AND NOT EXISTS (SELECT 1 FROM Platos WHERE LOWER(nombre) = LOWER($2::varchar))`,
        [anterior, nuevo]
      );
      resultado.renombrados += rowCount;
    }
    await cliente.query(
      `UPDATE Platos SET descripcion = replace(descripcion, 'CUFAMBRE', 'King') WHERE descripcion LIKE '%CUFAMBRE%'`
    );

    for (const plato of PLATOS) {
      const { rowCount } = await cliente.query(
        `INSERT INTO Platos (tipo, nombre, precio, descripcion)
         SELECT $1::varchar, $2::varchar, $3::int, $4::varchar
          WHERE NOT EXISTS (SELECT 1 FROM Platos WHERE LOWER(nombre) = LOWER($2::varchar))`,
        [plato.tipo, plato.nombre, plato.precio, plato.descripcion]
      );
      resultado.platos += rowCount;
    }

    for (const ingrediente of INGREDIENTES) {
      const { rowCount } = await cliente.query(
        'INSERT INTO Ingredientes (nombre, precio) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [ingrediente.nombre, ingrediente.precio]
      );
      resultado.ingredientes += rowCount;
    }

    for (const plato of PLATOS) {
      const { rows } = await cliente.query(
        `SELECT p.id FROM Platos p
          WHERE LOWER(p.nombre) = LOWER($1)
            AND NOT EXISTS (SELECT 1 FROM IngredientesXPlatos ixp WHERE ixp.id_plato = p.id)`,
        [plato.nombre]
      );
      if (rows.length === 0) continue; // ya tiene opciones: no se pisan

      const opciones = opcionesDe(plato, ingredientesPorNombre);
      if (opciones.length === 0) continue;
      for (const opcion of opciones) {
        await cliente.query(
          `INSERT INTO IngredientesXPlatos (id_plato, id_ingrediente, incluido, maximo)
           SELECT $1::int, i.id, $3::boolean, $4::int FROM Ingredientes i WHERE LOWER(i.nombre) = LOWER($2::varchar)
           ON CONFLICT DO NOTHING`,
          [rows[0].id, opcion.nombre, opcion.incluido, opcion.maximo]
        );
      }
      resultado.platosConOpciones += 1;
    }
    return resultado;
  });
}

async function main() {
  try {
    const conexion = await verificarConexion();
    console.log(`Conectado: ${conexion.descripcion}`);
    await inicializarBaseDeDatos();
    const { platos, ingredientes, platosConOpciones, renombrados } = await sembrarMenu();
    if (platos + ingredientes + platosConOpciones + renombrados === 0) {
      console.log('El menú de ejemplo ya estaba completo: no se insertó nada.');
    } else {
      if (renombrados > 0) console.log(`✔ Se renombraron ${renombrados} platos de la versión anterior.`);
      console.log(`✔ Platos nuevos: ${platos}`);
      console.log(`✔ Ingredientes nuevos: ${ingredientes}`);
      console.log(`✔ Platos con ingredientes y extras configurados: ${platosConOpciones}`);
    }
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await cerrarConexiones();
  }
}

if (require.main === module) {
  main();
}

module.exports = { sembrarMenu, opcionesDe, PLATOS, INGREDIENTES, RENOMBRES };
