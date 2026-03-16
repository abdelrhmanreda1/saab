import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, limit, deleteField } from 'firebase/firestore';
import { EmailCampaign, PushNotificationCampaign, AbandonedCart, FlashSale, BuyXGetYPromotion, FreeShippingRule } from './campaigns';

// ========== EMAIL CAMPAIGNS ==========
const emailCampaignsCollection = collection(db, 'email_campaigns');

export const createEmailCampaign = async (campaign: Omit<EmailCampaign, 'id' | 'createdAt' | 'updatedAt' | 'sentCount' | 'openedCount' | 'clickedCount'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    name: campaign.name,
    subject: campaign.subject,
    body: campaign.body,
    recipientType: campaign.recipientType,
    status: campaign.status,
    sentCount: 0,
    openedCount: 0,
    clickedCount: 0,
    createdBy: campaign.createdBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (campaign.segmentId !== undefined && campaign.segmentId !== null && campaign.segmentId !== '') {
    dataToSave.segmentId = campaign.segmentId;
  }
  if (campaign.recipientIds !== undefined && campaign.recipientIds !== null && Array.isArray(campaign.recipientIds) && campaign.recipientIds.length > 0) {
    dataToSave.recipientIds = campaign.recipientIds;
  }
  if (campaign.scheduledAt !== undefined && campaign.scheduledAt !== null) {
    dataToSave.scheduledAt = campaign.scheduledAt;
  }
  if (campaign.sentAt !== undefined && campaign.sentAt !== null) {
    dataToSave.sentAt = campaign.sentAt;
  }
  
  const docRef = await addDoc(emailCampaignsCollection, dataToSave);
  return docRef.id;
};

export const getEmailCampaign = async (id: string): Promise<EmailCampaign | null> => {
  const docRef = doc(db, 'email_campaigns', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as EmailCampaign;
  }
  return null;
};

export const getAllEmailCampaigns = async (): Promise<EmailCampaign[]> => {
  const q = query(emailCampaignsCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailCampaign));
};

export const updateEmailCampaign = async (id: string, updates: Partial<Omit<EmailCampaign, 'id' | 'createdAt'>>): Promise<void> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  // Only add fields that are defined
  if (updates.name !== undefined) dataToSave.name = updates.name;
  if (updates.subject !== undefined) dataToSave.subject = updates.subject;
  if (updates.body !== undefined) dataToSave.body = updates.body;
  if (updates.recipientType !== undefined) dataToSave.recipientType = updates.recipientType;
  if (updates.status !== undefined) dataToSave.status = updates.status;
  if (updates.sentCount !== undefined) dataToSave.sentCount = updates.sentCount;
  if (updates.openedCount !== undefined) dataToSave.openedCount = updates.openedCount;
  if (updates.clickedCount !== undefined) dataToSave.clickedCount = updates.clickedCount;
  if (updates.createdBy !== undefined) dataToSave.createdBy = updates.createdBy;
  
  // Optional fields - only add if they have values
  if (updates.segmentId !== undefined && updates.segmentId !== null && updates.segmentId !== '') {
    dataToSave.segmentId = updates.segmentId;
  } else if (updates.segmentId === null || updates.segmentId === '') {
    // Explicitly remove if set to null/empty
    dataToSave.segmentId = null;
  }
  
  if (updates.recipientIds !== undefined && updates.recipientIds !== null && Array.isArray(updates.recipientIds) && updates.recipientIds.length > 0) {
    dataToSave.recipientIds = updates.recipientIds;
  } else if (updates.recipientIds === null || (Array.isArray(updates.recipientIds) && updates.recipientIds.length === 0)) {
    // Explicitly remove if set to null/empty
    dataToSave.recipientIds = null;
  }
  
  if (updates.scheduledAt !== undefined && updates.scheduledAt !== null) {
    dataToSave.scheduledAt = updates.scheduledAt;
  } else if (updates.scheduledAt === null) {
    dataToSave.scheduledAt = null;
  }
  
  if (updates.sentAt !== undefined && updates.sentAt !== null) {
    dataToSave.sentAt = updates.sentAt;
  } else if (updates.sentAt === null) {
    dataToSave.sentAt = null;
  }
  
  const docRef = doc(db, 'email_campaigns', id);
  await updateDoc(docRef, dataToSave);
};

