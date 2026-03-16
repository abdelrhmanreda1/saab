import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { GiftCard, GiftCardTemplate } from './gift_cards';

// ========== GIFT CARDS ==========
const giftCardsCollection = collection(db, 'gift_cards');

// Generate unique gift card code
const generateGiftCardCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createGiftCard = async (giftCard: Omit<GiftCard, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'isRedeemed' | 'usageHistory'>): Promise<string> => {
  // Generate unique code
  let code = generateGiftCardCode();
  let codeExists = true;
  while (codeExists) {
    const existing = await getGiftCardByCode(code);
    if (!existing) {
      codeExists = false;
    } else {
      code = generateGiftCardCode();
    }
  }

  // Filter out undefined values - Firestore doesn't accept undefined
  const cleanedGiftCard: Record<string, unknown> = {
    code,
    amount: giftCard.amount,
    balance: giftCard.amount,
    currency: giftCard.currency,
    issuedBy: giftCard.issuedBy,
    validFrom: giftCard.validFrom,
    validUntil: giftCard.validUntil,
    isActive: giftCard.isActive,
    isRedeemed: false,
    usageHistory: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Only add optional fields if they have values
  if (giftCard.issuedTo !== undefined && giftCard.issuedTo !== null && giftCard.issuedTo !== '') {
    cleanedGiftCard.issuedTo = giftCard.issuedTo;
  }
  if (giftCard.issuedToEmail !== undefined && giftCard.issuedToEmail !== null && giftCard.issuedToEmail !== '') {
    cleanedGiftCard.issuedToEmail = giftCard.issuedToEmail;
  }

  const docRef = await addDoc(giftCardsCollection, cleanedGiftCard);
  return docRef.id;
};

export const getGiftCard = async (id: string): Promise<GiftCard | null> => {
  const docRef = doc(db, 'gift_cards', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as GiftCard;
  }
  return null;
};

export const getGiftCardByCode = async (code: string): Promise<GiftCard | null> => {
  const q = query(giftCardsCollection, where('code', '==', code));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as GiftCard;
  }
  return null;
};

export const getAllGiftCards = async (): Promise<GiftCard[]> => {
  const q = query(giftCardsCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftCard));
};

export const getUserGiftCards = async (userId: string): Promise<GiftCard[]> => {
  const q = query(giftCardsCollection, where('issuedTo', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftCard));
};

export const updateGiftCard = async (id: string, updates: Partial<Omit<GiftCard, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'gift_cards', id);
  
  // Filter out undefined values - Firestore doesn't accept undefined
  const cleanedUpdates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  // Only add fields that are explicitly provided (not undefined)
  if (updates.amount !== undefined) {
    cleanedUpdates.amount = updates.amount;
  }
  if (updates.balance !== undefined) {
    cleanedUpdates.balance = updates.balance;
  }
  if (updates.currency !== undefined) {
    cleanedUpdates.currency = updates.currency;
  }
  if (updates.issuedTo !== undefined) {
    cleanedUpdates.issuedTo = updates.issuedTo || null;
  }
  if (updates.issuedToEmail !== undefined) {
    cleanedUpdates.issuedToEmail = updates.issuedToEmail || null;
  }
  if (updates.issuedBy !== undefined) {
    cleanedUpdates.issuedBy = updates.issuedBy;
  }
  if (updates.validFrom !== undefined) {
    cleanedUpdates.validFrom = updates.validFrom;
  }
  if (updates.validUntil !== undefined) {
    cleanedUpdates.validUntil = updates.validUntil;
  }
  if (updates.isActive !== undefined) {
    cleanedUpdates.isActive = updates.isActive;
  }
  if (updates.isRedeemed !== undefined) {
    cleanedUpdates.isRedeemed = updates.isRedeemed;
  }
  if (updates.redeemedAt !== undefined) {
    cleanedUpdates.redeemedAt = updates.redeemedAt || null;
  }
  if (updates.redeemedBy !== undefined) {
    cleanedUpdates.redeemedBy = updates.redeemedBy || null;
  }
  if (updates.redeemedOrderId !== undefined) {
    cleanedUpdates.redeemedOrderId = updates.redeemedOrderId || null;
  }
  if (updates.usageHistory !== undefined) {
    cleanedUpdates.usageHistory = updates.usageHistory;
  }

  await updateDoc(docRef, cleanedUpdates);
};

export const redeemGiftCard = async (code: string, orderId: string, userId: string, amount: number): Promise<GiftCard | null> => {
  const giftCard = await getGiftCardByCode(code);
  if (!giftCard || !giftCard.isActive || giftCard.isRedeemed || giftCard.balance < amount) {
    return null;
  }

  const now = Timestamp.now();
  if (giftCard.validFrom > now || giftCard.validUntil < now) {
    return null;
  }

  const newBalance = giftCard.balance - amount;
  const usageEntry = {
    orderId,
    amount,
    usedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, 'gift_cards', giftCard.id!), {
    balance: newBalance,
    isRedeemed: newBalance === 0,
    redeemedAt: newBalance === 0 ? Timestamp.now() : giftCard.redeemedAt,
    redeemedBy: userId,
    redeemedOrderId: orderId,
    usageHistory: [...(giftCard.usageHistory || []), usageEntry],
    updatedAt: Timestamp.now(),
  });

  return { ...giftCard, balance: newBalance, isRedeemed: newBalance === 0, usageHistory: [...(giftCard.usageHistory || []), usageEntry] };
};

// ========== GIFT CARD TEMPLATES ==========
const giftCardTemplatesCollection = collection(db, 'gift_card_templates');

export const createGiftCardTemplate = async (template: Omit<GiftCardTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTemplate: Omit<GiftCardTemplate, 'id'> = {
    ...template,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(giftCardTemplatesCollection, newTemplate);
  return docRef.id;
};

export const getGiftCardTemplate = async (id: string): Promise<GiftCardTemplate | null> => {
  const docRef = doc(db, 'gift_card_templates', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as GiftCardTemplate;
  }
  return null;
};

export const getAllGiftCardTemplates = async (): Promise<GiftCardTemplate[]> => {
  const q = query(giftCardTemplatesCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftCardTemplate));
};

export const updateGiftCardTemplate = async (id: string, updates: Partial<Omit<GiftCardTemplate, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'gift_card_templates', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

export const deleteGiftCardTemplate = async (id: string): Promise<void> => {
  const docRef = doc(db, 'gift_card_templates', id);
  await deleteDoc(docRef);
};

