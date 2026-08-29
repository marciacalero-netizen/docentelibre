// Envuelve un handler async de Express para que las excepciones/rechazos
// lleguen al middleware de errores en vez de colgar el request (Express 4
// no atrapa promesas rechazadas automaticamente).
module.exports = function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
