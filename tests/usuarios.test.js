/**
 * Pruebas de administración de usuarios: listado, roles, edición y bajas.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, crearUsuario, crearPlatoDePrueba, emailDePrueba, pool } = require('./helpers');

describe('API de usuarios (administración)', () => {
  let api;
  let cerrar;
  let admin;
  let cliente;

  before(async () => {
    ({ api, cerrar } = await iniciarApi());
    admin = await crearUsuario(api, { admin: true, nombre: 'Admin' });
    cliente = await crearUsuario(api, { nombre: 'Carla' });
  });

  after(() => cerrar());

  test('todas las rutas exigen token (401) y rol de administrador (403)', async () => {
    const intentos = [
      ['GET', '/usuarios'],
      ['PUT', `/usuarios/${cliente.id}/admin`, { admin: true }],
      ['PUT', `/usuarios/${cliente.id}`, { nombre: 'X', apellido: 'Y', email: emailDePrueba() }],
      ['DELETE', `/usuarios/${cliente.id}`],
    ];
    for (const [metodo, ruta, body] of intentos) {
      assert.equal((await api(metodo, ruta, { body })).status, 401, `${metodo} ${ruta}`);
      const comoCliente = await api(metodo, ruta, { token: cliente.token, body });
      assert.equal(comoCliente.status, 403, `${metodo} ${ruta}`);
    }
    const { rows } = await pool.query('SELECT admin FROM Usuarios WHERE id = $1', [cliente.id]);
    assert.equal(rows[0].admin, false);
  });

  test('GET /usuarios lista los usuarios con sus pedidos y sin contraseñas', async () => {
    const plato = await crearPlatoDePrueba();
    await api('POST', '/pedidos', { token: cliente.token, body: { platos: [{ id: plato.id, cantidad: 1 }] } });

    const respuesta = await api('GET', '/usuarios', { token: admin.token });
    assert.equal(respuesta.status, 200);
    const fila = respuesta.body.find((usuario) => usuario.id === cliente.id);
    assert.deepEqual(fila, {
      id: cliente.id,
      nombre: 'Carla',
      apellido: 'Prueba',
      email: cliente.email,
      admin: false,
      pedidos: 1,
    });
    assert.equal(/password|\$2[aby]\$/.test(JSON.stringify(respuesta.body)), false);
  });

  test('un administrador da y quita el rol a otro usuario', async () => {
    const otro = await crearUsuario(api, { nombre: 'Otro' });
    const ruta = `/usuarios/${otro.id}/admin`;

    const promovido = await api('PUT', ruta, { token: admin.token, body: { admin: true } });
    assert.equal(promovido.status, 200);
    assert.equal(promovido.body.admin, true);
    // El rol se lee de la base en cada solicitud: el mismo token ya tiene permisos
    assert.equal((await api('GET', '/usuarios', { token: otro.token })).status, 200);
    assert.equal((await api('GET', '/auth/perfil', { token: otro.token })).body.admin, true);

    const degradado = await api('PUT', ruta, { token: admin.token, body: { admin: false } });
    assert.equal(degradado.status, 200);
    assert.equal(degradado.body.admin, false);
    assert.equal((await api('GET', '/usuarios', { token: otro.token })).status, 403);
  });

  test('valida el cuerpo y el id al cambiar el rol', async () => {
    for (const body of [{}, { admin: 'true' }, { admin: 1 }, [true]]) {
      const respuesta = await api('PUT', `/usuarios/${cliente.id}/admin`, { token: admin.token, body });
      assert.equal(respuesta.status, 400, JSON.stringify(body));
    }
    assert.equal((await api('PUT', '/usuarios/abc/admin', { token: admin.token, body: { admin: true } })).status, 400);
    assert.equal((await api('PUT', '/usuarios/2147483647/admin', { token: admin.token, body: { admin: true } })).status, 404);
  });

  test('un administrador no puede quitarse su propio rol ni eliminar su cuenta (409)', async () => {
    const quitarse = await api('PUT', `/usuarios/${admin.id}/admin`, { token: admin.token, body: { admin: false } });
    assert.equal(quitarse.status, 409);
    const eliminarse = await api('DELETE', `/usuarios/${admin.id}`, { token: admin.token });
    assert.equal(eliminarse.status, 409);
    const { rows } = await pool.query('SELECT admin FROM Usuarios WHERE id = $1', [admin.id]);
    assert.deepEqual(rows, [{ admin: true }]);
  });

  test('PUT /usuarios/:id corrige los datos, normaliza el email y rechaza duplicados', async () => {
    const usuario = await crearUsuario(api, { nombre: 'Dani' });
    const nuevoEmail = emailDePrueba('editado');
    const respuesta = await api('PUT', `/usuarios/${usuario.id}`, {
      token: admin.token,
      body: { nombre: ' Daniela ', apellido: 'López', email: `  ${nuevoEmail.toUpperCase()} `, admin: true },
    });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, {
      id: usuario.id,
      nombre: 'Daniela',
      apellido: 'López',
      email: nuevoEmail,
      admin: false, // el rol no se cambia por esta ruta
    });

    const duplicado = await api('PUT', `/usuarios/${usuario.id}`, {
      token: admin.token,
      body: { nombre: 'Daniela', apellido: 'López', email: cliente.email.toUpperCase() },
    });
    assert.equal(duplicado.status, 409);

    const invalido = await api('PUT', `/usuarios/${usuario.id}`, {
      token: admin.token,
      body: { nombre: '', apellido: 'López', email: 'no-es-un-email' },
    });
    assert.equal(invalido.status, 400);

    const login = await api('POST', '/auth/login', { body: { email: nuevoEmail, password: usuario.password } });
    assert.equal(login.status, 200, 'la contraseña sigue siendo la misma');
  });

  test('DELETE /usuarios/:id elimina la cuenta y sus pedidos', async () => {
    const usuario = await crearUsuario(api, { nombre: 'Eli' });
    const plato = await crearPlatoDePrueba();
    for (let i = 0; i < 2; i += 1) {
      await api('POST', '/pedidos', { token: usuario.token, body: { platos: [{ id: plato.id, cantidad: 1 }] } });
    }

    const respuesta = await api('DELETE', `/usuarios/${usuario.id}`, { token: admin.token });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, { message: 'Usuario eliminado correctamente', pedidos_eliminados: 2 });

    const { rows } = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM Usuarios WHERE id = $1) AS usuarios,
              (SELECT COUNT(*)::int FROM Pedidos WHERE id_usuario = $1) AS pedidos`,
      [usuario.id]
    );
    assert.deepEqual(rows[0], { usuarios: 0, pedidos: 0 });
    assert.equal((await api('GET', '/pedidos/usuario', { token: usuario.token })).status, 401, 'su token deja de servir');
    assert.equal((await api('DELETE', `/usuarios/${usuario.id}`, { token: admin.token })).status, 404);
  });
});
