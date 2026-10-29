/**
 * routes/ingredientesRouter.js — Endpoints de /ingredientes.
 * Lectura pública; crear, modificar y eliminar solo para administradores.
 */
const express = require('express');
const { ingredientesService } = require('../services/services');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /ingredientes — catálogo de ingredientes (público)
router.get('/', async (req, res) => {
  const ingredientes = await ingredientesService.listarIngredientes();
  res.status(200).json(ingredientes);
});

// POST /ingredientes — crea un ingrediente (administrador)
router.post('/', verificarToken, verificarAdmin, async (req, res) => {
  const ingrediente = await ingredientesService.crearIngrediente(req.body);
  res.status(201).json(ingrediente);
});

// PUT /ingredientes/:id — modifica un ingrediente (administrador)
router.put('/:id', verificarToken, verificarAdmin, async (req, res) => {
  const ingrediente = await ingredientesService.actualizarIngrediente(req.params.id, req.body);
  res.status(200).json(ingrediente);
});

// DELETE /ingredientes/:id — elimina un ingrediente que nunca se pidió (administrador)
router.delete('/:id', verificarToken, verificarAdmin, async (req, res) => {
  const resultado = await ingredientesService.eliminarIngrediente(req.params.id);
  res.status(200).json(resultado);
});

module.exports = router;
