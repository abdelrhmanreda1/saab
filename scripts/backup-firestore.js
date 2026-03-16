/**
 * Firestore Backup Script
 * Creates automated backups of Firestore data
 * Run this script via cron job or scheduled task
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadServiceAccount() {
  const candidates = [
    path.join(__dirname, '../service-account-key.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error('Service account key not found in project root.');
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Backup a collection
 */
async function backupCollection(collectionName) {
  // Backing up collection
  const snapshot = await db.collection(collectionName).get();
  const data = [];
  
  snapshot.forEach((doc) => {
    data.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return data;
}

/**
 * Create backup of all collections
 */
async function createBackup() {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}.json`);

  const collections = [
    'products',
    'orders',
    'users',
    'categories',
    'brands',
    'coupons',
    'reviews',
    'settings',
    'warehouses',
    'stock_history',
    'stock_transfers',
    'stock_adjustments',
    'email_campaigns',
    'push_notification_campaigns',
    'abandoned_carts',
    'flash_sales',
    'buy_x_get_y_promotions',
    'free_shipping_rules',
    'gift_cards',
    'audit_logs',
  ];

  const backup = {
    timestamp: new Date().toISOString(),
    collections: {},
  };

  for (const collectionName of collections) {
    try {
      backup.collections[collectionName] = await backupCollection(collectionName);
      // Backed up collection
    } catch (error) {
      // Failed to backup collection
      backup.collections[collectionName] = { error: error.message };
    }
  }

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  // Backup created

  // Keep only last 30 backups
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 30) {
    const toDelete = files.slice(30);
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      // Deleted old backup
    }
  }

  return backupPath;
}

// Run backup if called directly
if (require.main === module) {
  createBackup()
    .then((backupPath) => {
      // Backup completed successfully
      process.exit(0);
    })
    .catch((error) => {
      // Failed to backup
      process.exit(1);
    });
}

module.exports = { createBackup, backupCollection };

