import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  getDocs,
  query,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { PageContent } from './pages';
import { Page, PageContentTranslation } from './pages';

const PAGES_COLLECTION = 'pages';

// Get page by slug with language support
export const getPageBySlug = async (slug: string): Promise<Page | null> => {
  try {
    const docRef = doc(db, PAGES_COLLECTION, slug);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure translations array exists
      return { 
        id: docSnap.id, 
        ...data,
        translations: data.translations || []
      } as Page;
    } else {
      return null;
    }
  } catch  {
    // Failed to fetch page
    return null;
  }
};

// Get page translation for specific language
export const getPageTranslation = async (slug: string, languageCode: string): Promise<PageContentTranslation | null> => {
  const page = await getPageBySlug(slug);
  if (!page) return null;
  
  const translations = page.translations || [];
  const translation = translations.find(t => t.languageCode === languageCode);
  return translation || null;
};

// Get all pages
export const getAllPages = async (): Promise<Page[]> => {
  try {
    const q = query(collection(db, PAGES_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Page));
  } catch {
    // Failed to fetch pages
    return [];
  }
};

// Create or update page
export const createOrUpdatePage = async (page: Omit<Page, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const docRef = doc(db, PAGES_COLLECTION, page.slug);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update existing page
      await setDoc(docRef, {
        ...page,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      // Create new page
      await setDoc(docRef, {
        ...page,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    // Failed to save page
    throw error;
  }
};

// Update page translation
export const updatePageTranslation = async (
  slug: string, 
  languageCode: string, 
  translation: Omit<PageContentTranslation, 'updatedAt'>
): Promise<void> => {
  try {
    let page = await getPageBySlug(slug);
    
    // If page doesn't exist, create it
    if (!page) {
      page = {
        slug,
        isActive: true,
        translations: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      } as Page;
    }

    const translations = page.translations || [];
    const existingIndex = translations.findIndex(t => t.languageCode === languageCode);
    const updatedTranslation: PageContentTranslation = {
      ...translation,
      languageCode,
      updatedAt: Timestamp.now()
    };

    let updatedTranslations: PageContentTranslation[];
    if (existingIndex >= 0) {
      // Update existing translation
      updatedTranslations = [...translations];
      updatedTranslations[existingIndex] = updatedTranslation;
    } else {
      // Add new translation
      updatedTranslations = [...translations, updatedTranslation];
    }

    await createOrUpdatePage({
      ...page,
      translations: updatedTranslations
    });
  } catch (error) {
    // Failed to update page translation
    throw error;
  }
};

// Delete page translation
export const deletePageTranslation = async (slug: string, languageCode: string): Promise<void> => {
  try {
    const page = await getPageBySlug(slug);
    if (!page) {
      throw new Error(`Page with slug ${slug} not found`);
    }

    const translations = page.translations || [];
    const updatedTranslations = translations.filter(t => t.languageCode !== languageCode);
    
    await createOrUpdatePage({
      ...page,
      translations: updatedTranslations
    });
  } catch (error) {
    // Failed to delete page translation
    throw error;
  }
};

// Legacy function for backward compatibility
export const updatePage = async (slug: string, data: Partial<PageContent>) => {
  try {
    const page = await getPageBySlug(slug);
    const defaultLanguageCode = 'en'; // Default to English
    
    if (page) {
      // Update existing page
      const translations = page.translations || [];
      const existingTranslation = translations.find(t => t.languageCode === defaultLanguageCode);
      const translation: PageContentTranslation = {
        languageCode: defaultLanguageCode,
        title: data.title || existingTranslation?.title || '',
        content: data.content || existingTranslation?.content || '',
        metaTitle: data.metaTitle || existingTranslation?.metaTitle,
        metaDescription: data.metaDescription || existingTranslation?.metaDescription,
        updatedAt: Timestamp.now()
      };

      const updatedTranslations = existingTranslation
        ? translations.map(t => t.languageCode === defaultLanguageCode ? translation : t)
        : [...translations, translation];

      await createOrUpdatePage({
        ...page,
        isActive: data.isActive !== undefined ? data.isActive : page.isActive,
        translations: updatedTranslations
      });
    } else {
      // Create new page with default translation
      await createOrUpdatePage({
        slug,
        isActive: data.isActive !== undefined ? data.isActive : true,
        translations: [{
          languageCode: defaultLanguageCode,
          title: data.title || '',
          content: data.content || '',
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          updatedAt: Timestamp.now()
        }]
      });
    }
  } catch (error) {
    // Failed to update page
    throw error;
  }
};

