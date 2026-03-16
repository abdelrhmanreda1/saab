import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let db: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
    } else {
      const serviceAccountPath = path.join(process.cwd(), 'service-account-key.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        db = admin.firestore();
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        db = admin.firestore();
      } else {
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        db = admin.firestore();
      }
    }
  } else {
    db = admin.firestore();
  }
} catch {
  db = null;
}

async function getCurrentUid(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    return null;
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
}

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase Admin is not configured' }, { status: 500 });
    }

    const uid = await getCurrentUid(request);
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Missing authorization token' }, { status: 401 });
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ success: true, profile: null });
    }

    return NextResponse.json({
      success: true,
      profile: {
        uid,
        ...userSnap.data(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase Admin is not configured' }, { status: 500 });
    }

    const uid = await getCurrentUid(request);
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Missing authorization token' }, { status: 401 });
    }

    const body = await request.json();
    const userRef = db.collection('users').doc(uid);
    const existingSnap = await userRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : {};
    const now = admin.firestore.FieldValue.serverTimestamp();

    const patch: Record<string, unknown> = {
      updatedAt: now,
      uid,
      walletBalance: existingData?.walletBalance || 0,
      loyaltyPoints: existingData?.loyaltyPoints || 0,
      role: existingData?.role || (existingData?.isAdmin ? 'admin' : 'customer'),
      isAdmin: Boolean(existingData?.isAdmin),
      isBlocked: Boolean(existingData?.isBlocked),
      createdAt: existingData?.createdAt || now,
    };

    if ('displayName' in body) {
      patch.displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;
    }
    if ('email' in body) {
      patch.email = typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : null;
    }
    if ('photoURL' in body) {
      patch.photoURL = typeof body.photoURL === 'string' && body.photoURL.trim()
        ? body.photoURL.trim()
        : null;
    }
    if ('phoneNumber' in body) {
      patch.phoneNumber = typeof body.phoneNumber === 'string' && body.phoneNumber.trim()
        ? body.phoneNumber.trim()
        : null;
    }
    if ('loginType' in body && (body.loginType === 'phone' || body.loginType === 'email' || body.loginType === 'google')) {
      patch.loginType = body.loginType;
    }
    if ('address' in body) {
      patch.address = body.address || null;
    }

    await userRef.set(patch, { merge: true });

    if (typeof patch.displayName === 'string') {
      try {
        await admin.auth().updateUser(uid, { displayName: patch.displayName });
      } catch {
        // Keep Firestore as source of truth if Auth update is not possible.
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
