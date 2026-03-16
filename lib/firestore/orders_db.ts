import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Order, OrderStatus } from './orders';
import { logActivity } from '../utils/activityLogger';

const ordersCollectionRef = collection(db, 'orders');

export const addOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newOrderRef = await addDoc(ordersCollectionRef, { ...order, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  
  // Log activity
  await logActivity('order.created', 'orders', newOrderRef.id, {
    orderTotal: order.totalAmount,
    status: order.status,
  });
  
  return newOrderRef.id;
};

export const getOrder = async (id: string): Promise<Order | null> => {
  const orderDocRef = doc(db, 'orders', id);
  const orderSnapshot = await getDoc(orderDocRef);
  if (orderSnapshot.exists()) {
    return { id: orderSnapshot.id, ...orderSnapshot.data() } as Order;
  }
  return null;
};

export const getAllOrders = async (): Promise<Order[]> => {
  const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

export const getOrdersByUserId = async (userId: string): Promise<Order[]> => {
  const q = query(ordersCollectionRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

export const updateOrder = async (id: string, order: Partial<Order>): Promise<void> => {
  const orderDocRef = doc(db, 'orders', id);
  const existingOrder = await getOrder(id);
  
  await updateDoc(orderDocRef, { ...order, updatedAt: Timestamp.now() });
  
  // Log activity
  await logActivity('order.updated', 'orders', id, {
    fieldsUpdated: Object.keys(order),
    statusChanged: order.status ? order.status !== existingOrder?.status : false,
    newStatus: order.status,
  });
};

export const updateOrderStatus = async (id: string, status: Order['status']): Promise<void> => {
  const docRef = doc(db, 'orders', id);
  const existingOrder = await getOrder(id);
  
  await updateDoc(docRef, { status, updatedAt: Timestamp.now() });
  
  // Log activity
  await logActivity('order.status_changed', 'orders', id, {
    previousStatus: existingOrder?.status,
    newStatus: status,
  });
};

export const deleteOrder = async (id: string): Promise<void> => {
  const orderDocRef = doc(db, 'orders', id);
  await deleteDoc(orderDocRef);
};

export const cancelOrder = async (id: string, reason?: string, userId?: string): Promise<void> => {
  if (!id) {
    throw new Error('Order ID is required');
  }

  const existingOrder = await getOrder(id);
  
  if (!existingOrder) {
    throw new Error('Order not found');
  }

  // Check if order can be cancelled
  if (existingOrder.status === OrderStatus.Cancelled) {
    throw new Error('Order is already cancelled');
  }

  if (existingOrder.status === OrderStatus.Delivered) {
    throw new Error('Cannot cancel a delivered order');
  }

  // Check if user owns the order (if userId provided)
  if (userId && existingOrder.userId !== userId) {
    throw new Error('You do not have permission to cancel this order');
  }

  const orderDocRef = doc(db, 'orders', id);
  
  try {
    const updateData: {
      status: OrderStatus;
      updatedAt: Timestamp;
      cancellationReason?: string;
      cancelledAt: Timestamp;
    } = {
      status: OrderStatus.Cancelled,
      updatedAt: Timestamp.now(),
      cancelledAt: Timestamp.now(),
    };

    // Only include cancellationReason if reason is provided
    if (reason) {
      updateData.cancellationReason = reason;
    }

    await updateDoc(orderDocRef, updateData);
    
    // Log activity
    await logActivity('order.cancelled', 'orders', id, {
      reason,
      orderTotal: existingOrder?.totalAmount,
    });
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    
    if (errorObj.code === 'permission-denied') {
      throw new Error('Permission denied. You do not have permission to cancel this order. Please contact support.');
    } else if (errorObj.code === 'not-found') {
      throw new Error('Order not found');
    } else {
      throw new Error(errorObj.message || 'Failed to cancel order. Please try again or contact support.');
    }
  }
};
