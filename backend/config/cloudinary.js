const cloudinary = require('cloudinary').v2;
const { getDb } = require('./firebase');

// Build cloudinary accounts from env
const getCloudinaryAccountsFromEnv = () => {
  const accounts = [];
  let i = 1;
  while (process.env[`CLOUDINARY_ACCOUNT_${i}_CLOUD_NAME`]) {
    accounts.push({
      id: `account${i}`,
      name: `Account ${i}`,
      cloudName: process.env[`CLOUDINARY_ACCOUNT_${i}_CLOUD_NAME`],
      apiKey: process.env[`CLOUDINARY_ACCOUNT_${i}_API_KEY`],
      apiSecret: process.env[`CLOUDINARY_ACCOUNT_${i}_API_SECRET`],
      order: i,
    });
    i++;
  }
  return accounts;
};

// Get active cloudinary config from Firestore
const getActiveCloudinaryConfig = async () => {
  try {
    const db = getDb();
    
    // Fetch all accounts from Firestore to filter and sort in memory.
    // This avoids requiring Firestore composite indexes, making it much more robust.
    let snapshot;
    try {
      snapshot = await db.collection('cloudinaryAccounts').get();
    } catch (dbErr) {
      console.warn('Firestore cloudinaryAccounts query failed, falling back to ENV:', dbErr.message);
      snapshot = { empty: true };
    }

    if (snapshot && !snapshot.empty) {
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 1. Look for currently active account
      const activeAccount = accounts.find(a => a.isActive && a.isCurrentActive);
      if (activeAccount) {
        return {
          cloud_name: activeAccount.cloudName,
          api_key: activeAccount.apiKey,
          api_secret: activeAccount.apiSecret,
          accountId: activeAccount.id,
        };
      }

      // 2. Fallback: get the active account with lowest order
      const fallbackAccount = accounts
        .filter(a => a.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0))[0];

      if (fallbackAccount) {
        // Set as current active
        await db.collection('cloudinaryAccounts').doc(fallbackAccount.id).update({ isCurrentActive: true });
        return {
          cloud_name: fallbackAccount.cloudName,
          api_key: fallbackAccount.apiKey,
          api_secret: fallbackAccount.apiSecret,
          accountId: fallbackAccount.id,
        };
      }
    }

    // Last resort: use env
    const envAccounts = getCloudinaryAccountsFromEnv();
    if (envAccounts.length > 0) {
      const first = envAccounts[0];
      return {
        cloud_name: first.cloudName,
        api_key: first.apiKey,
        api_secret: first.apiSecret,
        accountId: 'account1',
      };
    }

    throw new Error('No Cloudinary account available');
  } catch (err) {
    console.error('Cloudinary config error:', err);
    throw err;
  }
};

// Configure cloudinary with a specific config
const configureCloudinary = (config) => {
  cloudinary.config({
    cloud_name: config.cloud_name,
    api_key: config.api_key,
    api_secret: config.api_secret,
    secure: true,
  });
  return cloudinary;
};

// Generate a secure signed streaming URL (prevents download, IDM, etc.)
const generateSecureVideoUrl = async (publicId, config) => {
  configureCloudinary(config);

  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry

  // Strip any file extension from the publicId to prevent duplicate extensions (like .mp4.mp4)
  const cleanPublicId = publicId.replace(/\.[^/.]+$/, "");

  // Generate a signed URL for secure MP4 streaming.
  // Using MP4 allows instant streaming without requiring pre-transcoding/eager profiles on Cloudinary,
  // while still securing access using 1-hour expiration tokens.
  const signedUrl = cloudinary.url(cleanPublicId, {
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    expires_at: expiresAt,
    format: 'mp4',
  });

  return signedUrl;
};

// Check if an account is near its usage limit
const checkAccountUsage = async () => {
  try {
    const db = getDb();
    
    // Fetch all accounts and filter/sort in memory to avoid index requirements
    const snapshot = await db.collection('cloudinaryAccounts').get();
    const activeAccounts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data(), ref: doc.ref }))
      .filter(a => a.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const accounts = [];
    for (const acc of activeAccounts) {
      // Configure this account and get usage
      const tempCloudinary = cloudinary;
      tempCloudinary.config({
        cloud_name: acc.cloudName,
        api_key: acc.apiKey,
        api_secret: acc.apiSecret,
      });

      try {
        const usage = await tempCloudinary.api.usage();
        const bandwidthUsedMB = (usage.bandwidth?.usage || 0) / (1024 * 1024);
        const bandwidthLimitMB = (usage.bandwidth?.limit || 1) / (1024 * 1024);
        const usagePercent = Math.round((bandwidthUsedMB / bandwidthLimitMB) * 100);

        await acc.ref.update({
          bandwidthUsed: bandwidthUsedMB,
          bandwidthLimit: bandwidthLimitMB,
          usagePercent,
          lastChecked: new Date(),
        });

        accounts.push({
          id: acc.id,
          name: acc.name,
          usagePercent,
          isCurrentActive: acc.isCurrentActive,
          order: acc.order,
        });

        // If current active account is >90% usage, switch to next
        if (acc.isCurrentActive && usagePercent >= 90) {
          await switchToNextCloudinaryAccount(acc.id, activeAccounts);
        }
      } catch (e) {
        console.error(`Error checking account ${acc.name}:`, e.message);
      }
    }
    return accounts;
  } catch (err) {
    console.error('Check usage error:', err);
  }
};

const switchToNextCloudinaryAccount = async (currentAccountId, activeAccounts) => {
  try {
    const db = getDb();
    const currentDoc = activeAccounts.find((d) => d.id === currentAccountId);
    const currentOrder = currentDoc?.order || 1;

    // Find next available account
    const nextDoc = activeAccounts.find(
      (d) => d.order > currentOrder && d.isActive && (d.usagePercent || 0) < 90
    );

    if (!nextDoc) {
      // No account available — notify admin
      await db.collection('notifications').add({
        type: 'cloudinary_limit',
        title: 'All Cloudinary Accounts Exhausted',
        message: 'All Cloudinary accounts have reached their usage limits. Video streaming may be unavailable.',
        isRead: false,
        createdAt: new Date(),
        allAccountsExhausted: true,
      });
      return;
    }

    // Deactivate current
    await db.collection('cloudinaryAccounts').doc(currentAccountId).update({ isCurrentActive: false });

    // Activate next
    await db.collection('cloudinaryAccounts').doc(nextDoc.id).update({ isCurrentActive: true });

    const remaining = activeAccounts.filter(
      (d) => d.isActive && (d.usagePercent || 0) < 90
    ).length;

    // Notify admin
    await db.collection('notifications').add({
      type: 'cloudinary_limit',
      title: `Cloudinary Account Switched`,
      message: `Account "${currentDoc?.name}" reached limit. Now streaming from "${nextDoc.name}". ${remaining} account(s) remaining.`,
      fromAccount: currentDoc?.name,
      toAccount: nextDoc.name,
      remainingAccounts: remaining,
      totalAccounts: activeAccounts.length,
      isRead: false,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('Switch account error:', err);
  }
};

module.exports = {
  getActiveCloudinaryConfig,
  configureCloudinary,
  generateSecureVideoUrl,
  checkAccountUsage,
  getCloudinaryAccountsFromEnv,
};
