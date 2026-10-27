/**
 * Pruebas de la API de pedidos: creación, permisos, transacciones y estados.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, crearUsuario, crearPlatoDePrueba, fechaDeHoyEnArgentina, pool } = require('./helpers');
const { pedidosController } = require('../controllers/controllers');

/** Cuenta los pedidos de un usuario y sus filas en PlatosXPedidos. */
async function contarDatosDelUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM Pedidos WHERE id_usuario = $1) AS pedidos,
            (SELECT COUNT(*)::int FROM PlatosXPedidos pp JOIN Pedidos p ON p.id = pp.id_pedido
              WHERE p.id_usuario = $1) AS relaciones`,
    [idUsuario]
  );
  return rows[0];
}

const soloIdYCantidad = (platos) => platos.map(({ id, cantidad }) => ({ id, cantidad }));

describe('API de pedidos', () => {
  let api;
  let cerrar;
  let admin;
  let ana;
  let beto;
  let hamburguesa;
  let postre;

  before(async () => {
    ({ api, cerrar } = await iniciarApi());
    admin = await crearUsuario(api, { admin: true, nombre: 'Admin' });
    ana = await crearUsuario(api, { nombre: 'Ana' });
    beto = await crearUsuario(api, { nombre: 'Beto' });
    hamburguesa = await crearPlatoDePrueba({ nombre: 'Hamburguesa', precio: 300 });
    postre = await crearPlatoDePrueba({ tipo: 'postre', nombre: 'Flan', precio: 150 });
  });

  after(() => cerrar());

  const pedir = (usuario, platos, extra = {}) =>
    api('POST', '/pedidos', { token: usuario.token, body: { platos, ...extra } });

  test('un visitante sin token no puede crear un pedido (401)', async () => {
    const respuesta = await api('POST', '/pedidos', { body: { platos: [{ id: hamburguesa.id, cantidad: 1 }] } });
    assert.equal(respuesta.status, 401);
  });

  test('un usuario autenticado crea un pedido: 201, estado pendiente y fecha del servidor', async () => {
    const respuesta = await pedir(ana, [
      { id: hamburguesa.id, cantidad: 2 },
      { id: postre.id, cantidad: 1 },
    ]);
    assert.equal(respuesta.status, 201);
    assert.ok(Number.isInteger(respuesta.body.id));
    assert.equal(respuesta.body.id_usuario, ana.id);
    assert.equal(respuesta.body.estado, 'pendiente');
    assert.equal(respuesta.body.fecha, fechaDeHoyEnArgentina());
    assert.deepEqual(soloIdYCantidad(respuesta.body.platos), [
      { id: hamburguesa.id, cantidad: 2 },
      { id: postre.id, cantidad: 1 },
    ]);
    assert.equal(respuesta.body.platos[0].nombre, hamburguesa.nombre);
    assert.equal(respuesta.body.platos[0].precio, 300);
  });

  test('las cantidades quedan guardadas en PlatosXPedidos', async () => {
    const respuesta = await pedir(ana, [
      { id: hamburguesa.id, cantidad: 3 },
      { id: postre.id, cantidad: 4 },
    ]);
    const { rows } = await pool.query(
      'SELECT id_plato, cantidad FROM PlatosXPedidos WHERE id_pedido = $1 ORDER BY id',
      [respuesta.body.id]
    );
    assert.deepEqual(rows, [
      { id_plato: hamburguesa.id, cantidad: 3 },
      { id_plato: postre.id, cantidad: 4 },
    ]);
  });

  test('el usuario sale del JWT: se ignoran id_usuario, fecha y estado enviados en el cuerpo', async () => {
    const respuesta = await pedir(ana, [{ id: hamburguesa.id, cantidad: 1 }], {
      id_usuario: beto.id,
      fecha: '2000-01-01',
      estado: 'entregado',
    });
    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.id_usuario, ana.id);
    assert.equal(respuesta.body.estado, 'pendiente');
    assert.equal(respuesta.body.fecha, fechaDeHoyEnArgentina());
    const delDeBeto = await api('GET', '/pedidos/usuario', { token: beto.token });
    assert.equal(delDeBeto.body.some((pedido) => pedido.id === respuesta.body.id), false);
  });

  test('si un plato se repite en el array, sus cantidades se suman', async () => {
    const respuesta = await pedir(ana, [
      { id: hamburguesa.id, cantidad: 1 },
      { id: postre.id, cantidad: 1 },
      { id: hamburguesa.id, cantidad: 2 },
    ]);
    assert.equal(respuesta.status, 201);
    assert.deepEqual(soloIdYCantidad(respuesta.body.platos), [
      { id: hamburguesa.id, cantidad: 3 },
      { id: postre.id, cantidad: 1 },
    ]);
  });

  test('rechaza cuerpos inválidos con 400 y no guarda nada', async () => {
    const antes = await contarDatosDelUsuario(ana.id);
    const cuerpos = [
      {},
      { platos: [] },
      { platos: 'hamburguesa' },
      { platos: [1, 2] },
      { platos: [null] },
      { platos: [{ id: hamburguesa.id }] },
      { platos: [{ cantidad: 1 }] },
      { platos: [{ id: hamburguesa.id, cantidad: 0 }] },
      { platos: [{ id: hamburguesa.id, cantidad: -2 }] },
      { platos: [{ id: hamburguesa.id, cantidad: 1.5 }] },
      { platos: [{ id: hamburguesa.id, cantidad: '2' }] },
      { platos: [{ id: 'abc', cantidad: 1 }] },
      [{ id: hamburguesa.id, cantidad: 1 }],
    ];
    for (const body of cuerpos) {
      const respuesta = await api('POST', '/pedidos', { token: ana.token, body });
      assert.equal(respuesta.status, 400, JSON.stringify(body));
      assert.equal(typeof respuesta.body.message, 'string');
    }
    const sinCuerpo = await api('POST', '/pedidos', { token: ana.token });
    assert.equal(sinCuerpo.status, 400);
    assert.deepEqual(await contarDatosDelUsuario(ana.id), antes);
  });

  test('rechaza platos inexistentes con 404 y no crea el pedido', async () => {
    const antes = await contarDatosDelUsuario(ana.id);
    const respuesta = await pedir(ana, [
      { id: hamburguesa.id, cantidad: 1 },
      { id: 2147483647, cantidad: 1 },
    ]);
    assert.equal(respuesta.status, 404);
    assert.match(respuesta.body.message, /2147483647/);
    assert.deepEqual(await contarDatosDelUsuario(ana.id), antes);
  });

  test('la transacción evita pedidos guardados a medias', async (t) => {
    t.mock.method(console, 'error', () => {}); // el error 500 esperado se registra en consola
    const original = pedidosController.agregarPlatoAlPedido;
    let llamadas = 0;
    // La segunda relación falla: el pedido y la primera relación deben revertirse
    t.mock.method(pedidosController, 'agregarPlatoAlPedido', async (...argumentos) => {
      llamadas += 1;
      if (llamadas === 2) throw new Error('Falla simulada al guardar PlatosXPedidos');
      return original(...argumentos);
    });

    const antes = await contarDatosDelUsuario(beto.id);
    const respuesta = await pedir(beto, [
      { id: hamburguesa.id, cantidad: 1 },
      { id: postre.id, cantidad: 1 },
    ]);
    assert.equal(respuesta.status, 500);
    assert.deepEqual(respuesta.body, { message: 'Error interno del servidor' });
    assert.equal(llamadas, 2);
    assert.deepEqual(await contarDatosDelUsuario(beto.id), antes);
  });

  test('GET /pedidos/usuario devuelve solo los pedidos del usuario del token', async () => {
    const deBeto = await pedir(beto, [{ id: postre.id, cantidad: 2 }]);
    const deAna = await pedir(ana, [{ id: hamburguesa.id, cantidad: 1 }]);

    const pedidosDeAna = await api('GET', '/pedidos/usuario', { token: ana.token });
    assert.equal(pedidosDeAna.status, 200);
    assert.ok(pedidosDeAna.body.length > 0);
    assert.ok(pedidosDeAna.body.every((pedido) => pedido.id_usuario === ana.id));
    assert.ok(pedidosDeAna.body.some((pedido) => pedido.id === deAna.body.id));

    const pedidosDeBeto = await api('GET', '/pedidos/usuario', { token: beto.token });
    assert.ok(pedidosDeBeto.body.every((pedido) => pedido.id_usuario === beto.id));
    assert.ok(pedidosDeBeto.body.some((pedido) => pedido.id === deBeto.body.id));
  });

  test('/pedidos/usuario ignora un id de usuario enviado por query string', async () => {
    const respuesta = await api('GET', `/pedidos/usuario?id_usuario=${beto.id}&id=${beto.id}`, { token: ana.token });
    assert.equal(respuesta.status, 200);
    assert.ok(respuesta.body.every((pedido) => pedido.id_usuario === ana.id));
  });

  test('solo un administrador puede listar todos los pedidos', async () => {
    assert.equal((await api('GET', '/pedidos')).status, 401);
    assert.equal((await api('GET', '/pedidos', { token: ana.token })).status, 403);

    const respuesta = await api('GET', '/pedidos', { token: admin.token });
    assert.equal(respuesta.status, 200);
    const usuarios = new Set(respuesta.body.map((pedido) => pedido.id_usuario));
    assert.ok(usuarios.has(ana.id) && usuarios.has(beto.id));
    for (const pedido of respuesta.body) {
      assert.ok(Array.isArray(pedido.platos));
      assert.ok(['pendiente', 'aceptado', 'en camino', 'entregado'].includes(pedido.estado));
    }
  });

  test('GET /pedidos/:id: admin 200, cliente 403, inexistente 404 e id inválido 400', async () => {
    const pedido = await pedir(ana, [{ id: hamburguesa.id, cantidad: 2 }]);
    const comoAdmin = await api('GET', `/pedidos/${pedido.body.id}`, { token: admin.token });
    assert.equal(comoAdmin.status, 200);
    assert.deepEqual(comoAdmin.body, pedido.body);

    assert.equal((await api('GET', `/pedidos/${pedido.body.id}`, { token: ana.token })).status, 403);
    assert.equal((await api('GET', '/pedidos/2147483647', { token: admin.token })).status, 404);
    assert.equal((await api('GET', '/pedidos/abc', { token: admin.token })).status, 400);
  });

  test('solo un administrador puede cambiar estados o eliminar pedidos', async () => {
    const pedido = await pedir(ana, [{ id: hamburguesa.id, cantidad: 1 }]);
    for (const accion of ['aceptar', 'comenzar', 'entregar']) {
      assert.equal((await api('PUT', `/pedidos/${pedido.body.id}/${accion}`, { token: ana.token })).status, 403);
      assert.equal((await api('PUT', `/pedidos/${pedido.body.id}/${accion}`)).status, 401);
    }
    assert.equal((await api('DELETE', `/pedidos/${pedido.body.id}`, { token: ana.token })).status, 403);
    assert.equal((await api('DELETE', `/pedidos/${pedido.body.id}`)).status, 401);
    const sigue = await api('GET', `/pedidos/${pedido.body.id}`, { token: admin.token });
    assert.equal(sigue.body.estado, 'pendiente');
  });

  test('el administrador recorre el flujo pendiente → aceptado → en camino → entregado', async () => {
    const pedido = await pedir(ana, [{ id: hamburguesa.id, cantidad: 1 }]);
    const pasos = [
      ['aceptar', 'aceptado'],
      ['comenzar', 'en camino'],
      ['entregar', 'entregado'],
    ];
    for (const [accion, estadoEsperado] of pasos) {
      const respuesta = await api('PUT', `/pedidos/${pedido.body.id}/${accion}`, { token: admin.token });
      assert.equal(respuesta.status, 200, accion);
      assert.equal(respuesta.body.id, pedido.body.id);
      assert.equal(respuesta.body.estado, estadoEsperado);
    }
  });

  test('las transiciones de estado inválidas devuelven 409 y no cambian el pedido', async () => {
    const pedido = await pedir(ana, [{ id: hamburguesa.id, cantidad: 1 }]);
    const ruta = (accion) => `/pedidos/${pedido.body.id}/${accion}`;
    const estado = async () => (await api('GET', `/pedidos/${pedido.body.id}`, { token: admin.token })).body.estado;

    assert.equal((await api('PUT', ruta('comenzar'), { token: admin.token })).status, 409);
    assert.equal((await api('PUT', ruta('entregar'), { token: admin.token })).status, 409);
    assert.equal(await estado(), 'pendiente');

    assert.equal((await api('PUT', ruta('aceptar'), { token: admin.token })).status, 200);
    const repetido = await api('PUT', ruta('aceptar'), { token: admin.token });
    assert.equal(repetido.status, 409);
    assert.match(repetido.body.message, /aceptado/);
    assert.equal((await api('PUT', ruta('entregar'), { token: admin.token })).status, 409);
    assert.equal(await estado(), 'aceptado');

    assert.equal((await api('PUT', ruta('comenzar'), { token: admin.token })).status, 200);
    assert.equal((await api('PUT', ruta('entregar'), { token: admin.token })).status, 200);
    assert.equal((await api('PUT', ruta('aceptar'), { token: admin.token })).status, 409);
    assert.equal(await estado(), 'entregado');
  });

  test('cambiar el estado de un pedido inexistente devuelve 404 y con id inválido 400', async () => {
    assert.equal((await api('PUT', '/pedidos/2147483647/aceptar', { token: admin.token })).status, 404);
    assert.equal((await api('PUT', '/pedidos/xyz/aceptar', { token: admin.token })).status, 400);
  });

  test('DELETE /pedidos/:id elimina el pedido y sus filas de PlatosXPedidos', async () => {
    const pedido = await pedir(ana, [
      { id: hamburguesa.id, cantidad: 1 },
      { id: postre.id, cantidad: 2 },
    ]);
    const respuesta = await api('DELETE', `/pedidos/${pedido.body.id}`, { token: admin.token });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, { message: 'Pedido eliminado correctamente' });

    assert.equal((await api('GET', `/pedidos/${pedido.body.id}`, { token: admin.token })).status, 404);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cantidad FROM PlatosXPedidos WHERE id_pedido = $1', [
      pedido.body.id,
    ]);
    assert.equal(rows[0].cantidad, 0);
  });

  test('DELETE /pedidos/:id con id inválido devuelve 400 e inexistente 404', async () => {
    assert.equal((await api('DELETE', '/pedidos/abc', { token: admin.token })).status, 400);
    assert.equal((await api('DELETE', '/pedidos/2147483647', { token: admin.token })).status, 404);
  });
});
