import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { PaymentGateway } from './payment_gateways';

const paymentGatewaysCollection = collection(db, 'payment_gateways');

export const createPaymentGateway = async (gateway: Omit<PaymentGateway, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    console.log('createPaymentGateway called with:', gateway);
    // Remove undefined values from gateway object
    const cleanedGateway = JSON.parse(JSON.stringify(gateway, (key, value) => value === undefined ? null : value));
    // Convert null back to undefined for fields we want to omit, or just remove them
    const cleaned = Object.fromEntries(
      Object.entries(cleanedGateway).filter(([, v]) => v !== null && v !== undefined)
    ) as Omit<PaymentGateway, 'id' | 'createdAt' | 'updatedAt'>;
    
    const newGateway: Omit<PaymentGateway, 'id'> = {
      ...cleaned,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    console.log('New gateway object with timestamps:', newGateway);
    console.log('Adding document to collection: payment_gateways');
    const docRef = await addDoc(paymentGatewaysCollection, newGateway);
    console.log('Document added successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('createPaymentGateway error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as { code?: string })?.code,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
};

export const getAllPaymentGateways = async (activeOnly?: boolean, region?: string): Promise<PaymentGateway[]> => {
  let q;
  if (activeOnly) {
    q = query(paymentGatewaysCollection, where('isActive', '==', true), orderBy('name', 'asc'));
  } else {
    q = query(paymentGatewaysCollection, orderBy('name', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  let gateways = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentGateway));
  
  // Filter by region if specified
  if (region) {
    gateways = gateways.filter(g => !g.supportedRegions || g.supportedRegions.length === 0 || g.supportedRegions.includes(region));
  }
  
  return gateways;
};

export const getPaymentGateway = async (id: string): Promise<PaymentGateway | null> => {
  const docRef = doc(db, 'payment_gateways', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as PaymentGateway;
  }
  return null;
};

export const getPaymentGatewayByType = async (type: PaymentGateway['type'], activeOnly: boolean = true): Promise<PaymentGateway | null> => {
  let q;
  if (activeOnly) {
    q = query(
      paymentGatewaysCollection,
      where('type', '==', type),
      where('isActive', '==', true),
      limit(1)
    );
  } else {
    q = query(
      paymentGatewaysCollection,
      where('type', '==', type),
      limit(1)
    );
  }
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as PaymentGateway;
  }
  return null;
};

export const updatePaymentGateway = async (id: string, updates: Partial<Omit<PaymentGateway, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    console.log('updatePaymentGateway called with:', { id, updates });
    // Remove undefined values from updates
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== null && v !== undefined)
    ) as Partial<Omit<PaymentGateway, 'id' | 'createdAt'>>;
    
    const docRef = doc(db, 'payment_gateways', id);
    console.log('Document reference created, updating...');
    const updateData = { ...cleanedUpdates, updatedAt: Timestamp.now() };
    console.log('Update data:', updateData);
    await updateDoc(docRef, updateData);
    console.log('Document updated successfully');
  } catch (error) {
    console.error('updatePaymentGateway error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as { code?: string })?.code,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
};

export const deletePaymentGateway = async (id: string): Promise<void> => {
  const docRef = doc(db, 'payment_gateways', id);
  await deleteDoc(docRef);
};

