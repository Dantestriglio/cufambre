/**
 * Pruebas de la API de platos: lectura pública, escritura solo para administradores.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, crearUsuario, crearPlatoDePrueba } = require('./helpers');

const PLATO_VALIDO = {
  tipo: 'combo',
  nombre: 'TEST Combo de prueba',
  precio: 15000,
  descripcion: 'Combo creado por las pruebas automáticas',
};

describe('API de platos', () => {
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

  test('GET /platos devuelve 200 y un array de platos', async () => {
    const plato = await crearPlatoDePrueba();
    const respuesta = await api('GET', '/platos');
    assert.equal(respuesta.status, 200);
    assert.ok(Array.isArray(respuesta.body));
    assert.deepEqual(respuesta.body.find((p) => p.id === plato.id), plato);
  });

  test('GET /platos/:id devuelve el plato con los campos de la consigna', async () => {
    const plato = await crearPlatoDePrueba({ nombre: 'Doble', precio: 300, descripcion: 'Carne, lechuga y tomate' });
    const respuesta = await api('GET', `/platos/${plato.id}`);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, {
      id: plato.id,
      tipo: 'principal',
      nombre: 'TEST Doble',
      precio: 300,
      descripcion: 'Carne, lechuga y tomate',
    });
  });

  test('GET /platos/:id con un id inexistente devuelve 404', async () => {
    const respuesta = await api('GET', '/platos/2147483647');
    assert.equal(respuesta.status, 404);
    assert.equal(typeof respuesta.body.message, 'string');
  });

  test('GET /platos/:id con un id mal formado devuelve 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const respuesta = await api('GET', `/platos/${id}`);
      assert.equal(respuesta.status, 400, `id ${id}`);
      assert.equal(typeof respuesta.body.message, 'string');
    }
  });

  test('GET /platos/tipo/:tipo filtra por tipo', async () => {
    const postre = await crearPlatoDePrueba({ tipo: 'postre', nombre: 'Flan' });
    for (const tipo of ['principal', 'combo', 'postre']) {
      const respuesta = await api('GET', `/platos/tipo/${tipo}`);
      assert.equal(respuesta.status, 200);
      assert.ok(Array.isArray(respuesta.body));
      assert.ok(respuesta.body.every((plato) => plato.tipo === tipo), `todos deben ser ${tipo}`);
    }
    const postres = await api('GET', '/platos/tipo/postre');
    assert.ok(postres.body.some((plato) => plato.id === postre.id));
  });

  test('GET /platos/tipo/:tipo con un tipo inválido devuelve 400', async () => {
    const respuesta = await api('GET', '/platos/tipo/bebida');
    assert.equal(respuesta.status, 400);
    assert.match(respuesta.body.message, /principal, combo, postre/);
  });

  test('sin token no se puede crear, modificar ni eliminar platos (401)', async () => {
    const plato = await crearPlatoDePrueba();
    const intentos = [
      api('POST', '/platos', { body: PLATO_VALIDO }),
      api('PUT', `/platos/${plato.id}`, { body: PLATO_VALIDO }),
      api('DELETE', `/platos/${plato.id}`),
    ];
    for (const respuesta of await Promise.all(intentos)) {
      assert.equal(respuesta.status, 401);
      assert.equal(typeof respuesta.body.message, 'string');
    }
    const sigue = await api('GET', `/platos/${plato.id}`);
    assert.deepEqual(sigue.body, plato);
  });

  test('un usuario sin permisos de administrador recibe 403', async () => {
    const plato = await crearPlatoDePrueba();
    const intentos = [
      api('POST', '/platos', { token: cliente.token, body: PLATO_VALIDO }),
      api('PUT', `/platos/${plato.id}`, { token: cliente.token, body: PLATO_VALIDO }),
      api('DELETE', `/platos/${plato.id}`, { token: cliente.token }),
    ];
    for (const respuesta of await Promise.all(intentos)) {
      assert.equal(respuesta.status, 403);
      assert.match(respuesta.body.message, /administrador/);
    }
  });

  test('un administrador puede crear, modificar y eliminar un plato', async () => {
    const creado = await api('POST', '/platos', { token: admin.token, body: PLATO_VALIDO });
    assert.equal(creado.status, 201);
    assert.ok(Number.isInteger(creado.body.id));
    assert.deepEqual(creado.body, { id: creado.body.id, ...PLATO_VALIDO });

    const cambios = { ...PLATO_VALIDO, nombre: 'TEST Combo modificado', precio: 16500 };
    const modificado = await api('PUT', `/platos/${creado.body.id}`, { token: admin.token, body: cambios });
    assert.equal(modificado.status, 200);
    assert.deepEqual(modificado.body, { id: creado.body.id, ...cambios });

    const eliminado = await api('DELETE', `/platos/${creado.body.id}`, { token: admin.token });
    assert.equal(eliminado.status, 200);
    assert.deepEqual(eliminado.body, { message: 'Plato eliminado correctamente' });

    const buscado = await api('GET', `/platos/${creado.body.id}`);
    assert.equal(buscado.status, 404);
  });

  test('POST /platos ignora un id enviado en el cuerpo: lo genera la base', async () => {
    const respuesta = await api('POST', '/platos', { token: admin.token, body: { ...PLATO_VALIDO, id: 999999 } });
    assert.equal(respuesta.status, 201);
    assert.notEqual(respuesta.body.id, 999999);
  });

  test('POST /platos rechaza datos incompletos o inválidos con 400', async () => {
    const sinDescripcion = { ...PLATO_VALIDO };
    delete sinDescripcion.descripcion;
    const casos = [
      {},
      sinDescripcion,
      { ...PLATO_VALIDO, tipo: 'bebida' },
      { ...PLATO_VALIDO, precio: -10 },
      { ...PLATO_VALIDO, precio: 10.5 },
      { ...PLATO_VALIDO, precio: '300' },
      { ...PLATO_VALIDO, nombre: '   ' },
      { ...PLATO_VALIDO, nombre: 'x'.repeat(71) },
      { ...PLATO_VALIDO, descripcion: 'x'.repeat(401) },
      [PLATO_VALIDO],
    ];
    for (const caso of casos) {
      const respuesta = await api('POST', '/platos', { token: admin.token, body: caso });
      assert.equal(respuesta.status, 400, JSON.stringify(caso).slice(0, 80));
      assert.equal(typeof respuesta.body.message, 'string');
    }
  });

  test('PUT /platos/:id valida el id, la existencia del plato y los datos', async () => {
    const plato = await crearPlatoDePrueba();
    const idInvalido = await api('PUT', '/platos/abc', { token: admin.token, body: PLATO_VALIDO });
    assert.equal(idInvalido.status, 400);

    const inexistente = await api('PUT', '/platos/2147483647', { token: admin.token, body: PLATO_VALIDO });
    assert.equal(inexistente.status, 404);

    const incompleto = await api('PUT', `/platos/${plato.id}`, { token: admin.token, body: { precio: 500 } });
    assert.equal(incompleto.status, 400);

    const sinCambios = await api('GET', `/platos/${plato.id}`);
    assert.deepEqual(sinCambios.body, plato);
  });

  test('DELETE /platos/:id de un plato inexistente devuelve 404', async () => {
    const respuesta = await api('DELETE', '/platos/2147483647', { token: admin.token });
    assert.equal(respuesta.status, 404);
  });

  test('DELETE /platos/:id de un plato incluido en un pedido devuelve 409 y no borra nada', async () => {
    const plato = await crearPlatoDePrueba();
    const pedido = await api('POST', '/pedidos', {
      token: cliente.token,
      body: { platos: [{ id: plato.id, cantidad: 1 }] },
    });
    assert.equal(pedido.status, 201);

    const respuesta = await api('DELETE', `/platos/${plato.id}`, { token: admin.token });
    assert.equal(respuesta.status, 409);
    assert.match(respuesta.body.message, /pedidos/);

    const sigue = await api('GET', `/platos/${plato.id}`);
    assert.equal(sigue.status, 200);
    const pedidoGuardado = await api('GET', `/pedidos/${pedido.body.id}`, { token: admin.token });
    assert.equal(pedidoGuardado.body.platos[0].id, plato.id);
  });
});
