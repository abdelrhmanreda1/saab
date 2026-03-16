import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { OrderNote, OrderHistoryLog, OrderFulfillment, OrderShipment, OrderReturn, OrderRefund } from './order_management';

// ========== ORDER NOTES ==========
const orderNotesCollection = collection(db, 'order_notes');

const generateFulfillmentNumber = (): string => {
  return `FUL-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

const generateShipmentNumber = (): string => {
  return `SHIP-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

const generateReturnNumber = (): string => {
  return `RET-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

const generateRefundNumber = (): string => {
  return `REF-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

export const addOrderNote = async (note: Omit<OrderNote, 'id' | 'createdAt'>): Promise<string> => {
  const newNote: Omit<OrderNote, 'id'> = {
    ...note,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(orderNotesCollection, newNote);
  return docRef.id;
};

export const getOrderNotes = async (orderId: string, internalOnly?: boolean): Promise<OrderNote[]> => {
  let q;
  if (internalOnly !== undefined) {
    q = query(orderNotesCollection, where('orderId', '==', orderId), where('isInternal', '==', internalOnly), orderBy('createdAt', 'desc'));
  } else {
    q = query(orderNotesCollection, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderNote));
};

// ========== ORDER HISTORY LOGS ==========
const orderHistoryCollection = collection(db, 'order_history');

export const addOrderHistoryLog = async (log: Omit<OrderHistoryLog, 'id' | 'createdAt'>): Promise<string> => {
  const newLog: Omit<OrderHistoryLog, 'id'> = {
    ...log,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(orderHistoryCollection, newLog);
  return docRef.id;
};

export const getOrderHistory = async (orderId: string): Promise<OrderHistoryLog[]> => {
  const q = query(orderHistoryCollection, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderHistoryLog));
};

// ========== ORDER FULFILLMENTS ==========
const orderFulfillmentsCollection = collection(db, 'order_fulfillments');

export const createOrderFulfillment = async (fulfillment: Omit<OrderFulfillment, 'id' | 'fulfillmentNumber' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> => {
  const fulfillmentNumber = generateFulfillmentNumber();
  const newFulfillment: Omit<OrderFulfillment, 'id'> = {
    ...fulfillment,
    fulfillmentNumber,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(orderFulfillmentsCollection, newFulfillment);
  return docRef.id;
};

export const getOrderFulfillment = async (id: string): Promise<OrderFulfillment | null> => {
  const docRef = doc(db, 'order_fulfillments', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as OrderFulfillment;
  }
  return null;
};

export const getOrderFulfillments = async (orderId: string): Promise<OrderFulfillment[]> => {
  const q = query(orderFulfillmentsCollection, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderFulfillment));
};

export const updateOrderFulfillment = async (id: string, updates: Partial<Omit<OrderFulfillment, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'order_fulfillments', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

// ========== ORDER SHIPMENTS ==========
const orderShipmentsCollection = collection(db, 'order_shipments');

export const createOrderShipment = async (shipment: Omit<OrderShipment, 'id' | 'shipmentNumber' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> => {
  const shipmentNumber = generateShipmentNumber();
  const newShipment: Omit<OrderShipment, 'id'> = {
    ...shipment,
    shipmentNumber,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(orderShipmentsCollection, newShipment);
  return docRef.id;
};

export const getOrderShipment = async (id: string): Promise<OrderShipment | null> => {
  const docRef = doc(db, 'order_shipments', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as OrderShipment;
  }
  return null;
};

export const getOrderShipments = async (orderId: string): Promise<OrderShipment[]> => {
  const q = query(orderShipmentsCollection, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderShipment));
};

export const updateOrderShipment = async (id: string, updates: Partial<Omit<OrderShipment, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'order_shipments', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

// ========== ORDER RETURNS ==========
const orderReturnsCollection = collection(db, 'order_returns');

export const createOrderReturn = async (returnOrder: Omit<OrderReturn, 'id' | 'returnNumber' | 'createdAt' | 'updatedAt' | 'status' | 'requestedAt'>): Promise<string> => {
  const returnNumber = generateReturnNumber();
  const newReturn: Omit<OrderReturn, 'id'> = {
    ...returnOrder,
    returnNumber,
    status: 'requested',
    requestedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(orderReturnsCollection, newReturn);
  return docRef.id;
};

export const getOrderReturn = async (id: string): Promise<OrderReturn | null> => {
  const docRef = doc(db, 'order_returns', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as OrderReturn;
  }
  return null;
};

export const getOrderReturns = async (orderId?: string): Promise<OrderReturn[]> => {
  let q;
  if (orderId) {
    q = query(orderReturnsCollection, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  } else {
    q = query(orderReturnsCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderReturn));
};

export const updateOrderReturn = async (id: string, updates: Partial<Omit<OrderReturn, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'order_returns', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

// ========== ORDER REFUNDS ==========
const orderRefundsCollection = collection(db, 'order_refunds');

export const createOrderRefund = async (refund: Omit<OrderRefund, 'id' | 'refundNumber' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> => {
  const refundNumber = generateRefundNumber();
  const newRefund: Omit<OrderRefund, 'id'> = {
    ...refund,
    refundNumber,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(orderRefundsCollection, newRefund);
  return docRef.id;
};

export const getOrderRefund = async (id: string): Promise<OrderRefund | null> => {
  const docRef = doc(db, 'order_refunds', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as OrderRefund;
  }
  return null;
};

export const getOrderRefunds = async (orderId?: string): Promise<OrderRefund[]> => {
  let q;
  if (orderId) {
    q = query(orderRefundsCollection, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  } else {
    q = query(orderRefundsCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderRefund));
};

export const updateOrderRefund = async (id: string, updates: Partial<Omit<OrderRefund, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'order_refunds', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

