/**
 * routes/routes.js — Router principal de la API.
 *
 * Monta los routers de cada recurso. Las rutas solo conectan HTTP con los
 * servicios: no contienen SQL ni lógica de negocio.
 */
const express = require('express');
const platosRouter = require('./platosRouter');
const authRouter = require('./authRouter');
const pedidosRouter = require('./pedidosRouter');

const router = express.Router();

router.use('/platos', platosRouter);
router.use('/auth', authRouter);
router.use('/pedidos', pedidosRouter);

module.exports = router;
