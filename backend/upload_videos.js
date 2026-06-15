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

async function uploadAll() {
  initFirebase();
  const db = getDb();

  const accounts = getAccounts();
  if (accounts.length === 0) {
    console.error('❌ No Cloudinary accounts found in .env file!');
    process.exit(1);
  }

  const videosDir = path.join(__dirname, 'videos');
  const files = fs.readdirSync(videosDir)
    .filter(f => f.toLowerCase().endsWith('.mp4'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  if (files.length === 0) {
    console.log('⚠️ No .mp4 files found in the videos folder.');
    process.exit(0);
  }

  console.log(`\n🚀 Starting upload of ${files.length} videos to ${accounts.length} Cloudinary accounts.`);
  console.log(`📋 Accounts: ${accounts.map(a => a.label + ' (' + a.cloud_name + ')').join(', ')}\n`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const filename of files) {
    const match = filename.match(/class\s*(\d+)/i) || filename.match(/(\d+)/);
    if (!match) {
      console.warn(`⚠️ Skipping "${filename}" — cannot detect class number.`);
      continue;
    }

    const classNum = parseInt(match[1]);
    const videoId = `class${classNum}`;
    const filePath = path.join(videosDir, filename);
    const fileSizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(1);

    console.log(`\n${'='.repeat(55)}`);
    console.log(`📹 CLASS ${classNum} | File: ${filename} | Size: ${fileSizeMB} MB`);
    console.log('='.repeat(55));

    const cloudinaryPublicIds = {};
    let duration = 1800;

    for (const account of accounts) {
      console.log(`\n  🔄 Uploading to ${account.label} (${account.cloud_name})...`);
      try {
        const result = await uploadToAccount(filePath, videoId, account);
        cloudinaryPublicIds[account.id] = result.public_id; // e.g. "courses/class1"
        duration = Math.round(result.duration) || duration;
        console.log(`  ✅ ${account.label}: Uploaded! Public ID: "${result.public_id}" | Duration: ${duration}s`);
      } catch (err) {
        console.error(`  ❌ ${account.label}: FAILED — ${err.message}`);
        totalFailed++;
      }
    }

    if (Object.keys(cloudinaryPublicIds).length > 0) {
      // Fetch existing Firestore data to preserve title/description
      const docRef = db.collection('videos').doc(videoId);
      const docSnap = await docRef.get();
      const existing = docSnap.exists ? docSnap.data() : {};

      await docRef.set({
        classNumber: classNum,
        title: existing.title || `Class ${classNum}`,
        description: existing.description || `Class ${classNum} fabric painting.`,
        cloudinaryPublicIds,    // All account IDs stored for fallback streaming
        duration,
        order: classNum,
      }, { merge: true });

      console.log(`\n  💾 Firestore updated for "${videoId}" with IDs from ${Object.keys(cloudinaryPublicIds).length} account(s).`);
      totalSuccess++;
    } else {
      console.error(`\n  ⛔ All uploads failed for ${videoId}. Firestore NOT updated.`);
    }
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`🎉 Upload complete!`);
  console.log(`   ✅ Successfully uploaded: ${totalSuccess} videos`);
  if (totalFailed > 0) console.log(`   ❌ Failed uploads: ${totalFailed}`);
  console.log('='.repeat(55));
  process.exit(0);
}

uploadAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
