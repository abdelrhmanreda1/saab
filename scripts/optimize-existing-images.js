/**
 * Optimize existing Firebase Storage images and rewrite Firestore URLs.
 *
 * Default mode is dry-run:
 *   node scripts/optimize-existing-images.js
 *
 * Apply changes:
 *   node scripts/optimize-existing-images.js --write
 *
 * Optional flags:
 *   --delete-originals   Delete source files after successful rewrite
 *   --limit=50           Process at most N images
 *   --collections=...    Comma-separated subset of handlers
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

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
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  });
}

const db = admin.firestore();
const defaultBucket = admin.storage().bucket();

const argv = process.argv.slice(2);
const shouldWrite = argv.includes('--write');
const shouldDeleteOriginals = argv.includes('--delete-originals');
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

const SUPPORTED_INPUT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
  'image/avif',
  'image/webp',
]);

const buildFirebaseDownloadUrl = (bucketName, objectPath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  if (url.startsWith('gs://')) {
    const withoutScheme = url.slice(5);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex === -1) {
      return null;
    }

    return {
      bucket: withoutScheme.slice(0, slashIndex),
      objectPath: withoutScheme.slice(slashIndex + 1),
    };
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const pathMatch = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!pathMatch) {
        return null;
      }

      return {
        bucket: decodeURIComponent(pathMatch[1]),
        objectPath: decodeURIComponent(pathMatch[2]),
      };
    }

    if (parsed.hostname === 'storage.googleapis.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        return null;
      }

      return {
        bucket: decodeURIComponent(parts[0]),
        objectPath: decodeURIComponent(parts.slice(1).join('/')),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function replaceFileExtension(filename, nextExtension) {
  const cleanExtension = nextExtension.startsWith('.') ? nextExtension : `.${nextExtension}`;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return `${filename}${cleanExtension}`;
  }
  return `${filename.slice(0, lastDot)}${cleanExtension}`;
}

function buildOptimizedObjectPath(sourcePath) {
  const pathParts = sourcePath.split('/');
  const filename = pathParts.pop() || 'image';
  const optimizedFilename = replaceFileExtension(filename, '.webp');
  return [...pathParts, 'optimized', optimizedFilename].join('/');
}

function stripOptimizedSegment(objectPath) {
  return objectPath.replace('/optimized/', '/');
}

function getBasenameWithoutExtension(filePath) {
  const filename = filePath.split('/').pop() || '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? filename : filename.slice(0, lastDot);
}

async function deleteOriginalForOptimizedUrl(url) {
  const parsed = parseStorageUrl(url);
  if (!parsed || !parsed.objectPath.includes('/optimized/')) {
    return { status: 'skip', reason: 'not-optimized-url' };
  }

  const bucket = admin.storage().bucket(parsed.bucket || defaultBucket.name);
  const originalPathGuess = stripOptimizedSegment(parsed.objectPath);
  const originalDir = originalPathGuess.split('/').slice(0, -1).join('/');
  const originalBaseName = getBasenameWithoutExtension(originalPathGuess);

  const [files] = await bucket.getFiles({ prefix: `${originalDir}/` });
  const matchingFiles = files.filter((file) => {
    if (file.name.includes('/optimized/')) {
      return false;
    }
    return getBasenameWithoutExtension(file.name) === originalBaseName;
  });

  if (!matchingFiles.length) {
    return { status: 'skip', reason: 'original-not-found' };
  }

  for (const file of matchingFiles) {
    await file.delete({ ignoreNotFound: true });
  }

  return {
    status: 'deleted',
    deleted: matchingFiles.length,
    files: matchingFiles.map((file) => file.name),
  };
}

function getAtPath(source, pathSegments) {
  let current = source;
  for (const segment of pathSegments) {
    if (current == null) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function setAtPath(target, pathSegments, value) {
  if (!pathSegments.length) {
    return target;
  }

  const clone = Array.isArray(target) ? [...target] : { ...target };
  let current = clone;

  for (let index = 0; index < pathSegments.length - 1; index++) {
    const segment = pathSegments[index];
    const nextValue = current[segment];
    current[segment] = Array.isArray(nextValue) ? [...nextValue] : { ...nextValue };
    current = current[segment];
  }

  current[pathSegments[pathSegments.length - 1]] = value;
  return clone;
}

function collectFromArrayField(fieldName, values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((url, index) => ({
      path: [fieldName, index],
      url,
    }))
    .filter((entry) => typeof entry.url === 'string' && entry.url.trim());
}

function collectSingleField(fieldName, value) {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  return [{ path: [fieldName], url: value }];
}

function collectNestedField(pathSegments, value) {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  return [{ path: pathSegments, url: value }];
}

const handlers = [
  {
    id: 'products',
    collection: 'products',
    collectReferences: (data) => collectFromArrayField('images', data.images),
  },
  {
    id: 'categories',
    collection: 'categories',
    collectReferences: (data) => collectSingleField('imageUrl', data.imageUrl),
  },
  {
    id: 'collections',
    collection: 'collections',
    collectReferences: (data) => collectSingleField('imageUrl', data.imageUrl),
  },
  {
    id: 'brands',
    collection: 'brands',
    collectReferences: (data) => collectSingleField('logoUrl', data.logoUrl),
  },
  {
    id: 'banners',
    collection: 'banners',
    collectReferences: (data) => collectSingleField('imageUrl', data.imageUrl),
  },
  {
    id: 'blog_posts',
    collection: 'blog_posts',
    collectReferences: (data) => collectSingleField('coverImage', data.coverImage),
  },
  {
    id: 'product_seo',
    collection: 'product_seo',
    collectReferences: (data) => collectSingleField('metaImage', data.metaImage),
  },
  {
    id: 'category_seo',
    collection: 'category_seo',
    collectReferences: (data) => collectSingleField('metaImage', data.metaImage),
  },
  {
    id: 'brand_seo',
    collection: 'brand_seo',
    collectReferences: (data) => collectSingleField('metaImage', data.metaImage),
  },
  {
    id: 'collection_seo',
    collection: 'collection_seo',
    collectReferences: (data) => collectSingleField('metaImage', data.metaImage),
  },
  {
    id: 'blog_seo',
    collection: 'blog_seo',
    collectReferences: (data) => collectSingleField('metaImage', data.metaImage),
  },
  {
    id: 'settings',
    collection: 'settings',
    collectReferences: (data) => {
      const refs = [
        ...collectNestedField(['theme', 'logoUrl'], data?.theme?.logoUrl),
        ...collectNestedField(['theme', 'faviconUrl'], data?.theme?.faviconUrl),
        ...collectNestedField(['theme', 'loginImageUrl'], data?.theme?.loginImageUrl),
      ];

      if (Array.isArray(data?.theme?.paymentMethods)) {
        data.theme.paymentMethods.forEach((method, index) => {
          if (typeof method?.imageUrl === 'string' && method.imageUrl.trim()) {
            refs.push({
              path: ['theme', 'paymentMethods', index, 'imageUrl'],
              url: method.imageUrl,
            });
          }
        });
      }

      return refs;
    },
  },
  {
    id: 'languages',
    collection: 'languages',
    collectReferences: (data) => collectSingleField('flag', data.flag),
  },
];

function getSelectedHandlers() {
  if (!requestedCollections) {
    return handlers;
  }

  return handlers.filter((handler) => requestedCollections.has(handler.id));
}

async function optimizeStorageImage(url, cache) {
  if (cache.has(url)) {
    return cache.get(url);
  }

  const pending = (async () => {
    const parsed = parseStorageUrl(url);
    if (!parsed) {
      return { status: 'skip', reason: 'unsupported-url', url };
    }

    const bucket = admin.storage().bucket(parsed.bucket || defaultBucket.name);
    const sourceFile = bucket.file(parsed.objectPath);
    const [exists] = await sourceFile.exists();

    if (!exists) {
      return { status: 'skip', reason: 'missing-source', url };
    }

    const [metadata] = await sourceFile.getMetadata();
    const contentType = String(metadata.contentType || '').toLowerCase();
    const lowerPath = parsed.objectPath.toLowerCase();

    if (contentType === 'image/svg+xml' || contentType === 'image/gif' || lowerPath.endsWith('.svg') || lowerPath.endsWith('.gif')) {
      return { status: 'skip', reason: 'unsupported-format', url };
    }

    if (contentType === 'image/webp' || lowerPath.endsWith('.webp')) {
      return { status: 'skip', reason: 'already-webp', url };
    }

    if (contentType && !SUPPORTED_INPUT_TYPES.has(contentType)) {
      return { status: 'skip', reason: `unsupported-content-type:${contentType}`, url };
    }

    const [sourceBuffer] = await sourceFile.download();
    const optimizedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    if (optimizedBuffer.length >= sourceBuffer.length) {
      return {
        status: 'skip',
        reason: 'not-smaller',
        url,
        originalBytes: sourceBuffer.length,
        optimizedBytes: optimizedBuffer.length,
      };
    }

    const optimizedPath = buildOptimizedObjectPath(parsed.objectPath);
    const token = crypto.randomUUID();
    const optimizedUrl = buildFirebaseDownloadUrl(bucket.name, optimizedPath, token);

    if (shouldWrite) {
      const destinationFile = bucket.file(optimizedPath);
      await destinationFile.save(optimizedBuffer, {
        resumable: false,
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      if (shouldDeleteOriginals) {
        await sourceFile.delete({ ignoreNotFound: true });
      }
    }

    return {
      status: 'optimized',
      url,
      optimizedUrl,
      originalBytes: sourceBuffer.length,
      optimizedBytes: optimizedBuffer.length,
      sourcePath: parsed.objectPath,
      optimizedPath,
    };
  })();

  cache.set(url, pending);
  return pending;
}

async function processHandler(handler, state) {
  const snapshot = await db.collection(handler.collection).get();

  for (const documentSnapshot of snapshot.docs) {
    if (state.processedImages >= maxItems) {
      return;
    }

    const data = documentSnapshot.data();
    const references = handler.collectReferences(data);
    if (!references.length) {
      continue;
    }

    let nextData = data;
    let docChanged = false;

    for (const reference of references) {
      if (state.processedImages >= maxItems) {
        break;
      }

      const result = await optimizeStorageImage(reference.url, state.cache);
      state.stats.scanned += 1;

      if (result.status === 'optimized') {
        state.processedImages += 1;
        state.stats.optimized += 1;
        state.stats.bytesBefore += result.originalBytes || 0;
        state.stats.bytesAfter += result.optimizedBytes || 0;
        nextData = setAtPath(nextData, reference.path, result.optimizedUrl);
        docChanged = true;
        console.log(`[optimize] ${handler.id}/${documentSnapshot.id} ${reference.url} -> ${result.optimizedUrl}`);
      } else if (
        shouldWrite &&
        shouldDeleteOriginals &&
        result.status === 'skip' &&
        result.reason === 'already-webp'
      ) {
        const deleteResult = await deleteOriginalForOptimizedUrl(reference.url);
        if (deleteResult.status === 'deleted') {
          state.stats.deletedOriginals += deleteResult.deleted || 0;
          console.log(`[cleanup] ${handler.id}/${documentSnapshot.id} deleted originals: ${deleteResult.files.join(', ')}`);
        } else {
          state.stats.skipped += 1;
          console.log(`[cleanup-skip:${deleteResult.reason}] ${handler.id}/${documentSnapshot.id} ${reference.url}`);
        }
      } else {
        state.stats.skipped += 1;
        console.log(`[skip:${result.reason}] ${handler.id}/${documentSnapshot.id} ${reference.url}`);
      }
    }

    if (docChanged) {
      state.stats.documentsChanged += 1;
      if (shouldWrite) {
        await documentSnapshot.ref.set(nextData, { merge: false });
      }
    }
  }
}

async function run() {
  const state = {
    cache: new Map(),
    processedImages: 0,
    stats: {
      scanned: 0,
      optimized: 0,
      skipped: 0,
      documentsChanged: 0,
      bytesBefore: 0,
      bytesAfter: 0,
      deletedOriginals: 0,
    },
  };

  const selectedHandlers = getSelectedHandlers();
  if (!selectedHandlers.length) {
    throw new Error('No matching collections to process.');
  }

  console.log(`Mode: ${shouldWrite ? 'WRITE' : 'DRY-RUN'}`);
  console.log(`Delete originals: ${shouldDeleteOriginals ? 'yes' : 'no'}`);
  console.log(`Collections: ${selectedHandlers.map((handler) => handler.id).join(', ')}`);
  console.log(`Limit: ${Number.isFinite(maxItems) ? maxItems : 'none'}`);
  console.log('');

  for (const handler of selectedHandlers) {
    if (state.processedImages >= maxItems) {
      break;
    }

    console.log(`Scanning collection: ${handler.collection}`);
    await processHandler(handler, state);
    console.log('');
  }

  const savedBytes = Math.max(0, state.stats.bytesBefore - state.stats.bytesAfter);
  const savedMb = (savedBytes / (1024 * 1024)).toFixed(2);

  console.log('Summary');
  console.log(`Scanned refs: ${state.stats.scanned}`);
  console.log(`Optimized refs: ${state.stats.optimized}`);
  console.log(`Skipped refs: ${state.stats.skipped}`);
  console.log(`Changed docs: ${state.stats.documentsChanged}`);
  console.log(`Bytes before: ${state.stats.bytesBefore}`);
  console.log(`Bytes after: ${state.stats.bytesAfter}`);
  console.log(`Saved approx: ${savedMb} MB`);
  console.log(`Deleted originals: ${state.stats.deletedOriginals}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
