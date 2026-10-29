/**
 * Pruebas de pedidos con platos personalizados: extras, ingredientes quitados,
 * aclaraciones y cálculo del precio en el servidor.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  iniciarApi,
  crearUsuario,
  crearPlatoDePrueba,
  crearIngredienteDePrueba,
  asignarIngrediente,
  pool,
} = require('./helpers');

describe('Pedidos con platos personalizados', () => {
  let api;
  let cerrar;
  let admin;
  let ana;
  let hamburguesa;
  let bebida;
  let cheddar;
  let panceta;
  let cebolla;
  let agotado;

  before(async () => {
    ({ api, cerrar } = await iniciarApi());
    admin = await crearUsuario(api, { admin: true, nombre: 'Admin' });
    ana = await crearUsuario(api, { nombre: 'Ana' });
    hamburguesa = await crearPlatoDePrueba({ nombre: 'Personalizable', precio: 10000 });
    bebida = await crearPlatoDePrueba({ tipo: 'bebida', nombre: 'Gaseosa', precio: 2500 });
    cheddar = await crearIngredienteDePrueba({ nombre: 'Cheddar', precio: 900 });
    panceta = await crearIngredienteDePrueba({ nombre: 'Panceta', precio: 1300 });
    cebolla = await crearIngredienteDePrueba({ nombre: 'Cebolla', precio: 400 });
    agotado = await crearIngredienteDePrueba({ nombre: 'Palta', precio: 1200, disponible: false });
    await asignarIngrediente(hamburguesa, cheddar, { incluido: true, maximo: 2 });
    await asignarIngrediente(hamburguesa, cebolla, { incluido: true, maximo: 0 });
    await asignarIngrediente(hamburguesa, panceta, { maximo: 3 });
    await asignarIngrediente(hamburguesa, agotado, { maximo: 1 });
  });

  after(() => cerrar());

  const pedir = (platos) => api('POST', '/pedidos', { token: ana.token, body: { platos } });

  test('el precio suma los extras, quitar no descuenta y se guarda la aclaración', async () => {
    const respuesta = await pedir([
      {
        id: hamburguesa.id,
        cantidad: 2,
        extras: [{ id: panceta.id, cantidad: 2 }, { id: cheddar.id }],
        sin: [cebolla.id],
        aclaracion: '  bien cocida  ',
      },
      { id: bebida.id, cantidad: 1 },
    ]);
    assert.equal(respuesta.status, 201, JSON.stringify(respuesta.body));
    const [item, gaseosa] = respuesta.body.platos;
    // 10000 + 2 × 1300 (panceta) + 1 × 900 (cheddar) = 13500 por unidad
    assert.equal(item.precio, 13500);
    assert.equal(item.cantidad, 2);
    assert.equal(item.aclaracion, 'bien cocida');
    assert.deepEqual(item.extras, [
      { id: cheddar.id, nombre: cheddar.nombre, cantidad: 1, precio: 900 },
      { id: panceta.id, nombre: panceta.nombre, cantidad: 2, precio: 1300 },
    ]);
    assert.deepEqual(item.sin, [{ id: cebolla.id, nombre: cebolla.nombre }]);
    assert.deepEqual(gaseosa, {
      id: bebida.id,
      cantidad: 1,
      nombre: bebida.nombre,
      tipo: 'bebida',
      precio: 2500,
      extras: [],
      sin: [],
      aclaracion: null,
    });
  });

  test('el precio guardado no cambia si después sube el precio de un extra', async () => {
    const respuesta = await pedir([{ id: hamburguesa.id, cantidad: 1, extras: [{ id: panceta.id }] }]);
    await pool.query('UPDATE Ingredientes SET precio = precio + 5000 WHERE id = $1', [panceta.id]);
    try {
      const guardado = await api('GET', `/pedidos/${respuesta.body.id}`, { token: admin.token });
      assert.equal(guardado.body.platos[0].precio, 11300);
      assert.equal(guardado.body.platos[0].extras[0].precio, 1300);
    } finally {
      await pool.query('UPDATE Ingredientes SET precio = precio - 5000 WHERE id = $1', [panceta.id]);
    }
  });

  test('el mismo plato con personalizaciones distintas queda en ítems separados', async () => {
    const respuesta = await pedir([
      { id: hamburguesa.id, cantidad: 1, sin: [cebolla.id] },
      { id: hamburguesa.id, cantidad: 1 },
      { id: hamburguesa.id, cantidad: 2, sin: [cebolla.id] },
      { id: hamburguesa.id, cantidad: 1, extras: [] },
    ]);
    assert.equal(respuesta.status, 201);
    assert.deepEqual(
      respuesta.body.platos.map((item) => [item.cantidad, item.sin.length]),
      [
        [3, 1],
        [2, 0],
      ]
    );
    const { rows } = await pool.query('SELECT COUNT(*)::int AS filas FROM PlatosXPedidos WHERE id_pedido = $1', [
      respuesta.body.id,
    ]);
    assert.equal(rows[0].filas, 2);
  });

  test('rechaza personalizaciones que el plato no admite (400) sin guardar nada', async () => {
    const { rows: antes } = await pool.query('SELECT COUNT(*)::int AS cantidad FROM Pedidos WHERE id_usuario = $1', [ana.id]);
    const casos = [
      [{ id: hamburguesa.id, cantidad: 1, extras: [{ id: cebolla.id }] }], // incluido sin extras permitidos
      [{ id: hamburguesa.id, cantidad: 1, extras: [{ id: cheddar.id, cantidad: 3 }] }], // supera el máximo
      [{ id: hamburguesa.id, cantidad: 1, extras: [{ id: cheddar.id, cantidad: 2 }, { id: cheddar.id }] }], // suma 3
      [{ id: hamburguesa.id, cantidad: 1, extras: [{ id: agotado.id }] }], // no disponible
      [{ id: hamburguesa.id, cantidad: 1, sin: [panceta.id] }], // no viene incluido
      [{ id: hamburguesa.id, cantidad: 1, extras: [{ id: cheddar.id }], sin: [cheddar.id] }], // agregar y quitar
      [{ id: bebida.id, cantidad: 1, extras: [{ id: panceta.id }] }], // otro plato
      [{ id: hamburguesa.id, cantidad: 1, extras: 'panceta' }],
      [{ id: hamburguesa.id, cantidad: 1, extras: [{ id: panceta.id, cantidad: 0 }] }],
      [{ id: hamburguesa.id, cantidad: 1, sin: ['cebolla'] }],
      [{ id: hamburguesa.id, cantidad: 1, aclaracion: 5 }],
      [{ id: hamburguesa.id, cantidad: 1, aclaracion: 'x'.repeat(141) }],
    ];
    for (const platos of casos) {
      const respuesta = await pedir(platos);
      assert.equal(respuesta.status, 400, JSON.stringify(platos));
      assert.equal(typeof respuesta.body.message, 'string');
    }
    const { rows: despues } = await pool.query('SELECT COUNT(*)::int AS cantidad FROM Pedidos WHERE id_usuario = $1', [ana.id]);
    assert.deepEqual(despues, antes);
  });

  test('el cliente no puede fijar el precio: se ignora el precio enviado', async () => {
    const respuesta = await pedir([{ id: hamburguesa.id, cantidad: 1, precio: 1, precioUnitario: 1 }]);
    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.platos[0].precio, 10000);
  });

  test('borrar el pedido borra también sus personalizaciones', async () => {
    const pedido = await pedir([{ id: hamburguesa.id, cantidad: 1, extras: [{ id: panceta.id }], sin: [cebolla.id] }]);
    const respuesta = await api('DELETE', `/pedidos/${pedido.body.id}`, { token: admin.token });
    assert.equal(respuesta.status, 200);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cantidad FROM Personalizaciones pz
        WHERE pz.id_item IN (SELECT id FROM PlatosXPedidos WHERE id_pedido = $1)`,
      [pedido.body.id]
    );
    assert.equal(rows[0].cantidad, 0);
  });
});
