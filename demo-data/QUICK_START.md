# Quick Start - Demo Data Import

## 🚀 Fastest Way to Import Demo Data

### Step 1: Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **⚙️ Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **"Generate New Private Key"**
6. Save the downloaded JSON file
7. Rename it to `service-account-key.json`
8. Move it to your project root (same folder as `package.json`)

### Step 2: Install Dependencies

```bash
npm install firebase-admin
```

### Step 3: Run Import Script

```bash
node demo-data/import-demo-data.js
```

That's it! ✅

## 📋 What Gets Imported

- ✅ 11 Countries (Pakistan, USA, UK, Canada, UAE, Saudi Arabia, India, Australia, Germany, France, Other)
- ✅ 50+ States/Provinces (with "Other" option for each country)
- ✅ 100+ Cities (with "Other" option for each state)
- ✅ 5 Categories (Dresses, Tops, Bottoms, Shoes, Accessories)
- ✅ 25 Products with variants (Dresses, Tops, Bottoms, Shoes, Accessories)
- ✅ 3 Brands (Elegance, StyleHouse, TrendSetter)
- ✅ 28 Sizes (XS, S, M, L, XL, XXL, XXXL, numeric sizes 28-52, shoe sizes 5-12)
- ✅ 32 Colors (Black, White, Navy, Gray, Beige, Brown, and 26 more fashion colors)
- ✅ 8 Banners (Main, New Arrivals, Summer Sale, Winter, Accessories, Free Shipping, Weekend Sale, Brands)
- ✅ 3 Collections (Spring, Elegant Evening, Casual Weekend)
- ✅ 100+ Product Reviews (3-5 reviews per product)
- ✅ 3 Flash Sales (Summer Fashion, Shoes & Accessories, Weekend Special)
- ✅ 3 Buy X Get Y Promotions (Buy 2 Get 1 Free, Buy 1 Get 1 at 50% Off, Buy 2 Shoes Get Accessory Free)
- ✅ 3 Product Bundles (Complete Outfit, Casual Weekend, Office Essentials)
- ✅ 7 Pages (About, Privacy, Terms, Shipping & Returns, Size Guide, Contact, FAQ)
- ✅ Store Settings

## 🔍 Verify Import

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database**
3. Check these collections:
   - `countries` (11 documents)
   - `states` (50+ documents)
   - `cities` (100+ documents)
   - `categories` (5 documents)
   - `products` (25 documents)
   - `brands` (3 documents)
   - `sizes` (28 documents)
   - `colors` (32 documents)
   - `banners` (8 documents)
   - `collections` (3 documents)
   - `reviews` (100+ documents)
   - `flash_sales` (3 documents)
   - `buy_x_get_y_promotions` (3 documents)
   - `product_bundles` (3 documents)
   - `pages` (7 documents)
   - `settings` (1 document)

## 🎯 Next Steps

1. Start your dev server: `npm run dev`
2. Visit http://localhost:3000
3. You should see products in the shop!
4. Login to admin panel to manage data

## ❌ Troubleshooting

**Error: "service-account-key.json not found"**
- Make sure file is in project root (not in demo-data folder)
- Check file name is exactly `service-account-key.json`

**Error: "Cannot find module 'firebase-admin'"**
- Run: `npm install firebase-admin`

**Error: "Permission denied"**
- Check Firestore rules allow writes
- Verify service account has proper permissions

**Products not showing?**
- Check products have `isActive: true`
- Verify category IDs match
- Clear browser cache

## 📚 Alternative Methods

If script doesn't work, see [README.md](./README.md) for:
- Manual import via Firebase Console
- Using Firebase CLI
- Other import methods

---

**Need help?** Check the main [INSTALLATION.html](../INSTALLATION.html) guide.