export const deleteEmailCampaign = async (id: string): Promise<void> => {
  const docRef = doc(db, 'email_campaigns', id);
  await deleteDoc(docRef);
};

// ========== PUSH NOTIFICATION CAMPAIGNS ==========
const pushCampaignsCollection = collection(db, 'push_notification_campaigns');

export const createPushCampaign = async (campaign: Omit<PushNotificationCampaign, 'id' | 'createdAt' | 'updatedAt' | 'sentCount' | 'openedCount' | 'clickedCount'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    name: campaign.name,
    title: campaign.title,
    body: campaign.body,
    recipientType: campaign.recipientType,
    status: campaign.status,
    sentCount: 0,
    openedCount: 0,
    clickedCount: 0,
    createdBy: campaign.createdBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (campaign.imageUrl !== undefined && campaign.imageUrl !== null && campaign.imageUrl !== '') {
    dataToSave.imageUrl = campaign.imageUrl;
  }
  if (campaign.linkUrl !== undefined && campaign.linkUrl !== null && campaign.linkUrl !== '') {
    dataToSave.linkUrl = campaign.linkUrl;
  }
  if (campaign.segmentId !== undefined && campaign.segmentId !== null && campaign.segmentId !== '') {
    dataToSave.segmentId = campaign.segmentId;
  }
  if (campaign.recipientIds !== undefined && campaign.recipientIds !== null && Array.isArray(campaign.recipientIds) && campaign.recipientIds.length > 0) {
    dataToSave.recipientIds = campaign.recipientIds;
  }
  if (campaign.scheduledAt !== undefined && campaign.scheduledAt !== null) {
    dataToSave.scheduledAt = campaign.scheduledAt;
  }
  if (campaign.sentAt !== undefined && campaign.sentAt !== null) {
    dataToSave.sentAt = campaign.sentAt;
  }
  
  const docRef = await addDoc(pushCampaignsCollection, dataToSave);
  return docRef.id;
};

export const getPushCampaign = async (id: string): Promise<PushNotificationCampaign | null> => {
  const docRef = doc(db, 'push_notification_campaigns', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as PushNotificationCampaign;
  }
  return null;
};

export const getAllPushCampaigns = async (): Promise<PushNotificationCampaign[]> => {
  const q = query(pushCampaignsCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PushNotificationCampaign));
};

export const updatePushCampaign = async (id: string, updates: Partial<Omit<PushNotificationCampaign, 'id' | 'createdAt'>>): Promise<void> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  // Only add fields that are defined
  if (updates.name !== undefined) dataToSave.name = updates.name;
  if (updates.title !== undefined) dataToSave.title = updates.title;
  if (updates.body !== undefined) dataToSave.body = updates.body;
  if (updates.recipientType !== undefined) dataToSave.recipientType = updates.recipientType;
  if (updates.status !== undefined) dataToSave.status = updates.status;
  if (updates.sentCount !== undefined) dataToSave.sentCount = updates.sentCount;
  if (updates.openedCount !== undefined) dataToSave.openedCount = updates.openedCount;
  if (updates.clickedCount !== undefined) dataToSave.clickedCount = updates.clickedCount;
  if (updates.createdBy !== undefined) dataToSave.createdBy = updates.createdBy;
  
  // Optional fields - only add if they have values
  if (updates.imageUrl !== undefined && updates.imageUrl !== null && updates.imageUrl !== '') {
    dataToSave.imageUrl = updates.imageUrl;
  } else if (updates.imageUrl === null || updates.imageUrl === '') {
    dataToSave.imageUrl = null;
  }
  
  if (updates.linkUrl !== undefined && updates.linkUrl !== null && updates.linkUrl !== '') {
    dataToSave.linkUrl = updates.linkUrl;
  } else if (updates.linkUrl === null || updates.linkUrl === '') {
    dataToSave.linkUrl = null;
  }
  
  if (updates.segmentId !== undefined && updates.segmentId !== null && updates.segmentId !== '') {
    dataToSave.segmentId = updates.segmentId;
  } else if (updates.segmentId === null || updates.segmentId === '') {
    dataToSave.segmentId = null;
  }
  
  if (updates.recipientIds !== undefined && updates.recipientIds !== null && Array.isArray(updates.recipientIds) && updates.recipientIds.length > 0) {
    dataToSave.recipientIds = updates.recipientIds;
  } else if (updates.recipientIds === null || (Array.isArray(updates.recipientIds) && updates.recipientIds.length === 0)) {
    dataToSave.recipientIds = null;
  }
  
  if (updates.scheduledAt !== undefined && updates.scheduledAt !== null) {
    dataToSave.scheduledAt = updates.scheduledAt;
  } else if (updates.scheduledAt === null) {
    dataToSave.scheduledAt = null;
  }
  
  if (updates.sentAt !== undefined && updates.sentAt !== null) {
    dataToSave.sentAt = updates.sentAt;
  } else if (updates.sentAt === null) {
    dataToSave.sentAt = null;
  }
  
  const docRef = doc(db, 'push_notification_campaigns', id);
  await updateDoc(docRef, dataToSave);
};

