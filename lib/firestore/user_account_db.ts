import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where } from 'firebase/firestore';
import { UserAddress, ReturnExchangeRequest, Refund, UserPreferences } from './user_account';

// ========== USER ADDRESSES ==========
const addressesCollectionRef = collection(db, 'user_addresses');

export const addUserAddress = async (address: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newAddressRef = await addDoc(addressesCollectionRef, {
    ...address,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newAddressRef.id;
};

export const getUserAddress = async (id: string): Promise<UserAddress | null> => {
  const addressDocRef = doc(db, 'user_addresses', id);
  const addressDoc = await getDoc(addressDocRef);
  if (addressDoc.exists()) {
    return { id: addressDoc.id, ...addressDoc.data() } as UserAddress;
  }
  return null;
};

export const getUserAddresses = async (userId: string): Promise<UserAddress[]> => {
  const q = query(addressesCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAddress));
};

export const updateUserAddress = async (id: string, address: Partial<Omit<UserAddress, 'id' | 'createdAt'>>): Promise<void> => {
  const addressDocRef = doc(db, 'user_addresses', id);
  await updateDoc(addressDocRef, {
    ...address,
    updatedAt: new Date(),
  });
};

export const deleteUserAddress = async (id: string): Promise<void> => {
  const addressDocRef = doc(db, 'user_addresses', id);
  await deleteDoc(addressDocRef);
};

export const setDefaultAddress = async (userId: string, addressId: string): Promise<void> => {
  // First, unset all default addresses for this user
  const userAddresses = await getUserAddresses(userId);
  await Promise.all(
    userAddresses.map(addr => 
      updateUserAddress(addr.id!, { isDefault: false })
    )
  );
  // Then set the selected address as default
  await updateUserAddress(addressId, { isDefault: true });
};

// ========== RETURN/EXCHANGE REQUESTS ==========
const returnRequestsCollectionRef = collection(db, 'return_exchange_requests');

export const addReturnExchangeRequest = async (request: Omit<ReturnExchangeRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newRequestRef = await addDoc(returnRequestsCollectionRef, {
    ...request,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newRequestRef.id;
};

export const getReturnExchangeRequest = async (id: string): Promise<ReturnExchangeRequest | null> => {
  const requestDocRef = doc(db, 'return_exchange_requests', id);
  const requestDoc = await getDoc(requestDocRef);
  if (requestDoc.exists()) {
    return { id: requestDoc.id, ...requestDoc.data() } as ReturnExchangeRequest;
  }
  return null;
};

export const getUserReturnExchangeRequests = async (userId: string): Promise<ReturnExchangeRequest[]> => {
  const q = query(returnRequestsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnExchangeRequest));
};

export const updateReturnExchangeRequest = async (id: string, request: Partial<Omit<ReturnExchangeRequest, 'id' | 'createdAt'>>): Promise<void> => {
  const requestDocRef = doc(db, 'return_exchange_requests', id);
  await updateDoc(requestDocRef, {
    ...request,
    updatedAt: new Date(),
  });
};

// ========== REFUNDS ==========
const refundsCollectionRef = collection(db, 'refunds');

export const addRefund = async (refund: Omit<Refund, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newRefundRef = await addDoc(refundsCollectionRef, {
    ...refund,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newRefundRef.id;
};

export const getRefund = async (id: string): Promise<Refund | null> => {
  const refundDocRef = doc(db, 'refunds', id);
  const refundDoc = await getDoc(refundDocRef);
  if (refundDoc.exists()) {
    return { id: refundDoc.id, ...refundDoc.data() } as Refund;
  }
  return null;
};

export const getUserRefunds = async (userId: string): Promise<Refund[]> => {
  const q = query(refundsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Refund));
};

export const getOrderRefunds = async (orderId: string): Promise<Refund[]> => {
  const q = query(refundsCollectionRef, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Refund));
};

export const updateRefund = async (id: string, refund: Partial<Omit<Refund, 'id' | 'createdAt'>>): Promise<void> => {
  const refundDocRef = doc(db, 'refunds', id);
  await updateDoc(refundDocRef, {
    ...refund,
    updatedAt: new Date(),
  });
};

// ========== USER PREFERENCES ==========
const preferencesCollectionRef = collection(db, 'user_preferences');

export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  const q = query(preferencesCollectionRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as UserPreferences;
};

export const setUserPreferences = async (userId: string, preferences: Omit<UserPreferences, 'id' | 'updatedAt'>): Promise<void> => {
  const existing = await getUserPreferences(userId);
  if (existing) {
    const prefDocRef = doc(db, 'user_preferences', existing.id!);
    await updateDoc(prefDocRef, {
      ...preferences,
      updatedAt: new Date(),
    });
  } else {
    await addDoc(preferencesCollectionRef, {
      ...preferences,
      updatedAt: new Date(),
    });
  }
};

