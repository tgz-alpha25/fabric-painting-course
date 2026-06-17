require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getDb, initFirebase } = require('./config/firebase');
const cloudinary = require('cloudinary').v2;

// Build list of accounts from .env
const getAccounts = () => {
  const accounts = [];
  let i = 1;
  while (process.env[`CLOUDINARY_ACCOUNT_${i}_CLOUD_NAME`]) {
    accounts.push({
      id: `account${i}`,
      label: `Account ${i}`,
      cloud_name: process.env[`CLOUDINARY_ACCOUNT_${i}_CLOUD_NAME`],
      api_key: process.env[`CLOUDINARY_ACCOUNT_${i}_API_KEY`],
      api_secret: process.env[`CLOUDINARY_ACCOUNT_${i}_API_SECRET`],
    });
    i++;
  }
  return accounts;
};

// Configure cloudinary for a specific account
const configFor = (account) => {
  cloudinary.config({
    cloud_name: account.cloud_name,
    api_key: account.api_key,
    api_secret: account.api_secret,
    secure: true,
  });
};

// Upload a single file to a single account with retry
const uploadToAccount = async (filePath, videoId, account, retries = 2) => {
  configFor(account);
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'video',
        type: 'authenticated',  // Secure — only accessible via signed URLs
        public_id: `courses/${videoId}`,
        overwrite: true,
        invalidate: true,
        chunk_size: 6000000, // 6MB chunks for large files
      });
      return result;
    } catch (err) {
      if (attempt <= retries) {
        console.log(`   ⚠️ Attempt ${attempt} failed. Retrying... (${err.message})`);
        await new Promise(r => setTimeout(r, 3000)); // wait 3s before retry
      } else {
        throw err;
      }
    }
  }
};

async function uploadDemo() {
  initFirebase();
  const db = getDb();

  const accounts = getAccounts();
  if (accounts.length === 0) {
    console.error('❌ No Cloudinary accounts found in .env file!');
    process.exit(1);
  }

  const demoFilePath = path.join(__dirname, 'videos', 'demo.mp4');
  if (!fs.existsSync(demoFilePath)) {
    console.error('❌ demo.mp4 not found in backend/videos directory!');
    process.exit(1);
  }

  const fileSizeMB = (fs.statSync(demoFilePath).size / (1024 * 1024)).toFixed(1);
  console.log(`\n🚀 Uploading demo video (${fileSizeMB} MB) to ${accounts.length} Cloudinary accounts.`);

  const cloudinaryPublicIds = {};
  let duration = 170;

  for (const account of accounts) {
    console.log(`\n  🔄 Uploading to ${account.label} (${account.cloud_name})...`);
    try {
      const result = await uploadToAccount(demoFilePath, 'demo', account);
      cloudinaryPublicIds[account.id] = result.public_id; // e.g. "courses/demo"
      duration = Math.round(result.duration) || duration;
      console.log(`  ✅ ${account.label}: Uploaded! Public ID: "${result.public_id}" | Duration: ${duration}s`);
    } catch (err) {
      console.error(`  ❌ ${account.label}: FAILED — ${err.message}`);
    }
  }

  if (Object.keys(cloudinaryPublicIds).length > 0) {
    const docRef = db.collection('videos').doc('demo');
    const docSnap = await docRef.get();
    const existing = docSnap.exists ? docSnap.data() : {};

    await docRef.set({
      classNumber: 0,
      title: existing.title || "Class 1 - Material Requirement (Demo)",
      description: existing.description || "Free Demo: Essential materials for fabric painting.",
      cloudinaryPublicIds,
      duration,
      order: 0,
    }, { merge: true });

    console.log('\n  💾 Firestore updated successfully for video "demo".');
  } else {
    console.error('\n  ⛔ All uploads failed for demo. Firestore NOT updated.');
  }
  process.exit(0);
}

uploadDemo().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