export const deletePushCampaign = async (id: string): Promise<void> => {
  const docRef = doc(db, 'push_notification_campaigns', id);
  await deleteDoc(docRef);
};

// ========== ABANDONED CARTS ==========
const abandonedCartsCollection = collection(db, 'abandoned_carts');

export const createAbandonedCart = async (cart: Omit<AbandonedCart, 'id' | 'createdAt' | 'recoveryEmailsSent' | 'recovered'>): Promise<string> => {
  const newCart: Omit<AbandonedCart, 'id'> = {
    ...cart,
    recoveryEmailsSent: 0,
    recovered: false,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(abandonedCartsCollection, newCart);
  return docRef.id;
};

export const getAbandonedCart = async (id: string): Promise<AbandonedCart | null> => {
  const docRef = doc(db, 'abandoned_carts', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as AbandonedCart;
  }
  return null;
};

export const getAbandonedCartByUserId = async (userId: string): Promise<AbandonedCart | null> => {
  const q = query(abandonedCartsCollection, where('userId', '==', userId), where('recovered', '==', false), orderBy('lastUpdated', 'desc'), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as AbandonedCart;
  }
  return null;
};

export const getAllAbandonedCarts = async (recoveredOnly?: boolean): Promise<AbandonedCart[]> => {
  let q;
  if (recoveredOnly !== undefined) {
    q = query(abandonedCartsCollection, where('recovered', '==', recoveredOnly), orderBy('lastUpdated', 'desc'));
  } else {
    q = query(abandonedCartsCollection, orderBy('lastUpdated', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbandonedCart));
};

export const updateAbandonedCart = async (id: string, updates: Partial<Omit<AbandonedCart, 'id'>>): Promise<void> => {
  const docRef = doc(db, 'abandoned_carts', id);
  await updateDoc(docRef, updates);
};

export const markAbandonedCartRecovered = async (id: string): Promise<void> => {
  const docRef = doc(db, 'abandoned_carts', id);
  await updateDoc(docRef, {
    recovered: true,
    recoveredAt: Timestamp.now(),
  });
};

// ========== FLASH SALES ==========
const flashSalesCollection = collection(db, 'flash_sales');

export const createFlashSale = async (sale: Omit<FlashSale, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    name: sale.name,
    productIds: sale.productIds,
    discountType: sale.discountType,
    discountValue: sale.discountValue,
    startTime: sale.startTime,
    endTime: sale.endTime,
    isActive: sale.isActive,
    createdBy: sale.createdBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (sale.description !== undefined && sale.description !== null && sale.description !== '') {
    dataToSave.description = sale.description;
  }
  if (sale.maxQuantity !== undefined && sale.maxQuantity !== null) {
    dataToSave.maxQuantity = sale.maxQuantity;
  }
  
  const docRef = await addDoc(flashSalesCollection, dataToSave);
  return docRef.id;
};

export const getFlashSale = async (id: string): Promise<FlashSale | null> => {
  const docRef = doc(db, 'flash_sales', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as FlashSale;
  }
  return null;
};

export const getAllFlashSales = async (activeOnly?: boolean): Promise<FlashSale[]> => {
  let q;
  if (activeOnly) {
    q = query(flashSalesCollection, where('isActive', '==', true), orderBy('startTime', 'desc'));
  } else {
    q = query(flashSalesCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashSale));
};

export const updateFlashSale = async (id: string, updates: Partial<Omit<FlashSale, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'flash_sales', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

export const deleteFlashSale = async (id: string): Promise<void> => {
  const docRef = doc(db, 'flash_sales', id);
  await deleteDoc(docRef);
};

// ========== BUY X GET Y PROMOTIONS ==========
const buyXGetYCollection = collection(db, 'buy_x_get_y_promotions');

export const createBuyXGetY = async (promo: Omit<BuyXGetYPromotion, 'id' | 'createdAt' | 'updatedAt' | 'usedCount'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    name: promo.name,
    buyProductIds: promo.buyProductIds,
    buyQuantity: promo.buyQuantity,
    getProductIds: promo.getProductIds,
    getQuantity: promo.getQuantity,
    getDiscountType: promo.getDiscountType,
    validFrom: promo.validFrom,
    validUntil: promo.validUntil,
    isActive: promo.isActive,
    createdBy: promo.createdBy,
    usedCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (promo.description !== undefined && promo.description !== null && promo.description !== '') {
    dataToSave.description = promo.description;
  }
  if (promo.getDiscountValue !== undefined && promo.getDiscountValue !== null) {
    dataToSave.getDiscountValue = promo.getDiscountValue;
  }
  if (promo.usageLimit !== undefined && promo.usageLimit !== null) {
    dataToSave.usageLimit = promo.usageLimit;
  }
  
  const docRef = await addDoc(buyXGetYCollection, dataToSave);
  return docRef.id;
};

export const getBuyXGetY = async (id: string): Promise<BuyXGetYPromotion | null> => {
  const docRef = doc(db, 'buy_x_get_y_promotions', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as BuyXGetYPromotion;
  }
  return null;
};

export const getAllBuyXGetY = async (activeOnly?: boolean): Promise<BuyXGetYPromotion[]> => {
  try {
    let q;
    if (activeOnly) {
      q = query(buyXGetYCollection, where('isActive', '==', true), orderBy('createdAt', 'desc'));
    } else {
      q = query(buyXGetYCollection, orderBy('createdAt', 'desc'));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuyXGetYPromotion));
  } catch {
    // If query fails (e.g., missing index), try fetching all without orderBy
    try {
      const querySnapshot = await getDocs(buyXGetYCollection);
      const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuyXGetYPromotion));
      // Sort manually by createdAt
      results.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bDate - aDate;
      });
      return results;
    } catch {
      return [];
    }
  }
};

