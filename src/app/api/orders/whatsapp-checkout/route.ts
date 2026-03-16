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

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase Admin is not configured' }, { status: 500 });
    }

    const uid = await getCurrentUid(request);
    const body = await request.json();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const orderData = {
      ...body,
      userId: uid || body.userId || 'anonymous',
      paymentMethod: 'whatsapp',
      status: 'pending',
      paymentIntentId: null,
      createdAt: now,
      updatedAt: now,
    };

    const orderRef = await db.collection('orders').add(orderData);

    if (body.couponCode) {
      const couponQuery = await db
        .collection('coupons')
        .where('code', '==', body.couponCode)
        .limit(1)
        .get();

      if (!couponQuery.empty) {
        const couponDoc = couponQuery.docs[0];
        const usedCount = Number(couponDoc.data().usedCount || 0);
        await couponDoc.ref.update({
          usedCount: usedCount + 1,
          updatedAt: now,
        });
      }
    }

    if (uid && body.shippingAddress) {
      const shippingAddress = body.shippingAddress;
      await db.collection('users').doc(uid).set(
        {
          displayName: shippingAddress.fullName || null,
          email: shippingAddress.email || null,
          phoneNumber: shippingAddress.phone || null,
          address: {
            street: shippingAddress.address || '',
            city: shippingAddress.city || '',
            state: shippingAddress.state || '',
            zipCode: shippingAddress.zipCode || '',
            country: shippingAddress.country || '',
          },
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create WhatsApp order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
