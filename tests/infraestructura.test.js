/**
 * Pruebas de infraestructura: configuración de la conexión, estructura SQL,
 * formato JSON de los errores y que no se filtren secretos.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, crearUsuario, crearPlatoDePrueba, inicializarBaseDeDatos, pool } = require('./helpers');
const { construirConfiguracion, describirConexion, ErrorDeConfiguracion } = require('../dbconfig');
const { platosController } = require('../controllers/controllers');
const { TABLAS } = require('../database/init');

const esErrorDeConfiguracion = (patron) => (error) => error instanceof ErrorDeConfiguracion && patron.test(error.message);

// Un solo servidor para todo el archivo (iniciarApi también ejecuta database/schema.sql)
let api;
let cerrar;
before(async () => {
  ({ api, cerrar } = await iniciarApi());
});
after(() => cerrar());

describe('dbconfig: configuración de la conexión a Neon', () => {
  test('usa DATABASE_URL como fuente principal y verifica el certificado SSL', () => {
    const config = construirConfiguracion({
      DATABASE_URL:
        'postgresql://ana:s3cr%40to@ep-ejemplo-123.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      PGHOST: 'otro-host',
      PGUSER: 'otro',
      PGDATABASE: 'otra',
      PGPASSWORD: 'otra',
    });
    assert.equal(config.host, 'ep-ejemplo-123.sa-east-1.aws.neon.tech');
    assert.equal(config.port, 5432);
    assert.equal(config.user, 'ana');
    assert.equal(config.password, 's3cr@to');
    assert.equal(config.database, 'neondb');
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
    assert.equal(config.enableChannelBinding, true);
  });

  test('sin DATABASE_URL usa PGHOST, PGUSER, PGDATABASE y PGPASSWORD con el puerto 5432 por defecto', () => {
    const config = construirConfiguracion({
      PGHOST: 'ep-ejemplo-123.sa-east-1.aws.neon.tech',
      PGUSER: 'ana',
      PGDATABASE: 'neondb',
      PGPASSWORD: 'secreto',
    });
    assert.equal(config.host, 'ep-ejemplo-123.sa-east-1.aws.neon.tech');
    assert.equal(config.port, 5432);
    assert.equal(config.user, 'ana');
    assert.equal(config.database, 'neondb');
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
    assert.equal(construirConfiguracion({ PGHOST: 'h.neon.tech', PGUSER: 'a', PGDATABASE: 'b', PGPASSWORD: 'c', PGPORT: '6543' }).port, 6543);
  });

  test('los asteriscos del .env cuentan como valores sin configurar', () => {
    assert.throws(
      () =>
        construirConfiguracion({
          DATABASE_URL: '************',
          PGHOST: '******',
          PGUSER: '******',
          PGDATABASE: '**********',
          PGPASSWORD: '**********',
        }),
      esErrorDeConfiguracion(/Falta configurar la conexión/)
    );
  });

  test('indica qué variables faltan y rechaza URL o puertos inválidos', () => {
    assert.throws(() => construirConfiguracion({ PGHOST: 'h.neon.tech', PGUSER: 'a' }), esErrorDeConfiguracion(/PGDATABASE, PGPASSWORD/));
    assert.throws(() => construirConfiguracion({ DATABASE_URL: 'esto no es una url' }), esErrorDeConfiguracion(/no es una URL válida/));
    assert.throws(() => construirConfiguracion({ DATABASE_URL: 'mysql://a:b@host/db' }), esErrorDeConfiguracion(/postgresql:\/\//));
    assert.throws(() => construirConfiguracion({ DATABASE_URL: 'postgresql://ana@host.neon.tech/db' }), esErrorDeConfiguracion(/contraseña/));
    assert.throws(
      () => construirConfiguracion({ PGHOST: 'h', PGUSER: 'a', PGDATABASE: 'b', PGPASSWORD: 'c', PGPORT: 'abc' }),
      esErrorDeConfiguracion(/PGPORT/)
    );
  });

  test('no permite desactivar SSL ni la verificación del certificado con un host remoto', () => {
    const base = 'postgresql://ana:clave-super-secreta@ep-ejemplo.neon.tech/neondb';
    assert.throws(() => construirConfiguracion({ DATABASE_URL: `${base}?sslmode=disable` }), esErrorDeConfiguracion(/requiere SSL/));
    assert.throws(() => construirConfiguracion({ DATABASE_URL: `${base}?sslmode=no-verify` }), esErrorDeConfiguracion(/verifica el certificado/));
    for (const modo of ['prefer', 'require', 'verify-ca', 'verify-full']) {
      assert.equal(construirConfiguracion({ DATABASE_URL: `${base}?sslmode=${modo}` }).ssl.rejectUnauthorized, true, modo);
    }
  });

  test('sslmode=disable solo se acepta con un PostgreSQL local', () => {
    const config = construirConfiguracion({ DATABASE_URL: 'postgresql://ana:clave@localhost:5433/cufambre?sslmode=disable' });
    assert.equal(config.ssl, false);
    assert.equal(config.port, 5433);
  });

  test('los mensajes de configuración nunca incluyen la contraseña', () => {
    const casos = [
      'postgresql://ana:clave-super-secreta@ep-ejemplo.neon.tech/neondb?sslmode=no-verify',
      'postgresql://ana:clave-super-secreta@ep-ejemplo.neon.tech/neondb?sslmode=disable',
      'postgresql://ana:clave-super-secreta@/neondb',
    ];
    for (const url of casos) {
      assert.throws(
        () => construirConfiguracion({ DATABASE_URL: url }),
        (error) => error instanceof ErrorDeConfiguracion && !error.message.includes('clave-super-secreta')
      );
    }
  });
});

describe('Base de datos: tablas, claves foráneas y restricciones', () => {
  test('database/schema.sql crea las cuatro tablas con los campos y tipos de la consigna', async () => {
    const { rows } = await pool.query(
      `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, is_identity
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position`,
      [TABLAS]
    );
    const estructura = {};
    for (const fila of rows) {
      const tipo = fila.character_maximum_length ? `${fila.data_type}(${fila.character_maximum_length})` : fila.data_type;
      (estructura[fila.table_name] ??= {})[fila.column_name] = tipo;
    }
    assert.deepEqual(estructura, {
      pedidos: { id: 'integer', id_usuario: 'integer', fecha: 'date', estado: 'character varying(50)' },
      platos: {
        id: 'integer',
        tipo: 'character varying(20)',
        nombre: 'character varying(70)',
        precio: 'integer',
        descripcion: 'character varying(400)',
      },
      platosxpedidos: { id: 'integer', id_pedido: 'integer', id_plato: 'integer', cantidad: 'integer' },
      usuarios: {
        id: 'integer',
        nombre: 'character varying(50)',
        apellido: 'character varying(50)',
        email: 'character varying(256)',
        password: 'character varying(256)',
        admin: 'boolean',
      },
    });
    const ids = rows.filter((fila) => fila.column_name === 'id');
    assert.ok(ids.every((fila) => fila.is_identity === 'YES' && fila.is_nullable === 'NO'), 'id autoincremental');
  });

  test('define las claves primarias y foráneas entre las tablas', async () => {
    const { rows } = await pool.query(
      `SELECT c.conrelid::regclass::text AS tabla, a.attname AS columna,
              c.confrelid::regclass::text AS referida, af.attname AS columna_referida, c.confdeltype AS al_borrar
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
        WHERE c.contype = 'f' AND c.conrelid::regclass::text = ANY($1::text[])
        ORDER BY tabla, columna`,
      [TABLAS]
    );
    assert.deepEqual(
      rows.map((fila) => `${fila.tabla}.${fila.columna} -> ${fila.referida}.${fila.columna_referida} (${fila.al_borrar})`),
      [
        'pedidos.id_usuario -> usuarios.id (r)', // r = RESTRICT
        'platosxpedidos.id_pedido -> pedidos.id (c)', // c = CASCADE
        'platosxpedidos.id_plato -> platos.id (r)',
      ]
    );
    const { rows: primarias } = await pool.query(
      `SELECT conrelid::regclass::text AS tabla FROM pg_constraint
        WHERE contype = 'p' AND conrelid::regclass::text = ANY($1::text[]) ORDER BY tabla`,
      [TABLAS]
    );
    assert.deepEqual(primarias.map((fila) => fila.tabla), ['pedidos', 'platos', 'platosxpedidos', 'usuarios']);
  });

  test('las restricciones rechazan tipos, precios, estados, cantidades y emails inválidos', async () => {
    const insertarPlato = (tipo, precio) =>
      pool.query(`INSERT INTO Platos (tipo, nombre, precio, descripcion) VALUES ($1, 'TEST x', $2, 'x')`, [tipo, precio]);
    await assert.rejects(insertarPlato('bebida', 100), { code: '23514' });
    await assert.rejects(insertarPlato('principal', -1), { code: '23514' });

    const { rows } = await pool.query(
      `INSERT INTO Usuarios (nombre, apellido, email, password) VALUES ('Test', 'SQL', $1, 'hash')
       RETURNING id, admin`,
      [`sql.${Date.now()}@test.cufambre`]
    );
    assert.equal(rows[0].admin, false, 'admin es false por defecto');
    await assert.rejects(
      pool.query(`INSERT INTO Usuarios (nombre, apellido, email, password) SELECT nombre, apellido, email, password FROM Usuarios WHERE id = $1`, [rows[0].id]),
      { code: '23505' }
    );

    await assert.rejects(pool.query(`INSERT INTO Pedidos (id_usuario, estado) VALUES ($1, 'cancelado')`, [rows[0].id]), { code: '23514' });
    await assert.rejects(pool.query(`INSERT INTO Pedidos (id_usuario) VALUES (2147483647)`), { code: '23503' });

    const plato = await crearPlatoDePrueba();
    const pedido = await pool.query(`INSERT INTO Pedidos (id_usuario) VALUES ($1) RETURNING id, estado`, [rows[0].id]);
    assert.equal(pedido.rows[0].estado, 'pendiente', 'estado pendiente por defecto');
    await assert.rejects(
      pool.query('INSERT INTO PlatosXPedidos (id_pedido, id_plato, cantidad) VALUES ($1, $2, 0)', [pedido.rows[0].id, plato.id]),
      { code: '23514' }
    );
    await assert.rejects(
      pool.query('INSERT INTO PlatosXPedidos (id_pedido, id_plato, cantidad) VALUES ($1, 2147483647, 1)', [pedido.rows[0].id]),
      { code: '23503' }
    );
  });

  test('volver a ejecutar schema.sql no borra datos (es idempotente)', async () => {
    const plato = await crearPlatoDePrueba({ nombre: 'Persistente' });
    await inicializarBaseDeDatos();
    await inicializarBaseDeDatos();
    const { rows } = await pool.query('SELECT nombre FROM Platos WHERE id = $1', [plato.id]);
    assert.deepEqual(rows, [{ nombre: 'TEST Persistente' }]);
  });
});

describe('Errores en JSON, rutas y secretos', () => {
  test('una ruta inexistente devuelve 404 con { message }', async () => {
    const respuesta = await api('GET', '/no-existe');
    assert.equal(respuesta.status, 404);
    assert.match(respuesta.headers.get('content-type'), /application\/json/);
    assert.deepEqual(Object.keys(respuesta.body), ['message']);
  });

  test('un JSON mal formado devuelve 400 con { message }', async () => {
    const respuesta = await api('POST', '/auth/login', { crudo: '{"email": "a@b.com",' });
    assert.equal(respuesta.status, 400);
    assert.deepEqual(respuesta.body, { message: 'El cuerpo de la solicitud no es un JSON válido' });
  });

  test('un error inesperado devuelve 500 sin exponer detalles internos', async (t) => {
    t.mock.method(console, 'error', () => {});
    t.mock.method(platosController, 'listarPlatos', async () => {
      throw new Error('relation "secreta" does not exist: SELECT password FROM Usuarios');
    });
    const respuesta = await api('GET', '/platos');
    assert.equal(respuesta.status, 500);
    assert.deepEqual(respuesta.body, { message: 'Error interno del servidor' });
    assert.equal(/SELECT|password|secreta|at /.test(respuesta.texto), false);
  });

  test('las rutas específicas no son interceptadas por las rutas con :id', async () => {
    const usuario = await crearUsuario(api);
    const porTipo = await api('GET', '/platos/tipo/principal');
    assert.equal(porTipo.status, 200);
    assert.ok(Array.isArray(porTipo.body));
    const propios = await api('GET', '/pedidos/usuario', { token: usuario.token });
    assert.equal(propios.status, 200, 'no debe tratar "usuario" como un :id ni exigir admin');
    assert.deepEqual(propios.body, []);
  });

  test('ni las respuestas ni los registros muestran la contraseña de la base ni JWT_SECRET', async (t) => {
    const contrasenaDb = decodeURIComponent(new URL(process.env.TEST_DATABASE_URL).password);
    const secretoJwt = process.env.JWT_SECRET;
    const registros = [];
    t.mock.method(console, 'error', (...args) => registros.push(args.map(String).join(' ')));
    t.mock.method(console, 'log', (...args) => registros.push(args.map(String).join(' ')));
    t.mock.method(platosController, 'buscarPlatoPorId', async () => {
      throw new Error('fallo simulado');
    });

    const respuesta = await api('GET', '/platos/1');
    assert.equal(respuesta.status, 500);
    registros.push(describirConexion());

    const textos = [respuesta.texto, ...registros];
    assert.ok(registros.length >= 2);
    for (const texto of textos) {
      assert.equal(texto.includes(contrasenaDb), false);
      assert.equal(texto.includes(secretoJwt), false);
    }
  });
});
