require('dotenv').config();
const { getDb } = require('./config/firebase');

async function checkUsers() {
  try {
    const db = getDb();
    console.log("Connecting to Firestore...");

    // Check users
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n--- Users in Firestore (${usersSnapshot.size}) ---`);
    usersSnapshot.forEach(doc => {
      console.log(`User ID: ${doc.id}`);
      console.log(`Data:`, JSON.stringify(doc.data(), null, 2));
    });

    // Check courseAccess
    const accessSnapshot = await db.collection('courseAccess').get();
    console.log(`\n--- Course Access in Firestore (${accessSnapshot.size}) ---`);
    accessSnapshot.forEach(doc => {
      console.log(`Access ID: ${doc.id}`);
      console.log(`Data:`, JSON.stringify(doc.data(), null, 2));
    });

    // Check videos
    const videosSnapshot = await db.collection('videos').get();
    console.log(`\n--- Videos in Firestore (${videosSnapshot.size}) ---`);
    videosSnapshot.forEach(doc => {
      console.log(`Video ID: ${doc.id}`);
      console.log(`Data:`, JSON.stringify(doc.data(), null, 2));
    });

    // Check Cloudinary Accounts
    const accountsSnapshot = await db.collection('cloudinaryAccounts').get();
    console.log(`\n--- Cloudinary Accounts in Firestore (${accountsSnapshot.size}) ---`);
    accountsSnapshot.forEach(doc => {
      console.log(`Account ID: ${doc.id}`);
      console.log(`Data:`, JSON.stringify(doc.data(), null, 2));
    });

    process.exit(0);
  } catch (error) {
    console.error("Error checking Firestore:", error);
    process.exit(1);
  }
}

checkUsers();
