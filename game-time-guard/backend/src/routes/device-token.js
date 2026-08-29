const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

// Muestra el token actual solo a quien ya inicio sesion como adulto,
// para poder copiarlo al instalar el agente en la PC.
router.get('/', (req, res) => {
  const settings = db.prepare('SELECT device_token FROM settings WHERE id = 1').get();
  res.json({ deviceToken: settings.device_token });
});

module.exports = router;
