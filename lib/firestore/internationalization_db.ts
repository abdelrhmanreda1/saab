import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Language, Currency, CurrencyConversion, TaxRate, LocalPaymentMethod } from './internationalization';

// ========== LANGUAGES ==========
const languagesCollection = collection(db, 'languages');

export const createLanguage = async (language: Omit<Language, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newLanguage: Omit<Language, 'id'> = {
    ...language,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(languagesCollection, newLanguage);
  return docRef.id;
};

export const getAllLanguages = async (activeOnly?: boolean): Promise<Language[]> => {
  let q;
  if (activeOnly) {
    q = query(languagesCollection, where('isActive', '==', true), orderBy('name', 'asc'));
  } else {
    q = query(languagesCollection, orderBy('name', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Language));
};

export const getLanguage = async (id: string): Promise<Language | null> => {
  const docRef = doc(db, 'languages', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Language;
  }
  return null;
};

export const getLanguageByCode = async (code: string): Promise<Language | null> => {
  const q = query(languagesCollection, where('code', '==', code), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Language;
  }
  return null;
};

export const updateLanguage = async (id: string, updates: Partial<Omit<Language, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'languages', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

export const deleteLanguage = async (id: string): Promise<void> => {
  const docRef = doc(db, 'languages', id);
  await deleteDoc(docRef);
};

// ========== CURRENCIES ==========
const currenciesCollection = collection(db, 'currencies');

export const createCurrency = async (currency: Omit<Currency, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newCurrency: Omit<Currency, 'id'> = {
    ...currency,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(currenciesCollection, newCurrency);
  return docRef.id;
};

export const getAllCurrencies = async (activeOnly?: boolean): Promise<Currency[]> => {
  let q;
  if (activeOnly) {
    q = query(currenciesCollection, where('isActive', '==', true), orderBy('code', 'asc'));
  } else {
    q = query(currenciesCollection, orderBy('code', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Currency));
};

export const getCurrency = async (id: string): Promise<Currency | null> => {
  const docRef = doc(db, 'currencies', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Currency;
  }
  return null;
};

export const getCurrencyByCode = async (code: string): Promise<Currency | null> => {
  const q = query(currenciesCollection, where('code', '==', code), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Currency;
  }
  return null;
};

export const getDefaultCurrency = async (): Promise<Currency | null> => {
  const q = query(currenciesCollection, where('isDefault', '==', true), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Currency;
  }
  return null;
};

// Deprecated: Use getDefaultCurrency instead
export const getBaseCurrency = async (): Promise<Currency | null> => {
  return getDefaultCurrency();
};

export const updateCurrency = async (id: string, updates: Partial<Omit<Currency, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'currencies', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

export const deleteCurrency = async (id: string): Promise<void> => {
  const docRef = doc(db, 'currencies', id);
  await deleteDoc(docRef);
};

// ========== CURRENCY CONVERSIONS ==========
const currencyConversionsCollection = collection(db, 'currency_conversions');

export const createOrUpdateCurrencyConversion = async (conversion: Omit<CurrencyConversion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Check if conversion already exists
  const q = query(
    currencyConversionsCollection,
    where('fromCurrency', '==', conversion.fromCurrency),
    where('toCurrency', '==', conversion.toCurrency),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const docRef = doc(db, 'currency_conversions', querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      ...conversion,
      lastUpdated: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return querySnapshot.docs[0].id;
  } else {
    const newConversion: Omit<CurrencyConversion, 'id'> = {
      ...conversion,
      lastUpdated: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(currencyConversionsCollection, newConversion);
    return docRef.id;
  }
};

export const getCurrencyConversion = async (fromCurrency: string, toCurrency: string): Promise<CurrencyConversion | null> => {
  const q = query(
    currencyConversionsCollection,
    where('fromCurrency', '==', fromCurrency),
    where('toCurrency', '==', toCurrency),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as CurrencyConversion;
  }
  return null;
};

export const getAllCurrencyConversions = async (): Promise<CurrencyConversion[]> => {
  const querySnapshot = await getDocs(currencyConversionsCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurrencyConversion));
};

// ========== TAX RATES ==========
const taxRatesCollection = collection(db, 'tax_rates');

export const createTaxRate = async (taxRate: Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTaxRate: Omit<TaxRate, 'id'> = {
    ...taxRate,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(taxRatesCollection, newTaxRate);
  return docRef.id;
};

export const getAllTaxRates = async (activeOnly?: boolean, region?: string): Promise<TaxRate[]> => {
  let q;
  if (region && activeOnly) {
    q = query(
      taxRatesCollection,
      where('region', '==', region),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
  } else if (region) {
    q = query(taxRatesCollection, where('region', '==', region), orderBy('name', 'asc'));
  } else if (activeOnly) {
    q = query(taxRatesCollection, where('isActive', '==', true), orderBy('name', 'asc'));
  } else {
    q = query(taxRatesCollection, orderBy('name', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaxRate));
};

export const getTaxRate = async (id: string): Promise<TaxRate | null> => {
  const docRef = doc(db, 'tax_rates', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as TaxRate;
  }
  return null;
};

export const updateTaxRate = async (id: string, updates: Partial<Omit<TaxRate, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'tax_rates', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

export const deleteTaxRate = async (id: string): Promise<void> => {
  const docRef = doc(db, 'tax_rates', id);
  await deleteDoc(docRef);
};

// ========== LOCAL PAYMENT METHODS ==========
const localPaymentMethodsCollection = collection(db, 'local_payment_methods');

export const createLocalPaymentMethod = async (method: Omit<LocalPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    console.log('createLocalPaymentMethod called with:', method);
    const newMethod: Omit<LocalPaymentMethod, 'id'> = {
      ...method,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    console.log('New method object with timestamps:', newMethod);
    console.log('Adding document to collection: local_payment_methods');
    const docRef = await addDoc(localPaymentMethodsCollection, newMethod);
    console.log('Document added successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('createLocalPaymentMethod error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as { code?: string })?.code,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
};

export const getAllLocalPaymentMethods = async (activeOnly?: boolean, region?: string): Promise<LocalPaymentMethod[]> => {
  let q;
  if (region && activeOnly) {
    q = query(
      localPaymentMethodsCollection,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
  } else if (activeOnly) {
    q = query(localPaymentMethodsCollection, where('isActive', '==', true), orderBy('name', 'asc'));
  } else {
    q = query(localPaymentMethodsCollection, orderBy('name', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  let methods = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LocalPaymentMethod));
  
  // Filter by region if specified
  if (region) {
    methods = methods.filter(m => !m.supportedRegions || m.supportedRegions.length === 0 || m.supportedRegions.includes(region));
  }
  
  return methods;
};

export const getLocalPaymentMethod = async (id: string): Promise<LocalPaymentMethod | null> => {
  const docRef = doc(db, 'local_payment_methods', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as LocalPaymentMethod;
  }
  return null;
};

export const updateLocalPaymentMethod = async (id: string, updates: Partial<Omit<LocalPaymentMethod, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    console.log('updateLocalPaymentMethod called with:', { id, updates });
    const docRef = doc(db, 'local_payment_methods', id);
    console.log('Document reference created, updating...');
    const updateData = { ...updates, updatedAt: Timestamp.now() };
    console.log('Update data:', updateData);
    await updateDoc(docRef, updateData);
    console.log('Document updated successfully');
  } catch (error) {
    console.error('updateLocalPaymentMethod error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as { code?: string })?.code,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
};

export const deleteLocalPaymentMethod = async (id: string): Promise<void> => {
  const docRef = doc(db, 'local_payment_methods', id);
  await deleteDoc(docRef);
};

