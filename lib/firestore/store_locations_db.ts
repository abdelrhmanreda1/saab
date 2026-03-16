import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { StoreLocation } from './store_locations';

const storeLocationsCollection = collection(db, 'store_locations');

export const createStoreLocation = async (location: Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Filter out undefined values before saving to Firestore
  const locationData: Record<string, unknown> = {
    name: location.name,
    address: location.address,
    city: location.city,
    state: location.state,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    isActive: location.isActive,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Only include optional fields if they are defined
  if (location.zipCode !== undefined && location.zipCode !== null && location.zipCode !== '') {
    locationData.zipCode = location.zipCode;
  }
  if (location.phone !== undefined && location.phone !== null && location.phone !== '') {
    locationData.phone = location.phone;
  }
  if (location.email !== undefined && location.email !== null && location.email !== '') {
    locationData.email = location.email;
  }
  if (location.description !== undefined && location.description !== null && location.description !== '') {
    locationData.description = location.description;
  }
  if (location.openingHours !== undefined && location.openingHours !== null) {
    locationData.openingHours = location.openingHours;
  }

  const docRef = await addDoc(storeLocationsCollection, locationData);
  return docRef.id;
};

export const getStoreLocation = async (id: string): Promise<StoreLocation | null> => {
  const docRef = doc(db, 'store_locations', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as StoreLocation;
  }
  return null;
};

export const getAllStoreLocations = async (activeOnly: boolean = false): Promise<StoreLocation[]> => {
  let q;
  if (activeOnly) {
    q = query(storeLocationsCollection, where('isActive', '==', true), orderBy('name', 'asc'));
  } else {
    q = query(storeLocationsCollection, orderBy('name', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreLocation));
};

export const updateStoreLocation = async (id: string, updates: Partial<Omit<StoreLocation, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'store_locations', id);
  
  // Filter out undefined values before updating
  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  // Only include defined fields
  Object.keys(updates).forEach(key => {
    const value = (updates as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) {
      // For optional string fields, also check if not empty string
      if (['zipCode', 'phone', 'email', 'description'].includes(key)) {
        if (value !== '') {
          updateData[key] = value;
        } else {
          // Set to null to remove the field
          updateData[key] = null;
        }
      } else {
        updateData[key] = value;
      }
    }
  });

  await updateDoc(docRef, updateData);
};

export const deleteStoreLocation = async (id: string): Promise<void> => {
  const docRef = doc(db, 'store_locations', id);
  await deleteDoc(docRef);
};

