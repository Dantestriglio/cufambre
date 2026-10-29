/**
 * routes/authRouter.js — Endpoints de /auth. Registro e ingreso son públicos.
 */
const express = require('express');
const { authService } = require('../services/services');
const { verificarToken } = require('../middleware/auth');

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

// GET /auth/perfil — datos actuales del usuario del token (incluido el rol, leído de la base)
router.get('/perfil', verificarToken, (req, res) => {
  res.status(200).json(req.usuario);
});

module.exports = router;
