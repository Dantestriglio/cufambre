/**
 * services/services.js — Punto de entrada de la capa de lógica de negocio.
 *
 * Los servicios validan los datos, aplican las reglas de la consigna y
 * coordinan las consultas de controllers. Se dividen por dominio igual que
 * los routers: platos, auth y pedidos.
 */
const platosService = require('./platosService');
const authService = require('./authService');
const pedidosService = require('./pedidosService');

module.exports = { platosService, authService, pedidosService };
