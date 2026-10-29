/**
 * database/admin.js — Da el rol de administrador a un usuario ya registrado.
 *
 *   npm run admin -- correo@ejemplo.com
 *
 * Sirve para crear el primer administrador. Después, los administradores pueden
 * dar o quitar el rol a otros desde el panel (Usuarios), sin tocar la base.
 */
const { pool, verificarConexion, cerrarConexiones } = require('../dbconfig');

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email) {
    console.error('✖ Indicá el email del usuario: npm run admin -- correo@ejemplo.com');
    process.exitCode = 1;
    return;
  }
  try {
    await verificarConexion();
    const { rows } = await pool.query(
      'UPDATE Usuarios SET admin = TRUE WHERE LOWER(email) = $1 RETURNING nombre, apellido',
      [email]
    );
    if (rows.length === 0) {
      console.error(`✖ No hay ningún usuario registrado con el email ${email}. Registralo primero desde la página.`);
      process.exitCode = 1;
    } else {
      console.log(`✔ ${rows[0].nombre} ${rows[0].apellido} (${email}) ahora es administrador.`);
      console.log('  Si tenía la sesión abierta, que salga y vuelva a ingresar para ver el panel.');
    }
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await cerrarConexiones();
  }
}

main();
