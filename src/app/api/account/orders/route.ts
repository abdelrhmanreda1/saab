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

type SerializableTimestamp = {
  seconds: number;
  nanoseconds: number;
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

const addOrderToMap = (
  ordersMap: Map<string, admin.firestore.DocumentData>,
  snapshot: admin.firestore.QuerySnapshot
) => {
  snapshot.docs.forEach((doc) => {
    ordersMap.set(doc.id, {
      id: doc.id,
      ...doc.data(),
    });
  });
};

export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
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
    const uid = decodedToken.uid;

    const [userRecord, profileSnapshot] = await Promise.all([
      admin.auth().getUser(uid).catch(() => null),
      adminDb.collection('users').doc(uid).get(),
    ]);

    const profileData = profileSnapshot.exists ? profileSnapshot.data() : {};
    const emailCandidates = Array.from(
      new Set(
        [
          normalizeEmail(userRecord?.email),
          normalizeEmail((profileData?.email as string | undefined) || decodedToken.email),
        ].filter(Boolean)
      )
    );
    const phoneCandidates = Array.from(
      new Set(
        [
          normalizePhone(userRecord?.phoneNumber),
          normalizePhone((profileData?.phoneNumber as string | undefined) || decodedToken.phone_number),
        ].filter(Boolean)
      )
    );

    const ordersMap = new Map<string, admin.firestore.DocumentData>();

    const directOrdersSnapshot = await adminDb
      .collection('orders')
      .where('userId', '==', uid)
      .get();
    addOrderToMap(ordersMap, directOrdersSnapshot);

    for (const email of emailCandidates) {
      const emailOrdersSnapshot = await adminDb
        .collection('orders')
        .where('shippingAddress.email', '==', email)
        .get();
      addOrderToMap(ordersMap, emailOrdersSnapshot);
    }

    for (const phone of phoneCandidates) {
      const phoneOrdersSnapshot = await adminDb
        .collection('orders')
        .where('shippingAddress.phone', '==', phone)
        .get();
      addOrderToMap(ordersMap, phoneOrdersSnapshot);
    }

    const orders = Array.from(ordersMap.values());

    await Promise.all(
      orders.map(async (order) => {
        const existingUserId = typeof order.userId === 'string' ? order.userId : '';
        if (existingUserId && existingUserId !== 'anonymous' && existingUserId === uid) {
          return;
        }

        const matchesEmail = emailCandidates.includes(
          normalizeEmail(order?.shippingAddress?.email as string | undefined)
        );
        const matchesPhone = phoneCandidates.includes(
          normalizePhone(order?.shippingAddress?.phone as string | undefined)
        );

        if (!matchesEmail && !matchesPhone) {
          return;
        }

        await adminDb
          .collection('orders')
          .doc(order.id)
          .set(
            {
              userId: uid,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        order.userId = uid;
      })
    );

    orders.sort((a, b) => {
      const aSeconds =
        a?.createdAt instanceof admin.firestore.Timestamp
          ? a.createdAt.seconds
          : Number(a?.createdAt?.seconds || 0);
      const bSeconds =
        b?.createdAt instanceof admin.firestore.Timestamp
          ? b.createdAt.seconds
          : Number(b?.createdAt?.seconds || 0);

      return bSeconds - aSeconds;
    });

    return NextResponse.json({
      success: true,
      orders: orders.map((order) => serializeValue(order)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch orders';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
