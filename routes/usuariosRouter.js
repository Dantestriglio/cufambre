/**
 * routes/usuariosRouter.js — Endpoints de /usuarios. Todos son de administrador.
 */
const express = require('express');
const { usuariosService } = require('../services/services');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verificarToken, verificarAdmin);

// GET /usuarios — todos los usuarios con su cantidad de pedidos
router.get('/', async (req, res) => {
  const usuarios = await usuariosService.listarUsuarios();
  res.status(200).json(usuarios);
});

// PUT /usuarios/:id/admin — da o quita el rol de administrador: { admin: true | false }
router.put('/:id/admin', async (req, res) => {
  const usuario = await usuariosService.cambiarRol(req.usuario.id, req.params.id, req.body);
  res.status(200).json(usuario);
});

// PUT /usuarios/:id — corrige nombre, apellido y email
router.put('/:id', async (req, res) => {
  const usuario = await usuariosService.actualizarUsuario(req.params.id, req.body);
  res.status(200).json(usuario);
});

// DELETE /usuarios/:id — elimina la cuenta y sus pedidos
router.delete('/:id', async (req, res) => {
  const resultado = await usuariosService.eliminarUsuario(req.usuario.id, req.params.id);
  res.status(200).json(resultado);
});

module.exports = router;
