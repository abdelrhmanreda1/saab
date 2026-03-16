import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin (server-side)
// This bypasses Firestore security rules
let db: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    // Try to initialize with service account if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account file if path is provided
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      db = admin.firestore();
    } else {
      // For local dev, try to initialize without credentials
      // This will work if Firebase emulator is running or if default credentials are available
      try {
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        db = admin.firestore();
      } catch {
        db = null;
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
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if Firebase Admin is initialized
    if (!db) {
      // Return exists: false to allow OTP flow
      return NextResponse.json({
        success: true,
        exists: false,
      });
    }
    
    try {
      // Use Firebase Admin SDK - bypasses security rules
      const usersRef = db.collection('users');
      const querySnapshot = await usersRef.where('email', '==', normalizedEmail).get();

      if (!querySnapshot.empty) {
        // User exists in Firestore
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        // Get loginType from user data
        // If loginType is missing but photoURL exists, assume Google
        const loginType = userData.loginType || (userData.photoURL ? 'google' : null);
        
        return NextResponse.json({
          success: true,
          exists: true,
          loginType,
          uid: userDoc.id,
        });
      }
    } catch {
      // Firestore query failed - return exists: false to allow OTP flow
    }

    return NextResponse.json({
      success: true,
      exists: false,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check email',
      },
      { status: 500 }
    );
  }
}

