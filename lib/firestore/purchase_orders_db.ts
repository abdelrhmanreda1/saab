import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where } from 'firebase/firestore';
import { PurchaseOrder } from './suppliers';

const purchaseOrdersCollectionRef = collection(db, 'purchase_orders');

export const addPurchaseOrder = async (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    orderNumber: order.orderNumber,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    total: order.total,
    status: order.status,
    createdBy: order.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Only add optional fields if they have values
  if (order.expectedDeliveryDate !== undefined && order.expectedDeliveryDate !== null) {
    dataToSave.expectedDeliveryDate = order.expectedDeliveryDate;
  }
  if (order.receivedDate !== undefined && order.receivedDate !== null) {
    dataToSave.receivedDate = order.receivedDate;
  }
  if (order.notes !== undefined && order.notes !== null && order.notes !== '') {
    dataToSave.notes = order.notes;
  }
  
  const newOrderRef = await addDoc(purchaseOrdersCollectionRef, dataToSave);
  return newOrderRef.id;
};

export const getPurchaseOrder = async (id: string): Promise<PurchaseOrder | null> => {
  const orderDocRef = doc(db, 'purchase_orders', id);
  const orderDoc = await getDoc(orderDocRef);
  if (orderDoc.exists()) {
    return { id: orderDoc.id, ...orderDoc.data() } as PurchaseOrder;
  }
  return null;
};

export const getAllPurchaseOrders = async (status?: PurchaseOrder['status']): Promise<PurchaseOrder[]> => {
  let q = query(purchaseOrdersCollectionRef, orderBy('createdAt', 'desc'));
  if (status) {
    q = query(purchaseOrdersCollectionRef, where('status', '==', status), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
};

export const updatePurchaseOrder = async (id: string, order: Partial<Omit<PurchaseOrder, 'id' | 'createdAt'>>): Promise<void> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  
  // Only add fields that are defined
  if (order.orderNumber !== undefined) dataToSave.orderNumber = order.orderNumber;
  if (order.supplierId !== undefined) dataToSave.supplierId = order.supplierId;
  if (order.supplierName !== undefined) dataToSave.supplierName = order.supplierName;
  if (order.items !== undefined) dataToSave.items = order.items;
  if (order.subtotal !== undefined) dataToSave.subtotal = order.subtotal;
  if (order.tax !== undefined) dataToSave.tax = order.tax;
  if (order.shipping !== undefined) dataToSave.shipping = order.shipping;
  if (order.total !== undefined) dataToSave.total = order.total;
  if (order.status !== undefined) dataToSave.status = order.status;
  if (order.createdBy !== undefined) dataToSave.createdBy = order.createdBy;
  
  // Optional fields - only add if they have values
  if (order.expectedDeliveryDate !== undefined && order.expectedDeliveryDate !== null) {
    dataToSave.expectedDeliveryDate = order.expectedDeliveryDate;
  } else if (order.expectedDeliveryDate === null) {
    dataToSave.expectedDeliveryDate = null;
  }
  
  if (order.receivedDate !== undefined && order.receivedDate !== null) {
    dataToSave.receivedDate = order.receivedDate;
  } else if (order.receivedDate === null) {
    dataToSave.receivedDate = null;
  }
  
  if (order.notes !== undefined && order.notes !== null && order.notes !== '') {
    dataToSave.notes = order.notes;
  } else if (order.notes === null || order.notes === '') {
    dataToSave.notes = null;
  }
  
  const orderDocRef = doc(db, 'purchase_orders', id);
  await updateDoc(orderDocRef, dataToSave);
};

export const deletePurchaseOrder = async (id: string): Promise<void> => {
  const orderDocRef = doc(db, 'purchase_orders', id);
  await deleteDoc(orderDocRef);
};

export const generateOrderNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PO-${year}${month}${day}-${random}`;
};

