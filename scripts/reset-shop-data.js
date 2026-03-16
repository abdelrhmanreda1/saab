/**
 * Reset shop catalog data while keeping core store settings and taxonomy.
 *
 * This script:
 * 1. Creates a full Firestore backup first
 * 2. Deletes product-facing catalog collections only
 * 3. Leaves users, orders, settings, categories, brands, and collections intact
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const { createBackup } = require('./backup-firestore');

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

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const SHOP_COLLECTIONS = [
  'products',
  'reviews',
  'flash_sales',
  'product_bundles',
];

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  let deleted = 0;

  if (snapshot.empty) {
    return deleted;
  }

  const batchSize = 100;
  const docs = snapshot.docs;

  for (let index = 0; index < docs.length; index += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(index, index + batchSize);

    chunk.forEach((doc) => {
      batch.delete(doc.ref);
      deleted += 1;
    });

    await batch.commit();
  }

  return deleted;
}

async function resetShopData() {
  const backupPath = await createBackup();
  const summary = {
    backupPath: path.relative(process.cwd(), backupPath),
    deleted: {},
  };

  for (const collectionName of SHOP_COLLECTIONS) {
    summary.deleted[collectionName] = await deleteCollection(collectionName);
  }

  return summary;
}

if (require.main === module) {
  resetShopData()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  resetShopData,
  SHOP_COLLECTIONS,
};
