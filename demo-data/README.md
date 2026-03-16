# Demo Database - Import Instructions

This folder contains sample data for the Pardah E-commerce Platform. Use these files to quickly populate your Firestore database with demo products, categories, and other data.

## 📦 What's Included

- **countries.json** - Countries with ISO codes, phone codes, and currencies (includes "Other" option)
- **states.json** - States/Provinces for each country (includes "Other" option for each country)
- **cities.json** - Cities for each state (includes "Other" option for each state)
- **categories.json** - Sample product categories
- **products.json** - Sample products with variants (connected to sizes and colors from sizes.json and colors.json)
- **brands.json** - Sample brands
- **sizes.json** - Product sizes (XS, S, M, L, XL, XXL, XXXL, numeric sizes)
- **colors.json** - Product colors with hex codes
- **banners.json** - Homepage banners
- **collections.json** - Product collections
- **reviews.json** - Product reviews and ratings
- **flash_sales.json** - Flash sale promotions
- **buy_x_get_y_promotions.json** - Buy X Get Y promotions
- **product_bundles.json** - Product bundle offers
- **pages.json** - Content pages (About, Privacy, Terms, Shipping, Size Guide, Contact, FAQ)
- **settings.json** - Default store settings

## 🚀 Import Methods

### Method 1: Using Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database**
4. For each collection:
   - Click **"Start collection"** or select existing collection
   - Click **"Add document"**
   - Use the document ID from JSON file (or let Firestore auto-generate)
   - Copy fields from JSON file
   - **Important:** Convert timestamp objects to Firestore Timestamp:
     - `{ "seconds": 1704067200, "nanoseconds": 0 }` → Use Firestore Timestamp type
   - Click **"Save"**

### Method 2: Using Import Script (Recommended)

**Prerequisites:**
1. Install Firebase Admin SDK:
```bash
npm install firebase-admin
```

2. Get Service Account Key:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file as `service-account-key.json` in project root

**Option A: Using Service Account File**
```bash
# Place service-account-key.json in project root
node demo-data/import-demo-data.js
```

**Option B: Using Environment Variable**
```bash
# Set environment variable with service account JSON
$env:FIREBASE_SERVICE_ACCOUNT = '{"type":"service_account",...}'
node demo-data/import-demo-data.js
```

**Option C: Using File Path**
```bash
# Set path to service account key
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"
node demo-data/import-demo-data.js
```

### Method 3: Using Admin SDK Script

Create a Node.js script to import data:

```javascript
// import-demo-data.js
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importCollection(collectionName, fileName) {
  const data = JSON.parse(fs.readFileSync(`./demo-data/${fileName}`, 'utf8'));
  
  for (const doc of data) {
    // Convert timestamp objects to Firestore Timestamp
    if (doc.createdAt) {
      doc.createdAt = admin.firestore.Timestamp.fromMillis(doc.createdAt.seconds * 1000);
    }
    if (doc.updatedAt) {
      doc.updatedAt = admin.firestore.Timestamp.fromMillis(doc.updatedAt.seconds * 1000);
    }
    if (doc.preOrderExpectedDate) {
      doc.preOrderExpectedDate = admin.firestore.Timestamp.fromMillis(doc.preOrderExpectedDate.seconds * 1000);
    }
    
    // Handle nested timestamps in translations
    if (doc.translations) {
      doc.translations = doc.translations.map(t => ({
        ...t,
        updatedAt: admin.firestore.Timestamp.fromMillis(t.updatedAt.seconds * 1000)
      }));
    }
    
    // Handle analytics lastViewed
    if (doc.analytics?.lastViewed) {
      doc.analytics.lastViewed = admin.firestore.Timestamp.fromMillis(doc.analytics.lastViewed.seconds * 1000);
    }
    
    await db.collection(collectionName).doc(doc.id).set(doc);
    console.log(`Imported ${collectionName}/${doc.id}`);
  }
}

async function importAll() {
  try {
    await importCollection('categories', 'categories.json');
    await importCollection('brands', 'brands.json');
    await importCollection('products', 'products.json');
    await importCollection('banners', 'banners.json');
    await importCollection('collections', 'collections.json');
    await importCollection('settings', 'settings.json');
    
    console.log('✅ All data imported successfully!');
  } catch (error) {
    console.error('❌ Error importing data:', error);
  }
}

importAll();
```

