/**
 * Pruebas de registro, inicio de sesión y verificación de JWT.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { iniciarApi, crearUsuario, emailDePrueba, pool } = require('./helpers');

function datosDeRegistro(cambios = {}) {
  return { nombre: 'Juan', apellido: 'Pérez', email: emailDePrueba('juan'), password: '123456', ...cambios };
}

describe('Registro y autenticación', () => {
  let api;
  let cerrar;

  before(async () => {
    ({ api, cerrar } = await iniciarApi());
  });

  after(() => cerrar());

  test('POST /auth/register registra un usuario válido (201) sin devolver la contraseña', async () => {
    const datos = datosDeRegistro();
    const respuesta = await api('POST', '/auth/register', { body: datos });
    assert.equal(respuesta.status, 201);
    assert.deepEqual(respuesta.body, {
      id: respuesta.body.id,
      nombre: 'Juan',
      apellido: 'Pérez',
      email: datos.email,
      admin: false,
    });
  });

  test('el usuario queda con admin = false aunque el cliente envíe admin: true', async () => {
    const respuesta = await api('POST', '/auth/register', { body: datosDeRegistro({ admin: true }) });
    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.admin, false);
    const { rows } = await pool.query('SELECT admin FROM Usuarios WHERE id = $1', [respuesta.body.id]);
    assert.equal(rows[0].admin, false);
  });

  test('la contraseña se guarda como hash de bcrypt, nunca en texto plano', async () => {
    const datos = datosDeRegistro({ password: 'mi-clave-secreta' });
    const respuesta = await api('POST', '/auth/register', { body: datos });
    const { rows } = await pool.query('SELECT password FROM Usuarios WHERE id = $1', [respuesta.body.id]);
    const hash = rows[0].password;
    assert.notEqual(hash, datos.password);
    assert.match(hash, /^\$2[aby]\$10\$/);
    assert.equal(await bcrypt.compare(datos.password, hash), true);
  });

  test('normaliza el email: sin espacios externos y en minúsculas', async () => {
    const email = emailDePrueba('Mayus').replace('Mayus', 'MaYuS');
    const respuesta = await api('POST', '/auth/register', { body: datosDeRegistro({ email: `  ${email.toUpperCase()}  ` }) });
    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.email, email.toLowerCase());

    const login = await api('POST', '/auth/login', { body: { email: email.toUpperCase(), password: '123456' } });
    assert.equal(login.status, 200);
  });

  test('un email ya registrado devuelve 409 (también con otras mayúsculas)', async () => {
    const datos = datosDeRegistro();
    assert.equal((await api('POST', '/auth/register', { body: datos })).status, 201);
    const repetido = await api('POST', '/auth/register', { body: datos });
    assert.equal(repetido.status, 409);
    assert.match(repetido.body.message, /email/);
    const conMayusculas = await api('POST', '/auth/register', { body: { ...datos, email: datos.email.toUpperCase() } });
    assert.equal(conMayusculas.status, 409);
  });

  test('rechaza registros con datos faltantes o inválidos (400)', async () => {
    const casos = [
      {},
      datosDeRegistro({ nombre: undefined }),
      datosDeRegistro({ apellido: '' }),
      datosDeRegistro({ email: 'no-es-un-email' }),
      datosDeRegistro({ email: 123 }),
      datosDeRegistro({ password: '123' }),
      datosDeRegistro({ password: 123456 }),
      datosDeRegistro({ nombre: 'x'.repeat(51) }),
    ];
    for (const caso of casos) {
      const respuesta = await api('POST', '/auth/register', { body: caso });
      assert.equal(respuesta.status, 400, JSON.stringify(caso));
      assert.equal(typeof respuesta.body.message, 'string');
    }
    const sinCuerpo = await api('POST', '/auth/register');
    assert.equal(sinCuerpo.status, 400);
  });

  test('POST /auth/login con credenciales correctas devuelve 200 y un token', async () => {
    const usuario = await crearUsuario(api);
    const respuesta = await api('POST', '/auth/login', { body: { email: usuario.email, password: usuario.password } });
    assert.equal(respuesta.status, 200);
    assert.equal(typeof respuesta.body.token, 'string');
    assert.equal(respuesta.body.usuario.id, usuario.id);
    assert.equal('password' in respuesta.body.usuario, false);
  });

  test('el JWT tiene el payload { id } y vence a los 30 minutos', async () => {
    const usuario = await crearUsuario(api);
    const payload = jwt.verify(usuario.token, process.env.JWT_SECRET);
    assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'id']);
    assert.equal(payload.id, usuario.id);
    assert.equal(payload.exp - payload.iat, 30 * 60);
  });

  test('credenciales incorrectas devuelven 401 con el mismo mensaje', async () => {
    const usuario = await crearUsuario(api);
    const claveIncorrecta = await api('POST', '/auth/login', { body: { email: usuario.email, password: 'otra-clave' } });
    const emailInexistente = await api('POST', '/auth/login', { body: { email: emailDePrueba('nadie'), password: 'otra-clave' } });
    assert.equal(claveIncorrecta.status, 401);
    assert.equal(emailInexistente.status, 401);
    assert.equal(claveIncorrecta.body.message, emailInexistente.body.message);
  });

  test('login con campos faltantes devuelve 400', async () => {
    for (const cuerpo of [{}, { email: 'a@b.com' }, { password: '123456' }, { email: '', password: '' }]) {
      const respuesta = await api('POST', '/auth/login', { body: cuerpo });
      assert.equal(respuesta.status, 400, JSON.stringify(cuerpo));
    }
  });

  test('las rutas protegidas responden 401 si falta el token o está mal formado', async () => {
    const usuario = await crearUsuario(api);
    const sinToken = await api('GET', '/pedidos/usuario');
    assert.equal(sinToken.status, 401);
    assert.equal(sinToken.headers.get('www-authenticate'), 'Bearer');
    for (const encabezado of [`Basic ${usuario.token}`, 'Bearer', `Bearer ${usuario.token} extra`, 'Bearer abc.def.ghi']) {
      const respuesta = await api('GET', '/pedidos/usuario', { encabezados: { Authorization: encabezado } });
      assert.equal(respuesta.status, 401, encabezado.slice(0, 20));
      assert.equal(typeof respuesta.body.message, 'string');
    }
  });

  test('un token vencido devuelve 401', async () => {
    const usuario = await crearUsuario(api);
    const vencido = jwt.sign({ id: usuario.id, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    const respuesta = await api('GET', '/pedidos/usuario', { token: vencido });
    assert.equal(respuesta.status, 401);
    assert.match(respuesta.body.message, /vencido/i);
  });

  test('un token firmado con otra clave o sin firma ("none") devuelve 401', async () => {
    const usuario = await crearUsuario(api);
    const otraClave = jwt.sign({ id: usuario.id }, 'una-clave-que-no-es-la-del-servidor', { expiresIn: '30m' });
    const sinFirma = jwt.sign({ id: usuario.id }, null, { algorithm: 'none' });
    for (const token of [otraClave, sinFirma]) {
      const respuesta = await api('GET', '/pedidos/usuario', { token });
      assert.equal(respuesta.status, 401);
    }
  });

  test('un token válido de un usuario que ya no existe devuelve 401', async () => {
    const token = jwt.sign({ id: 2147483647 }, process.env.JWT_SECRET, { expiresIn: '30m' });
    const respuesta = await api('GET', '/pedidos/usuario', { token });
    assert.equal(respuesta.status, 401);
  });

  test('ninguna respuesta de autenticación incluye el hash de la contraseña', async () => {
    const datos = datosDeRegistro();
    const registro = await api('POST', '/auth/register', { body: datos });
    const login = await api('POST', '/auth/login', { body: { email: datos.email, password: datos.password } });
    const { rows } = await pool.query('SELECT password FROM Usuarios WHERE id = $1', [registro.body.id]);
    for (const respuesta of [registro, login]) {
      assert.equal(respuesta.texto.includes(rows[0].password), false);
      assert.equal(respuesta.texto.includes('"password"'), false);
      assert.equal(respuesta.texto.includes(datos.password), false);
    }
    const payload = jwt.decode(login.body.token);
    assert.equal(JSON.stringify(payload).includes(rows[0].password), false);
  });
});
