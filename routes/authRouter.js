/**
 * routes/authRouter.js — Endpoints públicos de /auth (no requieren token).
 */
const express = require('express');
const { authService } = require('../services/services');

const router = express.Router();

// POST /auth/register — registra un usuario (siempre con admin = false)
router.post('/register', async (req, res) => {
  const usuario = await authService.registrarUsuario(req.body);
  res.status(201).json(usuario);
});

// POST /auth/login — devuelve un JWT válido por 30 minutos
router.post('/login', async (req, res) => {
  const sesion = await authService.iniciarSesion(req.body);
  res.status(200).json(sesion);
});

module.exports = router;
