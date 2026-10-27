# 🍔 CUFAMBRE

**CUFAMBRE** es una hamburguesería ficticia con identidad visual propia. Este proyecto contiene su **API REST**, que cumple los requisitos de la consigna **BurgerTIC – backend general** (platos, usuarios/autenticación y pedidos), y un **frontend** que la consume: menú con imágenes propias de cada producto, carrito, registro e ingreso, seguimiento de pedidos y panel de administración.

> BurgerTIC es el nombre de la consigna; la marca de la aplicación es CUFAMBRE.

---

## Índice

1. [Tecnologías](#tecnologías)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Inicio rápido](#inicio-rápido)
4. [Configurar Neon y el archivo .env](#configurar-neon-y-el-archivo-env)
5. [Base de datos: tablas, relaciones y restricciones](#base-de-datos-tablas-relaciones-y-restricciones)
6. [Usuarios, login y JWT](#usuarios-login-y-jwt)
7. [Crear un administrador](#crear-un-administrador)
8. [Referencia de la API](#referencia-de-la-api)
9. [Códigos de estado y errores](#códigos-de-estado-y-errores)
10. [Probar los pedidos y sus estados paso a paso](#probar-los-pedidos-y-sus-estados-paso-a-paso)
11. [Frontend](#frontend)
12. [Pruebas automáticas](#pruebas-automáticas)
13. [Decisiones técnicas](#decisiones-técnicas)
14. [Solución de problemas](#solución-de-problemas)

---

## Tecnologías

| Uso | Tecnología |
| --- | --- |
| Servidor | Node.js (20.10 o superior; probado con 22) + **Express 5** |
| Base de datos | **PostgreSQL en Neon**, con **pg** y **SQL puro** (sin Sequelize ni ningún ORM) |
| Autenticación | **jsonwebtoken** (JWT de 30 minutos) |
| Contraseñas | **bcryptjs** (hash con 10 rondas) |
| Configuración | **dotenv** |
| Frontend | HTML, CSS y JavaScript (módulos ES), servido por el mismo Express |
| Pruebas | `node:test` (incluido en Node) |

Todas las consultas son SQL explícito ejecutado con `pg` y parámetros `$1, $2…`, lo que evita la inyección SQL.

---

## Estructura del proyecto

```
cufambre/
├── main.js                  Servidor: crea la app Express, sirve el frontend, monta las rutas,
│                            centraliza los errores, verifica la base y ejecuta schema.sql al iniciar
├── dbconfig.js              Conexión a Neon: lee .env, configura SSL y exporta el Pool de pg
├── routes/                  RUTAS (express.Router): conectan HTTP con los servicios
│   ├── routes.js            Router principal: monta /platos, /auth y /pedidos
│   ├── platosRouter.js
│   ├── authRouter.js
│   └── pedidosRouter.js
├── services/                LÓGICA DE NEGOCIO: validaciones, reglas, JWT, transacciones
│   ├── services.js          Punto de entrada de la capa
│   ├── platosService.js
│   ├── authService.js
│   └── pedidosService.js
├── controllers/             ACCESO A DATOS: consultas SQL con pg
│   ├── controllers.js       Punto de entrada de la capa
│   ├── platosController.js
│   ├── authController.js    (tabla Usuarios)
│   └── pedidosController.js (tablas Pedidos y PlatosXPedidos)
├── middleware/
│   ├── auth.js              verificarToken (JWT) y verificarAdmin (rol leído de la base)
│   └── errores.js           404 y manejo centralizado de errores en JSON
├── utils/                   HttpError, validaciones y configuración común del JWT
├── database/
│   ├── schema.sql           Las 4 tablas con claves primarias, foráneas y restricciones
│   ├── init.js              Ejecuta schema.sql en una transacción (npm run db:init)
│   └── seed.js              Carga el menú de ejemplo si Platos está vacía (npm run db:seed)
├── public/                  Frontend
│   ├── index.html
│   ├── css/styles.css
│   ├── js/                  app.js, api.js, sesion.js, carrito.js, admin.js, vistas.js, imagenes.js, utilidades.js
│   └── images/
│       ├── burgers/         una ilustración distinta por hamburguesa
│       ├── combos/
│       └── desserts/
├── tests/                   Pruebas automáticas de la API
├── .env                     Variables locales (NO se sube al repositorio)
├── .env.example             Modelo de .env sin credenciales reales
├── .gitignore
├── package.json
└── README.md
```

Las capas se reparten como pide el proyecto: **routes** define los endpoints, **services** implementa la lógica y **controllers** accede a PostgreSQL. Cada capa está dividida por dominio (platos, auth y pedidos) y tiene su archivo principal (`routes.js`, `services.js`, `controllers.js`).

---

## Inicio rápido

```bash
npm install                 # 1. dependencias
cp .env.example .env        # 2. (o editá el .env existente) y completá los datos de Neon
npm run db:seed             # 3. crea las tablas (si no existen) y carga el menú de ejemplo
npm start                   # 4. http://localhost:3000
```

Para desarrollo, `npm run dev` reinicia el servidor al guardar cambios.

Al iniciar, el servidor:

1. verifica que exista `JWT_SECRET`;
2. se conecta a PostgreSQL (si falta configuración o falla la conexión, muestra un mensaje claro y no arranca);
3. ejecuta `database/schema.sql` (solo crea lo que falta: **nunca borra tablas ni datos**);
4. avisa si la tabla Platos está vacía y escucha en el puerto `PORT` (3000 por defecto).

---

## Configurar Neon y el archivo .env

1. Creá un proyecto en [Neon](https://neon.tech) (la base por defecto se llama `neondb`).
2. En el panel del proyecto, botón **Connect**, copiá la cadena de conexión. Tiene esta forma:
   `postgresql://usuario:contraseña@ep-xxxx-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
3. Pegala en el archivo `.env`, reemplazando los asteriscos:

```dotenv
# Recommended for most uses
DATABASE_URL=postgresql://usuario:contraseña@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
# Parameters for constructing your own connection string
PGHOST=ep-xxxx.sa-east-1.aws.neon.tech
PGUSER=usuario
PGDATABASE=neondb
PGPASSWORD=contraseña

# Clave para firmar los JWT: un valor largo y aleatorio
JWT_SECRET=pegá-acá-una-clave-larga
PORT=3000
```

Para generar `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Reglas de conexión de `dbconfig.js`

- Si existe `DATABASE_URL`, es la fuente principal.
- Si no existe, la conexión se arma con `PGHOST`, `PGUSER`, `PGDATABASE` y `PGPASSWORD` (y `PGPORT`, que vale **5432** si no está definido).
- Los valores que siguen siendo asteriscos (`****`) se consideran **sin configurar**, y el servidor explica qué falta.
- **SSL con verificación de certificado siempre**: cualquier `sslmode` (`require`, `verify-full`, etc.) se trata como `verify-full`, es decir, se valida la cadena de certificados y que el certificado corresponda al host (`rejectUnauthorized: true`). Neon usa certificados de una autoridad pública que Node reconoce por defecto, así que no hace falta descargar nada.
- `sslmode=no-verify` se rechaza, y `sslmode=disable` solo se acepta con un PostgreSQL **local** (`localhost`) para desarrollo.
- `channel_binding=require` (incluido en las cadenas de Neon) activa SCRAM-SHA-256-PLUS.
- En los registros solo se muestran el host y el nombre de la base: nunca la contraseña ni la URL completa.

> ¿Por qué no se pasa la URL tal cual a `pg`? Porque `pg` 8 trata `sslmode=require` como `verify-full`, pero avisa que en la versión 9 pasará a cifrar **sin** verificar el certificado. Al armar la configuración explícitamente, la verificación queda garantizada aunque se actualice la librería.

---

## Base de datos: tablas, relaciones y restricciones

Las tablas se definen con SQL en [`database/schema.sql`](database/schema.sql) (no hay carpeta `models/` porque no se usa ORM).

> 📄 Detalle de cada tabla (PK, FK, tipos) y SQL listo para pegar en Neon o Vercel: **[BASE_DE_DATOS.md](BASE_DE_DATOS.md)** y [`database/neon_setup.sql`](database/neon_setup.sql).

| Tabla | Campos |
| --- | --- |
| **Platos** | `id` INTEGER identidad (PK) · `tipo` VARCHAR(20) · `nombre` VARCHAR(70) · `precio` INTEGER · `descripcion` VARCHAR(400) |
| **Usuarios** | `id` INTEGER identidad (PK) · `nombre` VARCHAR(50) · `apellido` VARCHAR(50) · `email` VARCHAR(256) único · `password` VARCHAR(256) (hash bcrypt) · `admin` BOOLEAN por defecto `false` |
| **Pedidos** | `id` INTEGER identidad (PK) · `id_usuario` INTEGER (FK → Usuarios.id) · `fecha` DATE · `estado` VARCHAR(50) |
| **PlatosXPedidos** | `id` INTEGER identidad (PK) · `id_pedido` INTEGER (FK → Pedidos.id) · `id_plato` INTEGER (FK → Platos.id) · `cantidad` INTEGER |

Los identificadores usan `GENERATED BY DEFAULT AS IDENTITY`.

### Asociaciones (claves foráneas)

```
Usuarios 1 ──────< N Pedidos 1 ──────< N PlatosXPedidos N >────── 1 Platos
   id               id_usuario            id_pedido · id_plato · cantidad
```

- **Un usuario tiene muchos pedidos**: `Pedidos.id_usuario → Usuarios.id` (`ON DELETE RESTRICT`).
- **Un pedido tiene muchos platos y un plato aparece en muchos pedidos**, mediante la tabla intermedia **PlatosXPedidos**, que además guarda la **cantidad**:
  - `PlatosXPedidos.id_pedido → Pedidos.id` (`ON DELETE CASCADE`: al borrar un pedido no quedan filas huérfanas).
  - `PlatosXPedidos.id_plato → Platos.id` (`ON DELETE RESTRICT`: un plato que ya se pidió no se puede borrar; la API responde 409).

### Restricciones

- `Platos.tipo` ∈ {`principal`, `combo`, `postre`} · `precio >= 0` · nombre y descripción no vacíos.
- `Usuarios.email` único · `admin` por defecto `false`.
- `Pedidos.estado` ∈ {`pendiente`, `aceptado`, `en camino`, `entregado`}, por defecto `pendiente` · `fecha` por defecto la fecha actual.
- `PlatosXPedidos.cantidad > 0` · un mismo plato figura una sola vez por pedido (`UNIQUE (id_pedido, id_plato)`).

### Cómo crear las tablas en una base nueva

Cualquiera de estas opciones (todas son idempotentes y no borran datos):

- **Automático**: `npm start` ejecuta `schema.sql` al iniciar.
- **Script**: `npm run db:init` ejecuta `schema.sql` dentro de una transacción y lista las tablas (ejemplo de salida; la versión depende de tu proyecto de Neon):
  ```
  Conectado a PostgreSQL 17.x: base "neondb" en ep-xxxx.neon.tech:5432 (SSL con certificado verificado)
    ✔ platos
    ✔ usuarios
    ✔ pedidos
    ✔ platosxpedidos
  ```
- **psql**: `psql "$DATABASE_URL" --single-transaction -f database/schema.sql`
- **Neon SQL Editor**: pegá el contenido de `schema.sql` y ejecutalo.

### Cómo comprobar que existen

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('platos', 'usuarios', 'pedidos', 'platosxpedidos');
```

> PostgreSQL guarda en minúsculas los nombres escritos sin comillas: en Neon vas a ver `platos`, `usuarios`, `pedidos` y `platosxpedidos`. Las consultas se pueden escribir igual con la grafía de la consigna (`SELECT * FROM Platos;`).

### Datos de ejemplo

`npm run db:seed` crea las tablas si faltan y, **solo si Platos está vacía**, carga 16 platos: 8 hamburguesas (`principal`), 4 combos (`combo`) y 4 postres (`postre`). No borra ni duplica nada.

---

## Usuarios, login y JWT

### Registrar un usuario — `POST /auth/register` (público)

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","apellido":"Pérez","email":"juanperez@gmail.com","password":"123456"}'
```

Respuesta `201 Created` (nunca incluye la contraseña ni su hash):

```json
{ "id": 4, "nombre": "Juan", "apellido": "Pérez", "email": "juanperez@gmail.com", "admin": false }
```

- El email se normaliza (sin espacios externos y en minúsculas) y debe tener formato válido.
- La contraseña (6 a 72 caracteres) se guarda como **hash de bcrypt**.
- `admin` siempre queda en `false`: si el cliente envía `"admin": true`, se ignora.
- Email ya registrado → `409`. Datos faltantes o inválidos → `400`.

### Iniciar sesión — `POST /auth/login` (público)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juanperez@gmail.com","password":"123456"}'
```

Respuesta `200 OK`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": { "id": 4, "nombre": "Juan", "apellido": "Pérez", "email": "juanperez@gmail.com", "admin": false }
}
```

- El JWT tiene el payload `{ "id": 4 }` y vence a los **30 minutos** (`expiresIn: '30m'`, firmado con `JWT_SECRET` y HS256).
- Credenciales incorrectas → `401` con `{ "message": "Email o contraseña incorrectos" }` (mismo mensaje si el email no existe).
- Campos faltantes → `400`.

### Usar el token

Las rutas protegidas reciben el token en el encabezado `Authorization`:

```bash
curl http://localhost:3000/pedidos/usuario -H "Authorization: Bearer TOKEN_JWT_GENERADO"
```

En cada solicitud protegida el middleware verifica el formato `Bearer`, la firma, el vencimiento y que el usuario **siga existiendo en la base**. Si falta el token, está mal formado, es inválido o venció, responde `401` con `{ "message": "..." }`.

---

## Crear un administrador

Como exige la consigna, **no hay ninguna ruta para crear administradores**: el rol solo se asigna modificando la base directamente.

1. Registrá el usuario normalmente (`POST /auth/register` o desde el frontend, botón **Ingresar → Crear cuenta**).
2. En el **SQL Editor de Neon** (o con `psql`), ejecutá:
   ```sql
   UPDATE Usuarios SET admin = true WHERE email = 'admin@cufambre.com';
   ```
3. Iniciá sesión de nuevo. El rol se lee de la base en cada solicitud, así que el cambio vale incluso con un token ya emitido.

---

## Referencia de la API

Todas las respuestas son JSON. Los mensajes de éxito y de error tienen la forma `{ "message": "..." }`.

### Platos

| Método | Ruta | Acción | Acceso | Éxito | Errores |
| --- | --- | --- | --- | --- | --- |
| GET | `/platos` | Lista todos los platos (array, puede estar vacío) | Público | 200 | — |
| GET | `/platos/tipo/:tipo` | Platos de un tipo: `principal`, `combo` o `postre` | Público | 200 | 400 tipo inválido |
| GET | `/platos/:id` | Un plato | Público | 200 | 400 id inválido · 404 |
| POST | `/platos` | Crea un plato | Admin | 201 | 400 · 401 · 403 |
| PUT | `/platos/:id` | Modifica un plato (se envían los 4 campos) | Admin | 200 | 400 · 401 · 403 · 404 |
| DELETE | `/platos/:id` | Elimina un plato | Admin | 200 `{ message }` | 400 · 401 · 403 · 404 · 409 si está en pedidos |

Cuerpo de POST y PUT (el `id` lo genera la base):

```json
{ "tipo": "principal", "nombre": "Hamburguesa", "precio": 300, "descripcion": "Hamburguesa de carne con lechuga, tomate y queso" }
```

Respuesta de POST `201`:

```json
{ "id": 19, "tipo": "principal", "nombre": "Hamburguesa", "precio": 300, "descripcion": "Hamburguesa de carne con lechuga, tomate y queso" }
```

Validaciones: `tipo` uno de los tres permitidos; `nombre` (máx. 70) y `descripcion` (máx. 400) textos no vacíos; `precio` número **entero** mayor o igual a 0 (no se aceptan negativos, decimales ni textos como `"300"`).

### Autenticación

| Método | Ruta | Acción | Acceso | Éxito | Errores |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | Registra un usuario | Público | 201 | 400 · 409 |
| POST | `/auth/login` | Devuelve un JWT de 30 minutos | Público | 200 | 400 · 401 |

### Pedidos

| Método | Ruta | Acción | Acceso | Éxito | Errores |
| --- | --- | --- | --- | --- | --- |
| GET | `/pedidos` | Todos los pedidos con sus platos | Admin | 200 | 401 · 403 |
| GET | `/pedidos/usuario` | Pedidos del usuario del token | Usuario | 200 | 401 |
| GET | `/pedidos/:id` | Un pedido con sus platos | Admin | 200 | 400 · 401 · 403 · 404 |
| POST | `/pedidos` | Crea un pedido | Usuario | 201 | 400 · 401 · 404 plato inexistente |
| PUT | `/pedidos/:id/aceptar` | `pendiente` → `aceptado` | Admin | 200 | 400 · 401 · 403 · 404 · 409 |
| PUT | `/pedidos/:id/comenzar` | `aceptado` → `en camino` | Admin | 200 | 400 · 401 · 403 · 404 · 409 |
| PUT | `/pedidos/:id/entregar` | `en camino` → `entregado` | Admin | 200 | 400 · 401 · 403 · 404 · 409 |
| DELETE | `/pedidos/:id` | Elimina el pedido y sus filas de PlatosXPedidos | Admin | 200 `{ message }` | 400 · 401 · 403 · 404 |

Las rutas específicas se declaran antes que las que tienen parámetros (`/platos/tipo/:tipo` antes de `/platos/:id` y `/pedidos/usuario` antes de `/pedidos/:id`).

**Crear un pedido** — el cuerpo contiene **solo** el array `platos`:

```json
{ "platos": [ { "id": 1, "cantidad": 2 }, { "id": 2, "cantidad": 1 } ] }
```

- El usuario se toma **exclusivamente del JWT**; la fecha la asigna el servidor y el estado inicial es siempre `pendiente`. Si el cuerpo trae `id_usuario`, `fecha` o `estado`, se ignoran.
- `platos` debe ser un array no vacío de objetos con `id` entero positivo y `cantidad` entera mayor que 0 (si no → `400`). Si algún plato no existe → `404` y no se guarda nada.
- El pedido y todas sus filas de PlatosXPedidos se guardan en **una transacción**: si falla cualquier paso se hace `ROLLBACK`.
- Si un plato aparece repetido en el array, sus cantidades se **suman** en una sola fila.

Respuesta `201` (mismo formato en todos los endpoints de pedidos):

```json
{
  "id": 3,
  "id_usuario": 4,
  "fecha": "2026-10-26",
  "estado": "pendiente",
  "usuario": { "nombre": "Juan", "apellido": "Pérez", "email": "juanperez@gmail.com" },
  "platos": [
    { "id": 1, "cantidad": 2, "nombre": "Clásica CUFAMBRE", "precio": 9900 },
    { "id": 2, "cantidad": 1, "nombre": "Doble Cheddar Bacon", "precio": 12900 }
  ]
}
```

Conserva los campos del ejemplo de la consigna (`id`, `id_usuario`, `fecha`, `estado`, `platos[].id`, `platos[].cantidad`) y agrega datos descriptivos no sensibles (`nombre` y `precio` de cada plato, y el nombre y email del cliente, útiles para el panel de administración). Los pedidos se listan del más nuevo al más viejo.

**Cambios de estado**: el flujo es `pendiente → aceptado → en camino → entregado`. Saltar un paso o repetir una transición responde `409`:

```json
{ "message": "No se puede pasar el pedido 3 a «en camino»: está «pendiente» y debe estar «aceptado»" }
```

---

## Códigos de estado y errores

| Situación | Código |
| --- | --- |
| Consulta o modificación exitosa | 200 |
| Recurso creado | 201 |
| Cuerpo, parámetro o JSON inválido | 400 |
| Token ausente, mal formado, inválido o vencido | 401 |
| Usuario autenticado sin permisos de administrador | 403 |
| Recurso o ruta inexistente | 404 |
| Email duplicado, transición de estado inválida o plato con pedidos | 409 |
| Cuerpo demasiado grande | 413 |
| Base de datos no disponible | 503 |
| Error inesperado del servidor | 500 |

Ejemplos reales de respuestas de error:

```json
{ "message": "Tipo de plato inválido. Los tipos válidos son: principal, combo, postre" }
{ "message": "Token vencido. Iniciá sesión nuevamente" }
{ "message": "Acceso denegado: se requieren permisos de administrador" }
{ "message": "No se puede eliminar el plato porque forma parte de uno o más pedidos" }
{ "message": "El cuerpo de la solicitud no es un JSON válido" }
{ "message": "Error interno del servidor" }
```

El manejo de errores está centralizado en `middleware/errores.js`: los servicios lanzan errores con su código HTTP y los errores de PostgreSQL no tratados se traducen a códigos coherentes (por ejemplo, violación de unicidad → 409). Las respuestas **nunca** incluyen trazas, consultas SQL, tokens ni datos de conexión; el detalle de los errores 500 queda solo en la consola del servidor. Los mensajes nunca se envían como texto plano.

---

## Probar los pedidos y sus estados paso a paso

Con el servidor corriendo y el menú cargado (`npm run db:seed`). En Windows usá `curl.exe`, o importá las mismas solicitudes en Postman / Thunder Client.

```bash
# 1. Registrar e iniciar sesión como cliente
curl -X POST localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","apellido":"Pérez","email":"juanperez@gmail.com","password":"123456"}'
curl -X POST localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"juanperez@gmail.com","password":"123456"}'
# Copiá el "token" de la respuesta:
TOKEN=eyJ...

# 2. Crear un pedido (201, estado "pendiente")
curl -X POST localhost:3000/pedidos -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"platos":[{"id":1,"cantidad":2},{"id":2,"cantidad":1}]}'

# 3. Ver mis pedidos (200)
curl localhost:3000/pedidos/usuario -H "Authorization: Bearer $TOKEN"

# 4. Un cliente no puede ver todos los pedidos (403)
curl localhost:3000/pedidos -H "Authorization: Bearer $TOKEN"

# 5. Convertir a otro usuario en administrador (SQL en Neon) e iniciar sesión con él
#    UPDATE Usuarios SET admin = true WHERE email = 'admin@cufambre.com';
ADMIN=eyJ...

# 6. Recorrer los estados (200 cada uno)
curl -X PUT localhost:3000/pedidos/1/aceptar  -H "Authorization: Bearer $ADMIN"
curl -X PUT localhost:3000/pedidos/1/comenzar -H "Authorization: Bearer $ADMIN"
curl -X PUT localhost:3000/pedidos/1/entregar -H "Authorization: Bearer $ADMIN"

# 7. Una transición inválida responde 409
curl -X PUT localhost:3000/pedidos/1/aceptar -H "Authorization: Bearer $ADMIN"

# 8. Eliminar el pedido (200 con { message }) y volver a intentarlo (404)
curl -X DELETE localhost:3000/pedidos/1 -H "Authorization: Bearer $ADMIN"
curl -X DELETE localhost:3000/pedidos/1 -H "Authorization: Bearer $ADMIN"
```

---

## Frontend

Abrí `http://localhost:3000`. El frontend lo sirve el mismo servidor (no hace falta CORS) y usa solo los endpoints de la consigna:

- **Menú** con filtros Todo / Hamburguesas / Combos / Postres (`GET /platos` y `GET /platos/tipo/:tipo`).
- **Carrito** con cantidades y total; al confirmar crea el pedido con `POST /pedidos`.
- **Ingresar / Crear cuenta** (`POST /auth/login` y `POST /auth/register`). El JWT se guarda en el navegador y la sesión se cierra sola a los 30 minutos o ante cualquier `401`.
- **Mis pedidos** con el progreso `pendiente → aceptado → en camino → entregado` (`GET /pedidos/usuario`, se actualiza cada 30 segundos).
- **Panel de administración** (solo para administradores): pedidos filtrables por estado con los botones de cada transición y eliminación; alta, edición y baja de platos. Ocultar botones es solo comodidad: **la API verifica el rol en cada operación**.

### Identidad visual

Rojo tomate `#D92D20`, amarillo queso `#FFC83D`, crema `#FFF4DF` y marrón oscuro `#292016`, tipografías Lilita One y Nunito, contornos gruesos y sombras desplazadas tipo "sticker". El diseño es adaptable a celulares.

### Imágenes de los productos

Cada producto tiene su **propia ilustración SVG**, dibujada según sus ingredientes (pan, medallones, quesos, panceta, palta, jalapeños, provoleta con chimichurri, etc.):

- `public/images/burgers/` — las 8 hamburguesas (`clasica-cufambre.svg`, `doble-cheddar-bacon.svg`, `la-picante.svg`, `crispy-chicken.svg`, `veggie-garden.svg`, `la-bestia.svg`, `azul-y-hongos.svg`, `la-argenta.svg`).
- `public/images/combos/` — los 4 combos.
- `public/images/desserts/` — los 4 postres.

La tabla Platos de la consigna **no tiene columna de imagen**, y agregar una podría romper las pruebas que comparan los objetos exactos. Por eso la imagen se asocia **en el frontend por el nombre del plato** (`public/js/imagenes.js`): "Clásica CUFAMBRE" → `images/burgers/clasica-cufambre.svg`. Un plato nuevo que cargue un administrador (o uno renombrado) muestra la ilustración genérica de su tipo (`nueva-hamburguesa.svg`, `nuevo-combo.svg` o `nuevo-postre.svg`).

---

## Pruebas automáticas

Las pruebas usan `node:test` y una base **solo para pruebas** indicada en `TEST_DATABASE_URL` (puede ser una rama de Neon o un PostgreSQL local). Levantan la API en un puerto libre, ejecutan `schema.sql` y al terminar borran únicamente los datos que crearon (usuarios `@test.cufambre`, sus pedidos y platos `TEST …`).

```bash
# En .env o en la terminal:
TEST_DATABASE_URL=postgresql://usuario:contraseña@host/base_de_pruebas?sslmode=require
npm test
```

**63 pruebas** en 4 archivos:

- **Platos** (`tests/platos.test.js`): listado y búsqueda; 404 por id inexistente; 400 por id o tipo inválido; filtro por tipo; sin token → 401; usuario común → 403; un admin crea, modifica y elimina; datos incompletos o inválidos → 400; PUT valida id, existencia y datos; borrar un plato que está en un pedido → 409 sin borrar nada.
- **Autenticación** (`tests/auth.test.js`): registro válido (201) sin contraseña en la respuesta; `admin` queda en `false` aunque se envíe `true`; la contraseña se guarda como hash bcrypt; normalización del email; email duplicado → 409; datos inválidos → 400; login correcto con token; payload `{ id }` y vencimiento de exactamente 30 minutos; credenciales incorrectas → 401; token ausente, mal formado, vencido, firmado con otra clave o con `alg: none` → 401; usuario del token inexistente → 401; ninguna respuesta contiene el hash.
- **Pedidos** (`tests/pedidos.test.js`): visitante → 401; creación con usuario del JWT, fecha del servidor y estado `pendiente`; cantidades guardadas en PlatosXPedidos; se ignoran `id_usuario`, `fecha` y `estado` enviados; suma de platos repetidos; cuerpos inválidos → 400; plato inexistente → 404 sin guardar nada; **transacción**: si falla la segunda relación no queda ni el pedido ni la primera relación; cada usuario ve solo sus pedidos (aunque mande otro id por query string); solo admin lista todo, ve un pedido, cambia estados y elimina; flujo completo de estados; transiciones inválidas → 409; eliminación con sus relaciones.
- **Infraestructura** (`tests/infraestructura.test.js`): `dbconfig` (prioridad de `DATABASE_URL`, variables sueltas, puerto 5432 por defecto, asteriscos como "sin configurar", SSL siempre verificado, errores sin contraseñas); estructura real de las tablas, tipos, claves primarias y foráneas; restricciones CHECK/UNIQUE/FK; `schema.sql` idempotente; errores en JSON (ruta inexistente, JSON mal formado, 500 sin detalles internos); las rutas específicas no son capturadas por `/:id`; ni respuestas ni registros muestran la contraseña de la base o `JWT_SECRET`.

### Qué se probó y qué falta probar con Neon

- ✅ Las 63 pruebas pasan contra **PostgreSQL 16 local**, tanto sin SSL como con **SSL verificado (verify-full) y channel binding** usando una CA de prueba propia.
- ✅ Se verificó que la conexión **falla** si el certificado no es de una CA confiable o no corresponde al host, y que se rechazan `sslmode=no-verify` y `sslmode=disable` con un host remoto.
- ✅ Recorrido completo del frontend en Chromium (escritorio y celular): menú, filtros, carrito, registro, pedido, cambios de estado desde el panel admin, alta/edición/baja de platos, 409 al borrar un plato con pedidos y cierre de sesión ante un token inválido.
- ⏳ **Pendiente: la conexión real a Neon**, porque requiere tus credenciales. Con el `.env` completo, verificala con `npm run db:init` (debe mostrar "SSL con certificado verificado" y las 4 tablas) y, si querés, corré `npm test` contra una rama de Neon usada solo para pruebas.

---

## Decisiones técnicas

- **Capas**: `routes` (HTTP) → `services` (validación y reglas; no conocen `req`/`res`) → `controllers` (SQL con pg). Las transacciones las coordina el servicio con `conTransaccion()`, que reparte un mismo cliente a todas las consultas.
- **Express 5**: los errores de los handlers `async` llegan solos al middleware de errores.
- **Campos de control**: en `POST /pedidos` se ignoran `id_usuario`, `fecha` y `estado`; en el registro se ignora `admin`; en platos se ignora `id`. Solo se leen los campos permitidos.
- **Platos repetidos en un pedido**: se suman en una sola fila (`UNIQUE (id_pedido, id_plato)`).
- **PUT /platos/:id** reemplaza el plato completo: exige los cuatro campos.
- **Tipos y emails** se normalizan (espacios y minúsculas) antes de validar y guardar.
- **Fecha del pedido**: la asigna PostgreSQL con la hora de Argentina (`America/Argentina/Buenos_Aires`), porque Neon trabaja en UTC y un pedido de las 22 h quedaría con la fecha del día siguiente. Las columnas DATE se devuelven como texto `AAAA-MM-DD`.
- **Estados**: cada transición es un único `UPDATE ... WHERE estado = <estado esperado>`, así dos administradores no pueden aplicarla dos veces a la vez.
- **Eliminar un pedido**: en una transacción se borran primero sus filas de PlatosXPedidos y después el pedido; además, la FK con `ON DELETE CASCADE` garantiza que nunca queden filas huérfanas.
- **Eliminar un plato**: lo impide la FK `ON DELETE RESTRICT` si ya se pidió (409), y así los pedidos históricos siguen completos. Para sacarlo del menú en ese caso, se puede editar.
- **Seguridad del login**: mismo mensaje y un tiempo de respuesta similar si el email no existe (se compara contra un hash ficticio). Los JWT se verifican fijando el algoritmo HS256.
- **Caché**: las respuestas de la API llevan `Cache-Control: no-store`.
- **Precios de pedidos anteriores**: la tabla PlatosXPedidos de la consigna no guarda el precio, así que los totales se calculan con el precio actual de cada plato.

---

## Solución de problemas

| Mensaje | Causa probable |
| --- | --- |
| `Falta configurar la conexión a PostgreSQL...` | El `.env` todavía tiene asteriscos o le faltan variables. |
| `Falta configurar JWT_SECRET...` | Agregá `JWT_SECRET` al `.env`. |
| `Usuario o contraseña de PostgreSQL incorrectos` | Revisá la cadena de Neon (si reseteaste la contraseña, copiala de nuevo). |
| `No se encontró el host de la base de datos` | Host mal copiado o sin conexión a internet. |
| `No se pudo verificar el certificado SSL...` | Un proxy o antivirus intercepta TLS; no desactives la verificación: configurá su certificado con la variable `NODE_EXTRA_CA_CERTS`. |
| `El servidor no acepta SSL...` | Con un PostgreSQL local agregá `?sslmode=disable` a la URL. |
| `El puerto 3000 ya está en uso` | Cambiá `PORT` en el `.env`. |
| `Definí TEST_DATABASE_URL...` (al correr `npm test`) | Las pruebas necesitan una base aparte, solo para pruebas. |
