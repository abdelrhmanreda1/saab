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
        // Local dev fallback when application default credentials are available.
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

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const body = await request.json();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const emailInput = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const loginType = body.loginType === 'phone' || body.loginType === 'email' || body.loginType === 'google'
      ? body.loginType
      : 'phone';

    if (displayName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Display name must be at least 2 characters' },
        { status: 400 }
      );
    }

    const userRecord = await admin.auth().getUser(decodedToken.uid);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const existingSnap = await userRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const payload = {
      uid: decodedToken.uid,
      email: emailInput || userRecord.email || existingData?.email || null,
      displayName,
      photoURL: userRecord.photoURL || existingData?.photoURL || null,
      phoneNumber: userRecord.phoneNumber || existingData?.phoneNumber || null,
      loginType,
      isAdmin: Boolean(existingData?.isAdmin),
      role: existingData?.role || (existingData?.isAdmin ? 'admin' : 'customer'),
      isBlocked: Boolean(existingData?.isBlocked),
      walletBalance: existingData?.walletBalance || 0,
      loyaltyPoints: existingData?.loyaltyPoints || 0,
      updatedAt: now,
      createdAt: existingData?.createdAt || now,
    };

    await userRef.set(payload, { merge: true });

    return NextResponse.json({
      success: true,
      role: payload.role,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to complete profile';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
