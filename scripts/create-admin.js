/**
 * Promote or create an admin account using phone authentication.
 *
 * Usage:
 *   npm run create-admin
 *   node scripts/create-admin.js
 */

const admin = require('firebase-admin');
const readline = require('readline-sync');

let serviceAccount;

try {
  serviceAccount = require('../service-account-key.json');
  console.log('Found service-account-key.json\n');
} catch (error) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('Using service account from FIREBASE_SERVICE_ACCOUNT\n');
    } catch {
      console.error('Error: Invalid FIREBASE_SERVICE_ACCOUNT JSON');
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('Using service account from GOOGLE_APPLICATION_CREDENTIALS\n');
    } catch {
      console.error('Error: Cannot read service account file');
      process.exit(1);
    }
  } else {
    console.error('Error: Service account key not found.');
    console.log('\nUse one of these options:');
    console.log('1. Put service-account-key.json in the project root');
    console.log('2. Set FIREBASE_SERVICE_ACCOUNT with the service account JSON');
    console.log('3. Set GOOGLE_APPLICATION_CREDENTIALS to a key file path');
    process.exit(1);
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('+')) {
    return digits;
  }

  if (digits.startsWith('966')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+966${digits.slice(1)}`;
  }

  return `+${digits}`;
}

function isValidPhone(phone) {
  return /^\+\d{10,15}$/.test(phone);
}

function buildFirestoreProfile(userRecord, displayName, email) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    uid: userRecord.uid,
    id: userRecord.uid,
    displayName: displayName || userRecord.displayName || null,
    name: displayName || userRecord.displayName || null,
    email: email || userRecord.email || null,
    phoneNumber: userRecord.phoneNumber || null,
    phone: userRecord.phoneNumber || null,
    loginType: 'phone',
    role: 'admin',
    isAdmin: true,
    phoneVerified: true,
    emailVerified: Boolean(userRecord.emailVerified),
    updatedAt: now,
  };
}

async function upsertAdminFirestoreProfile(userRecord, displayName, email) {
  const userDocRef = db.collection('users').doc(userRecord.uid);
  const userDoc = await userDocRef.get();
  const profile = buildFirestoreProfile(userRecord, displayName, email);

  if (userDoc.exists) {
    await userDocRef.set(profile, { merge: true });
    console.log('Updated existing Firestore user document with admin access');
    return;
  }

  await userDocRef.set({
    ...profile,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('Created Firestore user document with admin access');
}

async function getOrCreateAuthUser(phoneNumber, displayName, email) {
  try {
    const existingUser = await auth.getUserByPhoneNumber(phoneNumber);
    console.log('Firebase Auth user already exists for this phone number');

    const updatePatch = {};
    if (displayName && existingUser.displayName !== displayName) {
      updatePatch.displayName = displayName;
    }
    if (email && existingUser.email !== email) {
      updatePatch.email = email;
      updatePatch.emailVerified = true;
    }

    if (Object.keys(updatePatch).length > 0) {
      await auth.updateUser(existingUser.uid, updatePatch);
      return auth.getUser(existingUser.uid);
    }

    return existingUser;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }
  }

  const createPayload = {
    phoneNumber,
    displayName,
  };

  if (email) {
    createPayload.email = email;
    createPayload.emailVerified = true;
  }

  const createdUser = await auth.createUser(createPayload);
  console.log('Created Firebase Auth user with phone authentication');
  return createdUser;
}

async function createAdminAccount() {
  console.log('='.repeat(60));
  console.log('Promote/Create Admin Account (Phone Login)');
  console.log('='.repeat(60));
  console.log('\nThis script works with the current phone-based login flow.\n');

  const displayName = readline.question('Full Name: ').trim();
  if (!displayName) {
    console.error('Error: Full name is required.');
    process.exit(1);
  }

  const rawPhone = readline.question('Phone Number (Saudi format, e.g. 05xxxxxxxx or +9665xxxxxxxx): ').trim();
  const phoneNumber = normalizePhone(rawPhone);
  if (!isValidPhone(phoneNumber)) {
    console.error('Error: Invalid phone number after normalization.');
    console.error(`Received: ${phoneNumber || '(empty)'}`);
    process.exit(1);
  }

  const email = readline.question('Email Address (optional): ').trim();

  console.log('\nProcessing admin account...\n');

  try {
    const userRecord = await getOrCreateAuthUser(phoneNumber, displayName, email || undefined);
    await upsertAdminFirestoreProfile(userRecord, displayName, email || undefined);

    console.log('\n' + '='.repeat(60));
    console.log('Admin access is ready');
    console.log('='.repeat(60));
    console.log(`Name: ${displayName}`);
    console.log(`Phone: ${userRecord.phoneNumber || phoneNumber}`);
    console.log(`Email: ${userRecord.email || email || 'N/A'}`);
    console.log(`UID: ${userRecord.uid}`);
    console.log('Role: admin');
    console.log('\nNext steps:');
    console.log('1. Open the storefront login page');
    console.log('2. Sign in with the same phone number using OTP');
    console.log('3. Open /admin');
    console.log('');
  } catch (error) {
    console.error('\nFailed to prepare admin account.');

    if (error.code === 'auth/phone-number-already-exists') {
      console.error('Phone number already belongs to another Firebase Auth user.');
    } else if (error.code === 'auth/invalid-phone-number') {
      console.error('Invalid phone number format. Use a Saudi number such as +9665xxxxxxxx.');
    } else if (error.code === 'auth/email-already-exists') {
      console.error('That email is already used by another Firebase Auth account.');
    } else {
      console.error(error.message || error);
    }

    process.exit(1);
  }
}

createAdminAccount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
