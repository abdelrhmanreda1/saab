import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { Translation } from './translations';

const translationsCollection = collection(db, 'translations');

// Create a translation
export const createTranslation = async (translation: Omit<Translation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTranslation: Omit<Translation, 'id'> = {
    ...translation,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(translationsCollection, newTranslation);
  return docRef.id;
};

// Get all translations for a language
export const getTranslationsByLanguage = async (languageCode: string, namespace?: string): Promise<Record<string, string>> => {
  const normalize = (code: string) => String(code || '').trim();
  const requested = normalize(languageCode);
  const alternates = Array.from(
    new Set([requested, requested.toLowerCase(), requested.toUpperCase()].filter(Boolean))
  );

  const tryFetch = async (code: string) => {
    const q = namespace
      ? query(
          translationsCollection,
          where('languageCode', '==', code),
          where('namespace', '==', namespace)
        )
      : query(translationsCollection, where('languageCode', '==', code));
    return await getDocs(q);
  };

  let querySnapshot = await tryFetch(alternates[0]);
  if (querySnapshot.empty && alternates.length > 1) {
    for (const alt of alternates.slice(1)) {
      const snap = await tryFetch(alt);
      if (!snap.empty) {
        querySnapshot = snap;
        break;
      }
    }
  }

  const translations: Record<string, string> = {};
  querySnapshot.forEach((doc) => {
    const data = doc.data() as Translation;
    translations[data.key] = data.value;
  });

  return translations;
};

// Get translation by key and language
export const getTranslation = async (key: string, languageCode: string): Promise<string | null> => {
  const q = query(
    translationsCollection,
    where('key', '==', key),
    where('languageCode', '==', languageCode)
  );
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data().value as string;
  }
  return null;
};

// Update translation
export const updateTranslation = async (id: string, updates: Partial<Omit<Translation, 'id' | 'createdAt'>>): Promise<void> => {
  const translationRef = doc(translationsCollection, id);
  await updateDoc(translationRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Delete translation
export const deleteTranslation = async (id: string): Promise<void> => {
  const translationRef = doc(translationsCollection, id);
  await deleteDoc(translationRef);
};

// Get all translations (for admin)
export const getAllTranslations = async (languageCode?: string): Promise<Translation[]> => {
  let q;
  if (languageCode) {
    q = query(translationsCollection, where('languageCode', '==', languageCode));
  } else {
    q = query(translationsCollection);
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Translation));
};

// Bulk create translations
export const bulkCreateTranslations = async (translations: Omit<Translation, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> => {
  const now = Timestamp.now();
  const ids: string[] = [];
  
  for (const translation of translations) {
    const newTranslation: Omit<Translation, 'id'> = {
      ...translation,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(translationsCollection, newTranslation);
    ids.push(docRef.id);
  }
  
  return ids;
};

