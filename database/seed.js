/**
 * database/seed.js — Carga el menú de ejemplo de CUFAMBRE.
 *
 *   npm run db:seed
 *
 * Crea las tablas si no existen y SOLO inserta platos si la tabla Platos está
 * vacía: nunca borra ni duplica datos. Los tipos usados son los de la consigna:
 * principal (hamburguesas), combo y postre.
 */
const { conTransaccion, verificarConexion, cerrarConexiones } = require('../dbconfig');
const { inicializarBaseDeDatos } = require('./init');

const PLATOS = [
  // ---- principal: hamburguesas ----
  {
    tipo: 'principal',
    nombre: 'Clásica CUFAMBRE',
    precio: 9900,
    descripcion: 'Medallón smash de 120 g, cheddar fundido, lechuga, tomate, pepinos y nuestra salsa secreta en pan de papa.',
  },
  {
    tipo: 'principal',
    nombre: 'Doble Cheddar Bacon',
    precio: 12900,
    descripcion: 'Doble medallón smash, doble cheddar, panceta crocante y cebolla caramelizada en pan brioche con sésamo.',
  },
  {
    tipo: 'principal',
    nombre: 'La Picante',
    precio: 11900,
    descripcion: 'Medallón de carne, queso pepper jack, jalapeños, cebolla morada y mayonesa chipotle. Para valientes.',
  },
  {
    tipo: 'principal',
    nombre: 'Crispy Chicken',
    precio: 11500,
    descripcion: 'Pechuga de pollo rebozada y crocante, lechuga, pepinos y mayonesa de miel y mostaza en pan brioche.',
  },
  {
    tipo: 'principal',
    nombre: 'Veggie Garden',
    precio: 10900,
    descripcion: 'Medallón de garbanzos y espinaca, palta, rúcula, tomate y alioli de limón en pan integral. 100 % vegetariana.',
  },
  {
    tipo: 'principal',
    nombre: 'La Bestia',
    precio: 15900,
    descripcion: 'Triple medallón, triple cheddar, panceta, huevo frito y salsa barbacoa ahumada. Solo para hambre de verdad.',
  },
  {
    tipo: 'principal',
    nombre: 'Azul y Hongos',
    precio: 12500,
    descripcion: 'Medallón de carne, queso azul, hongos salteados al ajo y rúcula fresca en pan negro con sésamo.',
  },
  {
    tipo: 'principal',
    nombre: 'La Argenta',
    precio: 12300,
    descripcion: 'Medallón de carne, provoleta grillada, chimichurri casero, tomate y lechuga en pan brioche.',
  },
  // ---- combo ----
  {
    tipo: 'combo',
    nombre: 'Combo Clásico',
    precio: 13900,
    descripcion: 'Clásica CUFAMBRE + papas fritas medianas + gaseosa de 500 ml.',
  },
  {
    tipo: 'combo',
    nombre: 'Combo Doble Bacon',
    precio: 17500,
    descripcion: 'Doble Cheddar Bacon + papas con cheddar y verdeo + gaseosa de 500 ml.',
  },
  {
    tipo: 'combo',
    nombre: 'Combo Crispy',
    precio: 15900,
    descripcion: 'Crispy Chicken + aros de cebolla + limonada con menta y jengibre.',
  },
  {
    tipo: 'combo',
    nombre: 'Combo Familiar',
    precio: 44900,
    descripcion: '4 Clásicas CUFAMBRE + 2 papas fritas grandes + 4 gaseosas de 500 ml. Para compartir (o no).',
  },
  // ---- postre ----
  {
    tipo: 'postre',
    nombre: 'Brownie con Helado',
    precio: 6900,
    descripcion: 'Brownie tibio de chocolate semiamargo con una bocha de helado de crema americana y salsa de chocolate.',
  },
  {
    tipo: 'postre',
    nombre: 'Sundae de Dulce de Leche',
    precio: 6500,
    descripcion: 'Helado de vainilla con dulce de leche, maní caramelizado, crema batida y una cereza.',
  },
  {
    tipo: 'postre',
    nombre: 'Cheesecake de Frutos Rojos',
    precio: 7200,
    descripcion: 'Porción de cheesecake cremoso sobre base de galletitas, con salsa casera de frutos rojos.',
  },
  {
    tipo: 'postre',
    nombre: 'Churros con Dulce de Leche',
    precio: 5900,
    descripcion: 'Cuatro churros recién hechos con azúcar y canela, acompañados de dulce de leche para mojar.',
  },
];

/** Inserta los platos de ejemplo si la tabla está vacía. Devuelve cuántos insertó. */
async function sembrarPlatos() {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query('SELECT COUNT(*)::int AS cantidad FROM Platos');
    if (rows[0].cantidad > 0) {
      return { insertados: 0, existentes: rows[0].cantidad };
    }
    for (const plato of PLATOS) {
      await cliente.query(
        'INSERT INTO Platos (tipo, nombre, precio, descripcion) VALUES ($1, $2, $3, $4)',
        [plato.tipo, plato.nombre, plato.precio, plato.descripcion]
      );
    }
    return { insertados: PLATOS.length, existentes: 0 };
  });
}

async function main() {
  try {
    const conexion = await verificarConexion();
    console.log(`Conectado: ${conexion.descripcion}`);
    await inicializarBaseDeDatos();
    const { insertados, existentes } = await sembrarPlatos();
    if (insertados > 0) {
      console.log(`✔ Se cargaron ${insertados} platos de ejemplo.`);
    } else {
      console.log(`La tabla Platos ya tiene ${existentes} platos: no se insertó nada.`);
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

module.exports = { sembrarPlatos, PLATOS };
