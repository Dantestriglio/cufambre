/**
 * routes/platosRouter.js — Endpoints de /platos.
 * Lectura pública; crear, modificar y eliminar solo para administradores.
 */
const express = require('express');
const { platosService, ingredientesService } = require('../services/services');
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

// GET /platos/opciones — ingredientes disponibles de todos los platos (público). Va antes de /:id.
router.get('/opciones', async (req, res) => {
  const opciones = await ingredientesService.listarOpcionesDelMenu();
  res.status(200).json(opciones);
});

// GET /platos/:id — un plato por id (público)
router.get('/:id', async (req, res) => {
  const plato = await platosService.obtenerPlato(req.params.id);
  res.status(200).json(plato);
});

// GET /platos/:id/ingredientes — qué trae el plato y qué extras admite (público)
router.get('/:id/ingredientes', async (req, res) => {
  const opciones = await ingredientesService.listarOpcionesDePlato(req.params.id);
  res.status(200).json(opciones);
});

// PUT /platos/:id/ingredientes — reemplaza los ingredientes del plato (administrador)
router.put('/:id/ingredientes', verificarToken, verificarAdmin, async (req, res) => {
  const opciones = await ingredientesService.reemplazarOpcionesDePlato(req.params.id, req.body);
  res.status(200).json(opciones);
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
