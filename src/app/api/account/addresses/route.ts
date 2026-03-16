import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminDb: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      adminDb = admin.firestore();
    } else {
      const serviceAccountPath = path.join(process.cwd(), 'service-account-key.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        adminDb = admin.firestore();
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        adminDb = admin.firestore();
      } else {
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        adminDb = admin.firestore();
      }
    }
  } else {
    adminDb = admin.firestore();
  }
} catch {
  adminDb = null;
}

const timestampToSerializable = (value: unknown): unknown => {
  if (value instanceof admin.firestore.Timestamp) {
    return {
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (Array.isArray(value)) {
    return value.map(timestampToSerializable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        timestampToSerializable(nestedValue),
      ])
    );
  }

  return value;
};

const getUidFromRequest = async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    throw new Error('Missing authorization token');
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
};

export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const uid = await getUidFromRequest(request);
    const snapshot = await adminDb
      .collection('user_addresses')
      .where('userId', '==', uid)
      .get();

    const addresses: Array<Record<string, unknown> & { id: string }> = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    }));

    addresses.sort((a, b) => {
      const aSeconds = Number((a.createdAt as { seconds?: number } | undefined)?.seconds || 0);
      const bSeconds = Number((b.createdAt as { seconds?: number } | undefined)?.seconds || 0);
      return bSeconds - aSeconds;
    });

    return NextResponse.json({
      success: true,
      addresses: addresses.map(timestampToSerializable),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch addresses';
    const status = message === 'Missing authorization token' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const uid = await getUidFromRequest(request);
    const body = (await request.json().catch(() => null)) as
      | {
          label?: string;
          fullName?: string;
          phone?: string;
          address?: string;
          city?: string;
          state?: string;
          zipCode?: string;
          country?: string;
          isDefault?: boolean;
        }
      | null;

    if (!body?.label || !body.address || !body.city || !body.state || !body.country) {
      return NextResponse.json(
        { success: false, error: 'Missing required address fields' },
        { status: 400 }
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('user_addresses').add({
      userId: uid,
      label: body.label,
      fullName: body.fullName || '',
      phone: body.phone || '',
      address: body.address,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode || '',
      country: body.country,
      isDefault: Boolean(body.isDefault),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save address';
    const status = message === 'Missing authorization token' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
