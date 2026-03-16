import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';

export interface ContactSubmission {
  id?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  repliedAt?: Timestamp;
  repliedBy?: string;
  createdAt: Timestamp;
}

const contactCollectionRef = collection(db, 'contact_submissions');

export const addContactSubmission = async (submission: Omit<ContactSubmission, 'id' | 'createdAt' | 'status'>): Promise<string> => {
  const newSubmissionRef = await addDoc(contactCollectionRef, {
    ...submission,
    status: 'new',
    createdAt: Timestamp.now(),
  });
  return newSubmissionRef.id;
};

export const getAllContactSubmissions = async (): Promise<ContactSubmission[]> => {
  const q = query(contactCollectionRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ContactSubmission[];
};

export const updateContactSubmission = async (id: string, updates: Partial<ContactSubmission>): Promise<void> => {
  const docRef = doc(db, 'contact_submissions', id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

