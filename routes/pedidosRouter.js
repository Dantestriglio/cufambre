/**
 * routes/pedidosRouter.js — Endpoints de /pedidos. Todos requieren un JWT válido.
 */
const express = require('express');
const { pedidosService } = require('../services/services');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /pedidos — todos los pedidos (administrador)
router.get('/', verificarToken, verificarAdmin, async (req, res) => {
  const pedidos = await pedidosService.listarPedidos();
  res.status(200).json(pedidos);
});

// GET /pedidos/usuario — pedidos del usuario del token. Va antes de /:id.
router.get('/usuario', verificarToken, async (req, res) => {
  const pedidos = await pedidosService.listarPedidosDelUsuario(req.usuario.id);
  res.status(200).json(pedidos);
});

// GET /pedidos/:id — un pedido con sus platos (administrador)
router.get('/:id', verificarToken, verificarAdmin, async (req, res) => {
  const pedido = await pedidosService.obtenerPedido(req.params.id);
  res.status(200).json(pedido);
});

// POST /pedidos — crea un pedido para el usuario del token
router.post('/', verificarToken, async (req, res) => {
  const pedido = await pedidosService.crearPedido(req.usuario.id, req.body);
  res.status(201).json(pedido);
});

// PUT /pedidos/:id/aceptar — pendiente → aceptado (administrador)
router.put('/:id/aceptar', verificarToken, verificarAdmin, async (req, res) => {
  const pedido = await pedidosService.aceptarPedido(req.params.id);
  res.status(200).json(pedido);
});

// PUT /pedidos/:id/comenzar — aceptado → en camino (administrador)
router.put('/:id/comenzar', verificarToken, verificarAdmin, async (req, res) => {
  const pedido = await pedidosService.comenzarPedido(req.params.id);
  res.status(200).json(pedido);
});

// PUT /pedidos/:id/entregar — en camino → entregado (administrador)
router.put('/:id/entregar', verificarToken, verificarAdmin, async (req, res) => {
  const pedido = await pedidosService.entregarPedido(req.params.id);
  res.status(200).json(pedido);
});

// DELETE /pedidos/:id — elimina un pedido y sus platos asociados (administrador)
router.delete('/:id', verificarToken, verificarAdmin, async (req, res) => {
  const resultado = await pedidosService.eliminarPedido(req.params.id);
  res.status(200).json(resultado);
});

module.exports = router;