export const updateBuyXGetY = async (id: string, updates: Partial<Omit<BuyXGetYPromotion, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'buy_x_get_y_promotions', id);
  
  // Prepare data object, removing undefined values
  const dataToUpdate: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  // Only add fields that are not undefined
  if (updates.name !== undefined) dataToUpdate.name = updates.name;
  if (updates.description !== undefined) {
    if (updates.description !== null && updates.description !== '') {
      dataToUpdate.description = updates.description;
    } else {
      dataToUpdate.description = deleteField(); // Remove field if empty/null
    }
  }
  if (updates.buyProductIds !== undefined) dataToUpdate.buyProductIds = updates.buyProductIds;
  if (updates.buyQuantity !== undefined) dataToUpdate.buyQuantity = updates.buyQuantity;
  if (updates.getProductIds !== undefined) dataToUpdate.getProductIds = updates.getProductIds;
  if (updates.getQuantity !== undefined) dataToUpdate.getQuantity = updates.getQuantity;
  if (updates.getDiscountType !== undefined) dataToUpdate.getDiscountType = updates.getDiscountType;
  // Handle getDiscountValue - only include if not undefined and not null
  if (updates.getDiscountValue !== undefined) {
    if (updates.getDiscountValue !== null && updates.getDiscountType !== 'free') {
      dataToUpdate.getDiscountValue = updates.getDiscountValue;
    } else {
      // If discount type is free or value is null, delete the field
      dataToUpdate.getDiscountValue = deleteField();
    }
  } else if (updates.getDiscountType === 'free') {
    // If only discount type changed to free, delete the discount value field
    dataToUpdate.getDiscountValue = deleteField();
  }
  if (updates.validFrom !== undefined) dataToUpdate.validFrom = updates.validFrom;
  if (updates.validUntil !== undefined) dataToUpdate.validUntil = updates.validUntil;
  if (updates.usageLimit !== undefined) {
    if (updates.usageLimit !== null) {
      dataToUpdate.usageLimit = updates.usageLimit;
    } else {
      dataToUpdate.usageLimit = deleteField(); // Remove field if null
    }
  }
  if (updates.isActive !== undefined) dataToUpdate.isActive = updates.isActive;
  
  await updateDoc(docRef, dataToUpdate);
};

