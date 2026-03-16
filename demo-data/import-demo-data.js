/**
 * Demo Data Import Script for Pardah E-commerce Platform
 * 
 * This script imports sample data from JSON files into Firestore.
 * 
 * Prerequisites:
 * 1. Install Firebase Admin SDK: npm install firebase-admin
 * 2. Get service account key from Firebase Console > Project Settings > Service Accounts
 * 3. Save service account key as 'service-account-key.json' in project root
 * 
 * Usage:
 * node demo-data/import-demo-data.js
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

// Initialize Firebase Admin
let serviceAccount;

// Method 1: Try to load from file
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  serviceAccount = require('../service-account-key.json');
  console.log('✅ Found service-account-key.json');
} catch {
  // Method 2: Try environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Using service account from environment variable');
    } catch {
      console.error('❌ Error: Invalid FIREBASE_SERVICE_ACCOUNT JSON in environment variable');
      process.exit(1);
    }
  } else {
    // Method 3: Try GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        console.log('✅ Using service account from GOOGLE_APPLICATION_CREDENTIALS');
      } catch {
        console.error('❌ Error: Cannot read file from GOOGLE_APPLICATION_CREDENTIALS');
        process.exit(1);
      }
    } else {
      console.error('❌ Error: Service account key not found!');
      console.log('\n📝 Please use one of these methods:');
      console.log('\n   Method 1: Download service account key');
      console.log('   1. Go to Firebase Console > Project Settings > Service Accounts');
      console.log('   2. Click "Generate New Private Key"');
      console.log('   3. Save as "service-account-key.json" in project root');
      console.log('\n   Method 2: Use environment variable');
      console.log('   Set FIREBASE_SERVICE_ACCOUNT="{\\"type\\":\\"service_account\\",...}"');
      console.log('\n   Method 3: Use file path');
      console.log('   Set GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
      console.log('\n   Method 4: Manual import via Firebase Console');
      console.log('   See demo-data/README.md for manual import instructions');
      process.exit(1);
    }
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Convert JSON timestamp to Firestore Timestamp
 */
function toFirestoreTimestamp(timestampObj) {
  if (!timestampObj) return null;
  if (timestampObj.seconds) {
    return admin.firestore.Timestamp.fromMillis(timestampObj.seconds * 1000 + (timestampObj.nanoseconds || 0) / 1000000);
  }
  return admin.firestore.Timestamp.now();
}

/**
 * Process document data and convert timestamps
 */
function processDocument(doc) {
  const processed = { ...doc };
  
  // Convert top-level timestamps
  if (processed.createdAt) {
    processed.createdAt = toFirestoreTimestamp(processed.createdAt);
  }
  if (processed.updatedAt) {
    processed.updatedAt = toFirestoreTimestamp(processed.updatedAt);
  }
  if (processed.preOrderExpectedDate) {
    processed.preOrderExpectedDate = toFirestoreTimestamp(processed.preOrderExpectedDate);
  }
  
  // Process translations array
  if (processed.translations && Array.isArray(processed.translations)) {
    processed.translations = processed.translations.map(t => ({
      ...t,
      updatedAt: toFirestoreTimestamp(t.updatedAt)
    }));
  }
  
  // Process analytics
  if (processed.analytics) {
    if (processed.analytics.lastViewed) {
      processed.analytics.lastViewed = toFirestoreTimestamp(processed.analytics.lastViewed);
    }
  }
  
  return processed;
}

/**
 * Import a collection from JSON file
 */
async function importCollection(collectionName, fileName) {
  try {
    const filePath = path.join(__dirname, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileName}, skipping...`);
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!Array.isArray(data)) {
      // Single document (like settings.json)
      const processed = processDocument(data);
      await db.collection(collectionName).doc(data.id || 'main').set(processed);
      console.log(`✅ Imported ${collectionName}/${data.id || 'main'}`);
      return;
    }
    
    // Array of documents (with batching to avoid rate limits)
    let imported = 0;
    let skipped = 0;
    
    // Use batch size based on collection type
    const batchSize = collectionName === 'products' ? 3 : collectionName === 'reviews' ? 10 : 5;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const promises = batch.map(async (doc) => {
        try {
          const processed = processDocument(doc);
          const docId = doc.id || doc.slug || `doc_${imported}`;
          
          await db.collection(collectionName).doc(docId).set(processed);
          imported++;
          console.log(`  ✓ ${collectionName}/${docId} (${imported}/${data.length})`);
          return true;
        } catch (error) {
          console.error(`  ✗ Error importing ${doc.id}:`, error.message);
          skipped++;
          return false;
        }
      });
      
      await Promise.all(promises);
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < data.length) {
        const delay = collectionName === 'products' ? 800 : collectionName === 'reviews' ? 400 : 300;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`✅ Imported ${collectionName}: ${imported} documents${skipped > 0 ? `, ${skipped} skipped` : ''}`);
  } catch (error) {
    console.error(`❌ Error importing ${collectionName}:`, error.message);
  }
}

/**
 * Main import function
 */
async function importAll() {
  console.log('\n🚀 Starting demo data import...\n');
  console.log('📦 Importing collections in order...\n');
  
  try {
    // Import in order (dependencies first)
    console.log('1️⃣  Importing countries...');
    await importCollection('countries', 'countries.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n2️⃣  Importing states...');
    await importCollection('states', 'states.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n3️⃣  Importing cities...');
    await importCollection('cities', 'cities.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n4️⃣  Importing categories...');
    await importCollection('categories', 'categories.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n5️⃣  Importing brands...');
    await importCollection('brands', 'brands.json');
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between collections
    
    console.log('\n6️⃣  Importing sizes...');
    await importCollection('sizes', 'sizes.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n7️⃣  Importing colors...');
    await importCollection('colors', 'colors.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n8️⃣  Importing collections...');
    await importCollection('collections', 'collections.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n9️⃣  Importing products...');
    await importCollection('products', 'products.json');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay after products
    
    console.log('\n🔟  Importing banners...');
    await importCollection('banners', 'banners.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n1️⃣1️⃣  Importing reviews...');
    await importCollection('reviews', 'reviews.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n1️⃣2️⃣  Importing flash sales...');
    await importCollection('flash_sales', 'flash_sales.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n1️⃣3️⃣  Importing buy x get y promotions...');
    await importCollection('buy_x_get_y_promotions', 'buy_x_get_y_promotions.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n1️⃣4️⃣  Importing product bundles...');
    await importCollection('product_bundles', 'product_bundles.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n1️⃣5️⃣  Importing pages...');
    await importCollection('pages', 'pages.json');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n1️⃣6️⃣  Importing settings...');
    await importCollection('settings', 'settings.json');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All data imported successfully!');
    console.log('='.repeat(50));
    console.log('\n📝 Next steps:');
    console.log('   1. Verify data in Firebase Console');
    console.log('   2. Start dev server: npm run dev');
    console.log('   3. Check your storefront at http://localhost:3000');
    console.log('   4. Login to admin panel to view imported data');
    console.log('\n');
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Error during import:', error.message);
    console.error('='.repeat(50));
    console.log('\n💡 Tip: If you prefer manual import, see demo-data/README.md');
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run import
importAll();

