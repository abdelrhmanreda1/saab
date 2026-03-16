/**
 * Replace clothing taxonomy with gold/jewelry taxonomy.
 *
 * What this script does:
 * 1. Creates a local JSON backup for categories, brands, and collections
 * 2. Replaces those Firestore collections with gold-focused data
 * 3. Re-links existing products to safe fallback taxonomy values
 *
 * Run:
 *   npm run taxonomy:gold
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;

try {
  serviceAccount = require('../service-account-key.json');
} catch (error) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else {
    throw new Error('Service account key not found. Put service-account-key.json in project root or set FIREBASE_SERVICE_ACCOUNT.');
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;
const timestampNow = admin.firestore.Timestamp.now();

const categorySeed = [
  {
    id: 'general-jewelry',
    name: 'General Jewelry',
    slug: 'general-jewelry',
    description: 'General gold and jewelry products.',
    translations: [
      { languageCode: 'ar', name: 'مجوهرات عامة', description: 'منتجات ذهب ومجوهرات عامة.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'General Jewelry', description: 'General gold and jewelry products.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'rings',
    name: 'Rings',
    slug: 'rings',
    description: 'Gold rings and statement ring designs.',
    translations: [
      { languageCode: 'ar', name: 'خواتم', description: 'خواتم ذهب وتصاميم مميزة.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Rings', description: 'Gold rings and statement ring designs.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'necklaces',
    name: 'Necklaces',
    slug: 'necklaces',
    description: 'Gold necklaces, chains, and pendants.',
    translations: [
      { languageCode: 'ar', name: 'قلادات', description: 'قلادات وسلاسل ودلايات ذهبية.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Necklaces', description: 'Gold necklaces, chains, and pendants.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'bracelets',
    name: 'Bracelets',
    slug: 'bracelets',
    description: 'Bracelets, bangles, and wrist pieces.',
    translations: [
      { languageCode: 'ar', name: 'أساور', description: 'أساور وغوايش وقطع معصم.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Bracelets', description: 'Bracelets, bangles, and wrist pieces.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'earrings',
    name: 'Earrings',
    slug: 'earrings',
    description: 'Studs, hoops, and drop earrings.',
    translations: [
      { languageCode: 'ar', name: 'أقراط', description: 'حلقات وأقراط وأطقم أذن.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Earrings', description: 'Studs, hoops, and drop earrings.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'sets',
    name: 'Sets',
    slug: 'sets',
    description: 'Matching gold jewelry sets.',
    translations: [
      { languageCode: 'ar', name: 'أطقم', description: 'أطقم مجوهرات ذهبية متناسقة.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Sets', description: 'Matching gold jewelry sets.', updatedAt: timestampNow },
    ],
  },
];

const brandSeed = [
  {
    id: 'pardah-gold',
    name: 'Pardah Gold',
    slug: 'pardah-gold',
    description: 'Main in-house gold jewelry brand.',
    translations: [
      { languageCode: 'ar', name: 'برده جولد', description: 'العلامة الأساسية للمجوهرات الذهبية.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Pardah Gold', description: 'Main in-house gold jewelry brand.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'saudi-gold-line',
    name: 'Saudi Gold Line',
    slug: 'saudi-gold-line',
    description: 'Classic Saudi-inspired gold styles.',
    translations: [
      { languageCode: 'ar', name: 'الخط السعودي للذهب', description: 'تصاميم ذهب كلاسيكية بطابع سعودي.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Saudi Gold Line', description: 'Classic Saudi-inspired gold styles.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'bridal-luxe',
    name: 'Bridal Luxe',
    slug: 'bridal-luxe',
    description: 'Bridal and occasion-focused jewelry designs.',
    translations: [
      { languageCode: 'ar', name: 'بريدا لَكس', description: 'تصاميم أعراس ومناسبات راقية.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Bridal Luxe', description: 'Bridal and occasion-focused jewelry designs.', updatedAt: timestampNow },
    ],
  },
];

const collectionSeed = [
  {
    id: 'signature-gold',
    name: 'Signature Gold',
    slug: 'signature-gold',
    description: 'Core everyday gold collection.',
    translations: [
      { languageCode: 'ar', name: 'سيجنتشر جولد', description: 'التشكيلة الذهبية الأساسية اليومية.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Signature Gold', description: 'Core everyday gold collection.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'bridal-collection',
    name: 'Bridal Collection',
    slug: 'bridal-collection',
    description: 'Wedding and engagement jewelry pieces.',
    translations: [
      { languageCode: 'ar', name: 'مجموعة العرائس', description: 'قطع خاصة بالزفاف والخطوبة.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Bridal Collection', description: 'Wedding and engagement jewelry pieces.', updatedAt: timestampNow },
    ],
  },
  {
    id: 'daily-elegance',
    name: 'Daily Elegance',
    slug: 'daily-elegance',
    description: 'Simple pieces for daily wear.',
    translations: [
      { languageCode: 'ar', name: 'أناقة يومية', description: 'قطع بسيطة للاستخدام اليومي.', updatedAt: timestampNow },
      { languageCode: 'en', name: 'Daily Elegance', description: 'Simple pieces for daily wear.', updatedAt: timestampNow },
    ],
  },
];

function withTimestamps(doc) {
  const now = FieldValue.serverTimestamp();
  return {
    ...doc,
    createdAt: now,
    updatedAt: now,
    translations: Array.isArray(doc.translations) ? doc.translations : [],
  };
}

async function backupCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function writeBackup() {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `taxonomy-backup-${timestamp}.json`);
  const backup = {
    timestamp: new Date().toISOString(),
    categories: await backupCollection('categories'),
    brands: await backupCollection('brands'),
    collections: await backupCollection('collections'),
  };

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  return backupPath;
}

async function deleteCollectionDocs(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seedCollection(collectionName, docs) {
  const batch = db.batch();
  docs.forEach((doc) => {
    const ref = db.collection(collectionName).doc(doc.id);
    batch.set(ref, withTimestamps(doc));
  });
  await batch.commit();
}

async function relinkProducts() {
  const snapshot = await db.collection('products').get();
  if (snapshot.empty) return 0;

  let changed = 0;
  const batch = db.batch();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const update = {};
    const pricingMode = String(data.pricingMode || '').toLowerCase();

    if (!data.category || !categorySeed.some((item) => item.id === data.category)) {
      update.category = pricingMode.includes('gold') ? 'rings' : 'general-jewelry';
    }

    if (!data.brand || !brandSeed.some((item) => item.id === data.brand)) {
      update.brand = 'pardah-gold';
    }

    if (!data.collection || !collectionSeed.some((item) => item.id === data.collection)) {
      update.collection = 'signature-gold';
    }

    if (Object.keys(update).length > 0) {
      batch.update(doc.ref, update);
      changed += 1;
    }
  });

  if (changed > 0) {
    await batch.commit();
  }

  return changed;
}

async function replaceFashionTaxonomy() {
  const backupPath = await writeBackup();

  await deleteCollectionDocs('categories');
  await deleteCollectionDocs('brands');
  await deleteCollectionDocs('collections');

  await seedCollection('categories', categorySeed);
  await seedCollection('brands', brandSeed);
  await seedCollection('collections', collectionSeed);

  const relinkedProducts = await relinkProducts();

  console.log('Gold taxonomy replacement completed.');
  console.log(`Backup created: ${backupPath}`);
  console.log(`Categories seeded: ${categorySeed.length}`);
  console.log(`Brands seeded: ${brandSeed.length}`);
  console.log(`Collections seeded: ${collectionSeed.length}`);
  console.log(`Products re-linked: ${relinkedProducts}`);
}

if (require.main === module) {
  replaceFashionTaxonomy()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to replace taxonomy:', error);
      process.exit(1);
    });
}

module.exports = { replaceFashionTaxonomy };
