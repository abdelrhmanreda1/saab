import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { getAllUsers } from './users';
import { getAllOrders } from './orders_db';
import { CustomerSegment, CustomerSegmentRule, CustomerTag, CustomerNote, CustomerCommunication, CustomerLifetimeValue } from './customer_management';

// ========== CUSTOMER SEGMENTATION ==========
const customerSegmentsCollectionRef = collection(db, 'customer_segments');

export const addCustomerSegmentRule = async (rule: Omit<CustomerSegmentRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Prepare conditions object, removing undefined values
  const conditions: Record<string, unknown> = {};
  if (rule.conditions.minOrders !== undefined && rule.conditions.minOrders !== null) {
    conditions.minOrders = rule.conditions.minOrders;
  }
  if (rule.conditions.minSpent !== undefined && rule.conditions.minSpent !== null) {
    conditions.minSpent = rule.conditions.minSpent;
  }
  if (rule.conditions.maxDaysSinceLastOrder !== undefined && rule.conditions.maxDaysSinceLastOrder !== null) {
    conditions.maxDaysSinceLastOrder = rule.conditions.maxDaysSinceLastOrder;
  }
  if (rule.conditions.minAverageOrderValue !== undefined && rule.conditions.minAverageOrderValue !== null) {
    conditions.minAverageOrderValue = rule.conditions.minAverageOrderValue;
  }
  if (rule.conditions.tags !== undefined && rule.conditions.tags !== null && Array.isArray(rule.conditions.tags) && rule.conditions.tags.length > 0) {
    conditions.tags = rule.conditions.tags;
  }
  
  const newRuleRef = await addDoc(customerSegmentsCollectionRef, {
    name: rule.name,
    segment: rule.segment,
    conditions,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return newRuleRef.id;
};

export const getAllCustomerSegmentRules = async (): Promise<CustomerSegmentRule[]> => {
  const querySnapshot = await getDocs(query(customerSegmentsCollectionRef, orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerSegmentRule));
};

export const updateCustomerSegmentRule = async (id: string, rule: Partial<Omit<CustomerSegmentRule, 'id' | 'createdAt'>>): Promise<void> => {
  const ruleDocRef = doc(db, 'customer_segments', id);
  await updateDoc(ruleDocRef, {
    ...rule,
    updatedAt: Timestamp.now(),
  });
};

export const deleteCustomerSegmentRule = async (id: string): Promise<void> => {
  const ruleDocRef = doc(db, 'customer_segments', id);
  await deleteDoc(ruleDocRef);
};

export const segmentCustomer = async (userId: string): Promise<CustomerSegment> => {
  const orders = await getAllOrders();
  const userOrders = orders.filter(o => o.userId === userId);
  
  if (userOrders.length === 0) {
    return CustomerSegment.New;
  }

  const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const lastOrderDate = userOrders.sort((a, b) => 
    b.createdAt.seconds - a.createdAt.seconds
  )[0].createdAt.toDate();
  const daysSinceLastOrder = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

  // Segmentation logic
  if (totalSpent > 50000 && userOrders.length > 5) {
    return CustomerSegment.VIP;
  }
  if (totalSpent > 20000) {
    return CustomerSegment.HighValue;
  }
  if (userOrders.length > 10) {
    return CustomerSegment.Frequent;
  }
  if (daysSinceLastOrder > 90) {
    return CustomerSegment.Inactive;
  }
  if (userOrders.length === 1) {
    return CustomerSegment.OneTime;
  }
  if (totalSpent > 5000) {
    return CustomerSegment.Regular;
  }

  return CustomerSegment.New;
};

export const segmentAllCustomers = async (): Promise<{ [userId: string]: CustomerSegment }> => {
  const users = await getAllUsers();
  const segments: { [userId: string]: CustomerSegment } = {};

  for (const user of users) {
    if (user.role !== 'admin') {
      segments[user.uid] = await segmentCustomer(user.uid);
    }
  }

  return segments;
};

// ========== CUSTOMER LIFETIME VALUE ==========
export const calculateCustomerLifetimeValue = async (userId: string): Promise<CustomerLifetimeValue> => {
  const orders = await getAllOrders();
  const userOrders = orders.filter(o => o.userId === userId && (o.status === 'delivered' || o.status === 'shipped'));

  if (userOrders.length === 0) {
    return {
      userId,
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      firstOrderDate: Timestamp.now(),
      lastOrderDate: Timestamp.now(),
      customerAge: 0,
      predictedCLV: 0,
      calculatedAt: Timestamp.now(),
    };
  }

  const totalRevenue = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = userOrders.length;
  const averageOrderValue = totalRevenue / totalOrders;

  const sortedOrders = userOrders.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
  const firstOrderDate = sortedOrders[0].createdAt;
  const lastOrderDate = sortedOrders[sortedOrders.length - 1].createdAt;

  const customerAge = Math.floor((lastOrderDate.seconds - firstOrderDate.seconds) / (60 * 60 * 24));
  const averageDaysBetweenOrders = customerAge > 0 ? customerAge / totalOrders : 0;
  
  // Simple CLV prediction: average order value * expected orders per year * customer lifespan (assumed 2 years)
  const ordersPerYear = averageDaysBetweenOrders > 0 ? 365 / averageDaysBetweenOrders : totalOrders;
  const predictedCLV = averageOrderValue * ordersPerYear * 2;

  return {
    userId,
    totalRevenue,
    totalOrders,
    averageOrderValue,
    firstOrderDate,
    lastOrderDate,
    customerAge,
    predictedCLV,
    calculatedAt: Timestamp.now(),
  };
};

// ========== CUSTOMER TAGS ==========
const customerTagsCollectionRef = collection(db, 'customer_tags');

export const addCustomerTag = async (tag: Omit<CustomerTag, 'id' | 'createdAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    name: tag.name,
    createdAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (tag.color !== undefined && tag.color !== null && tag.color !== '') {
    dataToSave.color = tag.color;
  }
  if (tag.description !== undefined && tag.description !== null && tag.description !== '') {
    dataToSave.description = tag.description;
  }
  
  const newTagRef = await addDoc(customerTagsCollectionRef, dataToSave);
  return newTagRef.id;
};

export const getCustomerTag = async (id: string): Promise<CustomerTag | null> => {
  const tagDocRef = doc(db, 'customer_tags', id);
  const tagDoc = await getDoc(tagDocRef);
  if (tagDoc.exists()) {
    return { id: tagDoc.id, ...tagDoc.data() } as CustomerTag;
  }
  return null;
};

export const getAllCustomerTags = async (): Promise<CustomerTag[]> => {
  const querySnapshot = await getDocs(query(customerTagsCollectionRef, orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerTag));
};

export const updateCustomerTag = async (id: string, tag: Partial<Omit<CustomerTag, 'id' | 'createdAt'>>): Promise<void> => {
  const tagDocRef = doc(db, 'customer_tags', id);
  await updateDoc(tagDocRef, tag);
};

export const deleteCustomerTag = async (id: string): Promise<void> => {
  const tagDocRef = doc(db, 'customer_tags', id);
  await deleteDoc(tagDocRef);
};

export const addTagToCustomer = async (userId: string, tagId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (userDoc.exists()) {
    const currentTags = userDoc.data().tags || [];
    if (!currentTags.includes(tagId)) {
      await updateDoc(userRef, {
        tags: [...currentTags, tagId],
        updatedAt: Timestamp.now(),
      });
    }
  }
};

export const removeTagFromCustomer = async (userId: string, tagId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (userDoc.exists()) {
    const currentTags = userDoc.data().tags || [];
    await updateDoc(userRef, {
      tags: currentTags.filter((id: string) => id !== tagId),
      updatedAt: Timestamp.now(),
    });
  }
};

// ========== CUSTOMER NOTES ==========
const customerNotesCollectionRef = collection(db, 'customer_notes');

export const addCustomerNote = async (note: Omit<CustomerNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newNoteRef = await addDoc(customerNotesCollectionRef, {
    ...note,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return newNoteRef.id;
};

export const getCustomerNote = async (id: string): Promise<CustomerNote | null> => {
  const noteDocRef = doc(db, 'customer_notes', id);
  const noteDoc = await getDoc(noteDocRef);
  if (noteDoc.exists()) {
    return { id: noteDoc.id, ...noteDoc.data() } as CustomerNote;
  }
  return null;
};

export const getCustomerNotes = async (userId: string, includePrivate?: boolean, createdBy?: string): Promise<CustomerNote[]> => {
  const q = query(customerNotesCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  let notes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerNote));
  
  // Filter private notes
  if (!includePrivate) {
    notes = notes.filter(note => !note.isPrivate || note.createdBy === createdBy);
  }
  
  return notes;
};

export const updateCustomerNote = async (id: string, note: Partial<Omit<CustomerNote, 'id' | 'createdAt'>>): Promise<void> => {
  const noteDocRef = doc(db, 'customer_notes', id);
  await updateDoc(noteDocRef, {
    ...note,
    updatedAt: Timestamp.now(),
  });
};

export const deleteCustomerNote = async (id: string): Promise<void> => {
  const noteDocRef = doc(db, 'customer_notes', id);
  await deleteDoc(noteDocRef);
};

// ========== CUSTOMER COMMUNICATION HISTORY ==========
const customerCommunicationsCollectionRef = collection(db, 'customer_communications');

export const addCustomerCommunication = async (communication: Omit<CustomerCommunication, 'id' | 'createdAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    userId: communication.userId,
    type: communication.type,
    message: communication.message,
    direction: communication.direction,
    status: communication.status,
    createdAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (communication.subject !== undefined && communication.subject !== null && communication.subject !== '') {
    dataToSave.subject = communication.subject;
  }
  if (communication.sentBy !== undefined && communication.sentBy !== null && communication.sentBy !== '') {
    dataToSave.sentBy = communication.sentBy;
  }
  if (communication.sentByName !== undefined && communication.sentByName !== null && communication.sentByName !== '') {
    dataToSave.sentByName = communication.sentByName;
  }
  if (communication.metadata !== undefined && communication.metadata !== null && Object.keys(communication.metadata).length > 0) {
    dataToSave.metadata = communication.metadata;
  }
  
  const newCommRef = await addDoc(customerCommunicationsCollectionRef, dataToSave);
  return newCommRef.id;
};

export const getCustomerCommunications = async (userId: string, type?: CustomerCommunication['type']): Promise<CustomerCommunication[]> => {
  const q = query(customerCommunicationsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  let communications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerCommunication));
  
  if (type) {
    communications = communications.filter(comm => comm.type === type);
  }
  
  return communications;
};

export const updateCommunicationStatus = async (id: string, status: CustomerCommunication['status']): Promise<void> => {
  const commDocRef = doc(db, 'customer_communications', id);
  await updateDoc(commDocRef, { status });
};

// ========== CUSTOMER IMPORT/EXPORT ==========
export const exportCustomersToCSV = async (): Promise<string> => {
  const users = await getAllUsers();
  const orders = await getAllOrders();
  
  // Calculate customer data
  const customerData = users
    .filter(user => user.role !== 'admin')
    .map(user => {
      const userOrders = orders.filter(o => o.userId === user.uid);
      const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const lastOrder = userOrders.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)[0];
      
      return {
        'Email': user.email || '',
        'Name': user.displayName || '',
        'Phone': user.phoneNumber || '',
        'Total Orders': userOrders.length,
        'Total Spent': totalSpent,
        'Last Order Date': lastOrder ? lastOrder.createdAt.toDate().toLocaleDateString() : '',
        'Created Date': user.createdAt ? user.createdAt.toDate().toLocaleDateString() : '',
        'Wallet Balance': user.walletBalance || 0,
        'Loyalty Points': user.loyaltyPoints || 0,
      };
    });

  // Convert to CSV
  const headers = Object.keys(customerData[0] || {});
  const csvRows = [
    headers.join(','),
    ...customerData.map(row => 
      headers.map(header => {
        const value = row[header as keyof typeof row];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    ),
  ];

  return csvRows.join('\n');
};

export const importCustomersFromCSV = async (csvContent: string): Promise<{ success: number; errors: string[] }> => {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const errors: string[] = [];
  let success = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue;

    try {
      const customerData: Record<string, string> = {};
      headers.forEach((header, index) => {
        customerData[header.trim()] = values[index]?.trim().replace(/^"|"$/g, '');
      });

      // In production, you would create Firebase Auth users here
      // For now, we'll just track the import
      success++;
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { success, errors };
};

