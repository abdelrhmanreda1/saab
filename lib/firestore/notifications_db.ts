import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, doc, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { EmailNotification, PushNotification, ChatMessage, ChatSession } from './notifications';
import { Order } from './orders';
import { getDefaultCurrency } from './internationalization_db';

// ========== EMAIL NOTIFICATIONS ==========
const emailNotificationsCollectionRef = collection(db, 'email_notifications');

export const addEmailNotification = async (notification: Omit<EmailNotification, 'id' | 'createdAt' | 'sentAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    userId: notification.userId,
    type: notification.type,
    subject: notification.subject,
    body: notification.body,
    sent: false,
    createdAt: new Date(),
  };
  
  // Only add optional fields if they have values
  if (notification.orderId !== undefined && notification.orderId !== null && notification.orderId !== '') {
    dataToSave.orderId = notification.orderId;
  }
  
  const newNotificationRef = await addDoc(emailNotificationsCollectionRef, dataToSave);
  return newNotificationRef.id;
};

export const markEmailNotificationSent = async (id: string): Promise<void> => {
  const notificationDocRef = doc(db, 'email_notifications', id);
  await updateDoc(notificationDocRef, {
    sent: true,
    sentAt: new Date(),
  });
};

export const getUserEmailNotifications = async (userId: string): Promise<EmailNotification[]> => {
  const q = query(emailNotificationsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailNotification));
};

// ========== PUSH NOTIFICATIONS ==========
const pushNotificationsCollectionRef = collection(db, 'push_notifications');

export const addPushNotification = async (notification: Omit<PushNotification, 'id' | 'createdAt' | 'sentAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    sent: false,
    createdAt: new Date(),
  };
  
  // Only add optional fields if they have values
  if (notification.data !== undefined && notification.data !== null && Object.keys(notification.data).length > 0) {
    dataToSave.data = notification.data;
  }
  
  const newNotificationRef = await addDoc(pushNotificationsCollectionRef, dataToSave);
  return newNotificationRef.id;
};

export const markPushNotificationSent = async (id: string): Promise<void> => {
  const notificationDocRef = doc(db, 'push_notifications', id);
  await updateDoc(notificationDocRef, {
    sent: true,
    sentAt: new Date(),
  });
};

export const getUserPushNotifications = async (userId: string): Promise<PushNotification[]> => {
  const q = query(pushNotificationsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PushNotification));
};

// ========== LIVE CHAT ==========
const chatSessionsCollectionRef = collection(db, 'chat_sessions');

