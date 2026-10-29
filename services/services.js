/**
 * services/services.js — Punto de entrada de la capa de lógica de negocio.
 *
 * Los servicios validan los datos, aplican las reglas del negocio y
 * coordinan las consultas de controllers. Se dividen por dominio igual que
 * los routers: platos, auth, pedidos, ingredientes y usuarios.
 */
const platosService = require('./platosService');
const authService = require('./authService');
const pedidosService = require('./pedidosService');
const ingredientesService = require('./ingredientesService');
const usuariosService = require('./usuariosService');

module.exports = { platosService, authService, pedidosService, ingredientesService, usuariosService };
