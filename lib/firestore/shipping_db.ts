import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { ShippingZone, ShippingRate, ShippingCarrier, OrderTracking } from './shipping';

// ========== SHIPPING ZONES ==========
const zonesCollectionRef = collection(db, 'shipping_zones');

export const addShippingZone = async (zone: Omit<ShippingZone, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newZoneRef = await addDoc(zonesCollectionRef, {
    ...zone,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newZoneRef.id;
};

export const getShippingZone = async (id: string): Promise<ShippingZone | null> => {
  const zoneDocRef = doc(db, 'shipping_zones', id);
  const zoneDoc = await getDoc(zoneDocRef);
  if (zoneDoc.exists()) {
    return { id: zoneDoc.id, ...zoneDoc.data() } as ShippingZone;
  }
  return null;
};

export const getAllShippingZones = async (activeOnly?: boolean): Promise<ShippingZone[]> => {
  let q = query(zonesCollectionRef, orderBy('createdAt', 'desc'));
  if (activeOnly) {
    q = query(zonesCollectionRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingZone));
};

export const updateShippingZone = async (id: string, zone: Partial<Omit<ShippingZone, 'id' | 'createdAt'>>): Promise<void> => {
  const zoneDocRef = doc(db, 'shipping_zones', id);
  await updateDoc(zoneDocRef, {
    ...zone,
    updatedAt: new Date(),
  });
};

export const deleteShippingZone = async (id: string): Promise<void> => {
  const zoneDocRef = doc(db, 'shipping_zones', id);
  await deleteDoc(zoneDocRef);
};

// ========== SHIPPING RATES ==========
const ratesCollectionRef = collection(db, 'shipping_rates');

export const addShippingRate = async (rate: Omit<ShippingRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Remove undefined values as Firestore doesn't accept them
  const cleanRate: Record<string, unknown> = {
    ...rate,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Remove undefined fields
  Object.keys(cleanRate).forEach(key => {
    if (cleanRate[key] === undefined) {
      delete cleanRate[key];
    }
  });
  
  const newRateRef = await addDoc(ratesCollectionRef, cleanRate);
  return newRateRef.id;
};

export const getShippingRate = async (id: string): Promise<ShippingRate | null> => {
  const rateDocRef = doc(db, 'shipping_rates', id);
  const rateDoc = await getDoc(rateDocRef);
  if (rateDoc.exists()) {
    return { id: rateDoc.id, ...rateDoc.data() } as ShippingRate;
  }
  return null;
};

export const getAllShippingRates = async (zoneId?: string, activeOnly?: boolean): Promise<ShippingRate[]> => {
  let q = query(ratesCollectionRef, orderBy('createdAt', 'desc'));
  if (zoneId) {
    q = query(ratesCollectionRef, where('zoneId', '==', zoneId), orderBy('createdAt', 'desc'));
  }
  if (activeOnly) {
    const baseQuery = zoneId 
      ? query(ratesCollectionRef, where('zoneId', '==', zoneId), where('isActive', '==', true))
      : query(ratesCollectionRef, where('isActive', '==', true));
    q = query(baseQuery, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRate));
};

export const updateShippingRate = async (id: string, rate: Partial<Omit<ShippingRate, 'id' | 'createdAt'>>): Promise<void> => {
  // Remove undefined values as Firestore doesn't accept them
  const cleanRate: Record<string, unknown> = {
    ...rate,
    updatedAt: new Date(),
  };
  
  // Remove undefined fields
  Object.keys(cleanRate).forEach(key => {
    if (cleanRate[key] === undefined) {
      delete cleanRate[key];
    }
  });
  
  const rateDocRef = doc(db, 'shipping_rates', id);
  await updateDoc(rateDocRef, cleanRate);
};

export const deleteShippingRate = async (id: string): Promise<void> => {
  const rateDocRef = doc(db, 'shipping_rates', id);
  await deleteDoc(rateDocRef);
};

// Calculate shipping cost based on zone, weight, and order value
export const calculateShippingCost = async (
  zoneId: string,
  weight: number,
  orderValue: number
): Promise<{ rate: ShippingRate | null; cost: number }> => {
  const rates = await getAllShippingRates(zoneId, true);
  
  for (const rate of rates) {
    if (rate.rateType === 'free' && rate.freeShippingThreshold && orderValue >= rate.freeShippingThreshold) {
      return { rate, cost: 0 };
    }
    
    if (rate.rateType === 'flat' && rate.flatRate !== undefined) {
      return { rate, cost: rate.flatRate };
    }
    
    if (rate.rateType === 'weight_based' && rate.weightRanges) {
      for (const range of rate.weightRanges) {
        if (weight >= range.minWeight && weight <= range.maxWeight) {
          return { rate, cost: range.rate };
        }
      }
    }
    
    if (rate.rateType === 'price_based' && rate.priceRanges) {
      for (const range of rate.priceRanges) {
        if (orderValue >= range.minPrice && orderValue <= range.maxPrice) {
          return { rate, cost: range.rate };
        }
      }
    }
  }
  
  return { rate: null, cost: 0 };
};

// ========== SHIPPING CARRIERS ==========
const carriersCollectionRef = collection(db, 'shipping_carriers');

export const addShippingCarrier = async (carrier: Omit<ShippingCarrier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newCarrierRef = await addDoc(carriersCollectionRef, {
    ...carrier,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newCarrierRef.id;
};

export const getShippingCarrier = async (id: string): Promise<ShippingCarrier | null> => {
  const carrierDocRef = doc(db, 'shipping_carriers', id);
  const carrierDoc = await getDoc(carrierDocRef);
  if (carrierDoc.exists()) {
    return { id: carrierDoc.id, ...carrierDoc.data() } as ShippingCarrier;
  }
  return null;
};

export const getShippingCarrierByCode = async (code: string): Promise<ShippingCarrier | null> => {
  const q = query(carriersCollectionRef, where('code', '==', code), where('isActive', '==', true));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as ShippingCarrier;
};

export const getAllShippingCarriers = async (activeOnly?: boolean): Promise<ShippingCarrier[]> => {
  let q = query(carriersCollectionRef, orderBy('createdAt', 'desc'));
  if (activeOnly) {
    q = query(carriersCollectionRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingCarrier));
};

export const updateShippingCarrier = async (id: string, carrier: Partial<Omit<ShippingCarrier, 'id' | 'createdAt'>>): Promise<void> => {
  const carrierDocRef = doc(db, 'shipping_carriers', id);
  await updateDoc(carrierDocRef, {
    ...carrier,
    updatedAt: new Date(),
  });
};

export const deleteShippingCarrier = async (id: string): Promise<void> => {
  const carrierDocRef = doc(db, 'shipping_carriers', id);
  await deleteDoc(carrierDocRef);
};

// ========== ORDER TRACKING ==========
const trackingCollectionRef = collection(db, 'order_tracking');

export const addOrderTracking = async (tracking: Omit<OrderTracking, 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTrackingRef = await addDoc(trackingCollectionRef, {
    ...tracking,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newTrackingRef.id;
};

export const getOrderTracking = async (orderId: string): Promise<OrderTracking | null> => {
  const q = query(trackingCollectionRef, where('orderId', '==', orderId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const docData = querySnapshot.docs[0].data();
  return { 
    id: querySnapshot.docs[0].id, 
    ...docData 
  } as unknown as OrderTracking;
};

export const updateOrderTracking = async (orderId: string, tracking: Partial<Omit<OrderTracking, 'orderId' | 'createdAt'>>): Promise<void> => {
  const existing = await getOrderTracking(orderId);
  if (!existing) {
    await addOrderTracking({
      orderId,
      ...tracking,
    } as Omit<OrderTracking, 'createdAt' | 'updatedAt'>);
  } else {
    const trackingDocRef = doc(db, 'order_tracking', existing.id!);
    await updateDoc(trackingDocRef, {
      ...tracking,
      updatedAt: new Date(),
    });
  }
};

export const updateTrackingNumber = async (
  orderId: string,
  trackingNumber: string,
  carrierId?: string,
  carrierName?: string,
  carrierCode?: string
): Promise<void> => {
  await updateOrderTracking(orderId, {
    trackingNumber,
    carrierId,
    carrierName,
    carrierCode,
    lastUpdate: Timestamp.now(),
  });
};

