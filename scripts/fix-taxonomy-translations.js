/**
 * Normalize category/collection/brand translations.
 *
 * Ensures:
 * - base fields (name/description) store English values
 * - non-English values stay in translations[]
 * - English translation entries are removed from translations[]
 *
 * Default mode is dry-run:
 *   node scripts/fix-taxonomy-translations.js
 *
 * Apply changes:
 *   node scripts/fix-taxonomy-translations.js --write
 *
 * Optional:
 *   --collections=categories,collections,brands
 *   --limit=25
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadServiceAccount() {
  const directCandidates = [
    path.join(__dirname, '../service-account-key.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  throw new Error('Service account key not found.');
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const argv = process.argv.slice(2);
const shouldWrite = argv.includes('--write');
const limitArg = argv.find((arg) => arg.startsWith('--limit='));
const collectionsArg = argv.find((arg) => arg.startsWith('--collections='));
const maxItems = limitArg ? Number(limitArg.split('=')[1]) : Number.POSITIVE_INFINITY;
const requestedCollections = collectionsArg
  ? new Set(
      collectionsArg
        .split('=')[1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  : null;

const handlers = [
  { id: 'categories', collection: 'categories' },
  { id: 'collections', collection: 'collections' },
  { id: 'brands', collection: 'brands' },
];

const normalizeCode = (code) => String(code || '').trim().toLowerCase();

function sanitizeTranslations(translations) {
  if (!Array.isArray(translations)) {
    return [];
  }

  return translations.filter((translation) => {
    if (!translation || typeof translation !== 'object') {
      return false;
    }

    return Boolean(
      normalizeCode(translation.languageCode) &&
      (String(translation.name || '').trim() || String(translation.description || '').trim())
    );
  });
}

function buildNormalizedDocument(data) {
  const translations = sanitizeTranslations(data.translations);
  const englishTranslation = translations.find((translation) => normalizeCode(translation.languageCode) === 'en');
  const localizedTranslations = translations.filter((translation) => normalizeCode(translation.languageCode) !== 'en');

  const nextName = String(englishTranslation?.name || data.name || '').trim();
  const nextDescription = String(
    englishTranslation?.description ?? data.description ?? ''
  ).trim();

  const currentName = String(data.name || '').trim();
  const currentDescription = String(data.description || '').trim();

  const currentTranslationsJson = JSON.stringify(translations);
  const nextTranslationsJson = JSON.stringify(localizedTranslations);

  const changed =
    nextName !== currentName ||
    nextDescription !== currentDescription ||
    currentTranslationsJson !== nextTranslationsJson;

  return {
    changed,
    nextData: {
      name: nextName,
      description: nextDescription,
      translations: localizedTranslations,
      updatedAt: new Date(),
    },
    summary: {
      beforeName: currentName,
      afterName: nextName,
      beforeTranslations: translations.length,
      afterTranslations: localizedTranslations.length,
      usedEnglishTranslation: Boolean(englishTranslation),
    },
  };
}

async function processHandler(handler) {
  const snapshot = await db.collection(handler.collection).get();
  const docs = snapshot.docs.slice(0, maxItems);
  let changedCount = 0;
  let scannedCount = 0;

  for (const doc of docs) {
    scannedCount += 1;
    const data = doc.data() || {};
    const normalized = buildNormalizedDocument(data);

    if (!normalized.changed) {
      console.log(`[skip] ${handler.id}/${doc.id}`);
      continue;
    }

    console.log(
      `[fix] ${handler.id}/${doc.id} ` +
        `name: "${normalized.summary.beforeName}" -> "${normalized.summary.afterName}", ` +
        `translations: ${normalized.summary.beforeTranslations} -> ${normalized.summary.afterTranslations}`
    );

    if (shouldWrite) {
      const payload = { ...normalized.nextData };
      if (!payload.description) {
        delete payload.description;
      }
      if (!payload.translations.length) {
        payload.translations = [];
      }
      await doc.ref.update(payload);
    }

    changedCount += 1;
  }

  return { scannedCount, changedCount };
}

async function main() {
  const selectedHandlers = handlers.filter(
    (handler) => !requestedCollections || requestedCollections.has(handler.id)
  );

  if (!selectedHandlers.length) {
    throw new Error('No matching collections selected.');
  }

  console.log(shouldWrite ? 'Running in WRITE mode.' : 'Running in DRY-RUN mode.');

  let totalScanned = 0;
  let totalChanged = 0;

  for (const handler of selectedHandlers) {
    const result = await processHandler(handler);
    totalScanned += result.scannedCount;
    totalChanged += result.changedCount;
  }

  console.log('');
  console.log(`Scanned: ${totalScanned}`);
  console.log(`Needs changes: ${totalChanged}`);
  console.log(shouldWrite ? 'Firestore updated.' : 'Dry-run complete. Re-run with --write to apply.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
