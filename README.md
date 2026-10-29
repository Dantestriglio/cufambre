# 👑🍔 King Sciarra

**King Sciarra** es una hamburguesería ficticia con identidad visual propia. Este proyecto contiene su **API REST**, construida sobre los requisitos de la consigna **BurgerTIC – backend general** (platos, usuarios/autenticación y pedidos), y un **frontend** que la consume: menú con imágenes propias de cada producto, **platos que se arman a gusto** (quitar ingredientes, sumar extras y dejar aclaraciones, con el precio recalculado), **bebidas**, carrito, registro e ingreso, seguimiento de pedidos y un **panel de administración** con resumen, pedidos, platos, ingredientes y usuarios.

> BurgerTIC es el nombre de la consigna; la marca de la aplicación es King Sciarra (antes se llamaba CUFAMBRE). Las ampliaciones respecto de la consigna original están marcadas en cada sección.

---

## Índice

1. [Tecnologías](#tecnologías)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Inicio rápido](#inicio-rápido)
4. [Configurar Neon y el archivo .env](#configurar-neon-y-el-archivo-env)
5. [Base de datos: tablas, relaciones y restricciones](#base-de-datos-tablas-relaciones-y-restricciones)
6. [Usuarios, login y JWT](#usuarios-login-y-jwt)
7. [Administradores](#administradores)
8. [Personalización de platos](#personalización-de-platos)
9. [Referencia de la API](#referencia-de-la-api)
10. [Códigos de estado y errores](#códigos-de-estado-y-errores)
11. [Probar los pedidos y sus estados paso a paso](#probar-los-pedidos-y-sus-estados-paso-a-paso)
12. [Frontend](#frontend)
13. [Pruebas automáticas](#pruebas-automáticas)
14. [Decisiones técnicas](#decisiones-técnicas)
15. [Solución de problemas](#solución-de-problemas)

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
│   ├── routes.js            Router principal: monta /platos, /auth, /pedidos, /ingredientes y /usuarios
│   ├── platosRouter.js      (incluye /platos/opciones y /platos/:id/ingredientes)
│   ├── authRouter.js
│   ├── pedidosRouter.js
│   ├── ingredientesRouter.js
│   └── usuariosRouter.js    (solo administradores)
├── services/                LÓGICA DE NEGOCIO: validaciones, reglas, precios, JWT, transacciones
│   ├── services.js          Punto de entrada de la capa
│   ├── platosService.js
│   ├── authService.js
│   ├── pedidosService.js    (valida la personalización y calcula el precio de cada ítem)
│   ├── ingredientesService.js
│   └── usuariosService.js
├── controllers/             ACCESO A DATOS: consultas SQL con pg
│   ├── controllers.js       Punto de entrada de la capa
│   ├── platosController.js
│   ├── authController.js    (tabla Usuarios: login y registro)
│   ├── pedidosController.js (tablas Pedidos, PlatosXPedidos y Personalizaciones)
│   ├── ingredientesController.js (tablas Ingredientes e IngredientesXPlatos)
│   └── usuariosController.js     (tabla Usuarios: administración)
├── middleware/
│   ├── auth.js              verificarToken (JWT) y verificarAdmin (rol leído de la base)
│   └── errores.js           404 y manejo centralizado de errores en JSON
├── utils/                   HttpError, validaciones y configuración común del JWT
├── database/
│   ├── schema.sql           Las 7 tablas con claves primarias, foráneas y restricciones,
│   │                        y las migraciones desde la versión anterior
│   ├── init.js              Ejecuta schema.sql en una transacción (npm run db:init)
│   ├── seed.js              Agrega lo que falte del menú de ejemplo (npm run db:seed)
│   ├── admin.js             Da el rol de administrador a un usuario (npm run admin -- email)
│   ├── neon_setup.sql       Todo lo anterior en un solo script para el SQL Editor de Neon
│   ├── datos_demo.sql       Usuarios y pedidos de demostración
│   └── demo.js              Carga datos_demo.sql (npm run db:demo)
├── public/                  Frontend
│   ├── index.html
│   ├── css/styles.css
│   ├── js/                  app.js, api.js, sesion.js, carrito.js, opciones.js, personalizar.js,
│   │                        admin.js, adminIngredientes.js, adminUsuarios.js, adminResumen.js,
│   │                        vistas.js, imagenes.js, utilidades.js
│   └── images/
│       ├── burgers/         una ilustración distinta por hamburguesa
│       ├── combos/
│       ├── desserts/
│       └── drinks/
├── tests/                   Pruebas automáticas de la API
├── .env                     Variables locales (NO se sube al repositorio)
├── .env.example             Modelo de .env sin credenciales reales
├── .gitignore
├── package.json
└── README.md
```

Las capas se reparten como pide el proyecto: **routes** define los endpoints, **services** implementa la lógica y **controllers** accede a PostgreSQL. Cada capa está dividida por dominio (platos, auth, pedidos, ingredientes y usuarios) y tiene su archivo principal (`routes.js`, `services.js`, `controllers.js`).

---

## Inicio rápido

```bash
npm install                 # 1. dependencias
cp .env.example .env        # 2. (o editá el .env existente) y completá los datos de Neon
npm run db:seed             # 3. crea o actualiza las tablas y carga el menú de ejemplo
npm start                   # 4. http://localhost:3000
# 5. Registrate desde la página y convertite en el primer administrador:
npm run admin -- tu-email@ejemplo.com
# (opcional) usuarios y pedidos de demostración para probar el panel:
npm run db:demo
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
| **PlatosXPedidos** | `id` INTEGER identidad (PK) · `id_pedido` INTEGER (FK → Pedidos.id) · `id_plato` INTEGER (FK → Platos.id) · `cantidad` INTEGER · *ampliación:* `precio_unitario` INTEGER · `aclaracion` VARCHAR(140) |
| **Ingredientes** *(ampliación)* | `id` INTEGER identidad (PK) · `nombre` VARCHAR(60) único sin distinguir mayúsculas · `precio` INTEGER (costo de cada unidad extra) · `disponible` BOOLEAN |
| **IngredientesXPlatos** *(ampliación)* | `id` (PK) · `id_plato` (FK → Platos.id) · `id_ingrediente` (FK → Ingredientes.id) · `incluido` BOOLEAN (viene en el plato y se puede quitar) · `maximo` INTEGER (unidades extra permitidas, 0 a 10) |
| **Personalizaciones** *(ampliación)* | `id` (PK) · `id_item` (FK → PlatosXPedidos.id) · `id_ingrediente` (FK → Ingredientes.id) · `accion` (`agregar` o `quitar`) · `cantidad` · `precio` (valor del extra al momento del pedido) |

Los identificadores usan `GENERATED BY DEFAULT AS IDENTITY`.

### Asociaciones (claves foráneas)

```
Usuarios 1 ──< N Pedidos 1 ──< N PlatosXPedidos N >── 1 Platos 1 ──< N IngredientesXPlatos N >── 1 Ingredientes
                                       1                                                              1
                                       └──────────< N Personalizaciones N >───────────────────────────┘
```

- **Un usuario tiene muchos pedidos**: `Pedidos.id_usuario → Usuarios.id` (`ON DELETE RESTRICT`).
- **Un pedido tiene muchos platos y un plato aparece en muchos pedidos**, mediante la tabla intermedia **PlatosXPedidos**. Cada fila es un **ítem** con su cantidad: el mismo plato puede aparecer dos veces si se personalizó distinto.
  - `PlatosXPedidos.id_pedido → Pedidos.id` (`ON DELETE CASCADE`: al borrar un pedido no quedan filas huérfanas).
  - `PlatosXPedidos.id_plato → Platos.id` (`ON DELETE RESTRICT`: un plato que ya se pidió no se puede borrar; la API responde 409).
- **Cada plato admite muchos ingredientes y un ingrediente sirve para muchos platos**, mediante **IngredientesXPlatos** (`ON DELETE CASCADE` en ambas FK: es configuración, no historia).
- **Cada ítem de un pedido guarda sus cambios** en **Personalizaciones**: `id_item → PlatosXPedidos.id` (`CASCADE`) e `id_ingrediente → Ingredientes.id` (`RESTRICT`: un ingrediente que ya se pidió no se borra; se puede marcar como agotado).

### Restricciones

- `Platos.tipo` ∈ {`principal`, `combo`, `postre`, `bebida`} · `precio >= 0` · nombre y descripción no vacíos.
- `Usuarios.email` único · `admin` por defecto `false`.
- `Pedidos.estado` ∈ {`pendiente`, `aceptado`, `en camino`, `entregado`}, por defecto `pendiente` · `fecha` por defecto la fecha actual.
- `PlatosXPedidos.cantidad > 0` · `precio_unitario >= 0`.
- `Ingredientes.precio >= 0` · `IngredientesXPlatos`: un ingrediente una sola vez por plato, `maximo` entre 0 y 10, y si no viene incluido tiene que poder agregarse (`maximo > 0`).
- `Personalizaciones.accion` ∈ {`agregar`, `quitar`} · `cantidad > 0` · un ingrediente una sola vez por ítem.

### Migración desde la versión anterior

`schema.sql` también actualiza una base creada con la versión anterior (CUFAMBRE) sin perder datos: agrega el tipo `bebida`, las columnas `precio_unitario` y `aclaracion`, quita la restricción que impedía repetir un plato en un pedido y crea las tablas nuevas. Los ítems viejos no tienen `precio_unitario` y se muestran con el precio actual del plato. Basta con iniciar el servidor (o `npm run db:init`) y después `npm run db:seed` para sumar el menú nuevo.

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
    ✔ ingredientes
    ✔ ingredientesxplatos
    ✔ personalizaciones
  ```
- **psql**: `psql "$DATABASE_URL" --single-transaction -f database/schema.sql`
- **Neon SQL Editor**: pegá el contenido de `schema.sql` y ejecutalo.

### Cómo comprobar que existen

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('platos', 'usuarios', 'pedidos', 'platosxpedidos',
                      'ingredientes', 'ingredientesxplatos', 'personalizaciones');
```

> PostgreSQL guarda en minúsculas los nombres escritos sin comillas: en Neon vas a ver `platos`, `usuarios`, `pedidos`, `platosxpedidos`, etc. Las consultas se pueden escribir igual con la grafía de la consigna (`SELECT * FROM Platos;`).

### Datos de ejemplo

`npm run db:seed` crea las tablas si faltan y **agrega solo lo que falte**, así que se puede correr sobre una base con datos:

- **25 platos**: 10 hamburguesas (`principal`, entre ellas la nueva **La King Sciarra** y **Pulled Pork BBQ**), 5 combos (con el nuevo **Combo King**), 4 postres y **6 bebidas** (gaseosas, limonada, agua, cerveza IPA y milkshake). Se comparan por nombre, sin distinguir mayúsculas.
- **44 ingredientes y extras** con su precio (medallón extra, cheddar, panceta, palta, salsas, pan sin TACC, agrandar papas, tamaño grande de bebida, bocha de helado…).
- **Qué trae y qué admite cada plato**: solo en los platos que todavía no tienen ninguna opción configurada, para no pisar lo que haya cambiado un administrador.
- Renombra el plato de la versión anterior "Clásica CUFAMBRE" a **"Clásica King"**.

### Datos de demostración (usuarios y pedidos)

Para probar la app y el panel con datos, [`database/datos_demo.sql`](database/datos_demo.sql) carga:

- **13 usuarios** `@demo.kingsciarra.com`, todos con la contraseña **`clave123`**: una administradora (`martina.sciarra@demo.kingsciarra.com`) y 12 clientes.
- **49 pedidos de las últimas 3 semanas**: los anteriores entregados y los de hoy en todos los estados, con hamburguesas personalizadas (extras, ingredientes quitados, aclaraciones), combos, bebidas y postres. Las fechas son relativas al día en que se ejecuta y los precios se calculan como en la API.

Se carga con `npm run db:demo` (asegura antes las tablas y el menú) o pegando el archivo en el SQL Editor de Neon **después** de `neon_setup.sql`. Se puede repetir: los usuarios no se duplican y los pedidos solo se cargan si los usuarios de demostración todavía no tienen ninguno. Para sacarlos, eliminá esas cuentas desde **Panel → Usuarios** (se borran con sus pedidos), o en SQL: `DELETE FROM Pedidos WHERE id_usuario IN (SELECT id FROM Usuarios WHERE email LIKE '%@demo.kingsciarra.com');` y después `DELETE FROM Usuarios WHERE email LIKE '%@demo.kingsciarra.com';`.

> ⚠️ Son cuentas con una contraseña conocida (incluida una administradora): usalas para probar, no en una base pública.

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

## Administradores

El registro público **siempre** crea clientes (`admin = false`), como pide la consigna. *Ampliación:* una vez que existe un administrador, **los administradores gestionan a los demás desde el panel** (pestaña **Usuarios**) o con la API `/usuarios`.

### El primer administrador

1. Registrá el usuario normalmente (`POST /auth/register` o desde el frontend, botón **Ingresar → Crear cuenta**).
2. Dale el rol con el script (usa la conexión del `.env`):
   ```bash
   npm run admin -- admin@kingsciarra.com
   ```
   o, si preferís, en el **SQL Editor de Neon**:
   ```sql
   UPDATE Usuarios SET admin = true WHERE email = 'admin@kingsciarra.com';
   ```
3. El rol se lee de la base en cada solicitud, así que el cambio vale incluso con un token ya emitido. El frontend consulta `GET /auth/perfil` cada 30 segundos y muestra el panel sin tener que volver a ingresar.

### Administración de usuarios (panel → Usuarios)

- Buscar por nombre o email y filtrar por rol; ver cuántos pedidos hizo cada uno.
- **Hacer admin / Quitar admin** a otros usuarios.
- **Editar** nombre, apellido y email (el email se normaliza y no puede repetirse).
- **Eliminar** una cuenta: se borran también sus pedidos, en una transacción.
- Para no dejar el local sin administradores, **nadie puede quitarse su propio rol ni eliminar su propia cuenta** (`409`). Como solo un administrador puede quitarle el rol a otro, siempre queda al menos uno.

---

## Personalización de platos

*Ampliación de la consigna.* Cada plato puede tener **ingredientes y extras** (tabla IngredientesXPlatos):

- **Incluidos**: vienen en el plato y el cliente los puede **quitar** (por ejemplo "sin pepinos"). Quitar no descuenta.
- **Extras**: se pueden **agregar** hasta un máximo de unidades, pagando el precio del ingrediente cada vez (por ejemplo "+2 cheddar" a $ 900 c/u). Un ingrediente incluido también puede tener extras (doble cheddar).
- **Aclaración** libre para la cocina (hasta 140 caracteres): "bien cocida", "cortada al medio"…
- Las bebidas también se personalizan (tamaño grande, rodaja de limón, sin hielo) y en los combos se puede agrandar las papas o la bebida.

**El precio lo calcula siempre el servidor**: precio del plato + extras, y se guarda en `PlatosXPedidos.precio_unitario` (y el de cada extra en Personalizaciones). Así, si después cambia un precio, los pedidos ya hechos no cambian. El frontend muestra la misma cuenta mientras armás el plato, pero cualquier precio que envíe el cliente se ignora.

Los administradores definen qué admite cada plato desde **Panel → Platos** (al crear o editar un plato, sección "Ingredientes y extras") y mantienen el catálogo en **Panel → Ingredientes**, donde además pueden marcar un ingrediente como **agotado** para dejar de ofrecerlo sin borrarlo.

---

## Referencia de la API

Todas las respuestas son JSON. Los mensajes de éxito y de error tienen la forma `{ "message": "..." }`.

### Platos

| Método | Ruta | Acción | Acceso | Éxito | Errores |
| --- | --- | --- | --- | --- | --- |
| GET | `/platos` | Lista todos los platos (array, puede estar vacío) | Público | 200 | — |
| GET | `/platos/tipo/:tipo` | Platos de un tipo: `principal`, `combo`, `postre` o `bebida` | Público | 200 | 400 tipo inválido |
| GET | `/platos/opciones` | Opciones de todos los platos (sin ingredientes agotados), para armar el menú | Público | 200 | — |
| GET | `/platos/:id` | Un plato | Público | 200 | 400 id inválido · 404 |
| GET | `/platos/:id/ingredientes` | Qué trae el plato y qué extras admite (incluye agotados) | Público | 200 | 400 · 404 |
| POST | `/platos` | Crea un plato | Admin | 201 | 400 · 401 · 403 |
| PUT | `/platos/:id` | Modifica un plato (se envían los 4 campos) | Admin | 200 | 400 · 401 · 403 · 404 |
| PUT | `/platos/:id/ingredientes` | Reemplaza los ingredientes del plato | Admin | 200 | 400 · 401 · 403 · 404 |
| DELETE | `/platos/:id` | Elimina un plato | Admin | 200 `{ message }` | 400 · 401 · 403 · 404 · 409 si está en pedidos |

Cuerpo de POST y PUT (el `id` lo genera la base):

```json
{ "tipo": "principal", "nombre": "Hamburguesa", "precio": 300, "descripcion": "Hamburguesa de carne con lechuga, tomate y queso" }
```

Respuesta de POST `201`:

```json
{ "id": 19, "tipo": "principal", "nombre": "Hamburguesa", "precio": 300, "descripcion": "Hamburguesa de carne con lechuga, tomate y queso" }
```

Validaciones: `tipo` uno de los cuatro permitidos; `nombre` (máx. 70) y `descripcion` (máx. 400) textos no vacíos; `precio` número **entero** mayor o igual a 0 (no se aceptan negativos, decimales ni textos como `"300"`).

Cuerpo de `PUT /platos/:id/ingredientes` (reemplaza la lista completa; `[]` la vacía):

```json
{ "ingredientes": [ { "id": 5, "incluido": true, "maximo": 3 }, { "id": 9, "incluido": false, "maximo": 2 } ] }
```

Respuesta (también la de `GET /platos/:id/ingredientes`):

```json
[
  { "id": 5, "nombre": "Cheddar", "precio": 900, "disponible": true, "incluido": true, "maximo": 3 },
  { "id": 9, "nombre": "Panceta crocante", "precio": 1300, "disponible": true, "incluido": false, "maximo": 2 }
]
```

`GET /platos/opciones` devuelve lo mismo para todos los platos, con un campo `id_plato` en cada fila.

### Ingredientes *(ampliación)*

| Método | Ruta | Acción | Acceso | Éxito | Errores |
| --- | --- | --- | --- | --- | --- |
| GET | `/ingredientes` | Catálogo, con `platos` = en cuántos platos se ofrece | Público | 200 | — |
| POST | `/ingredientes` | Crea un ingrediente `{ nombre, precio, disponible? }` | Admin | 201 | 400 · 401 · 403 · 409 nombre repetido |
| PUT | `/ingredientes/:id` | Modifica un ingrediente (por ejemplo `disponible: false` = agotado) | Admin | 200 | 400 · 401 · 403 · 404 · 409 |
| DELETE | `/ingredientes/:id` | Elimina un ingrediente | Admin | 200 `{ message }` | 400 · 401 · 403 · 404 · 409 si figura en pedidos |

### Autenticación

| Método | Ruta | Acción | Acceso | Éxito | Errores |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | Registra un usuario | Público | 201 | 400 · 409 |
| POST | `/auth/login` | Devuelve un JWT de 30 minutos | Público | 200 | 400 · 401 |
| GET | `/auth/perfil` | Datos actuales del usuario del token (incluido el rol) | Usuario | 200 | 401 |

### Usuarios *(ampliación, solo administradores)*

| Método | Ruta | Acción | Éxito | Errores |
| --- | --- | --- | --- | --- |
| GET | `/usuarios` | Todos los usuarios con la cantidad de `pedidos` (nunca la contraseña) | 200 | 401 · 403 |
| PUT | `/usuarios/:id/admin` | Da o quita el rol: `{ "admin": true }` | 200 | 400 · 401 · 403 · 404 · 409 si es el propio |
| PUT | `/usuarios/:id` | Corrige `{ nombre, apellido, email }` | 200 | 400 · 401 · 403 · 404 · 409 email repetido |
| DELETE | `/usuarios/:id` | Elimina la cuenta y sus pedidos: `{ message, pedidos_eliminados }` | 200 | 400 · 401 · 403 · 404 · 409 si es la propia |

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

**Crear un pedido** — el cuerpo contiene **solo** el array `platos`. El formato de la consigna sigue funcionando igual; la personalización es opcional:

```json
{
  "platos": [
    { "id": 1, "cantidad": 2, "extras": [ { "id": 5, "cantidad": 2 } ], "sin": [ 14 ], "aclaracion": "bien cocida" },
    { "id": 20, "cantidad": 1 }
  ]
}
```

- El usuario se toma **exclusivamente del JWT**; la fecha la asigna el servidor y el estado inicial es siempre `pendiente`. Si el cuerpo trae `id_usuario`, `fecha`, `estado` o precios, se ignoran.
- `platos` debe ser un array no vacío de objetos con `id` entero positivo y `cantidad` entera mayor que 0 (si no → `400`). Si algún plato no existe → `404` y no se guarda nada.
- `extras` (ids de ingredientes con su cantidad, 1 por defecto), `sin` (ids de ingredientes) y `aclaracion` (hasta 140 caracteres) son opcionales. Responde `400` si el plato no admite ese extra, si se supera el máximo, si el extra está agotado, si se quita algo que el plato no trae o si se agrega y se quita lo mismo.
- El pedido, sus ítems y sus personalizaciones se guardan en **una transacción**: si falla cualquier paso se hace `ROLLBACK`.
- Si un plato aparece repetido **con la misma personalización**, sus cantidades se **suman** en un solo ítem; con personalizaciones distintas quedan ítems separados.

Respuesta `201` (mismo formato en todos los endpoints de pedidos):

```json
{
  "id": 3,
  "id_usuario": 4,
  "fecha": "2026-10-26",
  "estado": "pendiente",
  "usuario": { "nombre": "Juan", "apellido": "Pérez", "email": "juanperez@gmail.com" },
  "platos": [
    {
      "id": 1, "cantidad": 2, "nombre": "Clásica King", "tipo": "principal", "precio": 11700,
      "extras": [ { "id": 5, "nombre": "Cheddar", "cantidad": 2, "precio": 900 } ],
      "sin": [ { "id": 14, "nombre": "Pepinos" } ],
      "aclaracion": "bien cocida"
    },
    { "id": 20, "cantidad": 1, "nombre": "Gaseosa Cola 500 ml", "tipo": "bebida", "precio": 2800, "extras": [], "sin": [], "aclaracion": null }
  ]
}
```

Conserva los campos del ejemplo de la consigna (`id`, `id_usuario`, `fecha`, `estado`, `platos[].id`, `platos[].cantidad`) y agrega datos descriptivos no sensibles. En cada ítem, `precio` es el de **una unidad con sus extras** (9.900 + 2 × 900 = 11.700); el total del ítem es `precio × cantidad`. Los pedidos se listan del más nuevo al más viejo.

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
| Email o ingrediente duplicado, transición de estado inválida, plato o ingrediente con pedidos, quitarse el rol o eliminarse a uno mismo | 409 |
| Cuerpo demasiado grande | 413 |
| Base de datos no disponible | 503 |
| Error inesperado del servidor | 500 |

Ejemplos reales de respuestas de error:

```json
{ "message": "Tipo de plato inválido. Los tipos válidos son: principal, combo, postre, bebida" }
{ "message": "A \"Clásica King\" se le pueden agregar como máximo 3 de Cheddar" }
{ "message": "No podés quitarte tus propios permisos de administrador: pedíselo a otro administrador" }
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

# 5. Convertir a otro usuario en administrador e iniciar sesión con él
#    npm run admin -- admin@kingsciarra.com   (o desde el panel, si ya hay un administrador)
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

Abrí `http://localhost:3000`. El frontend lo sirve el mismo servidor (no hace falta CORS):

- **Menú** con filtros Todo / Hamburguesas / Combos / Postres / Bebidas (`GET /platos`, `GET /platos/tipo/:tipo` y `GET /platos/opciones`). Los platos personalizables llevan el sello "Personalizable" y su precio "desde".
- **Armar el plato**: hamburguesas y combos se abren en una ventana donde destildás lo que no querés, sumás extras con + y −, dejás una aclaración y elegís la cantidad; el total se recalcula en el momento. Al armar una hamburguesa podés **sumarle bebidas** con un toque. Postres y bebidas se agregan directo y también tienen un enlace "Personalizar".
- **Carrito**: cada línea muestra su personalización (+extras, "sin…", aclaración) y se puede **editar**; dos líneas iguales se suman. Al confirmar crea el pedido con `POST /pedidos`. Si un extra dejó de estar disponible, el menú se recarga y el carrito se depura solo.
- **Ingresar / Crear cuenta** (`POST /auth/login` y `POST /auth/register`). El JWT se guarda en el navegador y la sesión se cierra sola a los 30 minutos o ante cualquier `401`.
- **Mis pedidos** con el progreso `pendiente → aceptado → en camino → entregado` y el detalle de cada ítem (`GET /pedidos/usuario`, se actualiza cada 30 segundos).
- **Panel de administración** (solo para administradores), en pestañas:
  - **Resumen**: pedidos de hoy, pendientes, en curso, ventas totales, ticket promedio, usuarios, y rankings de lo más pedido, extras favoritos y bebidas.
  - **Pedidos**: filtrables por estado, con los botones de cada transición y eliminación.
  - **Platos**: alta, edición y baja (incluye el tipo bebida) y, en el mismo formulario, qué ingredientes trae y qué extras admite.
  - **Ingredientes**: catálogo con precio de extra; marcar agotado / reponer; editar y eliminar.
  - **Usuarios**: buscar, filtrar por rol, hacer o quitar admin, editar datos y eliminar cuentas.

  Ocultar botones es solo comodidad: **la API verifica el rol en cada operación**.

### Identidad visual

Rojo tomate `#D92D20`, amarillo queso `#FFC83D`, crema `#FFF4DF` y marrón oscuro `#292016`, tipografías Lilita One y Nunito, contornos gruesos y sombras desplazadas tipo "sticker". El diseño es adaptable a celulares.

### Imágenes de los productos

Cada producto tiene su **propia ilustración SVG**, dibujada según sus ingredientes (pan, medallones, quesos, panceta, palta, jalapeños, provoleta con chimichurri, etc.):

- `public/images/burgers/` — las hamburguesas (`clasica-king.svg`, `la-king-sciarra.svg` con su corona, `doble-cheddar-bacon.svg`, `la-picante.svg`, `crispy-chicken.svg`, `veggie-garden.svg`, `la-bestia.svg`, `azul-y-hongos.svg`, `la-argenta.svg`).
- `public/images/combos/` — los combos (incluido `combo-king.svg`).
- `public/images/desserts/` — los 4 postres.
- `public/images/drinks/` — las 6 bebidas.

La tabla Platos de la consigna **no tiene columna de imagen**, y agregar una podría romper las pruebas que comparan los objetos exactos. Por eso la imagen se asocia **en el frontend por el nombre del plato** (`public/js/imagenes.js`): "Clásica King" → `images/burgers/clasica-king.svg`. Un plato sin ilustración propia (por ejemplo Pulled Pork BBQ o uno que cargue un administrador) muestra la genérica de su tipo (`nueva-hamburguesa.svg`, `nuevo-combo.svg`, `nuevo-postre.svg` o `nueva-bebida.svg`).

---

## Pruebas automáticas

Las pruebas usan `node:test` y una base **solo para pruebas** indicada en `TEST_DATABASE_URL` (puede ser una rama de Neon o un PostgreSQL local). Levantan la API en un puerto libre, ejecutan `schema.sql` y al terminar borran únicamente los datos que crearon (usuarios `@test.kingsciarra`, sus pedidos y los platos e ingredientes `TEST …`).

```bash
# En .env o en la terminal:
TEST_DATABASE_URL=postgresql://usuario:contraseña@host/base_de_pruebas?sslmode=require
npm test
```

**84 pruebas** en 7 archivos:

- **Platos** (`tests/platos.test.js`): listado y búsqueda; 404 por id inexistente; 400 por id o tipo inválido; filtro por tipo; sin token → 401; usuario común → 403; un admin crea, modifica y elimina; datos incompletos o inválidos → 400; PUT valida id, existencia y datos; borrar un plato que está en un pedido → 409 sin borrar nada.
- **Autenticación** (`tests/auth.test.js`): registro válido (201) sin contraseña en la respuesta; `admin` queda en `false` aunque se envíe `true`; la contraseña se guarda como hash bcrypt; normalización del email; email duplicado → 409; datos inválidos → 400; login correcto con token; payload `{ id }` y vencimiento de exactamente 30 minutos; credenciales incorrectas → 401; token ausente, mal formado, vencido, firmado con otra clave o con `alg: none` → 401; usuario del token inexistente → 401; ninguna respuesta contiene el hash.
- **Pedidos** (`tests/pedidos.test.js`): visitante → 401; creación con usuario del JWT, fecha del servidor y estado `pendiente`; cantidades guardadas en PlatosXPedidos; se ignoran `id_usuario`, `fecha` y `estado` enviados; suma de platos repetidos; cuerpos inválidos → 400; plato inexistente → 404 sin guardar nada; **transacción**: si falla la segunda relación no queda ni el pedido ni la primera relación; cada usuario ve solo sus pedidos (aunque mande otro id por query string); solo admin lista todo, ve un pedido, cambia estados y elimina; flujo completo de estados; transiciones inválidas → 409; eliminación con sus relaciones.
- **Personalización** (`tests/personalizacion.test.js`): el precio suma los extras y quitar no descuenta; se guarda la aclaración; el precio guardado no cambia si después sube un extra; mismo plato con personalizaciones distintas → ítems separados; extras no admitidos, por encima del máximo, agotados, quitar lo que no viene o agregar y quitar lo mismo → 400 sin guardar nada; se ignora un precio enviado por el cliente; borrar el pedido borra sus personalizaciones.
- **Ingredientes** (`tests/ingredientes.test.js`): catálogo público; solo admin crea, modifica y elimina; validaciones y nombres repetidos sin distinguir mayúsculas → 409; reemplazo y lectura de las opciones de un plato; validación de máximos y de ids; `/platos/opciones` omite los agotados; un ingrediente que figura en pedidos no se borra (409).
- **Usuarios** (`tests/usuarios.test.js`): todas las rutas exigen token y rol; listado con cantidad de pedidos y sin contraseñas; dar y quitar el rol (vale al instante con el mismo token); nadie se quita su propio rol ni elimina su propia cuenta; edición con email normalizado y sin duplicados (la contraseña no cambia); eliminar una cuenta borra sus pedidos y su token deja de servir.
- **Infraestructura** (`tests/infraestructura.test.js`): `dbconfig` (prioridad de `DATABASE_URL`, variables sueltas, puerto 5432 por defecto, asteriscos como "sin configurar", SSL siempre verificado, errores sin contraseñas); estructura real de las 7 tablas, tipos, claves primarias y foráneas; restricciones CHECK/UNIQUE/FK (también las de ingredientes); `schema.sql` idempotente; errores en JSON (ruta inexistente, JSON mal formado, 500 sin detalles internos); las rutas específicas no son capturadas por `/:id`; ni respuestas ni registros muestran la contraseña de la base o `JWT_SECRET`.

### Qué se probó y qué falta probar con Neon

- ✅ Las 84 pruebas pasan contra **PostgreSQL 18** (PGlite, en memoria).
- ✅ La migración de una base de la versión anterior (CUFAMBRE) con pedidos: conserva los datos, acepta bebidas y el mismo plato dos veces en un pedido; `schema.sql` se puede ejecutar dos veces seguidas.
- ✅ `npm run db:seed` dos veces seguidas: la primera renombra la Clásica y agrega platos, ingredientes y opciones; la segunda no inserta nada.
- ✅ Recorrido del frontend en Chrome (escritorio y celular): armar una hamburguesa (quitar, extras, bebida, aclaración, cantidad), totales iguales a los del servidor, editar la línea desde el carrito, confirmar el pedido, resumen, dar el rol de admin y editar un usuario, marcar un ingrediente agotado y editar los ingredientes de un plato; sin errores en la consola ni desplazamiento horizontal.
- ⏳ **Pendiente: la conexión real a Neon**, porque requiere tus credenciales. Con el `.env` completo, verificala con `npm run db:init` (debe mostrar "SSL con certificado verificado" y las 7 tablas) y, si querés, corré `npm test` contra una rama de Neon usada solo para pruebas.

---

## Decisiones técnicas

- **Capas**: `routes` (HTTP) → `services` (validación y reglas; no conocen `req`/`res`) → `controllers` (SQL con pg). Las transacciones las coordina el servicio con `conTransaccion()`, que reparte un mismo cliente a todas las consultas.
- **Express 5**: los errores de los handlers `async` llegan solos al middleware de errores.
- **Campos de control**: en `POST /pedidos` se ignoran `id_usuario`, `fecha`, `estado` y cualquier precio; en el registro se ignora `admin`; en platos se ignora `id`; en `PUT /usuarios/:id` se ignora `admin` (el rol solo cambia por `/usuarios/:id/admin`). Solo se leen los campos permitidos.
- **Platos repetidos en un pedido**: con la misma personalización se suman en un solo ítem; con otra quedan como ítems distintos (por eso ya no existe `UNIQUE (id_pedido, id_plato)`).
- **Precios de los pedidos**: se guardan al crear el pedido (`precio_unitario` y el precio de cada extra), calculados por el servidor; los pedidos anteriores a la personalización usan el precio actual del plato.
- **Ingredientes agotados**: en vez de borrarlos se marcan como no disponibles; así los pedidos viejos conservan su detalle y el ingrediente vuelve con un clic.
- **PUT /platos/:id** reemplaza el plato completo: exige los cuatro campos.
- **Tipos y emails** se normalizan (espacios y minúsculas) antes de validar y guardar.
- **Fecha del pedido**: la asigna PostgreSQL con la hora de Argentina (`America/Argentina/Buenos_Aires`), porque Neon trabaja en UTC y un pedido de las 22 h quedaría con la fecha del día siguiente. Las columnas DATE se devuelven como texto `AAAA-MM-DD`.
- **Estados**: cada transición es un único `UPDATE ... WHERE estado = <estado esperado>`, así dos administradores no pueden aplicarla dos veces a la vez.
- **Eliminar un pedido**: en una transacción se borran primero sus filas de PlatosXPedidos y después el pedido; además, la FK con `ON DELETE CASCADE` garantiza que nunca queden filas huérfanas.
- **Eliminar un plato**: lo impide la FK `ON DELETE RESTRICT` si ya se pidió (409), y así los pedidos históricos siguen completos. Para sacarlo del menú en ese caso, se puede editar.
- **Seguridad del login**: mismo mensaje y un tiempo de respuesta similar si el email no existe (se compara contra un hash ficticio). Los JWT se verifican fijando el algoritmo HS256.
- **Caché**: las respuestas de la API llevan `Cache-Control: no-store`.
- **Claves foráneas en PostgreSQL 18**: un borrado frenado por `ON DELETE RESTRICT` se informa con el código `23001` (antes `23503`); la API trata los dos como 409.

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
