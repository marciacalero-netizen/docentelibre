const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Firestore, FieldValue } = require('@google-cloud/firestore');

// En Cloud Run, las credenciales se obtienen automaticamente (Application
// Default Credentials via la cuenta de servicio del servicio). Para correr
// esto localmente hace falta `gcloud auth application-default login` y
// tener un proyecto con Firestore en modo Nativo habilitado.
const firestore = new Firestore();

const settingsRef = firestore.collection('meta').doc('settings');
const deviceStateRef = firestore.collection('meta').doc('deviceState');
const gamesCollection = firestore.collection('blockedGames');
const usageCollection = firestore.collection('usageDaily');

const DEFAULT_SETTINGS = {
  mode: 'budget', // 'budget' | 'window' | 'both'
  dailyBudgetMinutes: 180,
  windowStart: '16:00',
  windowEnd: '19:00',
  timezone: 'America/Argentina/Buenos_Aires',
};

async function ensureSeeded() {
  const snap = await settingsRef.get();
  if (snap.exists) return;

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(6).toString('hex');
  const adminPasswordHash = bcrypt.hashSync(initialPassword, 10);
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const deviceToken = crypto.randomBytes(24).toString('hex');

  await settingsRef.set({
    ...DEFAULT_SETTINGS,
    adminPasswordHash,
    jwtSecret,
    deviceToken,
  });
  await deviceStateRef.set({ currentlyBlocked: false });

  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log('========================================================');
    console.log('  Clave de adulto generada automaticamente (primer uso):');
    console.log('  ' + initialPassword);
    console.log('  Guardala ahora. Se puede cambiar despues desde el panel.');
    console.log('========================================================');
  }
  console.log('Token de dispositivo (para configurar el agente de Windows):');
  console.log('  ' + deviceToken);
}

module.exports = {
  firestore,
  FieldValue,
  settingsRef,
  deviceStateRef,
  gamesCollection,
  usageCollection,
  ensureSeeded,
};
