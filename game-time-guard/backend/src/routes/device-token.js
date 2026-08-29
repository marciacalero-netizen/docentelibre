const express = require('express');
const { settingsRef } = require('../firestore');
const requireAuth = require('../middleware/requireAuth');
const ah = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);

// Muestra el token actual solo a quien ya inicio sesion como adulto,
// para poder copiarlo al instalar el agente en la PC.
router.get('/', ah(async (req, res) => {
  const snap = await settingsRef.get();
  res.json({ deviceToken: snap.data().deviceToken });
}));

module.exports = router;
