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

type AuthorizedAddress = Record<string, unknown> & { id: string };

const getAuthorizedAddress = async (
  id: string,
  uid: string
): Promise<AuthorizedAddress | null> => {
  const docRef = adminDb!.collection('user_addresses').doc(id);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const address = snapshot.data() as Record<string, unknown>;
  if (address.userId !== uid) {
    return null;
  }

  return {
    id: snapshot.id,
    ...address,
  };
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const uid = await getUidFromRequest(request);
    const { id } = await params;
    const address = await getAuthorizedAddress(id, uid);

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      address: timestampToSerializable(address),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch address';
    const status = message === 'Missing authorization token' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const uid = await getUidFromRequest(request);
    const { id } = await params;
    const existingAddress = await getAuthorizedAddress(id, uid);

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          action?: string;
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

    if (body?.action === 'set-default') {
      const snapshot = await adminDb.collection('user_addresses').where('userId', '==', uid).get();
      await Promise.all(
        snapshot.docs.map((doc) =>
          doc.ref.set(
            {
              isDefault: doc.id === id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        )
      );

      return NextResponse.json({ success: true });
    }

    const updatePayload = {
      label: body?.label ?? existingAddress.label,
      fullName: body?.fullName ?? existingAddress.fullName,
      phone: body?.phone ?? existingAddress.phone,
      address: body?.address ?? existingAddress.address,
      city: body?.city ?? existingAddress.city,
      state: body?.state ?? existingAddress.state,
      zipCode: body?.zipCode ?? existingAddress.zipCode,
      country: body?.country ?? existingAddress.country,
      isDefault: body?.isDefault ?? existingAddress.isDefault,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await adminDb.collection('user_addresses').doc(id).set(updatePayload, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update address';
    const status = message === 'Missing authorization token' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const uid = await getUidFromRequest(request);
    const { id } = await params;
    const address = await getAuthorizedAddress(id, uid);

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    await adminDb.collection('user_addresses').doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete address';
    const status = message === 'Missing authorization token' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