export const deleteBuyXGetY = async (id: string): Promise<void> => {
  const docRef = doc(db, 'buy_x_get_y_promotions', id);
  await deleteDoc(docRef);
};

// ========== FREE SHIPPING RULES ==========
const freeShippingRulesCollection = collection(db, 'free_shipping_rules');

export const createFreeShippingRule = async (rule: Omit<FreeShippingRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Filter out undefined, null, and empty string values for optional fields
  const cleanedRule: Record<string, unknown> = {
    name: rule.name,
    threshold: rule.threshold,
    isActive: rule.isActive,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Only add optional fields if they have valid values
  if (rule.description !== undefined && rule.description !== null && rule.description !== '') {
    cleanedRule.description = rule.description;
  }
  if (rule.zoneIds !== undefined && rule.zoneIds !== null && Array.isArray(rule.zoneIds) && rule.zoneIds.length > 0) {
    cleanedRule.zoneIds = rule.zoneIds;
  }
  if (rule.validFrom !== undefined && rule.validFrom !== null) {
    cleanedRule.validFrom = rule.validFrom;
  }
  if (rule.validUntil !== undefined && rule.validUntil !== null) {
    cleanedRule.validUntil = rule.validUntil;
  }
  if (rule.createdBy !== undefined && rule.createdBy !== null) {
    cleanedRule.createdBy = rule.createdBy;
  }

  const docRef = await addDoc(freeShippingRulesCollection, cleanedRule);
  return docRef.id;
};

export const getFreeShippingRule = async (id: string): Promise<FreeShippingRule | null> => {
  const docRef = doc(db, 'free_shipping_rules', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as FreeShippingRule;
  }
  return null;
};

export const getAllFreeShippingRules = async (activeOnly?: boolean): Promise<FreeShippingRule[]> => {
  let q;
  if (activeOnly) {
    q = query(freeShippingRulesCollection, where('isActive', '==', true), orderBy('threshold', 'asc'));
  } else {
    q = query(freeShippingRulesCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FreeShippingRule));
};

export const updateFreeShippingRule = async (id: string, updates: Partial<Omit<FreeShippingRule, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'free_shipping_rules', id);
  
  // Filter out undefined values - Firestore doesn't accept undefined
  const cleanedUpdates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  // Only add fields that are explicitly provided (not undefined)
  if (updates.name !== undefined) {
    cleanedUpdates.name = updates.name;
  }
  if (updates.description !== undefined) {
    // Allow empty string or null to clear the field
    cleanedUpdates.description = updates.description || null;
  }
  if (updates.threshold !== undefined) {
    cleanedUpdates.threshold = updates.threshold;
  }
  if (updates.zoneIds !== undefined) {
    // Allow empty array
    cleanedUpdates.zoneIds = updates.zoneIds;
  }
  if (updates.validFrom !== undefined) {
    cleanedUpdates.validFrom = updates.validFrom || null;
  }
  if (updates.validUntil !== undefined) {
    cleanedUpdates.validUntil = updates.validUntil || null;
  }
  if (updates.isActive !== undefined) {
    cleanedUpdates.isActive = updates.isActive;
  }
  if (updates.createdBy !== undefined) {
    cleanedUpdates.createdBy = updates.createdBy;
  }

  await updateDoc(docRef, cleanedUpdates);
};

export const deleteFreeShippingRule = async (id: string): Promise<void> => {
  const docRef = doc(db, 'free_shipping_rules', id);
  await deleteDoc(docRef);
};

