# Scripts Directory

This directory contains utility scripts for the Pardah e-commerce project.

## Available Scripts

### 1. create-admin.js

Creates or promotes an admin account for the current phone-based login flow.

**Usage:**
```bash
npm run create-admin
# or
node scripts/create-admin.js
```

**What it does:**
- Prompts for admin details: name, phone number, optional email
- Looks up an existing Firebase Auth user by phone number
- Creates the Firebase Auth user if it does not exist yet
- Creates or updates the Firestore user document with:
  - `role: 'admin'`
  - `isAdmin: true`
- Keeps the account compatible with OTP phone login

**Prerequisites:**
- Service account key as one of:
  - `service-account-key.json` in project root
  - `FIREBASE_SERVICE_ACCOUNT` environment variable
  - `GOOGLE_APPLICATION_CREDENTIALS` environment variable

**Example:**
```bash
$ npm run create-admin

============================================================
Promote/Create Admin Account (Phone Login)
============================================================

This script works with the current phone-based login flow.

Full Name: John Doe
Phone Number (Saudi format, e.g. 05xxxxxxxx or +9665xxxxxxxx): 0500000001
Email Address (optional): admin@example.com

Processing admin account...

Created Firebase Auth user with phone authentication
Created Firestore user document with admin access

============================================================
Admin access is ready
============================================================
Name: John Doe
Phone: +966500000001
Email: admin@example.com
UID: abc123xyz
Role: admin

Next steps:
1. Open the storefront login page
2. Sign in with the same phone number using OTP
3. Open /admin
```

---

### 2. copy-next-build.js

Copies Next.js build output to the Firebase Functions directory for deployment.

**Usage:**
```bash
npm run build:firebase
```

---

### 3. backup-firestore.js

Backs up Firestore database.

**Usage:**
```bash
node scripts/backup-firestore.js
```

---

### 4. replace-fashion-taxonomy.js

Replaces clothing-focused `categories`, `brands`, and `collections` with gold/jewelry taxonomy.

**Usage:**
```bash
npm run taxonomy:gold
# or
node scripts/replace-fashion-taxonomy.js
```

**What it does:**
- Creates a local backup for current taxonomy inside `backups/`
- Replaces Firestore taxonomy with gold-friendly values
- Re-links existing products to valid fallback taxonomy docs

---

### 5. optimize-existing-images.js

Optimizes existing Firebase Storage images, converts them to `webp`, uploads optimized copies, and rewrites Firestore URLs.

**Usage:**
```bash
npm run images:optimize
node scripts/optimize-existing-images.js
node scripts/optimize-existing-images.js --write
node scripts/optimize-existing-images.js --write --delete-originals
node scripts/optimize-existing-images.js --write --collections=products,banners,settings
```

**What it does:**
- Scans image references in key collections like `products`, `categories`, `collections`, `brands`, `banners`, `blog_posts`, SEO collections, `settings`, and `languages`
- Downloads original files from Firebase Storage
- Resizes and converts eligible raster images to `webp`
- Uploads optimized copies under an `optimized/` path
- Updates Firestore documents to point to the new optimized URLs
- Can optionally delete the old originals after a successful rewrite

**Recommended flow:**
```bash
# 1) Preview only
npm run images:optimize

# 2) Apply changes
node scripts/optimize-existing-images.js --write

# 3) Optional cleanup
node scripts/optimize-existing-images.js --write --delete-originals
```

**Notes:**
- Default mode is `dry-run`, so nothing is written unless `--write` is passed
- `svg`, `gif`, and already-`webp` files are skipped
- The script only rewrites documents it actually improves

---

## Setup

### Install script dependency

```bash
npm install readline-sync
```

### Get service account key

1. Open Firebase Console.
2. Select the project.
3. Go to `Project Settings > Service Accounts`.
4. Click `Generate New Private Key`.
5. Save it as `service-account-key.json` in the project root.

Important: never commit `service-account-key.json` to version control.

---

## Troubleshooting

**Error: `Cannot find module 'readline-sync'`**
```bash
npm install readline-sync
```

**Error: `Service account key not found`**
- Put `service-account-key.json` in the project root
- Or set `FIREBASE_SERVICE_ACCOUNT`
- Or set `GOOGLE_APPLICATION_CREDENTIALS`

**Error: `auth/user-not-found`**
- The script will create the Firebase Auth user automatically for that phone number

**Error: `auth/invalid-phone-number`**
- Use a valid Saudi number such as `+9665xxxxxxxx`

---

For more information, see [INSTALLATION.html](../INSTALLATION.html)
