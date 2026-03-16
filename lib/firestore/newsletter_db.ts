import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, updateDoc } from 'firebase/firestore';

export interface NewsletterSubscription {
  id?: string;
  email: string;
  status: 'active' | 'unsubscribed';
  subscribedAt: Timestamp;
  unsubscribedAt?: Timestamp;
  source?: string; // 'footer', 'popup', 'checkout', etc.
}

const newsletterCollectionRef = collection(db, 'newsletter_subscriptions');

export const addNewsletterSubscription = async (subscription: Omit<NewsletterSubscription, 'id' | 'subscribedAt' | 'status'>): Promise<string> => {
  // Check if email already exists
  const existingQuery = query(newsletterCollectionRef, where('email', '==', subscription.email));
  const existingDocs = await getDocs(existingQuery);
  
  if (!existingDocs.empty) {
    // Update existing subscription to active
    const existingDoc = existingDocs.docs[0];
    await updateDoc(doc(db, 'newsletter_subscriptions', existingDoc.id), {
      status: 'active',
      subscribedAt: Timestamp.now(),
      unsubscribedAt: null,
      source: subscription.source,
    });
    return existingDoc.id;
  }
  
  const newSubscriptionRef = await addDoc(newsletterCollectionRef, {
    ...subscription,
    status: 'active',
    subscribedAt: Timestamp.now(),
  });
  return newSubscriptionRef.id;
};

export const getAllNewsletterSubscriptions = async (): Promise<NewsletterSubscription[]> => {
  const q = query(newsletterCollectionRef, orderBy('subscribedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as NewsletterSubscription[];
};

export const unsubscribeNewsletter = async (email: string): Promise<void> => {
  const q = query(newsletterCollectionRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docRef = doc(db, 'newsletter_subscriptions', querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      status: 'unsubscribed',
      unsubscribedAt: Timestamp.now(),
    });
  }
};

