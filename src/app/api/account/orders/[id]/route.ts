import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { OrderStatus } from '@/lib/firestore/orders';

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

type SerializableTimestamp = {
  seconds: number;
  nanoseconds: number;
};

type AuthContext = {
  uid: string;
  emailCandidates: string[];
  phoneCandidates: string[];
};

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();
const normalizePhone = (value?: string | null) => (value || '').replace(/[^\d+]/g, '').trim();

const timestampToSerializable = (value: unknown): SerializableTimestamp | unknown => {
  if (value instanceof admin.firestore.Timestamp) {
    return {
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  return value;
};

const serializeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === 'object') {
    const timestampCandidate = timestampToSerializable(value);
    if (timestampCandidate !== value) {
      return timestampCandidate;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        serializeValue(nestedValue),
      ])
    );
  }

  return value;
};

const getAuthContext = async (request: NextRequest): Promise<AuthContext> => {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    throw new Error('Missing authorization token');
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const uid = decodedToken.uid;
  const [userRecord, profileSnapshot] = await Promise.all([
    admin.auth().getUser(uid).catch(() => null),
    adminDb!.collection('users').doc(uid).get(),
  ]);

  const profileData = profileSnapshot.exists ? profileSnapshot.data() : {};

  return {
    uid,
    emailCandidates: Array.from(
      new Set(
        [
          normalizeEmail(userRecord?.email),
          normalizeEmail((profileData?.email as string | undefined) || decodedToken.email),
        ].filter(Boolean)
      )
    ),
    phoneCandidates: Array.from(
      new Set(
        [
          normalizePhone(userRecord?.phoneNumber),
          normalizePhone((profileData?.phoneNumber as string | undefined) || decodedToken.phone_number),
        ].filter(Boolean)
      )
    ),
  };
};

const orderBelongsToUser = (
  orderData: admin.firestore.DocumentData,
  authContext: AuthContext
) => {
  const existingUserId = typeof orderData.userId === 'string' ? orderData.userId : '';
  if (existingUserId === authContext.uid) {
    return true;
  }

  const orderEmail = normalizeEmail(orderData?.shippingAddress?.email as string | undefined);
  if (orderEmail && authContext.emailCandidates.includes(orderEmail)) {
    return true;
  }

  const orderPhone = normalizePhone(orderData?.shippingAddress?.phone as string | undefined);
  return !!orderPhone && authContext.phoneCandidates.includes(orderPhone);
};

type AuthorizedOrder = admin.firestore.DocumentData & { id: string };

const getAuthorizedOrder = async (
  orderId: string,
  authContext: AuthContext
): Promise<AuthorizedOrder | null> => {
  const orderRef = adminDb!.collection('orders').doc(orderId);
  const orderSnapshot = await orderRef.get();

  if (!orderSnapshot.exists) {
    return null;
  }

  const orderData = orderSnapshot.data() || {};
  if (!orderBelongsToUser(orderData, authContext)) {
    return null;
  }

  const existingUserId = typeof orderData.userId === 'string' ? orderData.userId : '';
  if (existingUserId !== authContext.uid) {
    await orderRef.set(
      {
        userId: authContext.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    orderData.userId = authContext.uid;
  }

  return {
    id: orderSnapshot.id,
    ...orderData,
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

    const { id } = await params;
    const authContext = await getAuthContext(request);
    const order = await getAuthorizedOrder(id, authContext);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: serializeValue(order),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch order';
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

    const { id } = await params;
    const authContext = await getAuthContext(request);
    const order = await getAuthorizedOrder(id, authContext);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
    if (body.action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'Unsupported action' },
        { status: 400 }
      );
    }

    if (order.status === OrderStatus.Cancelled) {
      return NextResponse.json(
        { success: false, error: 'Order is already cancelled' },
        { status: 400 }
      );
    }

    if (order.status === OrderStatus.Delivered) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a delivered order' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: OrderStatus.Cancelled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: authContext.uid,
    };

    if (body.reason) {
      updateData.cancellationReason = body.reason;
    }

    await adminDb.collection('orders').doc(id).set(updateData, { merge: true });

    return NextResponse.json({
      success: true,
      order: {
        id,
        status: OrderStatus.Cancelled,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update order';
    const status = message === 'Missing authorization token' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
