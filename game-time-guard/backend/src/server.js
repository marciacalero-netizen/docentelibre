const path = require('path');
const express = require('express');
const cors = require('cors');
const { ensureSeeded } = require('./firestore');

const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const statusRoutes = require('./routes/status');
const deviceRoutes = require('./routes/device');
const deviceTokenRoutes = require('./routes/device-token');

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/device-token', deviceTokenRoutes);

// Sirve el panel web (carpeta ../../web) para poder desplegar todo junto.
const webDir = path.join(__dirname, '..', '..', 'web');
app.use(express.static(webDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(webDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

ensureSeeded()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Game Time Guard backend escuchando en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo inicializar Firestore:', err);
    process.exit(1);
  });
