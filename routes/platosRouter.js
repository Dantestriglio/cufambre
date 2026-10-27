/**
 * routes/platosRouter.js — Endpoints de /platos.
 * Lectura pública; crear, modificar y eliminar solo para administradores.
 */
const express = require('express');
const { platosService } = require('../services/services');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /platos — lista todos los platos (público)
router.get('/', async (req, res) => {
  const platos = await platosService.listarPlatos();
  res.status(200).json(platos);
});

// GET /platos/tipo/:tipo — platos de un tipo (público). Va antes de /:id.
router.get('/tipo/:tipo', async (req, res) => {
  const platos = await platosService.listarPlatosPorTipo(req.params.tipo);
  res.status(200).json(platos);
});

// GET /platos/:id — un plato por id (público)
router.get('/:id', async (req, res) => {
  const plato = await platosService.obtenerPlato(req.params.id);
  res.status(200).json(plato);
});

// POST /platos — crea un plato (administrador)
router.post('/', verificarToken, verificarAdmin, async (req, res) => {
  const plato = await platosService.crearPlato(req.body);
  res.status(201).json(plato);
});

// PUT /platos/:id — modifica un plato (administrador)
router.put('/:id', verificarToken, verificarAdmin, async (req, res) => {
  const plato = await platosService.actualizarPlato(req.params.id, req.body);
  res.status(200).json(plato);
});

// DELETE /platos/:id — elimina un plato (administrador)
router.delete('/:id', verificarToken, verificarAdmin, async (req, res) => {
  const resultado = await platosService.eliminarPlato(req.params.id);
  res.status(200).json(resultado);
});

module.exports = router;