Run the script:
```bash
node import-demo-data.js
```

## 📝 Step-by-Step Manual Import

### 1. Import Categories

1. Go to Firestore > **categories** collection
2. For each category in `categories.json`:
   - Click **"Add document"**
   - Set Document ID to the `id` value
   - Add fields:
     - `name` (string)
     - `slug` (string)
     - `description` (string, optional)
     - `imageUrl` (string, optional)
     - `parentCategory` (string, optional - null for top-level)
     - `createdAt` (timestamp)
     - `updatedAt` (timestamp)

### 2. Import Brands

1. Go to Firestore > **brands** collection
2. Import each brand from `brands.json` similar to categories

### 3. Import Products

1. Go to Firestore > **products** collection
2. For each product:
   - Set Document ID to product `id`
   - Import all fields including:
     - `variants` (array)
     - `analytics` (map)
     - `images` (array)
   - **Important:** Ensure category ID matches an existing category

### 5. Import Reviews

1. Go to Firestore > **reviews** collection
2. For each review:
   - Set Document ID to review `id`
   - Import all fields
   - **Important:** Ensure `productId` matches an existing product

### 6. Import Banners

1. Go to Firestore > **banners** collection
2. Import banners for homepage

### 7. Import Collections

1. Go to Firestore > **collections** collection
2. Import collections

### 8. Import Settings

1. Go to Firestore > **settings** collection
2. Create a document with ID: `main`
3. Import settings from `settings.json`

## ⚠️ Important Notes

1. **Timestamps:** Firestore uses Timestamp objects. In JSON, they're represented as `{seconds, nanoseconds}`. When importing manually, use Firestore's Timestamp type.

2. **Document IDs:** Use the `id` field from JSON as the document ID for consistency.

3. **References:** Ensure referenced documents exist:
   - Product `category` → must exist in `categories`
   - Product `brandId` → must exist in `brands`

4. **Images:** The demo data uses Unsplash placeholder images. Replace with your own images in production.

5. **Settings:** Only one settings document should exist with ID `main`.

## 🔄 After Import

1. Verify data in Firebase Console
2. Check that products appear in the shop
3. Verify categories show in navigation
4. Test product detail pages
5. Check admin panel can view all data

## 🗑️ Clearing Demo Data

To remove demo data:

1. Go to Firestore Console
2. Select each collection
3. Delete documents (or entire collection)

Or use Firebase CLI:
```bash
firebase firestore:delete --all-collections
```

## 📸 Sample Data Overview

- **5 Categories:** Dresses, Tops & Blouses, Bottoms, Shoes, Accessories
- **25 Products:** Dresses, Tops, Bottoms, Shoes, Accessories (variety of fashion items)
- **3 Brands:** Elegance, StyleHouse, TrendSetter
- **8 Banners:** Main, New Arrivals, Summer Sale, Winter Collection, Accessories, Free Shipping, Weekend Sale, Brands
- **3 Collections:** Spring Collection, Elegant Evening, Casual Weekend
- **100+ Reviews:** Product reviews with ratings (3-5 reviews per product, 4-5 stars)
- **3 Flash Sales:** Summer Fashion Sale, Shoes & Accessories Sale, Weekend Special
- **3 Buy X Get Y Promotions:** Buy 2 Dresses Get 1 Free, Buy 1 Top Get 1 at 50% Off, Buy 2 Shoes Get Accessory Free
- **3 Product Bundles:** Complete Outfit Bundle, Casual Weekend Bundle, Office Essentials Bundle
- **7 Pages:** About Us, Privacy Policy, Terms of Service, Shipping & Returns, Size Guide, Contact Us, FAQs

## 🆘 Troubleshooting

**Issue:** Products not showing
- Check category IDs match
- Verify products are `isActive: true`
- Check Firestore rules allow read access

**Issue:** Images not loading
- Replace Unsplash URLs with your own
- Check image URLs are accessible
- Verify Firebase Storage is configured

**Issue:** Timestamp errors
- Ensure using Firestore Timestamp type
- Check timestamp format: `{seconds, nanoseconds}`

---

**Need help?** Check the main [INSTALLATION.html](../INSTALLATION.html) guide.