export const createChatSession = async (session: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt' | 'messages'>): Promise<string> => {
  try {
    // Filter out undefined values before saving to Firestore
    const sessionData: Record<string, unknown> = {
      userId: session.userId,
      userName: session.userName,
      status: session.status,
      messages: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    // Only include optional fields if they are defined
    if (session.userEmail !== undefined && session.userEmail !== null) {
      sessionData.userEmail = session.userEmail;
    }
    if (session.userPhone !== undefined && session.userPhone !== null) {
      sessionData.userPhone = session.userPhone;
    }
    if (session.isGuest !== undefined) {
      sessionData.isGuest = session.isGuest;
    }
    if (session.lastMessage !== undefined && session.lastMessage !== null) {
      sessionData.lastMessage = session.lastMessage;
    }
    if (session.lastMessageAt !== undefined && session.lastMessageAt !== null) {
      sessionData.lastMessageAt = session.lastMessageAt;
    }
    
    const newSessionRef = await addDoc(chatSessionsCollectionRef, sessionData);
    return newSessionRef.id;
  } catch (error: unknown) {
    // Failed to create chat session
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create chat session: ${errorMessage}`);
  }
};

export const getChatSession = async (id: string): Promise<ChatSession | null> => {
  const sessionDocRef = doc(db, 'chat_sessions', id);
  const sessionDoc = await getDoc(sessionDocRef);
  if (sessionDoc.exists()) {
    return { id: sessionDoc.id, ...sessionDoc.data() } as ChatSession;
  }
  return null;
};

export const getUserChatSession = async (userId: string): Promise<ChatSession | null> => {
  const q = query(chatSessionsCollectionRef, where('userId', '==', userId), where('status', '==', 'active'), orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as ChatSession;
};

export const getAllChatSessions = async (): Promise<ChatSession[]> => {
  const q = query(chatSessionsCollectionRef, orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ChatSession[];
};

export const addChatMessage = async (sessionId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<void> => {
  const sessionDocRef = doc(db, 'chat_sessions', sessionId);
  const session = await getChatSession(sessionId);
  if (session) {
    // Filter out undefined values
    const newMessage: Record<string, unknown> = {
      userId: message.userId,
      userName: message.userName,
      message: message.message,
      isAdmin: message.isAdmin,
      read: message.read,
      createdAt: Timestamp.now(),
    };
    
    // Only include optional fields if they are defined
    if (message.adminId !== undefined) newMessage.adminId = message.adminId;
    if (message.adminName !== undefined) newMessage.adminName = message.adminName;
    if (message.images !== undefined && message.images.length > 0) newMessage.images = message.images;
    if (message.productId !== undefined) newMessage.productId = message.productId;
    if (message.productName !== undefined) newMessage.productName = message.productName;
    if (message.productImage !== undefined) newMessage.productImage = message.productImage;
    if (message.productUrl !== undefined) newMessage.productUrl = message.productUrl;
    
    await updateDoc(sessionDocRef, {
      messages: [...(session.messages || []), newMessage],
      lastMessage: message.message || (message.productName ? `Product: ${message.productName}` : ''),
      lastMessageAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
};

export const updateChatSession = async (id: string, session: Partial<Omit<ChatSession, 'id' | 'createdAt'>>): Promise<void> => {
  const sessionDocRef = doc(db, 'chat_sessions', id);
  // Filter out undefined values
  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  // Only include defined fields
  Object.keys(session).forEach(key => {
    const value = (session as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) {
      updateData[key] = value;
    }
  });
  
  await updateDoc(sessionDocRef, updateData);
};

// Helper function to send order status update emails
export const sendOrderStatusEmail = async (
  userId: string,
  orderId: string,
  status: string,
  orderDetails: Order
): Promise<void> => {
  const subject = `Order ${status.charAt(0).toUpperCase() + status.slice(1)} - Order #${orderId.slice(0, 8)}`;
  const body = await generateOrderStatusEmailBody(status, orderDetails);
  
  // Map status to valid notification type
  const notificationTypeMap: Record<string, EmailNotification['type']> = {
    'pending': 'order_confirmation',
    'processing': 'order_confirmation',
    'shipped': 'order_shipped',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancelled',
  };
  
  await addEmailNotification({
    userId,
    type: notificationTypeMap[status] || 'order_confirmation',
    subject,
    body,
    orderId,
    sent: false,
  });
  
  // In production, you would trigger an email sending service here
  // For now, we just create the notification record
};

const formatCurrency = (amount: number, currency: { symbol: string; symbolPosition: 'left' | 'right'; decimalPlaces: number } | null): string => {
  if (!currency) {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  const formattedAmount = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency.decimalPlaces || 0,
  });

  if (currency.symbolPosition === 'right') {
    return `${formattedAmount} ${currency.symbol}`;
  } else {
    return `${currency.symbol} ${formattedAmount}`;
  }
};

const generateOrderStatusEmailBody = async (status: string, orderDetails: Order): Promise<string> => {
  const defaultCurrency = await getDefaultCurrency();
  const formattedTotal = formatCurrency(orderDetails.totalAmount, defaultCurrency);
  
  return `
    <h2>Order ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
    <p>Your order has been ${status}.</p>
    <p>Order ID: ${orderDetails.id}</p>
    <p>Total: ${formattedTotal}</p>
    <p>Thank you for shopping with us!</p>
  `;
};

