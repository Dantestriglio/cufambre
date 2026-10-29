/**
 * controllers/controllers.js — Punto de entrada de la capa de acceso a datos.
 *
 * En este proyecto: routes define las rutas, services implementa la lógica y
 * controllers accede a PostgreSQL con SQL explícito. La capa se divide por
 * dominio igual que los routers: platos, auth, pedidos, ingredientes y usuarios.
 */
const platosController = require('./platosController');
const authController = require('./authController');
const pedidosController = require('./pedidosController');
const ingredientesController = require('./ingredientesController');
const usuariosController = require('./usuariosController');
const { conTransaccion } = require('../dbconfig');

module.exports = {
  platosController,
  authController,
  pedidosController,
  ingredientesController,
  usuariosController,
  // Para las operaciones de varias consultas que coordinan los servicios
  conTransaccion,
};
