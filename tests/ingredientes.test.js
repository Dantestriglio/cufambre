/**
 * Pruebas de ingredientes: catálogo, opciones de cada plato y permisos.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  iniciarApi,
  crearUsuario,
  crearPlatoDePrueba,
  crearIngredienteDePrueba,
  asignarIngrediente,
} = require('./helpers');

describe('API de ingredientes', () => {
  let api;
  let cerrar;
  let admin;
  let cliente;

  before(async () => {
    ({ api, cerrar } = await iniciarApi());
    admin = await crearUsuario(api, { admin: true });
    cliente = await crearUsuario(api);
  });

  after(() => cerrar());

  const nombreUnico = (base) => `TEST ${base} ${Math.random().toString(36).slice(2, 8)}`;

  test('GET /ingredientes es público y devuelve el catálogo', async () => {
    const ingrediente = await crearIngredienteDePrueba({ precio: 900 });
    const respuesta = await api('GET', '/ingredientes');
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body.find((item) => item.id === ingrediente.id), { ...ingrediente, platos: 0 });
  });

  test('solo un administrador crea, modifica y elimina ingredientes', async () => {
    const datos = { nombre: nombreUnico('Cheddar'), precio: 900 };
    assert.equal((await api('POST', '/ingredientes', { body: datos })).status, 401);
    assert.equal((await api('POST', '/ingredientes', { token: cliente.token, body: datos })).status, 403);

    const creado = await api('POST', '/ingredientes', { token: admin.token, body: datos });
    assert.equal(creado.status, 201);
    assert.deepEqual(creado.body, { id: creado.body.id, ...datos, disponible: true, platos: 0 });

    const cambios = { nombre: datos.nombre, precio: 1100, disponible: false };
    const modificado = await api('PUT', `/ingredientes/${creado.body.id}`, { token: admin.token, body: cambios });
    assert.equal(modificado.status, 200);
    assert.equal(modificado.body.precio, 1100);
    assert.equal(modificado.body.disponible, false);

    const eliminado = await api('DELETE', `/ingredientes/${creado.body.id}`, { token: admin.token });
    assert.equal(eliminado.status, 200);
    assert.deepEqual(eliminado.body, { message: 'Ingrediente eliminado correctamente' });
    assert.equal((await api('DELETE', `/ingredientes/${creado.body.id}`, { token: admin.token })).status, 404);
  });

  test('valida los datos y rechaza nombres repetidos sin distinguir mayúsculas', async () => {
    const casos = [{}, { nombre: '  ', precio: 1 }, { nombre: 'TEST x', precio: -1 }, { nombre: 'TEST x', precio: 1.5 }, { nombre: 'TEST x', precio: 1, disponible: 'si' }];
    for (const body of casos) {
      const respuesta = await api('POST', '/ingredientes', { token: admin.token, body });
      assert.equal(respuesta.status, 400, JSON.stringify(body));
    }
    const existente = await crearIngredienteDePrueba();
    const repetido = await api('POST', '/ingredientes', {
      token: admin.token,
      body: { nombre: existente.nombre.toUpperCase(), precio: 1 },
    });
    assert.equal(repetido.status, 409);
  });

  test('PUT /platos/:id/ingredientes reemplaza las opciones del plato (administrador)', async () => {
    const plato = await crearPlatoDePrueba();
    const queso = await crearIngredienteDePrueba({ nombre: 'Queso', precio: 900 });
    const panceta = await crearIngredienteDePrueba({ nombre: 'Panceta', precio: 1300 });
    const ruta = `/platos/${plato.id}/ingredientes`;
    const body = {
      ingredientes: [
        { id: queso.id, incluido: true, maximo: 2 },
        { id: panceta.id, maximo: 3 },
      ],
    };

    assert.equal((await api('PUT', ruta, { body })).status, 401);
    assert.equal((await api('PUT', ruta, { token: cliente.token, body })).status, 403);

    const respuesta = await api('PUT', ruta, { token: admin.token, body });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, [
      { id: queso.id, nombre: queso.nombre, precio: 900, disponible: true, incluido: true, maximo: 2 },
      { id: panceta.id, nombre: panceta.nombre, precio: 1300, disponible: true, incluido: false, maximo: 3 },
    ]);
    assert.deepEqual((await api('GET', ruta)).body, respuesta.body, 'GET devuelve lo mismo y es público');

    const reemplazo = await api('PUT', ruta, { token: admin.token, body: { ingredientes: [{ id: panceta.id, maximo: 1 }] } });
    assert.deepEqual(reemplazo.body.map((opcion) => opcion.id), [panceta.id]);
  });

  test('PUT /platos/:id/ingredientes valida el plato, los ingredientes y los máximos', async () => {
    const plato = await crearPlatoDePrueba();
    const queso = await crearIngredienteDePrueba();
    const ruta = `/platos/${plato.id}/ingredientes`;
    const invalidos = [
      {},
      { ingredientes: 'queso' },
      { ingredientes: [{ id: 'x' }] },
      { ingredientes: [{ id: queso.id, incluido: false, maximo: 0 }] },
      { ingredientes: [{ id: queso.id, maximo: 11 }] },
      { ingredientes: [{ id: queso.id, incluido: 'si', maximo: 1 }] },
      { ingredientes: [{ id: queso.id, maximo: 1 }, { id: queso.id, maximo: 2 }] },
    ];
    for (const body of invalidos) {
      assert.equal((await api('PUT', ruta, { token: admin.token, body })).status, 400, JSON.stringify(body));
    }
    const inexistente = await api('PUT', ruta, { token: admin.token, body: { ingredientes: [{ id: 2147483647, maximo: 1 }] } });
    assert.equal(inexistente.status, 404);
    const sinPlato = await api('PUT', '/platos/2147483647/ingredientes', { token: admin.token, body: { ingredientes: [] } });
    assert.equal(sinPlato.status, 404);
  });

  test('GET /platos/opciones lista las opciones del menú sin los ingredientes agotados', async () => {
    const plato = await crearPlatoDePrueba();
    const disponible = await crearIngredienteDePrueba({ nombre: 'Tomate' });
    const agotado = await crearIngredienteDePrueba({ nombre: 'Palta', disponible: false });
    await asignarIngrediente(plato, disponible, { incluido: true });
    await asignarIngrediente(plato, agotado, { maximo: 1 });

    const respuesta = await api('GET', '/platos/opciones');
    assert.equal(respuesta.status, 200);
    const delPlato = respuesta.body.filter((opcion) => opcion.id_plato === plato.id);
    assert.deepEqual(delPlato.map((opcion) => opcion.id), [disponible.id]);
  });

  test('un ingrediente que figura en un pedido no se puede eliminar (409)', async () => {
    const plato = await crearPlatoDePrueba();
    const extra = await crearIngredienteDePrueba();
    await asignarIngrediente(plato, extra, { maximo: 1 });
    const pedido = await api('POST', '/pedidos', {
      token: cliente.token,
      body: { platos: [{ id: plato.id, cantidad: 1, extras: [{ id: extra.id }] }] },
    });
    assert.equal(pedido.status, 201);

    const respuesta = await api('DELETE', `/ingredientes/${extra.id}`, { token: admin.token });
    assert.equal(respuesta.status, 409);
    assert.match(respuesta.body.message, /no disponible/);
  });
});
