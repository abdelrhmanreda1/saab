/**
 * Add Arabic translations for existing collections and products.
 *
 * Default mode is dry-run:
 *   node scripts/add-arabic-taxonomy-and-products.js
 *
 * Apply changes:
 *   node scripts/add-arabic-taxonomy-and-products.js --write
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../service-account-key.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const shouldWrite = process.argv.includes('--write');

const translationsMap = {
  collections: {
    DLsibQsJ3NriP5S1eboa: {
      name: 'أناقة يومية',
      description: 'مجموعة من المجوهرات الذهبية المصممة للاستخدام اليومي، تجمع بين البساطة والأناقة لتكمل إطلالتك اليومية بذوق راقٍ.',
    },
    bNLGh93IuicgDECj51zM: {
      name: 'هدايا ذهبية',
      description: 'تشكيلة مختارة من المجوهرات الذهبية المثالية للهدايا في المناسبات الخاصة مثل أعياد الميلاد والخطوبة والاحتفالات المميزة.',
    },
  },
  products: {
    AH4ampw68b0XXaGWQ3WX: {
      name: 'سوار ذهب عيار 18 بتصميم مرصع مستوحى من الألماس',
      description:
        '<p>سوار ذهبي فاخر يتميز بتصميم أنيق مستوحى من ترصيع الألماس.</p><p>مصنوع من ذهب عيار 18 ليمنح إطلالتك لمسة راقية وفخمة تناسب المناسبات والإطلالات اليومية المميزة.</p>',
    },
    q8IG4LPBjkHv6hacwdqW: {
      name: 'خاتم ذهب عيار 18 بتصميم سلسلة وفراشة',
      description:
        '<p>خاتم ذهبي أنيق بتصميم مستوحى من السلسلة مع لمسة فراشة ناعمة.</p><p>مثالي للاستخدام اليومي وللإطلالات الرقيقة التي تجمع بين الأنوثة والعصرية.</p>',
    },
  },
};

function upsertArabicTranslation(existingTranslations, values) {
  const translations = Array.isArray(existingTranslations) ? [...existingTranslations] : [];
  const nextTranslation = {
    languageCode: 'ar',
    name: values.name,
    description: values.description,
    updatedAt: new Date(),
  };

  const existingIndex = translations.findIndex(
    (translation) => String(translation.languageCode || '').trim().toLowerCase() === 'ar'
  );

  if (existingIndex >= 0) {
    translations[existingIndex] = nextTranslation;
  } else {
    translations.push(nextTranslation);
  }

  return translations.filter(
    (translation) =>
      String(translation.languageCode || '').trim().toLowerCase() !== 'en' &&
      (String(translation.name || '').trim() || String(translation.description || '').trim())
  );
}

async function processCollection(collectionName, items) {
  let scanned = 0;
  let changed = 0;

  for (const [docId, values] of Object.entries(items)) {
    scanned += 1;
    const ref = db.collection(collectionName).doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`[skip] ${collectionName}/${docId} not found`);
      continue;
    }

    const data = snap.data() || {};
    const nextTranslations = upsertArabicTranslation(data.translations, values);
    console.log(`[fix] ${collectionName}/${docId} -> ar "${values.name}"`);

    if (shouldWrite) {
      await ref.update({
        translations: nextTranslations,
        updatedAt: new Date(),
      });
    }

    changed += 1;
  }

  return { scanned, changed };
}

async function main() {
  console.log(shouldWrite ? 'Running in WRITE mode.' : 'Running in DRY-RUN mode.');

  const collectionsResult = await processCollection('collections', translationsMap.collections);
  const productsResult = await processCollection('products', translationsMap.products);

  console.log('');
  console.log(`Scanned: ${collectionsResult.scanned + productsResult.scanned}`);
  console.log(`Updated: ${collectionsResult.changed + productsResult.changed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
