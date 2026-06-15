const admin = require('firebase-admin');

let db, auth;

const initFirebase = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  db = admin.firestore();
  auth = admin.auth();
  return { db, auth, admin };
};

const getDb = () => {
  if (!db) initFirebase();
  return db;
};

const getAuth = () => {
  if (!auth) initFirebase();
  return auth;
};

module.exports = { initFirebase, getDb, getAuth, admin };
